"""Daily: cancelled subscriptions whose paid period has ended → outlet
`deactivated` (SRS-12.7, 06-API-SPEC.md §5 `subscription.cancelled`).

Cancellation keeps the dashboard and collection running to the end of the
period the owner already paid for; after that the QR shows the neutral
screen (05-DATA-MODEL.md §4.1a). Reactivation happens via a new payment
webhook (SRS-12.9) — the slug never changes, so printed codes come back.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.outlet import Outlet
from app.models.subscription import Subscription

# Only live states are deactivated; suspended/rejected/pre-live are left alone.
_LIVE_STATES = ("trial", "locked", "active", "past_due")


def run_cancellation_expiry(db: Session) -> int:
    now = datetime.now(timezone.utc)
    expired = db.scalars(
        select(Subscription).where(
            Subscription.cancelled_at.is_not(None),
            Subscription.current_period_end.is_not(None),
            Subscription.current_period_end <= now,
            Subscription.status != "expired",
        )
    ).all()

    count = 0
    for sub in expired:
        # A newer, active subscription on the same account wins (re-subscribed).
        newer_active = db.scalar(
            select(Subscription.id).where(
                Subscription.account_id == sub.account_id,
                Subscription.id != sub.id,
                Subscription.status == "active",
            )
        )
        sub.status = "expired"
        if newer_active is not None:
            continue
        outlet = db.scalar(select(Outlet).where(Outlet.account_id == sub.account_id))
        if outlet is not None and outlet.state in _LIVE_STATES:
            outlet.state = "deactivated"
            count += 1

    db.commit()
    return count
