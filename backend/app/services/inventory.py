"""Blood bank stock levels and shortage alerts.

Each (bank, blood group) row has units on hand, a minimum safety threshold and an
average daily usage. Status is the worse of two views:

    critical : units <= 50% of threshold   OR  < 2 days of cover
    low      : units <  threshold          OR  < 5 days of cover
    healthy  : otherwise

When a group *worsens* (healthy→low, low→critical) staff and linked hospitals get
an in-app alert once – not on every page load. Staff can then "rally" donors:
nearby, verified, currently-eligible donors of exactly that group get a polite
walk-in request (rate-limited to once per 24h per group so nobody is spammed).
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import BloodBank, Donor, Hospital, Inventory, User, utcnow
from .blood import BLOOD_GROUPS
from .circle import donor_facts
from .eligibility import check_eligibility
from .geo import format_distance, rank_by_distance
from .notify import notify, notify_bank_staff, notify_hospital_staff

SEVERITY = {"healthy": 0, "low": 1, "critical": 2}
RALLY_RADIUS_KM = 15.0
RALLY_COOLDOWN = timedelta(hours=24)


def classify(units: int, min_threshold: int, daily_usage: float) -> tuple[str, float | None]:
    cover = round(units / daily_usage, 1) if daily_usage > 0 else None
    if units <= min_threshold * 0.5 or (cover is not None and cover < 2):
        return "critical", cover
    if units < min_threshold or (cover is not None and cover < 5):
        return "low", cover
    return "healthy", cover


def row_view(r: Inventory) -> dict:
    status, cover = classify(r.units, r.min_threshold, r.daily_usage)
    return {
        "blood_group": r.blood_group,
        "units": r.units,
        "min_threshold": r.min_threshold,
        "daily_usage": r.daily_usage,
        "days_of_cover": cover,
        "status": status,
        "fill_pct": min(100, round(100 * r.units / max(1, r.min_threshold * 2))),
        "last_rally_at": r.last_rally_at.isoformat() if r.last_rally_at else None,
    }


def bank_stock(db: Session, bank_id: int) -> list[dict]:
    rows = {r.blood_group: r for r in db.scalars(select(Inventory).where(Inventory.blood_bank_id == bank_id))}
    return [row_view(rows[g]) for g in BLOOD_GROUPS if g in rows]


def stock_alerts(db: Session, bank_id: int) -> list[dict]:
    out = []
    for v in bank_stock(db, bank_id):
        if v["status"] == "healthy":
            continue
        cover = f"{v['days_of_cover']} days of cover" if v["days_of_cover"] is not None else "no usage data"
        out.append({
            **v,
            "message": f"{v['blood_group']} is {v['status'].upper()}: {v['units']} units left ({cover}, minimum {v['min_threshold']}).",
        })
    out.sort(key=lambda a: (-SEVERITY[a["status"]], a["units"]))
    return out


def refresh_status(db: Session, row: Inventory) -> None:
    status, cover = classify(row.units, row.min_threshold, row.daily_usage)
    if SEVERITY[status] > SEVERITY.get(row.last_status, 0):
        bank = db.get(BloodBank, row.blood_bank_id)
        title = f"Stock {status.upper()}: {row.blood_group} at {bank.name}"
        body = f"{row.units} units left" + (f" · ~{cover} days of cover" if cover is not None else "") + ". Consider rallying donors."
        level = "critical" if status == "critical" else "warning"
        notify_bank_staff(db, bank.id, "stock", title, body, level, "/app/blood_bank")
        for hid in db.scalars(select(Hospital.id).where(Hospital.blood_bank_id == bank.id)):
            notify_hospital_staff(db, hid, "stock", title, body, level, "/app/hospital")
    row.last_status = status


def adjust(db: Session, row: Inventory, delta: int) -> None:
    row.units = max(0, row.units + delta)
    refresh_status(db, row)
    db.flush()


def get_row(db: Session, bank_id: int, group: str) -> Inventory:
    row = db.scalar(select(Inventory).where(Inventory.blood_bank_id == bank_id, Inventory.blood_group == group))
    if not row:
        row = Inventory(blood_bank_id=bank_id, blood_group=group, units=0)
        db.add(row)
        db.flush()
    return row


def rally(db: Session, bank: BloodBank, group: str, today: date, radius_km: float = RALLY_RADIUS_KM) -> list[dict]:
    row = get_row(db, bank.id, group)
    now = utcnow()
    if row.last_rally_at and now - row.last_rally_at < RALLY_COOLDOWN:
        raise ValueError(f"{group} donors were already contacted in the last 24 hours")
    donors = db.scalars(
        select(Donor).where(Donor.blood_group == group, Donor.verified.is_(True), Donor.available.is_(True), Donor.open_to_urgent.is_(True))
    ).all()
    eligible = [d for d in donors if check_eligibility(donor_facts(d), today, require_verified=True).eligible]
    ranked = rank_by_distance((bank.lat, bank.lng), eligible, lambda d: (d.lat, d.lng), radius_km=radius_km, limit=25)
    for r in ranked:
        d = r.item
        notify(db, d.user_id, "stock_rally", f"{bank.name} is low on {group}",
               f"You're eligible and {format_distance(r.distance_km)} away. A walk-in donation this week would help patients who depend on regular transfusions.",
               "warning", "/app/donor")
    row.last_rally_at = now
    db.flush()
    return [{"donor_id": r.item.id, "name": r.item.name, "phone": r.item.phone, "distance": format_distance(r.distance_km)} for r in ranked]
