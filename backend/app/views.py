"""Role-aware serialisers shared by routers. All donor data goes through privacy.donor_card."""
from __future__ import annotations

from datetime import date

from .models import Appointment, Assignment, Donor, UrgentRequest, User
from .services.circle import donor_facts
from .services.eligibility import check_eligibility
from .services.geo import format_distance
from .services.planning import ACTIVE, active_slot
from .services.privacy import donor_card


def eligibility_for(viewer: User, donor: Donor, on: date, recipient_group: str | None = None) -> dict:
    res = check_eligibility(donor_facts(donor), on, recipient_group)
    if viewer.role == "blood_bank" or (viewer.role == "donor" and donor.user_id == viewer.id):
        return res.as_dict()
    # Families / hospitals: no medical detail, only a friendly status.
    if res.eligible:
        label = "Eligible"
    elif not donor.available:
        label = "Unavailable"
    elif res.next_eligible_date:
        label = f"Resting until {res.next_eligible_date:%d %b}"
    else:
        label = "Not eligible for this patient"
    return {"eligible": res.eligible, "label": label,
            "next_eligible_date": res.next_eligible_date.isoformat() if res.next_eligible_date else None}


def slot_view(a: Assignment | None, viewer: User, today: date) -> dict | None:
    if not a:
        return None
    return {**donor_card(a.donor, viewer, today=today), "assignment_id": a.id, "slot": a.slot,
            "status": a.status, "source": a.source, "score": a.score}


def coverage(appt: Appointment) -> str:
    c, b = active_slot(appt, "confirmed"), active_slot(appt, "backup")
    if c and c.status == "attending":
        return "confirmed"
    if c:
        return "awaiting_donor" if not b else "planned"
    return "uncovered"


def appointment_view(appt: Appointment, viewer: User, today: date) -> dict:
    return {
        "id": appt.id,
        "date": appt.date.isoformat(),
        "days_until": (appt.date - today).days,
        "status": appt.status,
        "units_needed": appt.units_needed,
        "bank_note": appt.bank_note,
        "blood_bank": appt.blood_bank.name,
        "coverage": coverage(appt),
        "confirmed": slot_view(active_slot(appt, "confirmed"), viewer, today),
        "backup": slot_view(active_slot(appt, "backup"), viewer, today),
        "dropped": [slot_view(a, viewer, today) for a in appt.assignments if a.status not in ACTIVE] if viewer.role == "blood_bank" else None,
    }


def urgent_view(req: UrgentRequest, viewer: User, today: date) -> dict:
    alerts = sorted(req.alerts, key=lambda a: (a.stage, a.rank))
    out = {
        "id": req.id,
        "status": req.status,
        "stage": req.stage,
        "radius_km": req.radius_km,
        "blood_group": req.blood_group,
        "units": req.units,
        "needed_by": req.needed_by.isoformat(),
        "reason": req.reason,
        "source": req.source,
        "created_at": req.created_at.isoformat() + "Z",
        "filled_at": req.filled_at.isoformat() + "Z" if req.filled_at else None,
        "staff_note": req.staff_note,
        "blood_bank": req.blood_bank.name,
        "patient": {"id": req.patient.id, "name": req.patient.name, "hospital": req.patient.hospital.name},
        "alerted": {"circle": sum(a.in_circle for a in alerts), "nearby": sum(not a.in_circle for a in alerts),
                    "declined": sum(a.status == "declined" for a in alerts)},
        "filled_by": None,
    }
    if req.filled_by:
        acc = next((a for a in alerts if a.donor_id == req.filled_by_donor_id), None)
        out["filled_by"] = donor_card(req.filled_by, viewer, today=today,
                                      distance=format_distance(acc.distance_km) if acc else None,
                                      in_circle=acc.in_circle if acc else None)
    if viewer.role == "blood_bank":
        out["alerts"] = [
            {**donor_card(a.donor, viewer, today=today), "alert_id": a.id, "stage": a.stage, "in_circle": a.in_circle,
             "distance": format_distance(a.distance_km), "distance_km": a.distance_km, "status": a.status}
            for a in alerts
        ]
    return out
