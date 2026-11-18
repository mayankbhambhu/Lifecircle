"""Hospital / transfusion day-care staff: their patients' coverage, linked bank stock, urgent requests."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, Hospital, Patient, UrgentRequest, User
from ..security import require_roles
from ..services import inventory, urgent
from ..services.planning import complete_transfusion, plan_next, upcoming_appointment
from ..views import appointment_view, urgent_view
from .family import UrgentBody

router = APIRouter(prefix="/api/hospital", tags=["hospital"])
HospitalRole = require_roles("hospital")


def _hospital(db: Session, user: User) -> Hospital:
    if not user.hospital_id:
        raise HTTPException(403, "Account is not linked to a hospital")
    return db.get(Hospital, user.hospital_id)


def _patient(db: Session, user: User, pid: int) -> Patient:
    p = db.get(Patient, pid)
    if not p or p.hospital_id != user.hospital_id:
        raise HTTPException(404, "Patient not found")
    return p


@router.get("/overview")
def overview(user: User = Depends(HospitalRole), db: Session = Depends(get_db)):
    today = date.today()
    h = _hospital(db, user)
    patients = db.scalars(select(Patient).where(Patient.hospital_id == h.id).order_by(Patient.name)).all()
    rows = []
    for p in patients:
        appt = upcoming_appointment(db, p) or plan_next(db, p, today)
        rows.append({"id": p.id, "name": p.name, "blood_group": p.blood_group, "condition": p.condition,
                     "cycle_days": p.cycle_days, "next": appointment_view(appt, user, today)})
    rows.sort(key=lambda r: r["next"]["date"])
    reqs = db.scalars(select(UrgentRequest).join(Patient).where(Patient.hospital_id == h.id)
                      .order_by(UrgentRequest.created_at.desc()).limit(10)).all()
    db.commit()
    return {
        "hospital": {"id": h.id, "name": h.name, "city": h.city},
        "blood_bank": {"id": h.blood_bank.id, "name": h.blood_bank.name},
        "patients": rows,
        "stock": inventory.bank_stock(db, h.blood_bank_id),
        "stock_alerts": inventory.stock_alerts(db, h.blood_bank_id),
        "urgent": [urgent_view(r, user, today) for r in reqs],
    }


@router.post("/patients/{patient_id}/urgent")
def request_urgent(patient_id: int, body: UrgentBody, user: User = Depends(HospitalRole), db: Session = Depends(get_db)):
    p = _patient(db, user, patient_id)
    if db.scalar(select(UrgentRequest.id).where(UrgentRequest.patient_id == p.id, UrgentRequest.status.in_(urgent.OPEN))):
        raise HTTPException(409, "An urgent request is already active for this patient")
    appt = upcoming_appointment(db, p)
    link = appt if appt and appt.date == body.needed_by else None
    req = urgent.create_request(db, p, units=body.units, needed_by=body.needed_by, reason=body.reason,
                                source="hospital", created_by=user, appointment=link)
    db.commit()
    return urgent_view(req, user, date.today())


@router.post("/appointments/{appt_id}/complete")
def complete(appt_id: int, user: User = Depends(HospitalRole), db: Session = Depends(get_db)):
    a = db.get(Appointment, appt_id)
    if not a or a.patient.hospital_id != user.hospital_id:
        raise HTTPException(404, "Appointment not found")
    try:
        nxt = complete_transfusion(db, a, date.today())
    except ValueError as e:
        raise HTTPException(409, str(e))
    db.commit()
    return {"ok": True, "next_date": nxt.date.isoformat()}
