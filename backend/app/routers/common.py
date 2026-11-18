"""Shared endpoints: notifications, reference data, impact stats, demo controls."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Appointment, DonationLog, Donor, Hospital, Notification, Patient, UrgentRequest, User
from ..security import current_user, require_roles
from ..services import urgent
from ..services.blood import BLOOD_GROUPS
from ..services.planning import run_reminders

router = APIRouter(prefix="/api", tags=["common"])


@router.get("/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(40)).all()
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read.is_(False)))
    return {"unread": unread, "items": [{"id": n.id, "kind": n.kind, "level": n.level, "title": n.title, "body": n.body,
                                         "link": n.link, "read": n.read, "created_at": n.created_at.isoformat() + "Z"} for n in rows]}


@router.post("/notifications/read-all")
def read_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(read=True))
    db.commit()
    return {"ok": True}


@router.get("/meta")
def meta(db: Session = Depends(get_db)):
    return {
        "blood_groups": list(BLOOD_GROUPS),
        "hospitals": [{"id": h.id, "name": h.name, "city": h.city} for h in db.scalars(select(Hospital).order_by(Hospital.name))],
        "demo_mode": settings.demo_mode,
        "today": date.today().isoformat(),
    }


@router.get("/impact")
def impact(db: Session = Depends(get_db)):
    """Live numbers for the landing page – computed, not hard-coded."""
    filled = db.scalars(select(UrgentRequest).where(UrgentRequest.status == "filled")).all()
    mins = [(r.filled_at - r.created_at).total_seconds() / 60 for r in filled if r.filled_at]
    completed = db.scalar(select(func.count()).select_from(Appointment).where(Appointment.status == "completed")) or 0
    return {
        "patients": db.scalar(select(func.count()).select_from(Patient)) or 0,
        "donors": db.scalar(select(func.count()).select_from(Donor)) or 0,
        "verified_donors": db.scalar(select(func.count()).select_from(Donor).where(Donor.verified.is_(True))) or 0,
        "donations": db.scalar(select(func.count()).select_from(DonationLog).where(DonationLog.outcome == "donated")) or 0,
        "cycles_completed": completed,
        "urgent_filled": len(filled),
        "median_fill_minutes": round(sorted(mins)[len(mins) // 2]) if mins else None,
    }


@router.post("/system/tick")
def tick(user: User = Depends(require_roles("blood_bank", "hospital")), db: Session = Depends(get_db)):
    """Run the scheduler now (reminders + due escalations). A background loop also runs this every minute."""
    sent = run_reminders(db, date.today())
    escalated = urgent.run_due_escalations(db)
    db.commit()
    return {"reminders_sent": sent, "escalated": escalated}


@router.post("/demo/reset")
def demo_reset():
    if not settings.demo_mode:
        raise HTTPException(404, "Not available")
    from ..seed import reset_and_seed

    reset_and_seed()
    return {"ok": True}
