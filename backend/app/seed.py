"""Demo data, generated relative to *today* so the showcase is always fresh.

All people and organisations here are fictional.

Story it sets up
* Aarav (B+, every 21 days) – circle of 7. Fair rotation picks Amit (confirmed) + Priya (backup).
* Zoya  (O+, every 28 days) – transfusion is TODAY: staff can log the screening and complete
  the cycle, and watch the next one get planned automatically.
* Ishaan (B+, every 21 days) – his only eligible donor cancelled, there was no backup, so
  Urgent mode is live: circle had nobody eligible -> broadcast to verified donors within 5 km.
  Priya (2.4 km away) has the alert on her donor dashboard.
* City Blood Centre is critically low on O-, AB- and low on B-, B+.
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import (
    Appointment, BloodBank, CircleMember, DonationLog, Donor, Hospital, Inventory, Notification, Patient, User,
)
from .services import inventory as inv
from .services.planning import active_slot, cancel_assignment, plan_next

DEMO_ACCOUNTS = {
    "patient": "neha@lifecircle.demo",
    "donor": "priya@lifecircle.demo",
    "donor_confirmed": "amit@lifecircle.demo",
    "blood_bank": "staff@citybloodcentre.demo",
    "hospital": "ward@sunrisehospital.demo",
}

BANK_LAT, BANK_LNG = 26.9124, 75.7873  # demo city centre
KM_LAT = 1 / 111.2


def _at(km_north: float, km_east: float, lat=BANK_LAT, lng=BANK_LNG) -> tuple[float, float]:
    import math
    return lat + km_north * KM_LAT, lng + km_east / (111.2 * math.cos(math.radians(lat)))


def reset_and_seed() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed()


def seed_if_empty() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            return
    seed()


def seed() -> None:
    today = date.today()
    rnd = random.Random(42)
    db = SessionLocal()
    try:
        bank1 = BloodBank(name="City Blood Centre", city="Jaipur", lat=BANK_LAT, lng=BANK_LNG, phone="+911412000100")
        lat2, lng2 = _at(-7, 3)
        bank2 = BloodBank(name="Lakeside Regional Blood Bank", city="Jaipur", lat=lat2, lng=lng2, phone="+911412000200")
        db.add_all([bank1, bank2])
        db.flush()
        h1 = Hospital(name="Sunrise Children's Hospital", city="Jaipur", lat=BANK_LAT - 0.006, lng=BANK_LNG + 0.008, blood_bank_id=bank1.id)
        h2 = Hospital(name="Lakeside General Hospital", city="Jaipur", lat=lat2 + 0.004, lng=lng2, blood_bank_id=bank2.id)
        db.add_all([h1, h2])
        db.flush()

        staff = User(name="Dr. Meera Kapoor", email=DEMO_ACCOUNTS["blood_bank"], phone="+919800000003", role="blood_bank", blood_bank_id=bank1.id)
        staff2 = User(name="Anil Joshi", email="staff@lakeside.demo", phone="+919800000013", role="blood_bank", blood_bank_id=bank2.id)
        ward = User(name="Ravi Menon", email=DEMO_ACCOUNTS["hospital"], phone="+919800000004", role="hospital", hospital_id=h1.id)
        fam1 = User(name="Neha Sharma", email=DEMO_ACCOUNTS["patient"], phone="+919800000001", role="patient")
        fam2 = User(name="Imran Khan", email="imran@lifecircle.demo", phone="+919800000011", role="patient")
        fam3 = User(name="Sunita Verma", email="sunita@lifecircle.demo", phone="+919800000012", role="patient")
        db.add_all([staff, staff2, ward, fam1, fam2, fam3])
        db.flush()

        aarav = Patient(family_user_id=fam1.id, name="Aarav Sharma", blood_group="B+", cycle_days=21, hospital_id=h1.id,
                        last_transfusion_date=today - timedelta(days=12), invite_code="AARAV-7Q2K")
        zoya = Patient(family_user_id=fam2.id, name="Zoya Khan", blood_group="O+", cycle_days=28, hospital_id=h1.id,
                       last_transfusion_date=today - timedelta(days=28), invite_code="ZOYA-4M8T")
        ishaan = Patient(family_user_id=fam3.id, name="Ishaan Verma", blood_group="B+", cycle_days=21, hospital_id=h1.id,
                         last_transfusion_date=today - timedelta(days=19), invite_code="ISHAA-9C3D")
        db.add_all([aarav, zoya, ishaan])
        db.flush()

        phone_seq = iter(range(100, 999))

        def donor(name, group, sex, age, km_n, km_e, area, *, email=None, phone=None, verified=True, user=True, weight=None):
            lat, lng = _at(km_n, km_e)
            phone = phone or f"+9198100{next(phone_seq):05d}"
            u = None
            if user:
                u = User(name=name, email=email, phone=phone, role="donor")
                db.add(u)
                db.flush()
            d = Donor(user_id=u.id if u else None, name=name, phone=phone, blood_group=group, sex=sex,
                      date_of_birth=date(today.year - age, rnd.randint(1, 12), rnd.randint(1, 28)),
                      weight_kg=weight or rnd.randint(52, 88), verified=verified, lat=lat, lng=lng, area=area,
                      last_hemoglobin=round(rnd.uniform(12.8, 15.5), 1))
            db.add(d)
            db.flush()
            return d

        def gave(d: Donor, days_ago: int, patient: Patient | None = None, bank: BloodBank = bank1):
            day = today - timedelta(days=days_ago)
            db.add(DonationLog(donor_id=d.id, blood_bank_id=bank.id, patient_id=patient.id if patient else None,
                               date=day, outcome="donated", hemoglobin=d.last_hemoglobin, logged_by_user_id=staff.id))
            if not d.last_donation_date or d.last_donation_date < day:
                d.last_donation_date = day

        def member(p: Patient, d: Donor, relation: str):
            db.add(CircleMember(patient_id=p.id, donor_id=d.id, relation=relation))

        # ---- Aarav's circle (B+)
        amit = donor("Amit Sharma", "B+", "M", 34, 3.6, 2.0, "Malviya Nagar", email=DEMO_ACCOUNTS["donor_confirmed"], phone="+919800000002")
        priya = donor("Priya Mehta", "B+", "F", 29, 2.4, 0.1, "C-Scheme", email=DEMO_ACCOUNTS["donor"], phone="+919800000005")
        rahul = donor("Rahul Sharma", "B-", "M", 26, -4.0, 5.5, "Jagatpura")
        vikram = donor("Vikram Singh", "B+", "M", 41, 1.2, -2.2, "Bani Park")
        sneha = donor("Sneha Gupta", "O+", "F", 37, -1.5, -3.1, "Sodala")
        deepak = donor("Deepak Joshi", "B+", "M", 45, 6.1, 1.0, "Shastri Nagar")
        kabir = donor("Kabir Ahmed", "A+", "M", 31, 0.8, 4.4, "Raja Park")
        for d, rel in [(amit, "Uncle"), (priya, "Family friend"), (rahul, "Cousin"), (vikram, "Neighbour"),
                       (sneha, "Aunt"), (deepak, "Father's colleague"), (kabir, "Friend")]:
            member(aarav, d, rel)
        gave(vikram, 12, aarav); gave(deepak, 33, aarav); gave(rahul, 54, aarav); gave(sneha, 75, aarav)
        gave(priya, 124, aarav); gave(amit, 159, aarav); gave(vikram, 180, aarav); gave(deepak, 201, aarav)
        for i, days in enumerate((12, 33, 54, 75, 96, 117)):
            db.add(Appointment(patient_id=aarav.id, blood_bank_id=bank1.id, date=today - timedelta(days=days), status="completed"))

        # ---- Zoya's circle (O+) – transfusion today
        sana = donor("Sana Qureshi", "O-", "F", 33, -2.2, 1.4, "Lalkothi")
        ayesha = donor("Ayesha Khan", "O+", "F", 24, -0.9, 2.6, "Tonk Road")
        farhan = donor("Farhan Ali", "O+", "M", 39, 1.9, 3.3, "Adarsh Nagar")
        imtiyaz = donor("Imtiyaz Hussain", "A+", "M", 48, -3.5, -1.0, "Gopalpura")
        for d, rel in [(sana, "Cousin"), (ayesha, "Sister"), (farhan, "Uncle"), (imtiyaz, "Neighbour")]:
            member(zoya, d, rel)
        gave(farhan, 28, zoya); gave(sana, 130, zoya)

        # ---- Ishaan's circle (B+) – only Rohit is eligible
        rohit = donor("Rohit Verma", "B+", "M", 30, 4.8, -1.6, "Vidhyadhar Nagar")
        deepa = donor("Deepa Verma", "O+", "F", 35, 5.2, -0.4, "Vidhyadhar Nagar")
        arjun = donor("Arjun Rathore", "B+", "M", 27, 3.0, -4.0, "Jhotwara")
        for d, rel in [(rohit, "Father"), (deepa, "Mother"), (arjun, "Cousin")]:
            member(ishaan, d, rel)
        gave(rohit, 100, ishaan); gave(deepa, 60, ishaan); gave(arjun, 19, ishaan)

        # ---- the wider donor community (fictional names, random but reproducible)
        first = ["Aditi", "Rohan", "Kiran", "Manish", "Pooja", "Siddharth", "Nisha", "Yash", "Tanvi", "Harsh", "Ritika", "Gaurav",
                 "Meghna", "Kunal", "Shreya", "Varun", "Anjali", "Nikhil", "Divya", "Aman", "Simran", "Tarun", "Bhavna", "Ankit",
                 "Ira", "Mohit", "Lata", "Suresh", "Rekha", "Dev"]
        last = ["Agarwal", "Saxena", "Chauhan", "Bansal", "Mathur", "Jain", "Kumawat", "Shekhawat", "Pareek", "Goyal"]
        areas = ["Vaishali Nagar", "Mansarovar", "Raja Park", "Civil Lines", "Sanganer", "Pratap Nagar", "Nirman Nagar", "Durgapura"]
        groups = ["B+"] * 32 + ["O+"] * 29 + ["A+"] * 21 + ["AB+"] * 8 + ["O-"] * 3 + ["B-"] * 3 + ["A-"] * 2 + ["AB-"] * 2
        for i, fn in enumerate(first):
            sex = "F" if fn in {"Aditi", "Pooja", "Nisha", "Tanvi", "Ritika", "Meghna", "Shreya", "Anjali", "Divya", "Simran", "Bhavna", "Ira", "Lata", "Rekha"} else "M"
            r = rnd.uniform(1.0, 22.0)
            ang = rnd.uniform(0, 6.283)
            import math
            d = donor(f"{fn} {rnd.choice(last)}", rnd.choice(groups), sex, rnd.randint(19, 58), r * math.sin(ang), r * math.cos(ang),
                      rnd.choice(areas), verified=rnd.random() < 0.82, user=rnd.random() < 0.85)
            roll = rnd.random()
            if roll < 0.55:
                gave(d, rnd.randint(20, 320))
            if rnd.random() < 0.08:
                d.available = False

        # ---- stock
        stock1 = {"O-": (3, 8, 1.0), "O+": (42, 30, 6.0), "A-": (9, 6, 0.8), "A+": (30, 20, 4.0),
                  "B-": (5, 8, 0.8), "B+": (18, 25, 5.0), "AB-": (2, 4, 0.3), "AB+": (14, 8, 1.5)}
        stock2 = {"O-": (11, 8, 1.0), "O+": (55, 30, 6.0), "A-": (7, 6, 0.8), "A+": (26, 20, 4.0),
                  "B-": (9, 8, 0.8), "B+": (40, 25, 5.0), "AB-": (6, 4, 0.3), "AB+": (12, 8, 1.5)}
        for bank, stock in ((bank1, stock1), (bank2, stock2)):
            for g, (u, m, use) in stock.items():
                row = Inventory(blood_bank_id=bank.id, blood_group=g, units=u, min_threshold=m, daily_usage=use, last_status="healthy")
                db.add(row)
                db.flush()
                inv.refresh_status(db, row)  # raises the initial shortage alerts
        db.commit()

        # ---- run the real planner (this is the same code path production uses)
        for p in (aarav, zoya, ishaan):
            db.refresh(p)
            plan_next(db, p, today)
        db.commit()

        z = plan_next(db, zoya, today)
        z.status = "scheduled"
        for s in z.assignments:
            if s.status == "pending":
                s.status = "attending"
        a = plan_next(db, aarav, today)
        a.status = "scheduled"
        conf = active_slot(a, "confirmed")
        if conf:
            conf.status = "attending"
        db.commit()

        i = plan_next(db, ishaan, today)
        rohit_slot = active_slot(i, "confirmed")
        if rohit_slot:
            cancel_assignment(db, rohit_slot, "Called away for work travel")
        db.commit()

        # Clean slate for the bell icon on first login: keep the latest notifications only.
        for n in db.scalars(select(Notification)).all():
            n.read = n.kind in ("assignment", "queue", "planned") and n.user_id not in (fam1.id,)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    reset_and_seed()
    print("Seeded demo data.")
