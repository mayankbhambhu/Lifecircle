"""Blood bank staff: request queue, donor directory (with phones), daily screening log, stock."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Assignment, AuditLog, BloodBank, DonationLog, Donor, UrgentRequest, User, utcnow
from ..security import require_roles
from ..services import inventory, urgent
from ..services.blood import BLOOD_GROUPS
from ..services.eligibility import DEFAULT_RULES
from ..services.notify import notify
from ..services.planning import ACTIVE, UPCOMING, complete_transfusion, replace_confirmed
from ..services.privacy import audit, donor_card
from ..views import appointment_view, eligibility_for, urgent_view

router = APIRouter(prefix="/api/bank", tags=["blood bank"])
Staff = require_roles("blood_bank")


def _bank(db: Session, user: User) -> BloodBank:
    if not user.blood_bank_id:
        raise HTTPException(403, "Staff account is not linked to a blood bank")
    return db.get(BloodBank, user.blood_bank_id)


def _appt(db: Session, user: User, appt_id: int) -> Appointment:
    a = db.get(Appointment, appt_id)
    if not a or a.blood_bank_id != user.blood_bank_id:
        raise HTTPException(404, "Appointment not found")
    return a


def _req(db: Session, user: User, req_id: int) -> UrgentRequest:
    r = db.get(UrgentRequest, req_id)
    if not r or r.blood_bank_id != user.blood_bank_id:
        raise HTTPException(404, "Request not found")
    return r


@router.get("/queue")
def queue(user: User = Depends(Staff), db: Session = Depends(get_db)):
    today = date.today()
    bank = _bank(db, user)
    planned = db.scalars(
        select(Appointment).where(Appointment.blood_bank_id == bank.id, Appointment.status.in_(UPCOMING),
                                  Appointment.date <= today + timedelta(days=30)).order_by(Appointment.date)
    ).all()
    since = utcnow() - timedelta(days=2)
    reqs = db.scalars(
        select(UrgentRequest).where(UrgentRequest.blood_bank_id == bank.id,
                                    or_(UrgentRequest.status.in_(urgent.OPEN + ("no_match",)), UrgentRequest.created_at >= since))
        .order_by(UrgentRequest.created_at.desc())
    ).all()
    audit(db, user, "view_queue_contacts", f"bank:{bank.id}")
    db.commit()
    return {
        "bank": {"id": bank.id, "name": bank.name, "city": bank.city},
        "planned": [{**appointment_view(a, user, today), "patient": {"id": a.patient.id, "name": a.patient.name,
                     "blood_group": a.patient.blood_group, "hospital": a.patient.hospital.name}} for a in planned],
        "urgent": [urgent_view(r, user, today) for r in reqs],
        "other_banks": [{"id": b.id, "name": b.name} for b in db.scalars(select(BloodBank).where(BloodBank.id != bank.id))],
        "stock_alerts": inventory.stock_alerts(db, bank.id),
    }


class Note(BaseModel):
    note: str = Field(default="", max_length=300)


class Reroute(Note):
    blood_bank_id: int


@router.post("/appointments/{appt_id}/approve")
def approve_appt(appt_id: int, body: Note, user: User = Depends(Staff), db: Session = Depends(get_db)):
    a = _appt(db, user, appt_id)
    if a.status != "awaiting_bank":
        raise HTTPException(409, f"Appointment is {a.status}")
    a.status, a.bank_note = "scheduled", body.note or None
    notify(db, a.patient.family_user_id, "approved", f"Slot approved for {a.date:%d %b}", f"{a.blood_bank.name} has booked the transfusion slot.", "success", "/patient")
    db.commit()
    return {"ok": True}


@router.post("/appointments/{appt_id}/reroute")
def reroute_appt(appt_id: int, body: Reroute, user: User = Depends(Staff), db: Session = Depends(get_db)):
    a = _appt(db, user, appt_id)
    target = db.get(BloodBank, body.blood_bank_id)
    if not target or target.id == a.blood_bank_id:
        raise HTTPException(422, "Choose a different blood bank")
    if a.status not in UPCOMING:
        raise HTTPException(409, f"Appointment is {a.status}")
    a.blood_bank_id, a.status, a.bank_note = target.id, "awaiting_bank", body.note or f"Re-routed from {a.blood_bank.name}"
    db.flush()
    db.refresh(a)
    from ..services.notify import notify_bank_staff
    notify_bank_staff(db, target.id, "queue", f"Re-routed planned request: {a.patient.name} on {a.date:%d %b}", a.bank_note, "info", "/bank")
    notify(db, a.patient.family_user_id, "rerouted", f"Transfusion moved to {target.name}", a.bank_note, "info", "/patient")
    for s in a.assignments:
        if s.status in ACTIVE:
            notify(db, s.donor.user_id, "rerouted", f"Location changed: {target.name}", f"Your donation on {a.date:%d %b} is now at {target.name}.", "info", "/donor")
    db.commit()
    return {"ok": True}


@router.post("/appointments/{appt_id}/complete")
def complete(appt_id: int, user: User = Depends(Staff), db: Session = Depends(get_db)):
    a = _appt(db, user, appt_id)
    try:
        nxt = complete_transfusion(db, a, date.today())
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return {"ok": True, "next_date": nxt.date.isoformat()}


@router.post("/urgent/{req_id}/approve")
def approve_urgent(req_id: int, user: User = Depends(Staff), db: Session = Depends(get_db)):
    """Approve = stop waiting on the circle and broadcast to the nearest ring now."""
    r = _req(db, user, req_id)
    try:
        out = urgent.escalate(db, r, user)
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return out


@router.post("/urgent/{req_id}/reroute")
def reroute_urgent(req_id: int, body: Reroute, user: User = Depends(Staff), db: Session = Depends(get_db)):
    r = _req(db, user, req_id)
    target = db.get(BloodBank, body.blood_bank_id)
    if not target or target.id == r.blood_bank_id:
        raise HTTPException(422, "Choose a different blood bank")
    try:
        urgent.reroute(db, r, target, body.note, user)
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return {"ok": True}


@router.post("/urgent/{req_id}/fulfil-stock")
def fulfil(req_id: int, user: User = Depends(Staff), db: Session = Depends(get_db)):
    r = _req(db, user, req_id)
    try:
        out = urgent.fulfil_from_stock(db, r, user)
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return out


@router.post("/urgent/{req_id}/cancel")
def cancel_urgent(req_id: int, body: Note, user: User = Depends(Staff), db: Session = Depends(get_db)):
    r = _req(db, user, req_id)
    try:
        urgent.cancel(db, r, body.note or "Closed by blood bank")
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return {"ok": True}


@router.get("/donors")
def donors(q: str = "", group: str = "", user: User = Depends(Staff), db: Session = Depends(get_db)):
    today = date.today()
    stmt = select(Donor).order_by(Donor.name)
    if q:
        stmt = stmt.where(or_(Donor.name.ilike(f"%{q}%"), Donor.phone.contains(q), Donor.area.ilike(f"%{q}%")))
    if group:
        stmt = stmt.where(Donor.blood_group == group)
    rows = db.scalars(stmt.limit(200)).all()
    audit(db, user, "view_donor_directory", f"{len(rows)} donors q={q!r} group={group!r}")
    db.commit()
    return [{**donor_card(d, user, today=today), "eligibility": eligibility_for(user, d, today),
             "circles": [m.patient.name for m in d.memberships]} for d in rows]


class Verify(BaseModel):
    verified: bool = True


@router.post("/donors/{donor_id}/verify")
def verify(donor_id: int, body: Verify, user: User = Depends(Staff), db: Session = Depends(get_db)):
    d = db.get(Donor, donor_id)
    if not d:
        raise HTTPException(404, "Donor not found")
    d.verified = body.verified
    audit(db, user, "verify_donor" if body.verified else "unverify_donor", f"donor:{d.id}")
    if body.verified:
        notify(db, d.user_id, "verified", "You're verified ✓", "You can now receive urgent alerts from patients near you.", "success", "/donor")
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ daily log
@router.get("/log")
def day_log(day: date = Query(default_factory=date.today), user: User = Depends(Staff), db: Session = Depends(get_db)):
    bank = _bank(db, user)
    logs = db.scalars(select(DonationLog).where(DonationLog.blood_bank_id == bank.id, DonationLog.date == day)).all()
    by_assignment = {l.assignment_id: l for l in logs if l.assignment_id}
    by_request = {l.urgent_request_id: l for l in logs if l.urgent_request_id}
    rows = []
    appts = db.scalars(select(Appointment).where(Appointment.blood_bank_id == bank.id, Appointment.date == day)).all()
    for a in appts:
        for s in a.assignments:
            if s.status == "cancelled":
                continue
            log = by_assignment.get(s.id)
            rows.append({"key": f"a{s.id}", "assignment_id": s.id, "urgent_request_id": None, "appointment_id": a.id,
                         "appointment_status": a.status, "patient": a.patient.name, "slot": s.slot, "status": s.status,
                         "donor": donor_card(s.donor, user, today=day), "logged": _log_view(log)})
    filled = db.scalars(select(UrgentRequest).where(UrgentRequest.blood_bank_id == bank.id, UrgentRequest.status == "filled",
                                                    UrgentRequest.needed_by == day, UrgentRequest.appointment_id.is_(None))).all()
    for r in filled:
        rows.append({"key": f"u{r.id}", "assignment_id": None, "urgent_request_id": r.id, "appointment_id": None, "appointment_status": None,
                     "patient": r.patient.name, "slot": "urgent", "status": "attending",
                     "donor": donor_card(r.filled_by, user, today=day), "logged": _log_view(by_request.get(r.id))})
    audit(db, user, "view_daily_log", f"{day.isoformat()}")
    db.commit()
    counts = {k: sum(1 for l in logs if l.outcome == k) for k in ("donated", "deferred", "no_show", "excused")}
    return {"date": day.isoformat(), "rows": rows, "counts": counts, "min_hemoglobin": DEFAULT_RULES.min_hemoglobin}


def _log_view(l: DonationLog | None) -> dict | None:
    if not l:
        return None
    return {"outcome": l.outcome, "hemoglobin": l.hemoglobin, "deferral_days": l.deferral_days, "notes": l.notes}


class LogBody(BaseModel):
    date: date
    outcome: Literal["donated", "deferred", "no_show", "excused"]
    assignment_id: int | None = None
    urgent_request_id: int | None = None
    hemoglobin: float | None = Field(default=None, ge=3, le=25)
    deferral_days: int | None = Field(default=None, ge=1, le=3650)
    notes: str | None = Field(default=None, max_length=500)


@router.post("/log")
def log_outcome(body: LogBody, user: User = Depends(Staff), db: Session = Depends(get_db)):
    bank = _bank(db, user)
    if body.date > date.today():
        raise HTTPException(422, "Can't log an outcome for a future date")
    assignment = req = None
    if body.assignment_id:
        assignment = db.get(Assignment, body.assignment_id)
        if not assignment or assignment.appointment.blood_bank_id != bank.id:
            raise HTTPException(404, "Slot not found")
        donor, patient_id = assignment.donor, assignment.appointment.patient_id
        if db.scalar(select(DonationLog.id).where(DonationLog.assignment_id == assignment.id)):
            raise HTTPException(409, "Outcome already logged for this slot")
    elif body.urgent_request_id:
        req = _req(db, user, body.urgent_request_id)
        if not req.filled_by:
            raise HTTPException(409, "No donor accepted this request")
        donor, patient_id = req.filled_by, req.patient_id
        if db.scalar(select(DonationLog.id).where(DonationLog.urgent_request_id == req.id)):
            raise HTTPException(409, "Outcome already logged for this request")
    else:
        raise HTTPException(422, "assignment_id or urgent_request_id is required")

    min_hb = DEFAULT_RULES.min_hemoglobin
    if body.outcome == "donated" and body.hemoglobin is not None and body.hemoglobin < min_hb:
        raise HTTPException(422, f"Hb {body.hemoglobin} is below {min_hb} g/dL – record this as Deferred")
    if body.outcome == "deferred" and not body.deferral_days:
        raise HTTPException(422, "Give a deferral period in days")

    db.add(DonationLog(donor_id=donor.id, blood_bank_id=bank.id, assignment_id=body.assignment_id,
                       urgent_request_id=body.urgent_request_id, patient_id=patient_id, date=body.date,
                       outcome=body.outcome, hemoglobin=body.hemoglobin, deferral_days=body.deferral_days,
                       notes=body.notes, logged_by_user_id=user.id))
    if body.hemoglobin is not None:
        donor.last_hemoglobin = body.hemoglobin
    result: dict = {"ok": True}
    if body.outcome == "donated":
        donor.last_donation_date = body.date
        inventory.adjust(db, inventory.get_row(db, bank.id, donor.blood_group), +1)
        notify(db, donor.user_id, "thanks", "Thank you for donating today ❤",
               "Your donation was recorded. We'll let you know when you're eligible again.", "success", "/donor")
    elif body.outcome == "deferred":
        donor.deferred_until = body.date + timedelta(days=body.deferral_days)
        notify(db, donor.user_id, "deferred", "Temporarily deferred",
               f"Thanks for coming in. You can donate again after {donor.deferred_until:%d %b %Y}.", "info", "/donor")
    if assignment:
        assignment.status = body.outcome
        if body.outcome in ("deferred", "no_show") and assignment.slot == "confirmed" and assignment.appointment.status in UPCOMING:
            result.update(replace_confirmed(db, assignment.appointment, assignment,
                                            f"Confirmed donor {'deferred at screening' if body.outcome == 'deferred' else 'did not show up'}"))
    db.commit()
    return result


# ------------------------------------------------------------------ stock
@router.get("/inventory")
def stock(user: User = Depends(Staff), db: Session = Depends(get_db)):
    bank = _bank(db, user)
    return {"bank": bank.name, "stock": inventory.bank_stock(db, bank.id), "alerts": inventory.stock_alerts(db, bank.id)}


class StockUpdate(BaseModel):
    units: int | None = Field(default=None, ge=0, le=10000)
    min_threshold: int | None = Field(default=None, ge=0, le=10000)
    daily_usage: float | None = Field(default=None, ge=0, le=1000)


def _group(g: str) -> str:
    g = g.upper().replace(" ", "+")
    if g not in BLOOD_GROUPS:
        raise HTTPException(422, "Unknown blood group")
    return g


@router.put("/inventory/{group}")
def update_stock(group: str, body: StockUpdate, user: User = Depends(Staff), db: Session = Depends(get_db)):
    bank = _bank(db, user)
    row = inventory.get_row(db, bank.id, _group(group))
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    inventory.refresh_status(db, row)
    db.commit()
    return inventory.row_view(row)


@router.post("/inventory/{group}/rally")
def rally(group: str, user: User = Depends(Staff), db: Session = Depends(get_db)):
    bank = _bank(db, user)
    try:
        contacted = inventory.rally(db, bank, _group(group), date.today())
    except ValueError as e:
        raise HTTPException(409, str(e))
    audit(db, user, "rally_donors", f"{group}: {len(contacted)} donors")
    db.commit()
    return {"contacted": len(contacted), "donors": contacted}


@router.get("/audit")
def audit_log(user: User = Depends(Staff), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(50)).all()
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_({r.actor_user_id for r in rows})))}
    return [{"when": r.created_at.isoformat() + "Z", "who": names.get(r.actor_user_id), "action": r.action, "target": r.target} for r in rows]
