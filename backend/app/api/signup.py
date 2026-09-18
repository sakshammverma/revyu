import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.services.referrals import attach_referral
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tag import Tag
from app.jobs.trial_day15_check import TRIAL_DAYS
from app.schemas.signup import (
    CheckoutInfo,
    CheckoutPrefill,
    PlaceSearchResponse,
    PlaceSearchResult,
    SignupConfirmRequest,
    SignupRequest,
    SignupResponse,
    SignupStatusResponse,
)
from app.seeds.tags import list_verticals, seed_tags_for_outlet
from app.services.billing import mark_checkout_complete, record_payment
from app.services.payments import get_provider, get_provider_by_name
from app.services.payments.base import PaymentProvider
from app.services.payments.razorpay_provider import PaymentProviderUnavailableError
from app.services.places import PlacesUnavailableError, build_review_url, search_places

router = APIRouter(prefix="/api/signup", tags=["signup"])

DEFAULT_COUNTRY = "IN"  # v1 launch market (OD-4)


@router.get("/places/search", response_model=PlaceSearchResponse)
def places_search(q: str, near: str | None = None) -> PlaceSearchResponse:
    # SRS-18.3: search-and-pick against Google Places, never free text.
    try:
        results = search_places(q, near)
    except PlacesUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail={"error": {"code": "PLACES_UNAVAILABLE", "message": str(exc)}}
        ) from exc

    return PlaceSearchResponse(
        results=[
            PlaceSearchResult(
                place_id=r.place_id,
                name=r.name,
                address=r.address,
                rating=r.rating,
                review_count=r.review_count,
            )
            for r in results
        ]
    )


@router.post(
    "",
    response_model=SignupResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("signup", 10, 3600))],
)
def create_signup(body: SignupRequest, db: Session = Depends(get_db)) -> SignupResponse:
    if not body.placement_acknowledged:
        # SRS-18.10 — the CR-4 checkbox is mandatory, not a formality.
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "VALIDATION_FAILED", "message": "placement_acknowledged required"}},
        )

    if body.vertical not in list_verticals():
        # Otherwise seed_tags_for_outlet silently falls back to dental tags.
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "VALIDATION_FAILED", "message": "unknown vertical"}},
        )

    # SRS-18.5 — duplicate detection on email, phone, and Place ID. A signup
    # abandoned at checkout (still `pending_payment`) is not a duplicate: the
    # owner is simply retrying, so we reuse those rows.
    dup_account = db.scalar(
        select(Account).where(
            (Account.owner_email == body.owner_email) | (Account.owner_phone == body.owner_phone)
        )
    )
    dup_outlet = db.scalar(select(Outlet).where(Outlet.google_place_id == body.place_id))
    retry_outlet = _abandoned_outlet(db, dup_account, dup_outlet)
    if retry_outlet is None and (dup_account is not None or dup_outlet is not None):
        raise HTTPException(status_code=409, detail={"error": {"code": "DUPLICATE_BUSINESS"}})

    plan = db.scalar(
        select(Plan).where(
            Plan.code == body.plan, Plan.country_code == DEFAULT_COUNTRY, Plan.active.is_(True)
        )
    )
    if plan is None:
        raise HTTPException(
            status_code=400, detail={"error": {"code": "VALIDATION_FAILED", "message": "unknown plan"}}
        )

    # SRS-18.6/FR-40b — payment is authorised at signup, before approval.
    # The first charge is deferred by the trial (see services/payments/base.py).
    provider: PaymentProvider = get_provider(DEFAULT_COUNTRY)
    try:
        checkout = provider.create_checkout(
            plan_code=plan.code,
            amount_minor=plan.amount_minor,
            currency_code=plan.currency_code,
            customer_email=body.owner_email,
            trial_days=TRIAL_DAYS,
        )
    except PaymentProviderUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail={"error": {"code": "PAYMENT_UNAVAILABLE", "message": str(exc)}}
        ) from exc

    if retry_outlet is not None:
        outlet = retry_outlet
        account = db.get(Account, outlet.account_id)
        account.owner_phone = body.owner_phone
        account.owner_email = body.owner_email
        account.owner_name = body.owner_name
        if outlet.vertical != body.vertical:
            db.execute(delete(Tag).where(Tag.outlet_id == outlet.id))
            seed_tags_for_outlet(db, outlet.id, body.vertical)
        outlet.business_name = body.business_name
        outlet.vertical = body.vertical
        outlet.google_place_id = body.place_id
        outlet.google_review_url = build_review_url(body.place_id)
        for old in db.scalars(
            select(Subscription).where(
                Subscription.account_id == account.id, Subscription.status == "pending"
            )
        ):
            old.status = "abandoned"
    else:
        account = Account(
            id=uuid.uuid4(),
            owner_phone=body.owner_phone,
            owner_email=body.owner_email,
            owner_name=body.owner_name,
        )
        db.add(account)
        db.flush()
        attach_referral(db, account, body.referral_code)

        outlet = Outlet(
            id=uuid.uuid4(),
            account_id=account.id,
            slug=_placeholder_slug(),  # replaced with a real slug at approval (SRS-19.4)
            business_name=body.business_name,
            vertical=body.vertical,
            country_code=DEFAULT_COUNTRY,
            google_place_id=body.place_id,
            google_review_url=build_review_url(body.place_id),
            # Invisible until checkout completes (services/billing.py).
            state="pending_payment",
            source="self_serve",
            placement_confirmed=False,
            place_verified=False,
        )
        db.add(outlet)
        db.flush()
        seed_tags_for_outlet(db, outlet.id, body.vertical)

    db.add(
        Subscription(
            id=uuid.uuid4(),
            account_id=account.id,
            plan=plan.code,
            status="pending",
            provider=checkout.provider,
            razorpay_subscription_id=checkout.provider_subscription_id,
            razorpay_order_id=checkout.provider_order_id,
            mandate_status="not_applicable" if checkout.mode == "one_time" else "pending",
        )
    )
    db.commit()

    return SignupResponse(
        signup_id=outlet.id,
        checkout=CheckoutInfo(
            provider=checkout.provider,
            mode=checkout.mode,
            amount_minor=checkout.amount_minor,
            currency_code=checkout.currency_code,
            key_id=checkout.key_id,
            subscription_id=checkout.provider_subscription_id,
            order_id=checkout.provider_order_id,
            trial_days=TRIAL_DAYS,
            prefill=CheckoutPrefill(
                name=body.owner_name, email=body.owner_email, contact=body.owner_phone
            ),
        ),
    )


@router.post("/{signup_id}/confirm", response_model=SignupStatusResponse)
def confirm_signup(
    signup_id: uuid.UUID, body: SignupConfirmRequest, db: Session = Depends(get_db)
) -> SignupStatusResponse:
    """Called by the signup page with what Razorpay Checkout returns on
    success. The signature is verified server-side with the key secret, so
    this is not trusting a client redirect (SRS-12.8); the matching webhook
    (subscription.authenticated / order.paid) performs the same idempotent
    transition if it lands first or this call never arrives."""
    outlet = db.get(Outlet, signup_id)
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.account_id == outlet.account_id, Subscription.status != "abandoned")
        .order_by(Subscription.created_at.desc())
    )
    if subscription is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "CHECKOUT_NOT_FOUND"}})

    if outlet.state != "pending_payment":
        return _status_response(db, outlet)  # already confirmed — idempotent

    # The ids must be the ones we created for *this* signup.
    if (body.razorpay_subscription_id or None) != (subscription.razorpay_subscription_id or None) and (
        body.razorpay_order_id or None
    ) != (subscription.razorpay_order_id or None):
        raise HTTPException(status_code=400, detail={"error": {"code": "CHECKOUT_MISMATCH"}})

    provider = get_provider_by_name(subscription.provider)
    if not provider.verify_checkout_signature(
        payment_id=body.razorpay_payment_id,
        signature=body.razorpay_signature,
        subscription_id=subscription.razorpay_subscription_id,
        order_id=subscription.razorpay_order_id,
    ):
        raise HTTPException(status_code=400, detail={"error": {"code": "PAYMENT_SIGNATURE_INVALID"}})

    plan = db.scalar(
        select(Plan).where(Plan.code == subscription.plan, Plan.country_code == outlet.country_code)
    )
    record_payment(
        db,
        subscription,
        provider_payment_id=None if subscription.provider == "mock" else body.razorpay_payment_id,
        amount_minor=plan.amount_minor if plan and subscription.razorpay_order_id else 0,
        currency_code=plan.currency_code if plan else "INR",
        status="captured" if subscription.razorpay_order_id else "authorized",
        webhook_verified=False,
    )
    mark_checkout_complete(db, subscription)
    db.commit()
    return _status_response(db, outlet)


@router.get("/{signup_id}/status", response_model=SignupStatusResponse)
def signup_status(signup_id: uuid.UUID, db: Session = Depends(get_db)) -> SignupStatusResponse:
    outlet = db.get(Outlet, signup_id)
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return _status_response(db, outlet)


def _status_response(db: Session, outlet: Outlet) -> SignupStatusResponse:
    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.account_id == outlet.account_id, Subscription.status != "abandoned")
        .order_by(Subscription.created_at.desc())
    )
    one_time = bool(subscription and subscription.razorpay_order_id)
    paid_line = (
        "Payment received."
        if one_time
        else f"Payment method authorised — nothing is charged until your {TRIAL_DAYS}-day trial ends."
    )
    messages = {
        "pending_payment": "Waiting for payment. If you closed the payment window, start again from the signup page.",
        "pending_approval": f"{paid_line} We're verifying your business details — usually within a few hours.",
        "trial": "You're live! Check your email for your QR code and print files.",
        "rejected": (outlet.rejection_reason or "We couldn't verify this business.")
        + (" Your payment has been refunded in full." if one_time else " Your payment authorisation has been cancelled — you will not be charged."),
    }
    return SignupStatusResponse(
        state=outlet.state,
        submitted_at=outlet.submitted_at.isoformat() if outlet.submitted_at else None,
        message=messages.get(outlet.state, "You're live! Log in to your dashboard to see your numbers."),
    )


def _abandoned_outlet(db: Session, *matches: Account | Outlet | None) -> Outlet | None:
    """If every duplicate hit belongs to one signup still stuck at checkout,
    return its outlet so the owner can retry; otherwise None."""
    outlets: set[uuid.UUID] = set()
    for m in matches:
        if m is None:
            continue
        if isinstance(m, Outlet):
            outlets.add(m.id)
        else:
            for o in db.scalars(select(Outlet).where(Outlet.account_id == m.id)):
                outlets.add(o.id)
    if len(outlets) != 1:
        return None
    outlet = db.get(Outlet, next(iter(outlets)))
    return outlet if outlet is not None and outlet.state == "pending_payment" else None


def _placeholder_slug() -> str:
    # A real, unguessable slug is only generated at approval (SRS-19.4) since
    # no QR may exist before verification. This satisfies the `slug` NOT NULL
    # + unique constraint in the interim without ever being printed anywhere.
    return f"pending-{uuid.uuid4().hex[:10]}"
