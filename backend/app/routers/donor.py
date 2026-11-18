"""Donor endpoints – own schedule, urgent alerts nearby, availability & privacy settings."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Assignment, DonationLog, Donor, UrgentAlert, User
from ..security import require_roles
from ..services import urgent
from ..services.circle import donor_facts
from ..services.eligibility import check_eligibility
from ..services.geo import format_distance
from ..services.notify import notify, notify_bank_staff
from ..services.planning import ACTIVE, cancel_assignment
from ..services.privacy import donor_card, patient_label_for_donor, short_name
from .auth import join_circle

router = APIRouter(prefix="/api/donor", tags=["donor"])
DonorRole = require_roles("donor")


def me(db: Session, user: User) -> Donor:
    d = db.scalar(select(Donor).where(Donor.user_id == user.id))
    if not d:
        raise HTTPException(404, "Donor profile missing")
    return d


def own_assignment(db: Session, donor: Donor, assignment_id: int) -> Assignment:
    a = db.get(Assignment, assignment_id)
    if not a or a.donor_id != donor.id:
        raise HTTPException(404, "Slot not found")
    return a


def own_alert(db: Session, donor: Donor, alert_id: int) -> UrgentAlert:
    a = db.get(UrgentAlert, alert_id)
    if not a or a.donor_id != donor.id:
        raise HTTPException(404, "Alert not found")
    return a


@router.get("/overview")
def overview(user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    today = date.today()
    d = me(db, user)
    elig = check_eligibility(donor_facts(d), today)
    upcoming = db.scalars(
        select(Assignment).join(Appointment)
        .where(Assignment.donor_id == d.id, Assignment.status.in_(ACTIVE), Appointment.date >= today)
        .order_by(Appointment.date)
    ).all()
    alerts = db.scalars(select(UrgentAlert).where(UrgentAlert.donor_id == d.id).order_by(UrgentAlert.sent_at.desc()).limit(10)).all()
    logs = db.scalars(select(DonationLog).where(DonationLog.donor_id == d.id).order_by(DonationLog.date.desc())).all()
    donated = [l for l in logs if l.outcome == "donated"]
    return {
        "profile": {**donor_card(d, user, today=today), "open_to_urgent": d.open_to_urgent},
        "eligibility": elig.as_dict(),
        "stats": {"donations": len(donated), "lives_supported": len(donated) * 3 if donated else 0,
                  "since": min(l.date for l in donated).isoformat() if donated else None},
        "upcoming": [{
            "assignment_id": a.id, "date": a.appointment.date.isoformat(), "days_until": (a.appointment.date - today).days,
            "slot": a.slot, "status": a.status, "source": a.source,
            "patient": patient_label_for_donor(a.appointment.patient, d),
            "hospital": a.appointment.patient.hospital.name, "blood_bank": a.appointment.blood_bank.name,
        } for a in upcoming],
        "alerts": [{
            "alert_id": a.id, "request_id": a.request_id, "status": a.status, "request_status": a.request.status,
            "blood_group": a.request.blood_group, "units": a.request.units, "needed_by": a.request.needed_by.isoformat(),
            "distance": format_distance(a.distance_km), "distance_km": a.distance_km, "in_circle": a.in_circle,
            "blood_bank": a.request.blood_bank.name, "patient": patient_label_for_donor(a.request.patient, d),
            "sent_at": a.sent_at.isoformat() + "Z",
        } for a in alerts],
        "circles": [{"patient": m.patient.name.split()[0], "blood_group": m.patient.blood_group, "relation": m.relation,
                     "hospital": m.patient.hospital.name} for m in d.memberships],
        "history": [{"date": l.date.isoformat(), "outcome": l.outcome} for l in logs[:10]],
    }


@router.post("/assignments/{assignment_id}/confirm")
def confirm(assignment_id: int, user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    d = me(db, user)
    a = own_assignment(db, d, assignment_id)
    if a.status not in ACTIVE:
        raise HTTPException(409, "This slot is no longer active")
    if not check_eligibility(donor_facts(d), a.appointment.date, a.appointment.patient.blood_group).eligible:
        raise HTTPException(409, "You're not eligible on that date – please cancel so a backup can step in")
    a.status = "attending"
    p = a.appointment.patient
    notify(db, p.family_user_id, "confirmed", f"{short_name(d.name)} confirmed for {a.appointment.date:%d %b}",
           f"Your {a.slot} donor confirmed attendance.", "success", "/patient")
    notify_bank_staff(db, a.appointment.blood_bank_id, "confirmed", f"{d.name} confirmed ({a.slot}) for {p.name}",
                      f"{a.appointment.date:%d %b}", "success", "/bank")
    db.commit()
    return {"ok": True, "status": a.status}


class CancelBody(BaseModel):
    reason: str = Field(default="", max_length=300)


@router.post("/assignments/{assignment_id}/cancel")
def cancel(assignment_id: int, body: CancelBody, user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    d = me(db, user)
    a = own_assignment(db, d, assignment_id)
    try:
        out = cancel_assignment(db, a, body.reason)
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return {"ok": True, **out}


@router.post("/alerts/{alert_id}/accept")
def accept(alert_id: int, user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    d = me(db, user)
    a = own_alert(db, d, alert_id)
    ok, msg = urgent.accept(db, a)
    db.commit()
    if not ok:
        raise HTTPException(409, msg)
    return {"ok": True, "message": msg}


@router.post("/alerts/{alert_id}/decline")
def decline(alert_id: int, user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    d = me(db, user)
    urgent.decline(db, own_alert(db, d, alert_id))
    db.commit()
    return {"ok": True}


class Prefs(BaseModel):
    available: bool | None = None
    open_to_urgent: bool | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    area: str | None = None


@router.put("/preferences")
def preferences(body: Prefs, user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    d = me(db, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit()
    return {"ok": True}


class JoinBody(BaseModel):
    code: str
    relation: str | None = None


@router.post("/circles/join")
def join(body: JoinBody, user: User = Depends(DonorRole), db: Session = Depends(get_db)):
    d = me(db, user)
    p = join_circle(db, d, body.code, body.relation)
    notify(db, p.family_user_id, "circle", f"{short_name(d.name)} joined {p.name.split()[0]}'s circle",
           f"{d.blood_group} donor. They'll be included in fair rotation from the next eligible cycle.", "success", "/patient")
    db.commit()
    return {"ok": True, "patient": p.name.split()[0]}
