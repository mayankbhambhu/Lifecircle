"""JWT sessions + role-based access control (RBAC) dependencies."""
from __future__ import annotations

from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User, utcnow

ALGO = "HS256"
_bearer = HTTPBearer(auto_error=False)

ROLE_HOME = {
    "patient": "/patient",
    "donor": "/donor",
    "blood_bank": "/bank",
    "hospital": "/hospital",
}


def create_session_token(user: User) -> str:
    now = utcnow()
    payload = {"sub": str(user.id), "role": user.role, "typ": "session", "iat": now, "exp": now + timedelta(hours=settings.jwt_hours)}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGO)


def create_onboarding_token(identity: dict) -> str:
    """Proves the person verified a phone/email/Google account but has no LifeCircle profile yet."""
    now = utcnow()
    payload = {**identity, "typ": "onboarding", "iat": now, "exp": now + timedelta(minutes=settings.onboarding_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGO)


def decode(token: str, typ: str) -> dict:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired – please sign in again")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if data.get("typ") != typ:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    return data


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    data = decode(creds.credentials, "session")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists")
    if user.role != data.get("role"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Role changed – please sign in again")
    return user


def require_roles(*roles: str):
    """Route guard: `user: User = Depends(require_roles("blood_bank"))`."""

    def guard(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"This area is for {', '.join(r.replace('_', ' ') for r in roles)} accounts")
        return user

    return guard
