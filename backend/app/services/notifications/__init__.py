import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.notification import Notification
from app.services.notifications.base import TEMPLATES
from app.services.notifications.click_to_chat_backend import normalise_phone
from app.services.notifications.email_backend import EmailBackend
from app.services.notifications.templates import render

_email_backend = EmailBackend()

# Moments worth a manual WhatsApp tap on top of the email (roadmap 1.3).
HIGH_VALUE_TEMPLATES = frozenset(
    {"trial_threshold", "credits_low", "collection_paused", "payment_failed", "zero_scan_nudge"}
)


def notify(
    db: Session,
    *,
    account_id: uuid.UUID,
    outlet_id: uuid.UUID | None,
    to_email: str,
    template: str,
    data: dict,
) -> None:
    """Send a notification and log it (documents/05-DATA-MODEL.md §3.10).

    v1 behaviour per documents/10-ROADMAP.md §1.3: email is the automated
    default for every template. High-value moments (trial_threshold,
    payment_failed) additionally populate the admin click-to-chat queue —
    that wiring point is intentionally left in the caller, not here, so
    each notify() site can decide whether the moment warrants it.
    """
    if template not in TEMPLATES:
        raise ValueError(f"Unknown notification template: {template}")

    result = _email_backend.send(to_email=to_email, template=template, data=data)

    db.add(
        Notification(
            id=uuid.uuid4(),
            account_id=account_id,
            outlet_id=outlet_id,
            template=template,
            channel=result.channel,
            status=result.status,
            error=result.error,
            sent_at=datetime.now(timezone.utc) if result.status == "sent" else None,
        )
    )

    if template in HIGH_VALUE_TEMPLATES:
        account = db.get(Account, account_id)
        if account is not None and normalise_phone(account.owner_phone):
            _, body = render(template, data)
            db.add(
                Notification(
                    id=uuid.uuid4(),
                    account_id=account_id,
                    outlet_id=outlet_id,
                    template=template,
                    channel="click_to_chat",
                    status="queued",
                    to_phone=normalise_phone(account.owner_phone),
                    body=body,
                )
            )


def notify_once(
    db: Session,
    *,
    account_id: uuid.UUID,
    outlet_id: uuid.UUID,
    to_email: str,
    template: str,
    data: dict,
) -> bool:
    """Like notify(), but never sends the same lifecycle message twice for an
    outlet. Returns True if it was sent now."""
    already = db.scalar(
        select(Notification.id).where(
            Notification.outlet_id == outlet_id,
            Notification.template == template,
            Notification.status.in_(("sent", "skipped_no_provider")),
        )
    )
    if already is not None:
        return False
    notify(db, account_id=account_id, outlet_id=outlet_id, to_email=to_email, template=template, data=data)
    return True
