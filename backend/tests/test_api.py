"""End-to-end API tests over the seeded demo world."""
import re
from datetime import date, timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Donor, UrgentAlert, UrgentRequest, User

from .conftest import login

TODAY = date.today()


def all_donor_phones():
    with SessionLocal() as db:
        return [p for p in db.scalars(select(Donor.phone))]


def digits(p):
    return re.sub(r"\D", "", p)


# ---------------------------------------------------------------- auth
def test_otp_login_existing_user_routes_by_role(client):
    r = client.post("/api/auth/otp/request", json={"phone": "98000 00003"})
    assert r.status_code == 200
    code = r.json()["dev_code"]
    bad = client.post("/api/auth/otp/verify", json={"phone": "9800000003", "code": "000000" if code != "000000" else "111111"})
    assert bad.status_code == 400 and "attempt" in bad.json()["detail"]
    ok = client.post("/api/auth/otp/verify", json={"phone": "+91 98000 00003", "code": code}).json()
    assert ok["status"] == "signed_in" and ok["user"]["role"] == "blood_bank" and ok["home"] == "/bank"
    # code is single use
    assert client.post("/api/auth/otp/verify", json={"phone": "9800000003", "code": code}).status_code == 400


def test_otp_resend_cooldown_and_lockout(client):
    client.post("/api/auth/otp/request", json={"phone": "9811111111"})
    assert client.post("/api/auth/otp/request", json={"phone": "9811111111"}).status_code == 429


def test_magic_link_new_user_onboards_as_donor(client):
    r = client.post("/api/auth/magic/request", json={"email": "New.Donor@Example.com"}).json()
    token = r["dev_link"].split("token=")[1]
    res = client.post("/api/auth/magic/verify", json={"token": token}).json()
    assert res["status"] == "needs_onboarding"
    assert client.post("/api/auth/magic/verify", json={"token": token}).status_code == 400  # single use
    body = {"onboarding_token": res["onboarding_token"], "role": "donor", "name": "Neel Kapoor", "phone": "9822222222",
            "blood_group": "B+", "sex": "M", "date_of_birth": "1995-04-02", "weight_kg": 70, "invite_code": "aarav-7q2k", "relation": "Friend"}
    out = client.post("/api/auth/onboard", json=body).json()
    assert out["status"] == "signed_in" and out["user"]["role"] == "donor"
    fam = login(client, "patient")
    circle = client.get("/api/family/overview", headers=fam).json()["patients"][0]["circle"]
    assert any(c["display_name"] == "Neel K." for c in circle)


def test_staff_roles_are_invite_only(client):
    res = client.post("/api/auth/google/demo", json={"email": "someone@example.com"}).json()
    assert res["status"] == "needs_onboarding"
    r = client.post("/api/auth/onboard", json={"onboarding_token": res["onboarding_token"], "role": "blood_bank", "name": "Mallory"})
    assert r.status_code == 403


def test_google_demo_links_existing_email(client):
    res = client.post("/api/auth/google/demo", json={"email": "neha@lifecircle.demo"}).json()
    assert res["status"] == "signed_in" and res["user"]["role"] == "patient"


# ---------------------------------------------------------------- RBAC
def test_role_guards(client, as_role):
    fam, donor, bank, hosp = (as_role(r) for r in ("patient", "donor", "blood_bank", "hospital"))
    assert client.get("/api/bank/queue").status_code == 401
    assert client.get("/api/bank/queue", headers=fam).status_code == 403
    assert client.get("/api/bank/donors", headers=donor).status_code == 403
    assert client.get("/api/bank/donors", headers=hosp).status_code == 403
    assert client.get("/api/family/overview", headers=bank).status_code == 403
    assert client.get("/api/donor/overview", headers=fam).status_code == 403
    assert client.get("/api/hospital/overview", headers=donor).status_code == 403


def test_family_cannot_touch_other_patients(client, as_role):
    fam = as_role("patient")
    # patient 2 belongs to another family
    assert client.put("/api/family/patients/2/cycle", json={"cycle_days": 30}, headers=fam).status_code == 404
    assert client.post("/api/family/patients/2/urgent", json={"reason": "test", "needed_by": TODAY.isoformat()}, headers=fam).status_code == 404


# ---------------------------------------------------------------- privacy
def test_phone_numbers_never_reach_family_or_hospital(client, as_role):
    phones = {digits(p)[-10:] for p in all_donor_phones()}
    for role, url in (("patient", "/api/family/overview"), ("hospital", "/api/hospital/overview")):
        raw = digits(client.get(url, headers=as_role(role)).text)
        leaked = [p for p in phones if p in raw]
        assert not leaked, f"{role} response leaked donor phones: {leaked}"


def test_staff_see_phones_and_access_is_audited(client, as_role):
    bank = as_role("blood_bank")
    donors = client.get("/api/bank/donors?group=B%2B", headers=bank).json()
    assert donors and all("phone" in d for d in donors)
    audit = client.get("/api/bank/audit", headers=bank).json()
    assert audit[0]["action"] == "view_donor_directory"


def test_family_sees_status_not_medical_reasons(client, as_role):
    circle = client.get("/api/family/overview", headers=as_role("patient")).json()["patients"][0]["circle"]
    for c in circle:
        assert "reasons" not in c["eligibility"] and "label" in c["eligibility"]
        assert "phone" not in c and c["contact"].startswith("Hidden")


def test_external_donor_does_not_learn_patient_name(client, as_role):
    alerts = client.get("/api/donor/overview", headers=as_role("donor")).json()["alerts"]
    assert alerts and all("Ishaan" not in a["patient"] for a in alerts)


# ---------------------------------------------------------------- planned mode
def test_dashboard_shows_confirmed_and_backup(client, as_role):
    p = client.get("/api/family/overview", headers=as_role("patient")).json()["patients"][0]
    assert p["next"]["confirmed"]["display_name"] == "Amit S."
    assert p["next"]["backup"]["display_name"] == "Priya M."
    assert p["next"]["days_until"] == 9
    assert len(p["forecast"]) == 6


def test_cancel_promotes_backup(client, as_role):
    amit = as_role("donor_confirmed")
    slot = client.get("/api/donor/overview", headers=amit).json()["upcoming"][0]
    r = client.post(f"/api/donor/assignments/{slot['assignment_id']}/cancel", json={"reason": "Fever"}, headers=amit).json()
    assert r["promoted"] is not None and r["urgent_request_id"] is None
    nxt = client.get("/api/family/overview", headers=as_role("patient")).json()["patients"][0]["next"]
    assert nxt["confirmed"]["display_name"] == "Priya M."


def test_cycle_change_replans(client, as_role):
    fam = as_role("patient")
    r = client.put("/api/family/patients/1/cycle", json={"cycle_days": 28}, headers=fam).json()
    assert r["next_date"] == (TODAY - timedelta(days=12) + timedelta(days=28)).isoformat()


def test_daily_log_and_complete_rolls_cycle(client, as_role):
    bank = as_role("blood_bank")
    log = client.get(f"/api/bank/log?day={TODAY.isoformat()}", headers=bank).json()
    row = next(r for r in log["rows"] if r["slot"] == "confirmed")
    low_hb = client.post("/api/bank/log", headers=bank, json={"date": TODAY.isoformat(), "outcome": "donated", "assignment_id": row["assignment_id"], "hemoglobin": 11.0})
    assert low_hb.status_code == 422
    before = {s["blood_group"]: s["units"] for s in client.get("/api/bank/inventory", headers=bank).json()["stock"]}
    ok = client.post("/api/bank/log", headers=bank, json={"date": TODAY.isoformat(), "outcome": "donated", "assignment_id": row["assignment_id"], "hemoglobin": 13.4})
    assert ok.status_code == 200
    after = {s["blood_group"]: s["units"] for s in client.get("/api/bank/inventory", headers=bank).json()["stock"]}
    assert after[row["donor"]["blood_group"]] == before[row["donor"]["blood_group"]] + 1
    assert client.post("/api/bank/log", headers=bank, json={"date": TODAY.isoformat(), "outcome": "donated", "assignment_id": row["assignment_id"]}).status_code == 409
    done = client.post(f"/api/bank/appointments/{row['appointment_id']}/complete", headers=bank).json()
    assert done["next_date"] == (TODAY + timedelta(days=28)).isoformat()


# ---------------------------------------------------------------- urgent mode
def test_urgent_first_accept_wins(client, as_role):
    with SessionLocal() as db:
        req = db.scalar(select(UrgentRequest).where(UrgentRequest.status == "broadcast"))
        alerts = [(a.id, db.get(User, a.donor.user_id)) for a in req.alerts if a.donor.user_id]
    assert len(alerts) >= 2
    tokens = []
    for _, u in alerts[:2]:
        code = client.post("/api/auth/otp/request", json={"phone": u.phone}).json()["dev_code"]
        tokens.append(client.post("/api/auth/otp/verify", json={"phone": u.phone, "code": code}).json()["token"])
    r1 = client.post(f"/api/donor/alerts/{alerts[0][0]}/accept", headers={"Authorization": f"Bearer {tokens[0]}"})
    r2 = client.post(f"/api/donor/alerts/{alerts[1][0]}/accept", headers={"Authorization": f"Bearer {tokens[1]}"})
    assert r1.status_code == 200 and r2.status_code == 409
    with SessionLocal() as db:
        req = db.get(UrgentRequest, req.id)
        assert req.status == "filled"
        assert {a.status for a in req.alerts} <= {"accepted", "closed"}


def test_donor_cannot_accept_someone_elses_alert(client, as_role):
    with SessionLocal() as db:
        other = db.scalar(select(UrgentAlert).join(Donor).where(Donor.name != "Priya Mehta"))
    assert client.post(f"/api/donor/alerts/{other.id}/accept", headers=as_role("donor")).status_code == 404


def test_family_urgent_goes_to_bank_queue_and_escalates(client, as_role):
    fam, bank = as_role("patient"), as_role("blood_bank")
    r = client.post("/api/family/patients/1/urgent", headers=fam,
                    json={"reason": "Hb dropped to 6.2", "units": 1, "needed_by": (TODAY + timedelta(days=1)).isoformat()})
    assert r.status_code == 200
    rid = r.json()["id"]
    q = client.get("/api/bank/queue", headers=bank).json()
    mine = next(u for u in q["urgent"] if u["id"] == rid)
    assert mine["source"] == "family" and all("phone" in a for a in mine["alerts"])
    out = client.post(f"/api/bank/urgent/{rid}/approve", headers=bank).json()
    assert out["status"] in ("broadcast", "no_match")
    if out["status"] == "broadcast":
        q = client.get("/api/bank/queue", headers=bank).json()
        dists = [a["distance_km"] for a in next(u for u in q["urgent"] if u["id"] == rid)["alerts"] if not a["in_circle"]]
        assert dists == sorted(dists) and max(dists) <= out["radius_km"]


def test_fulfil_from_stock(client, as_role):
    bank = as_role("blood_bank")
    rid = next(u for u in client.get("/api/bank/queue", headers=bank).json()["urgent"] if u["status"] == "broadcast")["id"]
    r = client.post(f"/api/bank/urgent/{rid}/fulfil-stock", headers=bank).json()
    assert r["issued_group"] == "B+"


# ---------------------------------------------------------------- stock alerts
def test_stock_alerts_and_rally(client, as_role):
    bank, hosp = as_role("blood_bank"), as_role("hospital")
    alerts = client.get("/api/bank/inventory", headers=bank).json()["alerts"]
    assert [a["blood_group"] for a in alerts if a["status"] == "critical"][:2] == ["AB-", "O-"]
    assert client.get("/api/hospital/overview", headers=hosp).json()["stock_alerts"]
    # pushing a group below threshold raises a notification for staff
    client.put("/api/bank/inventory/A%2B", headers=bank, json={"units": 4})
    notes = client.get("/api/notifications", headers=bank).json()["items"]
    assert any("A+" in n["title"] and "CRITICAL" in n["title"] for n in notes)
    r = client.post("/api/bank/inventory/O%2B/rally", headers=bank)
    assert r.status_code == 200
    assert client.post("/api/bank/inventory/O%2B/rally", headers=bank).status_code == 409  # 24h cooldown


def test_scheduler_tick_sends_reminders_once(client, as_role):
    bank = as_role("blood_bank")
    first = client.post("/api/system/tick", headers=bank).json()["reminders_sent"]
    second = client.post("/api/system/tick", headers=bank).json()["reminders_sent"]
    assert second == 0 and first >= 0


def test_magic_link_opens_the_app_and_rejects_foreign_targets(client):
    ok = client.post("/api/auth/magic/request", json={"email": "a@example.com", "redirect": "exp://192.168.1.4:8081/--/magic"}).json()
    assert ok["dev_link"].startswith("exp://192.168.1.4:8081/--/magic?token=")
    default = client.post("/api/auth/magic/request", json={"email": "b@example.com"}).json()
    assert default["dev_link"].startswith("lifecircle://magic?token=")
    bad = client.post("/api/auth/magic/request", json={"email": "c@example.com", "redirect": "https://evil.example/steal"})
    assert bad.status_code == 422
