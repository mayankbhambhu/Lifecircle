"""In-app notifications (the bell icon). SMS / WhatsApp / push would hang off `notify()`."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Notification, User


def notify(db: Session, user_id: int | None, kind: str, title: str, body: str, level: str = "info", link: str | None = None) -> None:
    if not user_id:
        return  # e.g. a walk-in donor registered by staff with no app account
    db.add(Notification(user_id=user_id, kind=kind, title=title, body=body, level=level, link=link))


def notify_bank_staff(db: Session, blood_bank_id: int, kind: str, title: str, body: str, level: str = "info", link: str | None = None) -> None:
    for uid in db.scalars(select(User.id).where(User.role == "blood_bank", User.blood_bank_id == blood_bank_id)):
        notify(db, uid, kind, title, body, level, link)


def notify_hospital_staff(db: Session, hospital_id: int, kind: str, title: str, body: str, level: str = "info", link: str | None = None) -> None:
    for uid in db.scalars(select(User.id).where(User.role == "hospital", User.hospital_id == hospital_id)):
        notify(db, uid, kind, title, body, level, link)
