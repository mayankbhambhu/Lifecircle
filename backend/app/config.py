"""Runtime configuration, read from environment variables.

Everything has a safe local default so `uvicorn app.main:app --host 0.0.0.0` works out of the box
(listen on 0.0.0.0 so the Expo Go app on your phone can reach it over Wi-Fi).
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
    # Comma-separated OAuth client IDs whose Google ID tokens we accept (iOS, Android, web).
    google_client_ids: tuple[str, ...] = tuple(x.strip() for x in os.getenv("GOOGLE_CLIENT_IDS", "").split(",") if x.strip())
    # Magic links open the mobile app. Production builds use the app's own scheme;
    # Expo Go uses exp:// URLs, which are only accepted in demo mode.
    app_link: str = os.getenv("LIFECIRCLE_APP_LINK", "lifecircle://magic")

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
