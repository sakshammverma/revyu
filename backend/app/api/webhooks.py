"""Razorpay webhook — signature-verified, idempotent, all billing state
changes originate here, never from a client redirect (SRS-12.8, documents/
06-API-SPEC.md §5).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.subscription import Subscription
from app.services.billing import PERIOD_DAYS, mark_checkout_complete, record_payment
from app.services.notifications import notify
from app.services.payments.razorpay_provider import RazorpayProvider

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

GRACE_PERIOD_DAYS = 7  # SRS-12.5, OD-13


@router.post("/razorpay", status_code=200)
async def razorpay_webhook(request: Request) -> dict:
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    provider = RazorpayProvider()
    if not provider.verify_webhook_signature(body, signature):
        raise HTTPException(
            status_code=400, detail={"error": {"code": "WEBHOOK_SIGNATURE_INVALID"}}
        )

    payload = await request.json()
    event = payload.get("event", "")

    db = SessionLocal()
    try:
        _handle_event(db, event, payload)
        db.commit()
    finally:
        db.close()

    # Respond 200 fast; heavy work (cache invalidation, emails) should move
    # to a background task if this ever becomes a bottleneck at v1 volume.
    return {"status": "ok"}


def _handle_event(db: Session, event: str, payload: dict) -> None:
    entity = payload.get("payload", {})

    if event == "subscription.authenticated":
        _on_subscription_authenticated(db, entity)
    elif event == "subscription.activated":
        _on_subscription_activated(db, entity)
    elif event == "subscription.charged":
        _on_subscription_charged(db, entity)
    elif event == "payment.failed":
        _on_payment_failed(db, entity)
    elif event == "subscription.halted":
        _on_subscription_halted(db, entity)
    elif event == "subscription.cancelled":
        _on_subscription_cancelled(db, entity)
    elif event == "order.paid":
        _on_order_paid(db, entity)
    # Unknown event types are ignored, not errored — Razorpay's event set
    # grows over time and an unhandled type must never fail the webhook.


def _find_subscription_by_provider_id(db: Session, provider_sub_id: str) -> Subscription | None:
    return db.scalar(
        select(Subscription).where(Subscription.razorpay_subscription_id == provider_sub_id)
    )


# Outlet states a successful charge may move to `active`. Never the pre-live
# states: a paid signup still has to pass approval (SRS-19) first.
_PAYABLE_STATES = ("trial", "locked", "past_due", "suspended", "deactivated", "active")


def _activate_if_live(outlet: Outlet | None) -> None:
    if outlet is not None and outlet.state in _PAYABLE_STATES:
        # SRS-12.4 unlock dashboard; SRS-12.9 reactivates collection.
        outlet.state = "active"


def _on_subscription_authenticated(db: Session, entity: dict) -> None:
    # Mandate authorised at signup — same transition as the signed checkout
    # confirm (api/signup.py), whichever arrives first.
    sub_id = entity.get("subscription", {}).get("entity", {}).get("id")
    subscription = _find_subscription_by_provider_id(db, sub_id) if sub_id else None
    if subscription is None:
        return
    mark_checkout_complete(db, subscription)


def _on_subscription_activated(db: Session, entity: dict) -> None:
    # Fires when the deferred start date arrives (end of trial).
    sub_id = entity.get("subscription", {}).get("entity", {}).get("id")
    subscription = _find_subscription_by_provider_id(db, sub_id) if sub_id else None
    if subscription is None:
        return
    subscription.status = "active"
    subscription.mandate_status = "active"
    outlet = mark_checkout_complete(db, subscription)
    _activate_if_live(outlet)


def _on_subscription_charged(db: Session, entity: dict) -> None:
    payment_entity = entity.get("payment", {}).get("entity", {})
    sub_id = entity.get("subscription", {}).get("entity", {}).get("id")
    subscription = _find_subscription_by_provider_id(db, sub_id) if sub_id else None
    if subscription is None:
        return

    _record_payment_idempotent(db, subscription, payment_entity, status="captured")
    subscription.status = "active"
    subscription.grace_until = None
    subscription.current_period_end = datetime.now(timezone.utc) + timedelta(
        days=PERIOD_DAYS.get(subscription.plan, 30)
    )
    _activate_if_live(db.scalar(select(Outlet).where(Outlet.account_id == subscription.account_id)))


def _on_payment_failed(db: Session, entity: dict) -> None:
    payment_entity = entity.get("payment", {}).get("entity", {})
    sub_id = payment_entity.get("subscription_id") if payment_entity else None
    subscription = _find_subscription_by_provider_id(db, sub_id) if sub_id else None
    if subscription is None:
        return

    subscription.status = "past_due"
    subscription.grace_until = datetime.now(timezone.utc) + timedelta(days=GRACE_PERIOD_DAYS)

    outlet = db.scalar(select(Outlet).where(Outlet.account_id == subscription.account_id))
    if outlet is not None and outlet.state in ("trial", "locked", "active"):
        outlet.state = "past_due"
        # SRS-12.5: full flow stays live during the 7-day grace period.
        account = db.get(Account, subscription.account_id)
        if account is not None:
            notify(
                db,
                account_id=account.id,
                outlet_id=outlet.id,
                to_email=account.owner_email,
                template="payment_failed",
                data={
                    "business_name": outlet.business_name,
                    "grace_days": GRACE_PERIOD_DAYS,
                    "payment_link": f"{get_settings().frontend_base_url.rstrip('/')}/app/login",
                },
            )

    _record_payment_idempotent(db, subscription, payment_entity, status="failed")


def _on_subscription_halted(db: Session, entity: dict) -> None:
    # Grace expired, unpaid -> suspended, collection stops (OD-18).
    sub_id = entity.get("subscription", {}).get("entity", {}).get("id")
    subscription = _find_subscription_by_provider_id(db, sub_id) if sub_id else None
    if subscription is None:
        return

    subscription.status = "cancelled"
    outlet = db.scalar(select(Outlet).where(Outlet.account_id == subscription.account_id))
    if outlet is not None:
        outlet.state = "suspended"


def _on_subscription_cancelled(db: Session, entity: dict) -> None:
    sub_id = entity.get("subscription", {}).get("entity", {}).get("id")
    subscription = _find_subscription_by_provider_id(db, sub_id) if sub_id else None
    if subscription is None:
        return

    subscription.cancelled_at = datetime.now(timezone.utc)
    # Access and collection continue to period end, then
    # app/jobs/cancellation_expiry.py transitions the outlet to deactivated.


def _on_order_paid(db: Session, entity: dict) -> None:
    # Annual or one-time-fallback payment. Reactivates collection if
    # previously suspended (SRS-12.9).
    payment_entity = entity.get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id")
    if not order_id:
        return

    # One-time orders aren't linked to a `subscriptions` row via
    # razorpay_subscription_id (that field is mandate-only) — the caller
    # must have created a subscription row with a matching order reference
    # at checkout time. Best-effort match via provider_payment_id here.
    subscription = db.scalar(select(Subscription).where(Subscription.razorpay_order_id == order_id))
    if subscription is None:
        return

    _record_payment_idempotent(db, subscription, payment_entity, status="captured")
    outlet = mark_checkout_complete(db, subscription)  # signup: -> pending_approval
    _activate_if_live(outlet)  # renewal / reactivation after suspension


def _record_payment_idempotent(
    db: Session, subscription: Subscription, payment_entity: dict, *, status: str
) -> None:
    provider_payment_id = payment_entity.get("id")
    if not provider_payment_id:
        return
    # SRS-12.8 / API spec §5 — dedup on provider_payment_id.
    record_payment(
        db,
        subscription,
        provider_payment_id=provider_payment_id,
        amount_minor=payment_entity.get("amount", 0),
        currency_code=payment_entity.get("currency", "INR"),
        status=status,
        webhook_verified=True,
    )
