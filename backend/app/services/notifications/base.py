"""Notification adapter interface (documents/10-ROADMAP.md §1.3).

One interface, pluggable backends: EmailBackend (v1 default, fully
automated), ClickToChatBackend (wa.me link in admin console), WhatsAppApi
Backend (v2, deferred per OD-9). Swapping backends must never touch caller
code — that is the entire point of building this now.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

TEMPLATES = (
    "otp_login",
    "outlet_activated",
    "first_scan",
    "trial_threshold",
    "private_feedback_received",
    "weekly_digest",
    "payment_failed",
    "needs_info",
    "signup_rejected",
    "trial_reminder",
    "credits_low",
    "collection_paused",
    "zero_scan_nudge",
    "gap_report",
    "service_update",
)


@dataclass
class NotifyResult:
    channel: str
    status: str  # queued | sent | failed | skipped_no_provider
    error: str | None = None


class NotificationBackend(ABC):
    @abstractmethod
    def send(self, *, to_email: str, template: str, data: dict) -> NotifyResult:
        ...
