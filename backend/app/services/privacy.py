"""Privacy routing – one place that decides what each role may see about a donor.

Rules
-----
* Donor phone numbers are returned ONLY to blood bank staff (and to the donor themself).
  The field is *omitted*, not masked, for families and hospitals, so it cannot leak
  through the network tab or a careless UI.
* Families and hospitals see a short name ("Amit S."), blood group, relation / distance
  and status – enough to feel reassured, not enough to contact the donor directly.
  All coordination goes through the blood bank.
* External (non-circle) donors answering an urgent broadcast do not learn the
  patient's name – only blood group, hospital and distance.
* Every time staff load donor contact details an audit row is written.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from ..models import AuditLog, Donor, Patient, User
from .eligibility import age_on

CONTACT_HIDDEN = "Hidden · coordinated by blood bank"


def short_name(full: str) -> str:
    parts = full.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


def format_phone(phone: str) -> str:
    digits = phone.lstrip("+")
    if phone.startswith("+91") and len(digits) == 12:
        return f"+91 {digits[2:7]} {digits[7:]}"
    return phone


def mask_phone(phone: str) -> str:
    return f"{phone[:3]} ••••• {phone[-4:]}" if len(phone) > 7 else "•••••"


def can_see_contact(viewer: User, donor: Donor) -> bool:
    return viewer.role == "blood_bank" or (viewer.role == "donor" and donor.user_id == viewer.id)


def donor_card(donor: Donor, viewer: User, *, today: date | None = None, **extra) -> dict:
    card = {
        "id": donor.id,
        "display_name": short_name(donor.name),
        "blood_group": donor.blood_group,
        "verified": donor.verified,
    }
    if can_see_contact(viewer, donor):
        card.update(
            name=donor.name,
            phone=format_phone(donor.phone),
            sex=donor.sex,
            age=age_on(donor.date_of_birth, today or date.today()),
            weight_kg=donor.weight_kg,
            available=donor.available,
            area=donor.area,
            last_donation_date=donor.last_donation_date.isoformat() if donor.last_donation_date else None,
            deferred_until=donor.deferred_until.isoformat() if donor.deferred_until else None,
            last_hemoglobin=donor.last_hemoglobin,
        )
    else:
        card["contact"] = CONTACT_HIDDEN
    card.update({k: v for k, v in extra.items() if v is not None})
    return card


def patient_label_for_donor(patient: Patient, donor: Donor) -> str:
    """Circle donors know the patient; strangers answering a broadcast do not."""
    in_circle = any(m.donor_id == donor.id for m in patient.circle)
    return patient.name.split()[0] if in_circle else f"A {patient.condition.lower()} patient"


def audit(db: Session, actor: User, action: str, target: str) -> None:
    db.add(AuditLog(actor_user_id=actor.id, action=action, target=target))
