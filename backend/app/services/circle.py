"""Adapters from ORM rows to the plain dataclasses the algorithms use."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Assignment, Donor, DonationLog, Patient, utcnow
from .eligibility import DonorFacts
from .rotation import Candidate, DonorHistory


def donor_facts(d: Donor) -> DonorFacts:
    return DonorFacts(
        id=d.id,
        name=d.name,
        blood_group=d.blood_group,
        sex=d.sex,
        date_of_birth=d.date_of_birth,
        weight_kg=d.weight_kg,
        last_donation_date=d.last_donation_date,
        deferred_until=d.deferred_until,
        verified=d.verified,
        available=d.available,
    )


def donor_history(db: Session, donor_id: int, patient_id: int | None, on_date: date) -> DonorHistory:
    logs = db.execute(
        select(DonationLog.outcome, DonationLog.date, DonationLog.patient_id).where(DonationLog.donor_id == donor_id)
    ).all()
    year_ago = on_date - timedelta(days=365)
    donated = [l for l in logs if l.outcome == "donated"]
    served = [l.date for l in donated if patient_id and l.patient_id == patient_id]
    cancel_since: datetime = utcnow() - timedelta(days=90)
    cancels = db.scalar(
        select(func.count()).select_from(Assignment).where(
            Assignment.donor_id == donor_id, Assignment.status == "cancelled", Assignment.updated_at >= cancel_since
        )
    )
    return DonorHistory(
        donations_last_365=sum(1 for l in donated if l.date >= year_ago),
        last_served_patient=max(served) if served else None,
        assigned_count=sum(1 for l in logs if l.outcome in ("donated", "no_show")),
        donated_count=len(donated),
        no_show_count=sum(1 for l in logs if l.outcome == "no_show"),
        cancellations_90d=cancels or 0,
    )


def circle_candidates(db: Session, patient: Patient, on_date: date) -> list[Candidate]:
    return [
        Candidate(donor=donor_facts(m.donor), history=donor_history(db, m.donor_id, patient.id, on_date), relation=m.relation)
        for m in patient.circle
    ]


def busy_donor_ids(db: Session, on_date: date, except_appointment_id: int | None = None) -> set[int]:
    """Donors already holding an active slot for another appointment on the same day."""
    from ..models import Appointment

    q = (
        select(Assignment.donor_id)
        .join(Appointment)
        .where(Appointment.date == on_date, Assignment.status.in_(("pending", "attending")))
    )
    if except_appointment_id:
        q = q.where(Appointment.id != except_appointment_id)
    return set(db.scalars(q))
