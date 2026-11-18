"""Donor medical pre-eligibility.

This is a *pre-screen* used for planning. The final decision is always made by
blood bank staff at the health screening on the day (haemoglobin, BP, pulse,
temperature, questionnaire) and recorded as Donated / Deferred / No-show / Excused.

Default rules follow common Indian whole-blood donation criteria (NBTC / Drugs &
Cosmetics Rules): age 18-65, weight >= 45 kg, haemoglobin >= 12.5 g/dL, and a
minimum gap of 90 days (men) / 120 days (women) between whole-blood donations.
They are kept in one `Rules` object so a blood bank can tune them.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from .blood import can_donate_rbc


@dataclass(frozen=True)
class Rules:
    min_age: int = 18
    max_age: int = 65
    min_weight_kg: float = 45.0
    min_hemoglobin: float = 12.5
    interval_days_male: int = 90
    interval_days_female: int = 120


DEFAULT_RULES = Rules()


@dataclass
class DonorFacts:
    """Plain data the algorithm needs – decoupled from the ORM so it is easy to test."""

    id: int
    name: str
    blood_group: str
    sex: str  # "M" | "F"
    date_of_birth: date
    weight_kg: float
    last_donation_date: date | None = None
    deferred_until: date | None = None
    verified: bool = True
    available: bool = True


@dataclass
class EligibilityResult:
    eligible: bool
    reasons: list[str] = field(default_factory=list)
    next_eligible_date: date | None = None
    checks: dict[str, bool] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "eligible": self.eligible,
            "reasons": self.reasons,
            "next_eligible_date": self.next_eligible_date.isoformat() if self.next_eligible_date else None,
            "checks": self.checks,
        }


def age_on(dob: date, on: date) -> int:
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def interval_days(sex: str, rules: Rules = DEFAULT_RULES) -> int:
    return rules.interval_days_female if sex.upper() == "F" else rules.interval_days_male


def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year + years, day=28)


def check_eligibility(
    donor: DonorFacts,
    on_date: date,
    recipient_group: str | None = None,
    rules: Rules = DEFAULT_RULES,
    require_verified: bool = False,
) -> EligibilityResult:
    """Can `donor` donate on `on_date` (optionally: for a recipient of `recipient_group`)?

    Returns every failing reason (not just the first) plus the earliest date the
    *time-based* blockers clear, so the UI can show "eligible again on 3 Jan".
    """
    reasons: list[str] = []
    checks: dict[str, bool] = {}
    blockers_until: list[date] = []
    permanent = False

    age = age_on(donor.date_of_birth, on_date)
    checks["age"] = rules.min_age <= age <= rules.max_age
    if age < rules.min_age:
        reasons.append(f"Under {rules.min_age} (age {age})")
        blockers_until.append(_add_years(donor.date_of_birth, rules.min_age))
    elif age > rules.max_age:
        reasons.append(f"Over {rules.max_age} (age {age})")
        permanent = True

    checks["weight"] = donor.weight_kg >= rules.min_weight_kg
    if not checks["weight"]:
        reasons.append(f"Weight {donor.weight_kg:g} kg is below {rules.min_weight_kg:g} kg")
        permanent = True  # cannot be predicted from dates

    gap = interval_days(donor.sex, rules)
    if donor.last_donation_date:
        ready_on = donor.last_donation_date + timedelta(days=gap)
        checks["interval"] = on_date >= ready_on
        if not checks["interval"]:
            days_left = (ready_on - on_date).days
            reasons.append(f"Donated {donor.last_donation_date:%d %b}; needs {gap}-day gap ({days_left} more days)")
            blockers_until.append(ready_on)
    else:
        checks["interval"] = True

    if donor.deferred_until and on_date <= donor.deferred_until:
        checks["deferral"] = False
        reasons.append(f"Temporarily deferred until {donor.deferred_until:%d %b %Y}")
        blockers_until.append(donor.deferred_until + timedelta(days=1))
    else:
        checks["deferral"] = True

    if recipient_group:
        checks["compatible"] = can_donate_rbc(donor.blood_group, recipient_group)
        if not checks["compatible"]:
            reasons.append(f"{donor.blood_group} is not compatible with {recipient_group}")
            permanent = True

    checks["available"] = donor.available
    if not donor.available:
        reasons.append("Marked themselves unavailable")

    if require_verified:
        checks["verified"] = donor.verified
        if not donor.verified:
            reasons.append("Profile not yet verified by a blood bank")

    eligible = not reasons
    next_date: date | None = None
    if eligible:
        next_date = on_date
    elif not permanent and donor.available and (not require_verified or donor.verified):
        next_date = max(blockers_until) if blockers_until else None
    return EligibilityResult(eligible=eligible, reasons=reasons, next_eligible_date=next_date, checks=checks)
