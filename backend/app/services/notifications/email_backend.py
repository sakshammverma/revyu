"""Email backend — v1 default, fully automated (documents/10-ROADMAP.md §1.3).

Uses Resend's HTTP API (simple, no SMTP config, generous free tier — fits
the "avoid third-party lead times" principle in 04-ARCHITECTURE.md §1.4).
Falls back to logging when no API key is configured, so local dev and CI
never depend on a live provider — this is deliberate, not a stub: the
notifications table still records the attempt either way.
"""

import logging

import httpx

from app.core.config import get_settings
from app.services.notifications.base import NotificationBackend, NotifyResult
from app.services.notifications.templates import render

logger = logging.getLogger("revyu.notifications")

RESEND_API_URL = "https://api.resend.com/emails"


class EmailBackend(NotificationBackend):
    def send(self, *, to_email: str, template: str, data: dict) -> NotifyResult:
        subject, body = render(template, data)
        settings = get_settings()

        if not settings.email_provider_api_key:
            logger.info("EMAIL [no provider configured] to=%s subject=%s\n%s", to_email, subject, body)
            # Nothing left the building - record that truthfully so a missing
            # key in production is visible in the notifications table.
            return NotifyResult(channel="email", status="skipped_no_provider")

        try:
            resp = httpx.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.email_provider_api_key}"},
                json={
                    "from": settings.email_from_address,
                    "to": [to_email],
                    "subject": subject,
                    "text": body,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            return NotifyResult(channel="email", status="sent")
        except httpx.HTTPError as exc:
            logger.error("Email send failed to=%s template=%s: %s", to_email, template, exc)
            return NotifyResult(channel="email", status="failed", error=str(exc))
