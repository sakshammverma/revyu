from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    # Honoured only when ENVIRONMENT=local, so repeated e2e runs are not throttled.
    disable_rate_limits: bool = False
    database_url: str = "postgresql+psycopg://revyu:revyu@localhost:5432/revyu"

    google_places_api_key: str = ""

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    # Plan ids created once in the Razorpay dashboard (see razorpay_provider.py).
    razorpay_plan_id_monthly: str = ""
    razorpay_plan_id_annual: str = ""

    email_provider_api_key: str = ""
    email_from_address: str = "noreply@revyu.in"

    # Where new Growth Service requests are emailed. Empty = log only.
    admin_notify_email: str = ""
    admin_session_secret: str = "change-me"
    auth_secret: str = "change-me"

    # Where owners open the dashboard — used to build absolute magic-login
    # links in emails (a relative link is dead inside an email client).
    frontend_base_url: str = "http://localhost:3000"
    # Public origin encoded into printed QR codes (/r/{slug}). Set to the real
    # domain in production; defaults to the local frontend so dev QRs scan.
    public_flow_base_url: str = "http://localhost:3000"
    # Comma-separated. Browser calls normally go through the Next.js /api
    # rewrite (same-origin), so CORS only matters for direct calls.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def is_local(self) -> bool:
        return self.environment == "local"

    @model_validator(mode="after")
    def _refuse_unsafe_production(self) -> "Settings":
        """A production boot with default secrets or mock providers would
        silently run an open admin console and free signups. Fail loudly."""
        if self.is_local:
            return self
        problems = []
        for name in ("admin_session_secret", "auth_secret"):
            value = getattr(self, name)
            if value in ("", "change-me") or len(value) < 24:
                problems.append(f"{name} must be set to a random value of 24+ characters")
        for name in (
            "razorpay_key_id",
            "razorpay_key_secret",
            "razorpay_webhook_secret",
            "google_places_api_key",
            "email_provider_api_key",
        ):
            if not getattr(self, name):
                problems.append(f"{name} is required when ENVIRONMENT={self.environment}")
        if problems:
            raise ValueError("Unsafe configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
