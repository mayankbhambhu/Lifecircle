"""Planned mode – the core scheduling loop.

    transfusion completed ──► next date = last + cycle ──► rotation picks
    confirmed + backup ──► blood bank approves slot ──► automated reminders
    (T-7, T-3, T-1) ──► day-of screening logged ──► transfusion completed ...

Cancellation handling:
    confirmed cancels ─► backup promoted ─► new backup picked by rotation
                     └► no backup left ─► Urgent mode (circle first, then nearby)
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Appointment, Assignment, Inventory, Patient, ReminderLog, UrgentRequest, User
from . import inventory, urgent
from .blood import can_donate_rbc
from .circle import busy_donor_ids, circle_candidates
from .notify import notify, notify_bank_staff, notify_hospital_staff
from .privacy import short_name
from .rotation import rank_circle
from .scheduler import next_transfusion_date, reminder_text, reminders_due

ACTIVE = ("pending", "attending")
UPCOMING = ("awaiting_bank", "scheduled")


def first_name(name: str) -> str:
    return name.split()[0]


def upcoming_appointment(db: Session, patient: Patient) -> Appointment | None:
    return db.scalar(
        select(Appointment)
        .where(Appointment.patient_id == patient.id, Appointment.status.in_(UPCOMING))
        .order_by(Appointment.date)
    )


def active_slot(appt: Appointment, slot: str) -> Assignment | None:
    return next((a for a in appt.assignments if a.slot == slot and a.status in ACTIVE), None)


def fill_slots(db: Session, appt: Appointment) -> dict:
    """Fill any empty confirmed/backup slot from the circle using fair rotation."""
    patient = appt.patient
    already = {a.donor_id for a in appt.assignments}  # never re-ask someone who cancelled this cycle
    busy = busy_donor_ids(db, appt.date, except_appointment_id=appt.id)
    result = rank_circle(circle_candidates(db, patient, appt.date), patient.blood_group, appt.date, exclude_ids=already | busy)
    pool = list(result.ranked)
    picked = {}
    for slot in ("confirmed", "backup"):
        if active_slot(appt, slot) or not pool:
            continue
        choice = pool.pop(0)
        a = Assignment(appointment=appt, donor_id=choice.donor_id, slot=slot, score=choice.score, source="rotation")
        db.add(a)
        db.flush()
        picked[slot] = choice
        donor_user = a.donor.user_id if a.donor else None
        when = appt.date.strftime("%a %d %b")
        if slot == "confirmed":
            notify(db, donor_user, "assignment", f"You're {first_name(patient.name)}'s donor on {when}",
                   f"Fair rotation picked you this cycle ({choice.explanation}). Please confirm or cancel early so we can plan.",
                   "info", "/donor")
        else:
            notify(db, donor_user, "assignment", f"You're backup for {first_name(patient.name)} on {when}",
                   "You'll only be needed if the confirmed donor can't make it.", "info", "/donor")
    return {"picked": picked, "ranked": result.ranked, "ineligible": result.ineligible}


def plan_next(db: Session, patient: Patient, today: date) -> Appointment:
    existing = upcoming_appointment(db, patient)
    if existing:
        return existing
    when, overdue = next_transfusion_date(patient.last_transfusion_date, patient.cycle_days, today)
    appt = Appointment(
        patient=patient,
        blood_bank_id=patient.hospital.blood_bank_id,
        date=when,
        units_needed=patient.units_per_transfusion,
        status="awaiting_bank",
    )
    db.add(appt)
    db.flush()
    outcome = fill_slots(db, appt)
    pname = first_name(patient.name)
    notify(db, patient.family_user_id, "planned", f"Next transfusion planned: {when:%d %b}",
           "Confirmed and backup donors have been chosen from your circle." if outcome["picked"].get("backup")
           else "We couldn't fill both slots from your circle – the blood bank has been told.",
           "warning" if overdue or not outcome["picked"].get("confirmed") else "success", "/patient")
    notify_bank_staff(db, appt.blood_bank_id, "queue", f"Planned request: {pname} ({patient.blood_group}) on {when:%d %b}",
                      "A new planned transfusion is waiting for slot approval.", "info", "/bank")
    return appt


def replace_confirmed(db: Session, appt: Appointment, lost: Assignment, why: str) -> dict:
    """The confirmed donor is out (cancelled, deferred at screening, no-show).

    Promote the backup if there is one, refill the backup from the circle,
    otherwise go to Urgent mode (circle first, then nearby donors).
    """
    patient = appt.patient
    donor_label = short_name(lost.donor.name)
    out: dict = {"promoted": None, "new_backup": None, "urgent_request_id": None}
    backup = active_slot(appt, "backup")
    if backup:
        backup.slot = "confirmed"
        backup.source = "promoted"
        db.flush()
        out["promoted"] = backup.donor_id
        notify(db, backup.donor.user_id, "promoted", f"You're now the donor for {first_name(patient.name)}",
               f"The confirmed donor can't donate. Can you make it on {appt.date:%a %d %b}? Please confirm.", "warning", "/donor")
        notify(db, patient.family_user_id, "cancellation", f"{donor_label} can't donate – {short_name(backup.donor.name)} stepped in",
               "Your backup donor was promoted automatically and a new backup is being chosen.", "warning", "/patient")
        filled = fill_slots(db, appt)
        if filled["picked"].get("backup"):
            out["new_backup"] = filled["picked"]["backup"].donor_id
    else:
        req = urgent.create_request(db, patient, units=appt.units_needed, needed_by=appt.date,
                                    reason=f"{why}; no backup available", source="donor_cancellation",
                                    created_by=None, appointment=appt, exclude_donor_ids={lost.donor_id})
        out["urgent_request_id"] = req.id
        notify(db, patient.family_user_id, "cancellation", f"{donor_label} can't donate – Urgent mode started",
               "We're alerting your circle first, then nearby verified donors. The blood bank is watching this request.",
               "critical", "/patient")
    return out


def cancel_assignment(db: Session, a: Assignment, reason: str) -> dict:
    if a.status not in ACTIVE:
        raise ValueError("This slot is no longer active")
    appt = a.appointment
    patient = appt.patient
    a.status = "cancelled"
    a.cancel_reason = reason or None
    db.flush()
    if a.slot == "confirmed":
        out = replace_confirmed(db, appt, a, f"Confirmed donor cancelled ({reason or 'no reason given'})")
    else:
        out = {"promoted": None, "new_backup": None, "urgent_request_id": None}
        filled = fill_slots(db, appt)
        if filled["picked"].get("backup"):
            out["new_backup"] = filled["picked"]["backup"].donor_id
        notify(db, patient.family_user_id, "cancellation", f"Backup donor {short_name(a.donor.name)} cancelled",
               "A replacement backup was chosen from your circle." if out["new_backup"] else "No other eligible backup in your circle this cycle.",
               "info" if out["new_backup"] else "warning", "/patient")
    notify_bank_staff(db, appt.blood_bank_id, "cancellation", f"{a.donor.name} cancelled ({a.slot}) for {patient.name}",
                      reason or "No reason given", "warning", "/bank")
    return out


def complete_transfusion(db: Session, appt: Appointment, today: date) -> Appointment:
    if appt.status not in UPCOMING:
        raise ValueError("Appointment is not open")
    appt.status = "completed"
    patient = appt.patient
    # Issue the units from stock (the replacement donation went into stock earlier).
    rows = db.scalars(select(Inventory).where(Inventory.blood_bank_id == appt.blood_bank_id)).all()
    usable = sorted((r for r in rows if r.units >= appt.units_needed and can_donate_rbc(r.blood_group, patient.blood_group)),
                    key=lambda r: (r.blood_group != patient.blood_group, -r.units))
    if usable:
        inventory.adjust(db, usable[0], -appt.units_needed)
    patient.last_transfusion_date = appt.date
    db.flush()
    nxt = plan_next(db, patient, today)
    notify_hospital_staff(db, patient.hospital_id, "planned", f"{patient.name}: next transfusion {nxt.date:%d %b}",
                          "Cycle rolled forward automatically.", "info", "/hospital")
    return nxt


def run_reminders(db: Session, today: date) -> int:
    """Send due reminders exactly once; at T-1 swap in a confirmed backup if the main donor never confirmed."""
    sent = 0
    appts = db.scalars(
        select(Appointment).where(Appointment.status.in_(UPCOMING), Appointment.date >= today, Appointment.date <= today + timedelta(days=7))
    ).all()
    for appt in appts:
        patient = appt.patient
        hospital = patient.hospital.name
        days_left = (appt.date - today).days
        if days_left <= 3 and not active_slot(appt, "confirmed"):
            fill_slots(db, appt)  # someone may have become eligible / joined the circle
            open_req = db.scalar(select(UrgentRequest.id).where(UrgentRequest.appointment_id == appt.id,
                                                                UrgentRequest.status.in_(urgent.OPEN + ("no_match",))))
            if not active_slot(appt, "confirmed") and not open_req:
                urgent.create_request(db, patient, units=appt.units_needed, needed_by=appt.date,
                                      reason="No confirmed donor 3 days before transfusion", source="planner",
                                      created_by=None, appointment=appt)
        if days_left <= 1:
            conf, back = active_slot(appt, "confirmed"), active_slot(appt, "backup")
            if conf and back and conf.status == "pending" and back.status == "attending":
                conf.slot, back.slot = "backup", "confirmed"
                notify(db, patient.family_user_id, "swap", "Donor swap for tomorrow",
                       f"{short_name(conf.donor.name)} hasn't confirmed, so {short_name(back.donor.name)} (already confirmed) takes the slot.", "warning", "/patient")
        for a in list(appt.assignments):
            if a.status not in ACTIVE:
                continue
            for kind in reminders_due(appt.date, a.slot, today):
                try:
                    with db.begin_nested():
                        db.add(ReminderLog(assignment_id=a.id, kind=kind))
                except IntegrityError:
                    continue  # already sent
                title, body = reminder_text(kind, first_name(patient.name), appt.date, hospital)
                notify(db, a.donor.user_id, "reminder", title, body, "info", "/donor")
                sent += 1
    return sent


def family_user(db: Session, patient: Patient) -> User:
    return db.get(User, patient.family_user_id)
