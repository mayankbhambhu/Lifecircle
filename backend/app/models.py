"""Database models.

Roles
-----
patient    – the patient's family account (manages one or more patients)
donor      – a blood donor (may belong to several patients' circles)
blood_bank – blood bank staff (the ONLY role that can see donor phone numbers)
hospital   – hospital / day-care transfusion unit staff
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

ROLES = ("patient", "donor", "blood_bank", "hospital")
SELF_SERVICE_ROLES = ("patient", "donor")  # staff accounts are invite-only


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite has no timezone type)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(200), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    role: Mapped[str] = mapped_column(String(20))
    blood_bank_id: Mapped[int | None] = mapped_column(ForeignKey("blood_banks.id"))
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_login_method: Mapped[str | None] = mapped_column(String(20))


class BloodBank(Base):
    __tablename__ = "blood_banks"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(20))


class Hospital(Base):
    __tablename__ = "hospitals"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    blood_bank_id: Mapped[int] = mapped_column(ForeignKey("blood_banks.id"))
    blood_bank: Mapped[BloodBank] = relationship()


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(primary_key=True)
    family_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    blood_group: Mapped[str] = mapped_column(String(3))
    condition: Mapped[str] = mapped_column(String(80), default="Thalassemia major")
    cycle_days: Mapped[int] = mapped_column(Integer, default=21)
    units_per_transfusion: Mapped[int] = mapped_column(Integer, default=1)
    last_transfusion_date: Mapped[date | None] = mapped_column(Date)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    invite_code: Mapped[str] = mapped_column(String(16), unique=True)

    hospital: Mapped[Hospital] = relationship()
    family: Mapped[User] = relationship()
    circle: Mapped[list["CircleMember"]] = relationship(back_populates="patient", cascade="all, delete-orphan")


class Donor(Base):
    __tablename__ = "donors"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20))
    blood_group: Mapped[str] = mapped_column(String(3))
    sex: Mapped[str] = mapped_column(String(1))  # "M" / "F"
    date_of_birth: Mapped[date] = mapped_column(Date)
    weight_kg: Mapped[float] = mapped_column(Float)
    last_hemoglobin: Mapped[float | None] = mapped_column(Float)
    last_donation_date: Mapped[date | None] = mapped_column(Date)
    deferred_until: Mapped[date | None] = mapped_column(Date)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    open_to_urgent: Mapped[bool] = mapped_column(Boolean, default=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    area: Mapped[str] = mapped_column(String(80), default="")

    memberships: Mapped[list["CircleMember"]] = relationship(back_populates="donor")


class CircleMember(Base):
    __tablename__ = "circle_members"
    __table_args__ = (UniqueConstraint("patient_id", "donor_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"))
    relation: Mapped[str] = mapped_column(String(40), default="Friend")
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    patient: Mapped[Patient] = relationship(back_populates="circle")
    donor: Mapped[Donor] = relationship(back_populates="memberships")


class Appointment(Base):
    """One transfusion cycle for one patient."""

    __tablename__ = "appointments"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    blood_bank_id: Mapped[int] = mapped_column(ForeignKey("blood_banks.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    units_needed: Mapped[int] = mapped_column(Integer, default=1)
    # awaiting_bank -> scheduled -> completed  (or cancelled)
    status: Mapped[str] = mapped_column(String(20), default="awaiting_bank")
    bank_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    patient: Mapped[Patient] = relationship()
    blood_bank: Mapped[BloodBank] = relationship()
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="appointment", cascade="all, delete-orphan")


class Assignment(Base):
    """A donor slotted against an appointment, as confirmed donor or backup."""

    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(ForeignKey("appointments.id"))
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"))
    slot: Mapped[str] = mapped_column(String(10))  # confirmed | backup
    # pending -> attending | cancelled ; after the day: donated | deferred | no_show | excused
    status: Mapped[str] = mapped_column(String(12), default="pending")
    source: Mapped[str] = mapped_column(String(12), default="rotation")  # rotation | urgent | promoted
    score: Mapped[float | None] = mapped_column(Float)
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    appointment: Mapped[Appointment] = relationship(back_populates="assignments")
    donor: Mapped[Donor] = relationship()


class UrgentRequest(Base):
    __tablename__ = "urgent_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.id"))
    blood_bank_id: Mapped[int] = mapped_column(ForeignKey("blood_banks.id"))
    blood_group: Mapped[str] = mapped_column(String(3))
    units: Mapped[int] = mapped_column(Integer, default=1)
    needed_by: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20))  # family | hospital | donor_cancellation
    # circle -> broadcast -> filled | stock_fulfilled | no_match | cancelled | rerouted
    status: Mapped[str] = mapped_column(String(20), default="circle")
    stage: Mapped[int] = mapped_column(Integer, default=1)  # 1 = circle, 2.. = broadcast rings
    radius_km: Mapped[float | None] = mapped_column(Float)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    filled_by_donor_id: Mapped[int | None] = mapped_column(ForeignKey("donors.id"))
    filled_at: Mapped[datetime | None] = mapped_column(DateTime)
    stage_started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    staff_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    patient: Mapped[Patient] = relationship()
    blood_bank: Mapped[BloodBank] = relationship()
    filled_by: Mapped[Donor | None] = relationship()
    alerts: Mapped[list["UrgentAlert"]] = relationship(back_populates="request", cascade="all, delete-orphan")


class UrgentAlert(Base):
    __tablename__ = "urgent_alerts"
    __table_args__ = (UniqueConstraint("request_id", "donor_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("urgent_requests.id"))
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"))
    stage: Mapped[int] = mapped_column(Integer)
    in_circle: Mapped[bool] = mapped_column(Boolean, default=False)
    distance_km: Mapped[float] = mapped_column(Float)
    rank: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="sent")  # sent | accepted | declined | closed
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime)

    request: Mapped[UrgentRequest] = relationship(back_populates="alerts")
    donor: Mapped[Donor] = relationship()


class DonationLog(Base):
    """Final health-screening outcome recorded by blood bank staff."""

    __tablename__ = "donation_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"))
    blood_bank_id: Mapped[int] = mapped_column(ForeignKey("blood_banks.id"))
    assignment_id: Mapped[int | None] = mapped_column(ForeignKey("assignments.id"))
    urgent_request_id: Mapped[int | None] = mapped_column(ForeignKey("urgent_requests.id"))
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    outcome: Mapped[str] = mapped_column(String(10))  # donated | deferred | no_show | excused
    hemoglobin: Mapped[float | None] = mapped_column(Float)
    deferral_days: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    logged_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    donor: Mapped[Donor] = relationship()


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (UniqueConstraint("blood_bank_id", "blood_group"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    blood_bank_id: Mapped[int] = mapped_column(ForeignKey("blood_banks.id"))
    blood_group: Mapped[str] = mapped_column(String(3))
    units: Mapped[int] = mapped_column(Integer, default=0)
    min_threshold: Mapped[int] = mapped_column(Integer, default=10)
    daily_usage: Mapped[float] = mapped_column(Float, default=2.0)
    last_status: Mapped[str] = mapped_column(String(10), default="healthy")
    last_rally_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    level: Mapped[str] = mapped_column(String(10), default="info")  # info | success | warning | critical
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(200))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ReminderLog(Base):
    """Makes automated reminders idempotent: one row per (assignment, reminder kind)."""

    __tablename__ = "reminder_log"
    __table_args__ = (UniqueConstraint("assignment_id", "kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"))
    kind: Mapped[str] = mapped_column(String(20))
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OtpCode(Base):
    __tablename__ = "otp_codes"
    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MagicLink(Base):
    __tablename__ = "magic_links"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    """Privacy audit trail – every time staff view donor contact details."""

    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    target: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
