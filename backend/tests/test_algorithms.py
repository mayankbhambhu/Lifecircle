from datetime import date, timedelta

import pytest

from app.services.blood import can_donate_rbc, compatible_donor_groups
from app.services.eligibility import DonorFacts, check_eligibility
from app.services.geo import bounding_box, format_distance, haversine_km, next_ring, rank_by_distance
from app.services.inventory import classify
from app.services.rotation import Candidate, DonorHistory, forecast, rank_circle
from app.services.scheduler import next_transfusion_date, reminders_due

D = date(2026, 11, 18)


def donor(i=1, group="B+", sex="M", age=30, weight=70, last=None, deferred=None, available=True, verified=True, name=None):
    return DonorFacts(id=i, name=name or f"Donor {i}", blood_group=group, sex=sex, date_of_birth=date(D.year - age, 1, 1),
                      weight_kg=weight, last_donation_date=last, deferred_until=deferred, available=available, verified=verified)


# ---------------------------------------------------------------- blood groups
def test_abo_rh_compatibility():
    assert can_donate_rbc("O-", "AB+") and can_donate_rbc("O-", "B-")
    assert can_donate_rbc("B-", "B+") and not can_donate_rbc("B+", "B-")
    assert not can_donate_rbc("A+", "B+")
    assert compatible_donor_groups("O-") == ["O-"]
    assert len(compatible_donor_groups("AB+")) == 8


# ---------------------------------------------------------------- eligibility
def test_fresh_adult_is_eligible():
    r = check_eligibility(donor(), D, "B+")
    assert r.eligible and r.next_eligible_date == D


def test_interval_male_90_female_120():
    assert not check_eligibility(donor(last=D - timedelta(days=89)), D).eligible
    assert check_eligibility(donor(last=D - timedelta(days=90)), D).eligible
    r = check_eligibility(donor(sex="F", last=D - timedelta(days=100)), D)
    assert not r.eligible and r.next_eligible_date == D + timedelta(days=20)


def test_collects_all_reasons():
    r = check_eligibility(donor(group="A+", weight=40, age=17), D, "B+")
    assert not r.eligible
    assert len(r.reasons) == 3
    assert r.next_eligible_date is None  # weight/compatibility can't be fixed by waiting


def test_deferral_and_age_limits():
    r = check_eligibility(donor(deferred=D + timedelta(days=5)), D)
    assert not r.eligible and r.next_eligible_date == D + timedelta(days=6)
    assert not check_eligibility(donor(age=66), D).eligible


def test_unverified_only_matters_when_required():
    d = donor(verified=False)
    assert check_eligibility(d, D).eligible
    assert not check_eligibility(d, D, require_verified=True).eligible


# ---------------------------------------------------------------- rotation
def circle():
    return [
        Candidate(donor(1, name="Amit A"), DonorHistory(last_served_patient=D - timedelta(days=160), donations_last_365=1, assigned_count=3, donated_count=3)),
        Candidate(donor(2, sex="F", name="Priya P", last=D - timedelta(days=125)), DonorHistory(last_served_patient=D - timedelta(days=125), donations_last_365=2, assigned_count=2, donated_count=2)),
        Candidate(donor(3, name="Vikram V", last=D - timedelta(days=10)), DonorHistory(last_served_patient=D - timedelta(days=10), donations_last_365=3)),
        Candidate(donor(4, group="A+", name="Kabir K")),
    ]


def test_rotation_filters_ineligible_and_explains():
    res = rank_circle(circle(), "B+", D)
    assert res.confirmed.name == "Amit A"
    assert res.backup.name == "Priya P"
    assert {r.name for r in res.ineligible} == {"Vikram V", "Kabir K"}
    assert set(res.confirmed.breakdown) == {"rotation", "rest", "load", "reliability", "match"}
    assert 0 < res.confirmed.score <= 100


def test_never_served_donor_goes_first():
    c = circle() + [Candidate(donor(5, name="New N"))]
    assert rank_circle(c, "B+", D).confirmed.name == "New N"


def test_cancellations_reduce_priority():
    a = Candidate(donor(1, name="Flaky F"), DonorHistory(cancellations_90d=3))
    b = Candidate(donor(2, name="Steady S"), DonorHistory())
    assert rank_circle([a, b], "B+", D).confirmed.name == "Steady S"


def test_forecast_rotates_through_circle():
    c = [Candidate(donor(i, name=f"D{i}")) for i in range(1, 5)]
    plan = forecast(c, "B+", [D + timedelta(days=21 * k) for k in range(4)])
    confirmed = [p["confirmed"]["name"] for p in plan]
    assert len(set(confirmed)) == 4  # nobody asked twice before everyone has been asked once


def test_exclusions_respected():
    assert rank_circle(circle(), "B+", D, exclude_ids={1}).confirmed.name == "Priya P"


# ---------------------------------------------------------------- geo
def test_haversine_known_distance():
    # Jaipur -> Delhi is ~ 236 km as the crow flies
    assert 230 < haversine_km(26.9124, 75.7873, 28.6139, 77.2090) < 242


def test_bounding_box_contains_radius():
    lat, lng = 26.9, 75.8
    mnlat, mxlat, mnlng, mxlng = bounding_box(lat, lng, 10)
    assert haversine_km(lat, lng, mxlat, lng) == pytest.approx(10, rel=0.01)
    assert haversine_km(lat, lng, lat, mxlng) == pytest.approx(10, rel=0.01)


def test_rank_by_distance_and_radius():
    pts = {"far": (27.10, 75.79), "near": (26.93, 75.79), "mid": (26.96, 75.79)}
    ranked = rank_by_distance((26.9124, 75.7873), pts, lambda k: pts[k], radius_km=10)
    assert [r.item for r in ranked] == ["near", "mid"]
    assert ranked[0].label.endswith("km")


def test_format_and_rings():
    assert format_distance(2.43) == "2.4 km"
    assert format_distance(0.42) == "420 m"
    assert next_ring(None) == 5 and next_ring(5) == 10 and next_ring(50) is None


# ---------------------------------------------------------------- scheduling
def test_next_date_and_overdue():
    assert next_transfusion_date(D - timedelta(days=12), 21, D) == (D + timedelta(days=9), False)
    assert next_transfusion_date(D - timedelta(days=30), 21, D) == (D, True)
    with pytest.raises(ValueError):
        next_transfusion_date(D, 3, D)


def test_reminder_windows():
    t = D + timedelta(days=3)
    assert reminders_due(t, "confirmed", D) == ["t_minus_7", "t_minus_3"]
    assert reminders_due(t, "backup", D) == ["standby_3"]
    assert reminders_due(D - timedelta(days=1), "confirmed", D) == []


# ---------------------------------------------------------------- stock
def test_stock_classification():
    assert classify(3, 8, 1.0)[0] == "critical"
    assert classify(18, 25, 5.0)[0] == "low"
    assert classify(42, 30, 6.0) == ("healthy", 7.0)
    assert classify(40, 30, 25.0)[0] == "critical"  # plenty of units but < 2 days of cover
