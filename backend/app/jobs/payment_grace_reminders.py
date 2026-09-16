"""Payment-failed reminders during the 7-day grace period (SRS-12.5).

The webhook sends the first notice on day 0. This daily job sends the follow-ups
on days 3 and 6, so an owner hears about a failed payment three times before
collection pauses.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.account import Account
from app.models.notification import Notification
from app.models.outlet import Outlet
from app.models.subscription import Subscription
from app.services.notifications import notify

GRACE_DAYS = 7
REMINDER_DAYS = (3, 6)


def run_payment_grace_reminders(db: Session) -> int:
    now = datetime.now(timezone.utc)
    link = f"{get_settings().frontend_base_url.rstrip('/')}/app/billing"
    sent = 0

    for sub in db.scalars(
        select(Subscription).where(Subscription.status == "past_due", Subscription.grace_until.is_not(None))
    ):
        elapsed = (now - (sub.grace_until - timedelta(days=GRACE_DAYS))).days
        if elapsed not in REMINDER_DAYS:
            continue
        outlet = db.scalar(select(Outlet).where(Outlet.account_id == sub.account_id))
        account = db.get(Account, sub.account_id)
        if outlet is None or account is None:
            continue
        recent = db.scalar(
            select(Notification.id).where(
                Notification.outlet_id == outlet.id,
                Notification.template == "payment_failed",
                Notification.created_at >= now - timedelta(hours=20),
            )
        )
        if recent is not None:
            continue  # already reminded today
        notify(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="payment_failed",
            data={
                "business_name": outlet.business_name,
                "grace_days": max(0, GRACE_DAYS - elapsed),
                "payment_link": link,
            },
        )
        sent += 1
    db.commit()
    return sent
