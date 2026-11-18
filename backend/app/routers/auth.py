"""One login page for every role.

    POST /otp/request -> /otp/verify          (phone)
    POST /magic/request -> /magic/verify      (email)
    POST /google  (or /google/demo in demo mode)
                     │
                     ▼
     existing user ─► {status: signed_in, token, home: "/patient" | "/donor" | "/bank" | "/hospital"}
     new identity  ─► {status: needs_onboarding, onboarding_token}
                          └► POST /onboard {role: patient|donor, ...}
"""
from __future__ import annotations

import hashlib
import random
import string
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import SELF_SERVICE_ROLES, CircleMember, Donor, Hospital, Patient, User, utcnow
from ..security import ROLE_HOME, create_onboarding_token, create_session_token, current_user, decode
from ..services import auth_methods as am
from ..services.blood import BLOOD_GROUPS
from ..services.planning import fill_slots, plan_next, upcoming_appointment

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_view(u: User) -> dict:
    return {"id": u.id, "name": u.name, "role": u.role, "email": u.email, "phone": u.phone,
            "home": ROLE_HOME[u.role], "blood_bank_id": u.blood_bank_id, "hospital_id": u.hospital_id}


def signed_in(db: Session, user: User, method: str) -> dict:
    user.last_login_at = utcnow()
    user.last_login_method = method
    db.commit()
    return {"status": "signed_in", "token": create_session_token(user), "user": user_view(user), "home": ROLE_HOME[user.role]}


def resolve(db: Session, method: str, *, phone=None, email=None, google_sub=None, name=None) -> dict:
    user = am.find_user(db, phone=phone, email=email, google_sub=google_sub)
    if user:
        return signed_in(db, user, method)
    identity = {k: v for k, v in {"phone": phone, "email": email, "google_sub": google_sub, "name": name, "method": method}.items() if v}
    return {"status": "needs_onboarding", "onboarding_token": create_onboarding_token(identity), "identity": identity}


@router.get("/config")
def auth_config():
    return {
        "demo_mode": settings.demo_mode,
        "google_enabled": bool(settings.google_client_ids),
        "methods": ["otp", "magic_link", "google"],
        "self_service_roles": list(SELF_SERVICE_ROLES),
    }


class OtpRequest(BaseModel):
    phone: str


class OtpVerify(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=8)


@router.post("/otp/request")
def otp_request(body: OtpRequest, db: Session = Depends(get_db)):
    return am.request_otp(db, body.phone)


@router.post("/otp/verify")
def otp_verify(body: OtpVerify, db: Session = Depends(get_db)):
    phone = am.verify_otp(db, body.phone, body.code)
    return resolve(db, "otp", phone=phone)


class MagicRequest(BaseModel):
    email: str
    redirect: str | None = None  # e.g. Linking.createURL("magic") from the app


class MagicVerify(BaseModel):
    token: str


@router.post("/magic/request")
def magic_request(body: MagicRequest, db: Session = Depends(get_db)):
    return am.request_magic_link(db, body.email, body.redirect)


@router.post("/magic/verify")
def magic_verify(body: MagicVerify, db: Session = Depends(get_db)):
    email = am.verify_magic_link(db, body.token)
    return resolve(db, "magic_link", email=email)


class GoogleBody(BaseModel):
    credential: str


@router.post("/google")
def google(body: GoogleBody, db: Session = Depends(get_db)):
    info = am.verify_google_credential(body.credential)
    return resolve(db, "google", email=info["email"], google_sub=info["sub"], name=info["name"])


class GoogleDemoBody(BaseModel):
    email: str
    name: str = ""


@router.post("/google/demo")
def google_demo(body: GoogleDemoBody, db: Session = Depends(get_db)):
    """Simulated Google account chooser – only when no real client id is configured."""
    if not settings.demo_mode or settings.google_client_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not available")
    email = am.normalize_email(body.email)
    sub = "demo-" + hashlib.sha256(email.encode()).hexdigest()[:20]
    return resolve(db, "google", email=email, google_sub=sub, name=body.name or email.split("@")[0].title())


class DemoLogin(BaseModel):
    role: str


@router.post("/demo-login")
def demo_login(body: DemoLogin, db: Session = Depends(get_db)):
    """One-tap sign-in to the seeded showcase accounts (presentation only)."""
    if not settings.demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not available")
    from ..seed import DEMO_ACCOUNTS

    email = DEMO_ACCOUNTS.get(body.role)
    user = db.scalar(select(User).where(User.email == email)) if email else None
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo account not found – reset demo data")
    return signed_in(db, user, "demo")


class Onboard(BaseModel):
    onboarding_token: str
    role: str
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = None
    # patient family
    patient_name: str | None = None
    patient_blood_group: str | None = None
    cycle_days: int | None = Field(default=21, ge=7, le=90)
    last_transfusion_date: date | None = None
    hospital_id: int | None = None
    # donor
    blood_group: str | None = None
    sex: str | None = None
    date_of_birth: date | None = None
    weight_kg: float | None = Field(default=None, ge=30, le=250)
    lat: float | None = None
    lng: float | None = None
    area: str | None = None
    invite_code: str | None = None
    relation: str | None = None


def _invite_code(db: Session, name: str) -> str:
    base = "".join(c for c in name.upper() if c.isalpha())[:5] or "LIFE"
    while True:
        code = f"{base}-{''.join(random.choices(string.ascii_uppercase + string.digits, k=4))}"
        if not db.scalar(select(Patient.id).where(Patient.invite_code == code)):
            return code


def join_circle(db: Session, donor: Donor, code: str, relation: str | None) -> Patient:
    patient = db.scalar(select(Patient).where(Patient.invite_code == code.strip().upper()))
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No circle found for that invite code")
    if not db.scalar(select(CircleMember.id).where(CircleMember.patient_id == patient.id, CircleMember.donor_id == donor.id)):
        db.add(CircleMember(patient_id=patient.id, donor_id=donor.id, relation=relation or "Friend"))
        db.flush()
        db.refresh(patient)
        appt = upcoming_appointment(db, patient)
        if appt:
            fill_slots(db, appt)
    return patient


@router.post("/onboard")
def onboard(body: Onboard, db: Session = Depends(get_db)):
    ident = decode(body.onboarding_token, "onboarding")
    if body.role not in SELF_SERVICE_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Blood bank and hospital accounts are created by invitation only")
    if am.find_user(db, phone=ident.get("phone"), email=ident.get("email"), google_sub=ident.get("google_sub")):
        raise HTTPException(status.HTTP_409_CONFLICT, "Account already exists – please sign in")
    phone = ident.get("phone") or (am.normalize_phone(body.phone) if body.phone else None)
    if phone and db.scalar(select(User.id).where(User.phone == phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "That phone number is already registered")

    user = User(name=body.name.strip(), email=ident.get("email"), phone=phone, google_sub=ident.get("google_sub"), role=body.role)
    db.add(user)
    db.flush()

    if body.role == "patient":
        if not (body.patient_name and body.patient_blood_group in BLOOD_GROUPS and body.hospital_id):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Patient name, blood group and hospital are required")
        hospital = db.get(Hospital, body.hospital_id)
        if not hospital:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown hospital")
        p = Patient(family_user_id=user.id, name=body.patient_name.strip(), blood_group=body.patient_blood_group,
                    cycle_days=body.cycle_days or 21, last_transfusion_date=body.last_transfusion_date,
                    hospital_id=hospital.id, invite_code=_invite_code(db, body.patient_name))
        db.add(p)
        db.flush()
        db.refresh(p)
        plan_next(db, p, date.today())
    else:
        if not (body.blood_group in BLOOD_GROUPS and body.sex in ("M", "F") and body.date_of_birth and body.weight_kg and phone):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Blood group, sex, date of birth, weight and phone are required")
        donor = Donor(user_id=user.id, name=user.name, phone=phone, blood_group=body.blood_group, sex=body.sex,
                      date_of_birth=body.date_of_birth, weight_kg=body.weight_kg, verified=False,
                      lat=body.lat if body.lat is not None else 26.9124, lng=body.lng if body.lng is not None else 75.7873,
                      area=body.area or "")
        db.add(donor)
        db.flush()
        if body.invite_code:
            join_circle(db, donor, body.invite_code, body.relation)
    db.commit()
    return signed_in(db, user, ident.get("method", "otp"))


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_view(user)
