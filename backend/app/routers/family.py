"""Patient-family endpoints. A family can only ever touch its own patients."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, DonationLog, Patient, UrgentRequest, User
from ..security import require_roles
from ..services import urgent
from ..services.circle import circle_candidates
from ..services.notify import notify
from ..services.planning import UPCOMING, fill_slots, plan_next, upcoming_appointment
from ..services.privacy import donor_card
from ..services.rotation import forecast, rank_circle
from ..services.scheduler import project_dates
from ..views import appointment_view, eligibility_for, urgent_view

router = APIRouter(prefix="/api/family", tags=["patient family"])
Family = require_roles("patient")


def own_patient(db: Session, user: User, patient_id: int) -> Patient:
    p = db.get(Patient, patient_id)
    if not p or p.family_user_id != user.id:
        raise HTTPException(404, "Patient not found")  # 404, not 403: don't confirm it exists
    return p


def patient_view(db: Session, p: Patient, user: User, today: date) -> dict:
    appt = upcoming_appointment(db, p) or plan_next(db, p, today)
    ranking = rank_circle(circle_candidates(db, p, appt.date), p.blood_group, appt.date)
    scores = {r.donor_id: r for r in ranking.ranked}
    circle = []
    for m in p.circle:
        r = scores.get(m.donor_id)
        circle.append(donor_card(m.donor, user, today=today, relation=m.relation,
                                 eligibility=eligibility_for(user, m.donor, appt.date, p.blood_group),
                                 rotation_score=r.score if r else None, why=r.explanation if r else None))
    circle.sort(key=lambda c: -(c.get("rotation_score") or -1))
    reqs = db.scalars(select(UrgentRequest).where(UrgentRequest.patient_id == p.id).order_by(UrgentRequest.created_at.desc()).limit(5)).all()
    history = db.scalars(select(Appointment).where(Appointment.patient_id == p.id, Appointment.status == "completed")
                         .order_by(Appointment.date.desc()).limit(6)).all()
    logs = db.scalars(select(DonationLog).where(DonationLog.patient_id == p.id, DonationLog.outcome == "donated")).all()
    return {
        "id": p.id, "name": p.name, "blood_group": p.blood_group, "condition": p.condition,
        "cycle_days": p.cycle_days, "units_per_transfusion": p.units_per_transfusion, "invite_code": p.invite_code,
        "hospital": p.hospital.name, "blood_bank": p.hospital.blood_bank.name,
        "last_transfusion_date": p.last_transfusion_date.isoformat() if p.last_transfusion_date else None,
        "next": appointment_view(appt, user, today),
        "circle": circle,
        "forecast": forecast(circle_candidates(db, p, appt.date), p.blood_group, project_dates(appt.date, p.cycle_days, 6)),
        "urgent": [urgent_view(r, user, today) for r in reqs],
        "history": [{"date": a.date.isoformat(), "donors": [donor_card(l.donor, user)["display_name"] for l in logs if l.date == a.date]}
                    for a in history],
    }


@router.get("/overview")
def overview(user: User = Depends(Family), db: Session = Depends(get_db)):
    today = date.today()
    patients = db.scalars(select(Patient).where(Patient.family_user_id == user.id)).all()
    data = [patient_view(db, p, user, today) for p in patients]
    db.commit()  # plan_next may have created an appointment
    return {"patients": data}


class CycleSettings(BaseModel):
    cycle_days: int = Field(ge=7, le=90)
    units_per_transfusion: int = Field(default=1, ge=1, le=4)


@router.put("/patients/{patient_id}/cycle")
def update_cycle(patient_id: int, body: CycleSettings, user: User = Depends(Family), db: Session = Depends(get_db)):
    p = own_patient(db, user, patient_id)
    changed = p.cycle_days != body.cycle_days
    p.cycle_days, p.units_per_transfusion = body.cycle_days, body.units_per_transfusion
    appt = upcoming_appointment(db, p)
    if appt and changed:
        if db.scalar(select(UrgentRequest.id).where(UrgentRequest.appointment_id == appt.id, UrgentRequest.status.in_(urgent.OPEN))):
            raise HTTPException(409, "An urgent request is open for this cycle – resolve it before changing the cycle")
        affected = [a.donor.user_id for a in appt.assignments]
        db.delete(appt)  # nothing has happened yet – re-plan cleanly (no penalty for donors)
        db.flush()
        appt = plan_next(db, p, date.today())
        for uid in affected:
            notify(db, uid, "rescheduled", f"{p.name.split()[0]}'s transfusion was rescheduled",
                   f"The cycle changed to every {p.cycle_days} days. Check your dashboard for your updated slot.", "info", "/app/donor")
    elif appt:
        appt.units_needed = p.units_per_transfusion
    db.commit()
    return {"ok": True, "next_date": appt.date.isoformat() if appt else None}


class UrgentBody(BaseModel):
    reason: str = Field(min_length=3, max_length=300)
    units: int = Field(default=1, ge=1, le=4)
    needed_by: date


@router.post("/patients/{patient_id}/urgent")
def request_urgent(patient_id: int, body: UrgentBody, user: User = Depends(Family), db: Session = Depends(get_db)):
    p = own_patient(db, user, patient_id)
    if body.needed_by < date.today():
        raise HTTPException(422, "Needed-by date can't be in the past")
    if db.scalar(select(UrgentRequest.id).where(UrgentRequest.patient_id == p.id, UrgentRequest.status.in_(urgent.OPEN))):
        raise HTTPException(409, "An urgent request is already active for this patient")
    appt = upcoming_appointment(db, p)
    link = appt if appt and appt.date == body.needed_by else None
    req = urgent.create_request(db, p, units=body.units, needed_by=body.needed_by, reason=body.reason,
                                source="family", created_by=user, appointment=link)
    db.commit()
    return urgent_view(req, user, date.today())


@router.post("/patients/{patient_id}/replan")
def replan(patient_id: int, user: User = Depends(Family), db: Session = Depends(get_db)):
    p = own_patient(db, user, patient_id)
    appt = upcoming_appointment(db, p) or plan_next(db, p, date.today())
    fill_slots(db, appt)
    db.commit()
    return appointment_view(appt, user, date.today())
