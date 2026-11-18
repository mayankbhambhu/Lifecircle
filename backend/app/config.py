"""Runtime configuration, read from environment variables.

Everything has a safe local default so `uvicorn app.main:app` works out of the box.
In DEMO mode the OTP code and the magic link are returned in the API response
(and shown in the UI as a "demo inbox") because no SMS/email provider is wired up.
Turn DEMO off in production and plug in a real SmsSender / EmailSender.
"""
import os


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    secret_key: str = os.getenv("LIFECIRCLE_SECRET", "dev-only-secret-change-me-in-production")
    database_url: str = os.getenv("LIFECIRCLE_DB", "sqlite:///./lifecircle.db")
    demo_mode: bool = _bool("LIFECIRCLE_DEMO", True)
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    frontend_url: str = os.getenv("LIFECIRCLE_FRONTEND_URL", "http://localhost:5173")

    jwt_hours: int = 12
    onboarding_minutes: int = 30

    otp_ttl_seconds: int = 300        # 5 minutes
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 30
    magic_ttl_seconds: int = 900      # 15 minutes

    # Urgent mode timings
    circle_window_minutes: int = 30   # how long the immediate circle gets before broadcast
    ring_window_minutes: int = 20     # how long each broadcast ring gets before widening
    broadcast_batch: int = 10         # max new donors alerted per ring

    background_tick_seconds: int = 60


settings = Settings()
