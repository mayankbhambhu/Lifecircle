"""Passwordless sign-in: phone OTP, email magic link, Google.

All three end the same way: we know a verified identity (phone / email / Google
account). If it belongs to an existing user we issue a session and the frontend
routes by role. Otherwise we issue a short-lived *onboarding token* and the user
picks a role (patient family or donor – staff roles are invite-only).

Security choices
* OTP and magic-link secrets are stored only as HMAC-SHA256 hashes.
* OTP: 6 digits, 5 min expiry, 5 wrong attempts burns the code, 30 s resend cooldown.
* Magic link: 256-bit random token, 15 min expiry, single use.
* Google: ID token verified by Google's tokeninfo endpoint; `aud` must equal our
  client id and the email must be verified.
* Responses never reveal whether a phone/email already has an account.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import urllib.parse
import urllib.request
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import MagicLink, OtpCode, User, utcnow


def _hash(secret: str) -> str:
    return hmac.new(settings.secret_key.encode(), secret.encode(), hashlib.sha256).hexdigest()


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "91" + digits
    if not (11 <= len(digits) <= 15):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Enter a valid mobile number")
    return "+" + digits


def normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Enter a valid email address")
    return email


# ---------------------------------------------------------------- delivery
class ConsoleSender:
    """Stand-in for an SMS gateway / email provider (Twilio, MSG91, SES, ...)."""

    def send_sms(self, phone: str, text: str) -> None:
        print(f"[SMS to {phone}] {text}")

    def send_email(self, email: str, subject: str, text: str) -> None:
        print(f"[EMAIL to {email}] {subject}\n{text}")


sender = ConsoleSender()


# ---------------------------------------------------------------- OTP
def request_otp(db: Session, raw_phone: str) -> dict:
    phone = normalize_phone(raw_phone)
    now = utcnow()
    last = db.scalar(select(OtpCode).where(OtpCode.phone == phone).order_by(OtpCode.created_at.desc()))
    if last and (now - last.created_at).total_seconds() < settings.otp_resend_seconds:
        wait = settings.otp_resend_seconds - int((now - last.created_at).total_seconds())
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Please wait {wait}s before requesting another code")
    for old in db.scalars(select(OtpCode).where(OtpCode.phone == phone, OtpCode.consumed.is_(False))):
        old.consumed = True
    code = f"{secrets.randbelow(10**6):06d}"
    db.add(OtpCode(phone=phone, code_hash=_hash(f"{phone}:{code}"), expires_at=now + timedelta(seconds=settings.otp_ttl_seconds)))
    db.commit()
    sender.send_sms(phone, f"{code} is your LifeCircle code. It expires in 5 minutes. Never share it.")
    out = {"sent": True, "phone": phone, "expires_in": settings.otp_ttl_seconds, "resend_in": settings.otp_resend_seconds}
    if settings.demo_mode:
        out["dev_code"] = code
    return out


def verify_otp(db: Session, raw_phone: str, code: str) -> str:
    phone = normalize_phone(raw_phone)
    otp = db.scalar(
        select(OtpCode).where(OtpCode.phone == phone, OtpCode.consumed.is_(False)).order_by(OtpCode.created_at.desc())
    )
    if not otp or otp.expires_at < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code expired – request a new one")
    if otp.attempts >= settings.otp_max_attempts:
        otp.consumed = True
        db.commit()
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts – request a new code")
    if not hmac.compare_digest(otp.code_hash, _hash(f"{phone}:{(code or '').strip()}")):
        otp.attempts += 1
        left = settings.otp_max_attempts - otp.attempts
        if left <= 0:
            otp.consumed = True
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Incorrect code – {left} attempt(s) left" if left else "Too many attempts – request a new code")
    otp.consumed = True
    db.commit()
    return phone


# ---------------------------------------------------------------- magic link
def safe_app_link(redirect: str | None) -> str:
    """Where the emailed link should open. Only our own app scheme is trusted; Expo Go's
    exp:// links are allowed in demo mode so the flow works without a custom build."""
    if not redirect:
        return settings.app_link
    allowed = ("lifecircle://",) + (("exp://", "exps://") if settings.demo_mode else ())
    if not redirect.startswith(allowed) or any(c in redirect for c in "?#"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unsupported sign-in link target")
    return redirect


def request_magic_link(db: Session, raw_email: str, redirect: str | None = None) -> dict:
    email = normalize_email(raw_email)
    base = safe_app_link(redirect)
    token = secrets.token_urlsafe(32)
    db.add(MagicLink(email=email, token_hash=_hash(token), expires_at=utcnow() + timedelta(seconds=settings.magic_ttl_seconds)))
    db.commit()
    link = f"{base}?token={token}"
    sender.send_email(email, "Your LifeCircle sign-in link", f"Tap to sign in (valid 15 minutes, single use):\n{link}")
    out = {"sent": True, "email": email, "expires_in": settings.magic_ttl_seconds}
    if settings.demo_mode:
        out["dev_link"] = link
        out["dev_token"] = token
    return out


def verify_magic_link(db: Session, token: str) -> str:
    row = db.scalar(select(MagicLink).where(MagicLink.token_hash == _hash(token or "")))
    if not row or row.consumed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link has already been used or is invalid")
    if row.expires_at < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link has expired – request a new one")
    row.consumed = True
    db.commit()
    return row.email


# ---------------------------------------------------------------- Google
def verify_google_credential(credential: str) -> dict:
    if not settings.google_client_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google sign-in is not configured on this server")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            info = json.loads(resp.read())
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google could not verify this sign-in")
    if info.get("aud") not in settings.google_client_ids:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google token was issued for a different app")
    if str(info.get("email_verified")).lower() != "true":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google email is not verified")
    return {"sub": info["sub"], "email": info["email"].lower(), "name": info.get("name") or info["email"].split("@")[0]}


# ---------------------------------------------------------------- lookup
def find_user(db: Session, *, phone: str | None = None, email: str | None = None, google_sub: str | None = None) -> User | None:
    if google_sub:
        u = db.scalar(select(User).where(User.google_sub == google_sub))
        if u:
            return u
    if email:
        u = db.scalar(select(User).where(User.email == email))
        if u:
            if google_sub and not u.google_sub:
                u.google_sub = google_sub  # link Google to the existing email account
            return u
    if phone:
        return db.scalar(select(User).where(User.phone == phone))
    return None
