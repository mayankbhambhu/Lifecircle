"""Urgent mode – emergency escalation.

Stage 1  circle     : every eligible member of the patient's own circle is alerted.
Stage 2+ broadcast  : verified, available, compatible, eligible donors OUTSIDE the
                      circle, ranked by distance to the blood bank, are alerted ring
                      by ring (5 → 10 → 25 → 50 km, max `broadcast_batch` per ring).
First donor to accept wins – enforced with a single conditional UPDATE so two
people tapping "Accept" at the same moment cannot both be confirmed.
Blood bank staff can approve (skip the wait and broadcast now), re-route to
another bank, or fulfil from stock at any point.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Assignment, BloodBank, Donor, Inventory, Patient, UrgentAlert, UrgentRequest, User, utcnow
from .blood import can_donate_rbc, compatible_donor_groups, is_exact_match
from .circle import busy_donor_ids, donor_facts
from .eligibility import check_eligibility, interval_days
from .geo import bounding_box, format_distance, haversine_km, next_ring, rank_by_distance
from .notify import notify, notify_bank_staff, notify_hospital_staff
from .privacy import patient_label_for_donor, short_name

OPEN = ("circle", "broadcast")


def _distance(bank: BloodBank, d: Donor) -> float:
    return haversine_km(bank.lat, bank.lng, d.lat, d.lng)


def _eligible(db: Session, d: Donor, req: UrgentRequest, *, external: bool) -> bool:
    res = check_eligibility(donor_facts(d), req.needed_by, req.blood_group, require_verified=external)
    if not res.eligible:
        return False
    if external and not d.open_to_urgent:
        return False
    if d.id in busy_donor_ids(db, req.needed_by, except_appointment_id=req.appointment_id):
        return False
    # Don't pull someone who is the CONFIRMED donor for another patient within their donation gap –
    # that would just move the emergency to the other family. Backups are fair game (we refill them).
    gap = interval_days(d.sex)
    for a in _active_slots(db, d.id, exclude_appointment_id=req.appointment_id):
        if a.slot == "confirmed" and abs((a.appointment.date - req.needed_by).days) < gap:
            return False
    return True


def _active_slots(db: Session, donor_id: int, exclude_appointment_id: int | None) -> list[Assignment]:
    q = select(Assignment).where(Assignment.donor_id == donor_id, Assignment.status.in_(("pending", "attending")))
    if exclude_appointment_id:
        q = q.where(Assignment.appointment_id != exclude_appointment_id)
    return list(db.scalars(q))


def _send_alert(db: Session, req: UrgentRequest, d: Donor, *, stage: int, in_circle: bool, dist: float, rank: int) -> None:
    db.add(UrgentAlert(request=req, donor_id=d.id, stage=stage, in_circle=in_circle, distance_km=round(dist, 2), rank=rank))
    who = patient_label_for_donor(req.patient, d)
    notify(db, d.user_id, "urgent", f"Urgent: {req.blood_group} needed – {format_distance(dist)} from you",
           f"{who} needs {req.units} unit(s) at {req.blood_bank.name} by {req.needed_by:%a %d %b}. First to accept is confirmed.",
           "critical", "/app/donor")


def create_request(
    db: Session,
    patient: Patient,
    *,
    units: int,
    needed_by: date,
    reason: str,
    source: str,
    created_by: User | None,
    appointment=None,
    exclude_donor_ids: set[int] | frozenset = frozenset(),
) -> UrgentRequest:
    bank_id = appointment.blood_bank_id if appointment else patient.hospital.blood_bank_id
    req = UrgentRequest(
        patient=patient,
        appointment_id=appointment.id if appointment else None,
        blood_bank_id=bank_id,
        blood_group=patient.blood_group,
        units=units,
        needed_by=needed_by,
        reason=reason,
        source=source,
        created_by_user_id=created_by.id if created_by else None,
        status="circle",
        stage=1,
    )
    db.add(req)
    db.flush()
    db.refresh(req)

    sent = 0
    for m in patient.circle:
        d = m.donor
        if d.id in exclude_donor_ids or not _eligible(db, d, req, external=False):
            continue
        _send_alert(db, req, d, stage=1, in_circle=True, dist=_distance(req.blood_bank, d), rank=sent + 1)
        sent += 1

    notify_bank_staff(db, bank_id, "urgent", f"URGENT: {patient.name} needs {patient.blood_group} by {needed_by:%d %b}",
                      f"{reason}. Circle alerted: {sent} donor(s). Approve to broadcast nearby, re-route, or fulfil from stock.",
                      "critical", "/app/blood_bank")
    notify_hospital_staff(db, patient.hospital_id, "urgent", f"Urgent request opened for {patient.name}",
                          f"{units} unit(s) {patient.blood_group} by {needed_by:%d %b}. Blood bank notified.", "warning", "/app/hospital")
    if source != "donor_cancellation":
        notify(db, patient.family_user_id, "urgent", "Urgent help requested",
               f"Sent to {req.blood_bank.name}. {sent} member(s) of your circle alerted first.", "warning", "/app/patient")
    db.flush()
    if sent == 0:
        escalate(db, req)
    return req


def escalate(db: Session, req: UrgentRequest, actor: User | None = None) -> dict:
    """Widen to the next ring of external donors. Skips empty rings."""
    if req.status not in OPEN:
        raise ValueError(f"Request is {req.status}")
    bank = req.blood_bank
    circle_ids = {m.donor_id for m in req.patient.circle}
    alerted = {a.donor_id for a in req.alerts}
    groups = compatible_donor_groups(req.blood_group)
    radius = next_ring(req.radius_km)
    if actor:
        req.approved_by_user_id = actor.id

    while radius is not None:
        min_lat, max_lat, min_lng, max_lng = bounding_box(bank.lat, bank.lng, radius)
        # SQL pre-filter on an indexable lat/lng box; exact haversine afterwards.
        pool = db.scalars(
            select(Donor).where(
                Donor.blood_group.in_(groups),
                Donor.verified.is_(True),
                Donor.available.is_(True),
                Donor.open_to_urgent.is_(True),
                Donor.lat.between(min_lat, max_lat),
                Donor.lng.between(min_lng, max_lng),
            )
        ).all()
        pool = [d for d in pool if d.id not in circle_ids and d.id not in alerted and _eligible(db, d, req, external=True)]
        ranked = rank_by_distance(
            (bank.lat, bank.lng), pool, lambda d: (d.lat, d.lng), radius_km=radius,
            limit=settings.broadcast_batch, tiebreak=lambda d: (0 if is_exact_match(d.blood_group, req.blood_group) else 1, d.id),
        )
        if ranked:
            req.stage += 1
            req.status = "broadcast"
            req.radius_km = radius
            req.stage_started_at = utcnow()
            for i, r in enumerate(ranked, 1):
                _send_alert(db, req, r.item, stage=req.stage, in_circle=False, dist=r.distance_km, rank=i)
            db.flush()
            return {"status": "broadcast", "radius_km": radius, "alerted": len(ranked)}
        req.radius_km = radius
        radius = next_ring(radius)

    req.status = "no_match"
    notify_bank_staff(db, req.blood_bank_id, "urgent", f"No donor found within 50 km for {req.patient.name}",
                      "Fulfil from stock or re-route to another blood bank.", "critical", "/app/blood_bank")
    db.flush()
    return {"status": "no_match", "radius_km": req.radius_km, "alerted": 0}


def accept(db: Session, alert: UrgentAlert) -> tuple[bool, str]:
    req = alert.request
    if alert.status != "sent":
        return False, "This alert is no longer active."
    # Atomic first-accept-wins: only one UPDATE can flip an open request to filled.
    won = db.execute(
        update(UrgentRequest)
        .where(UrgentRequest.id == req.id, UrgentRequest.status.in_(OPEN))
        .values(status="filled", filled_by_donor_id=alert.donor_id, filled_at=utcnow())
        .execution_options(synchronize_session=False)
    ).rowcount == 1
    now = utcnow()
    if not won:
        alert.status, alert.responded_at = "closed", now
        db.flush()
        return False, "Someone else just accepted – thank you for responding so fast."
    db.refresh(req)
    alert.status, alert.responded_at = "accepted", now
    donor = alert.donor
    for other in req.alerts:
        if other.id != alert.id and other.status == "sent":
            other.status = "closed"
            notify(db, other.donor.user_id, "urgent_closed", "Request filled – thank you",
                   f"Another donor accepted the {req.blood_group} request. You weren't needed this time.", "success", "/app/donor")
    if req.appointment_id:
        db.add(Assignment(appointment_id=req.appointment_id, donor_id=donor.id, slot="confirmed", status="attending", source="urgent"))
    # Release this donor's backup slots that the donation would make them ineligible for, and refill them.
    from .planning import fill_slots  # local import: planning imports this module

    gap = interval_days(donor.sex)
    for slot in _active_slots(db, donor.id, exclude_appointment_id=req.appointment_id):
        if slot.slot == "backup" and abs((slot.appointment.date - req.needed_by).days) < gap:
            slot.status = "released"  # not a cancellation – no reliability penalty
            db.flush()
            fill_slots(db, slot.appointment)
            notify(db, slot.appointment.patient.family_user_id, "backup_changed", "Your backup donor changed",
                   f"{short_name(donor.name)} answered an emergency elsewhere; a new backup was chosen from your circle.", "info", "/app/patient")
    label = "your circle" if alert.in_circle else f"a verified donor {format_distance(alert.distance_km)} away"
    notify(db, req.patient.family_user_id, "urgent_filled", f"Donor confirmed: {short_name(donor.name)}",
           f"{short_name(donor.name)} from {label} accepted. The blood bank will coordinate.", "success", "/app/patient")
    notify_bank_staff(db, req.blood_bank_id, "urgent_filled", f"Filled: {donor.name} for {req.patient.name}",
                      f"{donor.blood_group} · {format_distance(alert.distance_km)} away · call {donor.phone} to book the slot.", "success", "/app/blood_bank")
    notify_hospital_staff(db, req.patient.hospital_id, "urgent_filled", f"Urgent request filled for {req.patient.name}",
                          f"Donor {short_name(donor.name)} confirmed.", "success", "/app/hospital")
    notify(db, donor.user_id, "urgent_won", "You're confirmed – thank you!",
           f"Please reach {req.blood_bank.name} by {req.needed_by:%a %d %b}. Staff will call you.", "success", "/app/donor")
    db.flush()
    return True, "You're confirmed! The blood bank will contact you."


def decline(db: Session, alert: UrgentAlert) -> None:
    if alert.status != "sent":
        return
    alert.status, alert.responded_at = "declined", utcnow()
    db.flush()
    req = alert.request
    current = [a for a in req.alerts if a.stage == req.stage]
    if req.status in OPEN and current and all(a.status != "sent" for a in current):
        escalate(db, req)  # everyone in this ring said no – don't wait for the timer


def run_due_escalations(db: Session, now: datetime | None = None) -> int:
    now = now or utcnow()
    n = 0
    for req in db.scalars(select(UrgentRequest).where(UrgentRequest.status.in_(OPEN))).all():
        window = settings.circle_window_minutes if req.status == "circle" else settings.ring_window_minutes
        if now - req.stage_started_at >= timedelta(minutes=window):
            escalate(db, req)
            n += 1
    return n


def fulfil_from_stock(db: Session, req: UrgentRequest, actor: User) -> dict:
    from .inventory import adjust

    if req.status not in OPEN + ("no_match",):
        raise ValueError(f"Request is {req.status}")
    rows = db.scalars(select(Inventory).where(Inventory.blood_bank_id == req.blood_bank_id)).all()
    usable = [r for r in rows if can_donate_rbc(r.blood_group, req.blood_group) and r.units >= req.units]
    if not usable:
        raise ValueError("Not enough compatible units in stock")
    usable.sort(key=lambda r: (0 if r.blood_group == req.blood_group else 1, -r.units))
    row = usable[0]
    adjust(db, row, -req.units)
    req.status = "stock_fulfilled"
    req.approved_by_user_id = actor.id
    req.staff_note = f"Issued {req.units} unit(s) of {row.blood_group} from stock"
    for a in req.alerts:
        if a.status == "sent":
            a.status = "closed"
            notify(db, a.donor.user_id, "urgent_closed", "Request covered – thank you",
                   "The blood bank covered this request from stock.", "success", "/app/donor")
    notify(db, req.patient.family_user_id, "urgent_filled", "Covered from blood bank stock",
           f"{req.blood_bank.name} issued {req.units} unit(s) of {row.blood_group}.", "success", "/app/patient")
    db.flush()
    return {"issued_group": row.blood_group, "units": req.units}


def reroute(db: Session, req: UrgentRequest, to_bank: BloodBank, note: str, actor: User) -> None:
    if req.status not in OPEN + ("no_match",):
        raise ValueError(f"Request is {req.status}")
    old = req.blood_bank.name
    req.blood_bank_id = to_bank.id
    req.staff_note = note or f"Re-routed from {old}"
    req.approved_by_user_id = actor.id
    was_no_match = req.status == "no_match"
    if was_no_match:
        req.status, req.radius_km, req.stage_started_at = "broadcast", None, utcnow()
    db.flush()
    db.refresh(req)
    if was_no_match:
        escalate(db, req, actor)  # search again around the new bank
    notify_bank_staff(db, to_bank.id, "urgent", f"Re-routed URGENT: {req.patient.name} needs {req.blood_group}",
                      f"From {old}. {note}", "critical", "/app/blood_bank")
    notify(db, req.patient.family_user_id, "urgent", f"Request moved to {to_bank.name}",
           note or "Re-routed for faster fulfilment.", "info", "/app/patient")


def cancel(db: Session, req: UrgentRequest, note: str) -> None:
    if req.status not in OPEN + ("no_match",):
        raise ValueError(f"Request is {req.status}")
    req.status = "cancelled"
    req.staff_note = note
    for a in req.alerts:
        if a.status == "sent":
            a.status = "closed"
    db.flush()
