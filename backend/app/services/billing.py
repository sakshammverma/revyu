"""Billing state transitions shared by signup confirm, webhooks and admin
rejection. Keeping them here means a browser confirm and the matching
webhook (whichever lands first) produce exactly the same result, once.

Signup lifecycle (SRS-18.6/18.7, 05-DATA-MODEL.md §4.1):

    pending_payment ──(checkout verified)──▶ pending_approval ──approve──▶ trial
                                                   └──reject──▶ rejected (+ refund / mandate cancelled)

`pending_payment` rows are invisible everywhere (no queue entry, no QR, no
flow) — they exist only so the checkout has something to attach to. That is
the practical reading of "the outlet is not created until payment succeeds".
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.outlet import Outlet
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.services.payments import get_provider_by_name
from app.services.payments.razorpay_provider import PaymentProviderUnavailableError

logger = logging.getLogger("revyu.billing")

PERIOD_DAYS = {"monthly": 30, "annual": 365}


def record_payment(
    db: Session,
    subscription: Subscription,
    *,
    provider_payment_id: str | None,
    amount_minor: int,
    currency_code: str,
    status: str,
    webhook_verified: bool,
) -> Payment | None:
    """Idempotent on provider_payment_id (API spec §5)."""
    if provider_payment_id:
        existing = db.scalar(select(Payment).where(Payment.provider_payment_id == provider_payment_id))
        if existing is not None:
            if webhook_verified and not existing.webhook_verified:
                existing.webhook_verified = True
            # A later capture supersedes an earlier authorisation record.
            if status == "captured" and existing.status != "refunded":
                existing.status = "captured"
                from app.services.referrals import mark_referee_paid

                mark_referee_paid(db, subscription.account_id)
            return existing
    payment = Payment(
        id=uuid.uuid4(),
        subscription_id=subscription.id,
        provider_payment_id=provider_payment_id,
        amount_minor=amount_minor,
        currency_code=currency_code,
        status=status,
        webhook_verified=webhook_verified,
    )
    db.add(payment)
    if status == "captured":
        from app.services.referrals import mark_referee_paid

        mark_referee_paid(db, subscription.account_id)
    return payment


def mark_checkout_complete(db: Session, subscription: Subscription) -> Outlet | None:
    """Checkout succeeded (verified signature or webhook): mandate authorised,
    or one-time order paid. Moves the signup into the approval queue."""
    now = datetime.now(timezone.utc)
    if subscription.razorpay_order_id or subscription.mandate_status == "not_applicable":
        # One-time payment: the period is paid for up front.
        subscription.status = "active"
        subscription.mandate_status = "not_applicable"
        if subscription.current_period_end is None:
            subscription.current_period_end = now + timedelta(days=PERIOD_DAYS.get(subscription.plan, 30))
    else:
        # Mandate authorised; first charge lands when the trial ends.
        subscription.mandate_status = "active"

    outlet = db.scalar(select(Outlet).where(Outlet.account_id == subscription.account_id))
    if outlet is not None and outlet.state == "pending_payment":
        outlet.state = "pending_approval"
        outlet.submitted_at = now
    return outlet


def has_paid_period(db: Session, account_id: uuid.UUID) -> bool:
    """True if the account has an active, currently-paid subscription —
    used so a paid outlet goes to `active` instead of `locked` at day 15."""
    now = datetime.now(timezone.utc)
    sub = db.scalar(
        select(Subscription).where(
            Subscription.account_id == account_id,
            Subscription.status == "active",
            Subscription.current_period_end.is_not(None),
            Subscription.current_period_end > now,
        )
    )
    return sub is not None


def release_signup_payment(db: Session, account_id: uuid.UUID) -> list[str]:
    """SRS-19.7 — on rejection, cancel any mandate and refund any captured
    payment. Returns human-readable problems (empty if all clean); never
    raises, so a gateway hiccup can't block the admin's rejection."""
    problems: list[str] = []
    subs = db.scalars(select(Subscription).where(Subscription.account_id == account_id)).all()
    for sub in subs:
        provider = get_provider_by_name(sub.provider)
        if sub.razorpay_subscription_id and sub.status not in ("cancelled", "abandoned"):
            try:
                provider.cancel_subscription(sub.razorpay_subscription_id)
            except PaymentProviderUnavailableError as exc:
                problems.append(f"mandate {sub.razorpay_subscription_id}: {exc}")
        for payment in sub.payments:
            if payment.status == "captured" and payment.provider_payment_id:
                try:
                    provider.refund_payment(payment.provider_payment_id)
                    payment.status = "refunded"
                except PaymentProviderUnavailableError as exc:
                    problems.append(f"refund {payment.provider_payment_id}: {exc}")
        sub.status = "cancelled"
        sub.cancelled_at = datetime.now(timezone.utc)
    for p in problems:
        logger.error("Signup payment release needs manual follow-up: %s", p)
    return problems
