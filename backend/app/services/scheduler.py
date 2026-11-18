"""Transfusion-cycle date maths and reminder plan (pure functions)."""
from __future__ import annotations

from datetime import date, timedelta

# (days before transfusion, kind, applies to slot)
REMINDER_PLAN = (
    (7, "t_minus_7", "confirmed"),
    (3, "t_minus_3", "confirmed"),
    (3, "standby_3", "backup"),
    (1, "t_minus_1", "confirmed"),
)


def next_transfusion_date(last_transfusion: date | None, cycle_days: int, today: date) -> tuple[date, bool]:
    """Return (date, overdue).

    The next date is last + cycle. If that is already in the past the patient is
    overdue: we schedule for today and flag it, rather than silently skipping a cycle.
    """
    if cycle_days < 7 or cycle_days > 90:
        raise ValueError("cycle_days must be between 7 and 90")
    if last_transfusion is None:
        return today + timedelta(days=7), False
    nxt = last_transfusion + timedelta(days=cycle_days)
    if nxt < today:
        return today, True
    return nxt, False


def project_dates(first: date, cycle_days: int, n: int) -> list[date]:
    return [first + timedelta(days=cycle_days * i) for i in range(n)]


def reminders_due(transfusion_date: date, slot: str, today: date) -> list[str]:
    """Reminder kinds that should have gone out by `today` for a donor in `slot`."""
    if today > transfusion_date:
        return []
    days_left = (transfusion_date - today).days
    return [kind for offset, kind, s in REMINDER_PLAN if s == slot and days_left <= offset]


def reminder_text(kind: str, patient_first: str, when: date, hospital: str) -> tuple[str, str]:
    d = when.strftime("%a %d %b")
    return {
        "t_minus_7": (f"You're up for {patient_first} on {d}", f"You're the confirmed donor for {patient_first}'s transfusion at {hospital}. Please confirm you can make it."),
        "t_minus_3": (f"3 days to go – {d}", f"Reminder: donation for {patient_first} at {hospital}. Eat well, hydrate, sleep 6+ hours."),
        "standby_3": (f"You're backup for {patient_first} ({d})", f"You're on standby for {patient_first}. We'll only call on you if the confirmed donor can't make it."),
        "t_minus_1": (f"Tomorrow: donation at {hospital}", f"Tomorrow is the day for {patient_first}. Carry a photo ID. Thank you for showing up again."),
    }[kind]
