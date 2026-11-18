"""Fair rotation of a patient's donor circle.

Goal: every cycle pick one CONFIRMED donor and one BACKUP donor from the patient's
circle such that
  1. nobody medically ineligible is ever picked (hard filter),
  2. the load is spread across the circle (nobody is asked every time), and
  3. reliable donors are slightly preferred, without locking out anyone.

Each eligible donor gets a transparent 0-100 score made of five parts. The
breakdown is returned with the result so families and staff can see *why*
someone was chosen ("Amit hasn't been asked for 84 days").

    component      weight  meaning
    rotation         40    days since this donor last served THIS patient (never = max)
    rest             20    days rested beyond their mandatory donation gap
    load             15    fewer donations in the last 365 days = better (fatigue guard)
    reliability      20    Laplace-smoothed show-up rate, minus recent cancellations
    match             5    exact ABO/Rh match preferred over merely compatible

Ties break on: longer since last served -> lower donor id (deterministic).
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import date

from .blood import is_exact_match
from .eligibility import DEFAULT_RULES, DonorFacts, EligibilityResult, Rules, check_eligibility, interval_days

WEIGHTS = {"rotation": 40.0, "rest": 20.0, "load": 15.0, "reliability": 20.0, "match": 5.0}

ROTATION_HORIZON_DAYS = 180  # served this long ago (or never) = full rotation credit
REST_HORIZON_DAYS = 90       # rested this long past the mandatory gap = full rest credit
LOAD_CAP = 4                 # 4+ donations in a year = zero load credit


@dataclass
class DonorHistory:
    donations_last_365: int = 0
    last_served_patient: date | None = None
    assigned_count: int = 0  # times picked as confirmed donor and the day has passed
    donated_count: int = 0
    no_show_count: int = 0
    cancellations_90d: int = 0


@dataclass
class Candidate:
    donor: DonorFacts
    history: DonorHistory = field(default_factory=DonorHistory)
    relation: str = ""


@dataclass
class RankedDonor:
    donor_id: int
    name: str
    score: float
    breakdown: dict[str, float]
    explanation: str
    eligibility: EligibilityResult


@dataclass
class RotationResult:
    confirmed: RankedDonor | None
    backup: RankedDonor | None
    ranked: list[RankedDonor]
    ineligible: list[RankedDonor]


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_candidate(c: Candidate, patient_group: str, on_date: date, rules: Rules = DEFAULT_RULES) -> tuple[float, dict[str, float], str]:
    h, d = c.history, c.donor

    if h.last_served_patient is None:
        rotation, served_txt = 1.0, "has never been asked for this patient"
    else:
        days = (on_date - h.last_served_patient).days
        rotation = _clamp(days / ROTATION_HORIZON_DAYS)
        served_txt = f"last helped this patient {days} days ago"

    if d.last_donation_date is None:
        rest = 1.0
    else:
        rested_beyond_gap = (on_date - d.last_donation_date).days - interval_days(d.sex, rules)
        rest = _clamp(rested_beyond_gap / REST_HORIZON_DAYS)

    load = 1.0 - _clamp(h.donations_last_365 / LOAD_CAP)

    show_rate = (h.donated_count + 1) / (h.assigned_count + 2)  # Laplace smoothing: new donors start at 0.5
    reliability = _clamp(show_rate - 0.15 * h.cancellations_90d - 0.10 * h.no_show_count)

    match = 1.0 if is_exact_match(d.blood_group, patient_group) else 0.5

    parts = {"rotation": rotation, "rest": rest, "load": load, "reliability": reliability, "match": match}
    breakdown = {k: round(v * WEIGHTS[k], 1) for k, v in parts.items()}
    score = round(sum(breakdown.values()), 1)
    explanation = f"{d.name.split()[0]} {served_txt}; {h.donations_last_365} donation(s) in the last year"
    return score, breakdown, explanation


def rank_circle(
    candidates: list[Candidate],
    patient_group: str,
    on_date: date,
    rules: Rules = DEFAULT_RULES,
    exclude_ids: set[int] | None = None,
) -> RotationResult:
    exclude_ids = exclude_ids or set()
    ranked: list[tuple[tuple, RankedDonor]] = []
    ineligible: list[RankedDonor] = []
    for c in candidates:
        if c.donor.id in exclude_ids:
            continue
        elig = check_eligibility(c.donor, on_date, patient_group, rules)
        score, breakdown, expl = score_candidate(c, patient_group, on_date, rules)
        rd = RankedDonor(c.donor.id, c.donor.name, score, breakdown, expl, elig)
        if elig.eligible:
            last = c.history.last_served_patient or date.min
            ranked.append(((-score, last, c.donor.id), rd))
        else:
            rd.score = 0.0
            ineligible.append(rd)
    ranked.sort(key=lambda t: t[0])
    ordered = [rd for _, rd in ranked]
    return RotationResult(
        confirmed=ordered[0] if ordered else None,
        backup=ordered[1] if len(ordered) > 1 else None,
        ranked=ordered,
        ineligible=ineligible,
    )


def forecast(
    candidates: list[Candidate],
    patient_group: str,
    dates: list[date],
    rules: Rules = DEFAULT_RULES,
) -> list[dict]:
    """Simulate the next N cycles assuming each confirmed donor donates as planned.

    Used to *show* fairness: the forecast table should visibly rotate through the circle.
    """
    sim = copy.deepcopy(candidates)
    by_id = {c.donor.id: c for c in sim}
    out = []
    for d in dates:
        res = rank_circle(sim, patient_group, d, rules)
        out.append({
            "date": d.isoformat(),
            "confirmed": {"donor_id": res.confirmed.donor_id, "name": res.confirmed.name, "score": res.confirmed.score} if res.confirmed else None,
            "backup": {"donor_id": res.backup.donor_id, "name": res.backup.name, "score": res.backup.score} if res.backup else None,
            "eligible_count": len(res.ranked),
        })
        if res.confirmed:
            c = by_id[res.confirmed.donor_id]
            c.donor.last_donation_date = d
            c.history.last_served_patient = d
            c.history.donations_last_365 += 1
            c.history.assigned_count += 1
            c.history.donated_count += 1
    return out
