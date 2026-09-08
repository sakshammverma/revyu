"""Owner billing: see plan/trial status, pay to unlock from the dashboard.

Closes the gap where a locked or past-due owner had no way to pay
(SRS-12.3, FR-47). Reuses the same provider interface and webhook machinery
as signup; the synchronous /confirm just makes the unlock instant instead of
waiting for the webhook.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.jobs.trial_day15_check import TRIAL_DAYS
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.schemas.signup import CheckoutInfo, CheckoutPrefill, SignupConfirmRequest
from app.services.billing import PERIOD_DAYS, record_payment
from app.services.payments import get_provider, get_provider_by_name
from app.services.payments.razorpay_provider import PaymentProviderUnavailableError
from app.services.referrals import summary as referral_summary
from app.services.trial_metering import TRIAL_CREDITS

router = APIRouter(prefix="/api/app/billing", tags=["billing"])

PAYABLE_STATES = ("trial", "locked", "past_due", "suspended", "deactivated", "active")


class PlanOption(BaseModel):
    code: str
    amount_minor: int
    currency_code: str


class PaymentRow(BaseModel):
    amount_minor: int
    currency_code: str
    status: str
    created_at: str


class BillingStatus(BaseModel):
    outlet_id: uuid.UUID
    state: str
    subscription_status: str | None
    plan: str | None
    current_period_end: str | None
    trial_days_left: int | None
    credits_left: int | None
    scans_waiting: int
    can_pay: bool
    plans: list[PlanOption]
    annual_saving_minor: int
    payments: list[PaymentRow]
    referral_discounts_earned: int


def _own_outlet(db: Session, owner: Account) -> Outlet:
    outlet = db.scalar(select(Outlet).where(Outlet.account_id == owner.id))
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


def _plans(db: Session, outlet: Outlet) -> list[Plan]:
    return list(
        db.scalars(
            select(Plan).where(Plan.country_code == outlet.country_code, Plan.active.is_(True))
        )
    )


def _latest_subscription(db: Session, account_id: uuid.UUID) -> Subscription | None:
    return db.scalar(
        select(Subscription)
        .where(Subscription.account_id == account_id, Subscription.status != "abandoned")
        .order_by(Subscription.created_at.desc())
    )


@router.get("/status", response_model=BillingStatus)
def billing_status(
    owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)
) -> BillingStatus:
    outlet = _own_outlet(db, owner)
    sub = _latest_subscription(db, owner.id)
    plans = _plans(db, outlet)
    by_code = {p.code: p for p in plans}

    trial_days_left = None
    if outlet.state == "trial" and outlet.activated_at is not None:
        end = outlet.activated_at + timedelta(days=TRIAL_DAYS)
        trial_days_left = max(0, (end - datetime.now(timezone.utc)).days + 1)

    credits_left = None
    if outlet.state == "locked" and outlet.locked_at_flow_count is not None:
        used = outlet.trial_flow_count - outlet.locked_at_flow_count
        credits_left = max(0, TRIAL_CREDITS - used)
    elif outlet.state == "suspended":
        credits_left = 0

    saving = 0
    if "monthly" in by_code and "annual" in by_code:
        saving = max(0, by_code["monthly"].amount_minor * 12 - by_code["annual"].amount_minor)

    payments = []
    if sub is not None:
        payments = [
            PaymentRow(
                amount_minor=p.amount_minor,
                currency_code=p.currency_code,
                status=p.status,
                created_at=p.created_at.isoformat(),
            )
            for p in db.scalars(
                select(Payment)
                .join(Subscription, Subscription.id == Payment.subscription_id)
                .where(Subscription.account_id == owner.id)
                .order_by(Payment.created_at.desc())
                .limit(24)
            )
        ]

    return BillingStatus(
        outlet_id=outlet.id,
        state=outlet.state,
        subscription_status=sub.status if sub else None,
        plan=sub.plan if sub else None,
        current_period_end=sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        trial_days_left=trial_days_left,
        credits_left=credits_left,
        scans_waiting=outlet.trial_flow_count,
        can_pay=outlet.state in PAYABLE_STATES,
        plans=[PlanOption(code=p.code, amount_minor=p.amount_minor, currency_code=p.currency_code) for p in plans],
        annual_saving_minor=saving,
        payments=payments,
        referral_discounts_earned=referral_summary(db, owner)["earned"],
    )


class CheckoutBody(BaseModel):
    plan: str  # monthly | annual


class CheckoutResponse(BaseModel):
    checkout: CheckoutInfo
    subscription_id: uuid.UUID


@router.post("/checkout", response_model=CheckoutResponse, status_code=201)
def create_checkout(
    body: CheckoutBody, owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)
) -> CheckoutResponse:
    outlet = _own_outlet(db, owner)
    if outlet.state not in PAYABLE_STATES:
        raise HTTPException(status_code=409, detail={"error": {"code": "NOT_PAYABLE"}})
    plan = next((p for p in _plans(db, outlet) if p.code == body.plan), None)
    if plan is None:
        raise HTTPException(status_code=400, detail={"error": {"code": "UNKNOWN_PLAN"}})

    provider = get_provider(outlet.country_code)
    try:
        # No trial here: the owner is paying now, so the first charge is immediate.
        intent = provider.create_checkout(
            plan_code=plan.code,
            amount_minor=plan.amount_minor,
            currency_code=plan.currency_code,
            customer_email=owner.owner_email,
            trial_days=0,
        )
    except PaymentProviderUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail={"error": {"code": "PAYMENT_UNAVAILABLE", "message": str(exc)}}
        ) from exc

    # Earlier unpaid attempts are superseded.
    for old in db.scalars(
        select(Subscription).where(
            Subscription.account_id == owner.id, Subscription.status == "pending"
        )
    ):
        old.status = "abandoned"

    sub = Subscription(
        id=uuid.uuid4(),
        account_id=owner.id,
        plan=plan.code,
        status="pending",
        provider=intent.provider,
        razorpay_subscription_id=intent.provider_subscription_id,
        razorpay_order_id=intent.provider_order_id,
        mandate_status="not_applicable" if intent.mode == "one_time" else "pending",
    )
    db.add(sub)
    db.commit()

    return CheckoutResponse(
        subscription_id=sub.id,
        checkout=CheckoutInfo(
            provider=intent.provider,
            mode=intent.mode,
            amount_minor=intent.amount_minor,
            currency_code=intent.currency_code,
            key_id=intent.key_id,
            subscription_id=intent.provider_subscription_id,
            order_id=intent.provider_order_id,
            trial_days=0,
            prefill=CheckoutPrefill(
                name=owner.owner_name or "", email=owner.owner_email, contact=owner.owner_phone
            ),
        ),
    )


@router.post("/confirm", response_model=BillingStatus)
def confirm_checkout(
    body: SignupConfirmRequest,
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> BillingStatus:
    """Verified-signature confirm so the unlock is instant. The matching
    webhook performs the same idempotent transition and records the capture."""
    outlet = _own_outlet(db, owner)
    sub = db.scalar(
        select(Subscription)
        .where(Subscription.account_id == owner.id, Subscription.status == "pending")
        .order_by(Subscription.created_at.desc())
    )
    if sub is None:
        # Already confirmed (webhook beat us) - idempotent.
        return billing_status(owner, db)

    provider = get_provider_by_name(sub.provider)
    if not provider.verify_checkout_signature(
        payment_id=body.razorpay_payment_id,
        signature=body.razorpay_signature,
        subscription_id=sub.razorpay_subscription_id,
        order_id=sub.razorpay_order_id,
    ):
        raise HTTPException(status_code=400, detail={"error": {"code": "PAYMENT_SIGNATURE_INVALID"}})

    plan = next((p for p in _plans(db, outlet) if p.code == sub.plan), None)
    now = datetime.now(timezone.utc)
    record_payment(
        db,
        sub,
        provider_payment_id=None if sub.provider == "mock" else body.razorpay_payment_id,
        amount_minor=plan.amount_minor if plan else 0,
        currency_code=plan.currency_code if plan else "INR",
        # A mandate is only authorised here; its charge is confirmed by the webhook.
        status="captured" if sub.razorpay_order_id else "authorized",
        webhook_verified=False,
    )
    sub.status = "active"
    sub.grace_until = None
    if sub.razorpay_subscription_id and not sub.razorpay_order_id:
        sub.mandate_status = "active"
    sub.current_period_end = now + timedelta(days=PERIOD_DAYS.get(sub.plan, 30))
    if outlet.state in PAYABLE_STATES:
        outlet.state = "active"  # dashboard unlocks, collection resumes
    db.commit()
    return billing_status(owner, db)
