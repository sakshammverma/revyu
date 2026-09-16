import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.flow import build_flow_config
from app.core.admin_auth import require_admin
from app.core.config import get_settings
from app.core.db import get_db
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.subscription import Subscription
from app.schemas.flow import FlowConfigResponse
from app.services.billing import release_signup_payment
from app.services.referrals import void_reward
from app.services.notifications import notify
from app.schemas.admin import (
    ApprovalQueueItem,
    ApprovalQueueResponse,
    ApproveRequest,
    ApproveResponse,
    CorrectPlaceRequest,
    GoogleMatchInfo,
    OwnerInfo,
    RejectRequest,
    RequestInfoRequest,
)
from app.services.places import PlacesUnavailableError, get_place_snapshot
from app.services.slug import generate_unique_slug

router = APIRouter(
    prefix="/api/admin/approvals", tags=["admin"], dependencies=[Depends(require_admin)]
)


@router.get("", response_model=ApprovalQueueResponse)
def list_approval_queue(db: Session = Depends(get_db)) -> ApprovalQueueResponse:
    # SRS-19.1 — oldest first, with age since submitted_at.
    outlets = (
        db.scalars(
            select(Outlet)
            .where(Outlet.state == "pending_approval")
            .order_by(Outlet.submitted_at.asc())
        )
        .all()
    )

    items = []
    now = datetime.now(timezone.utc)
    for outlet in outlets:
        account = db.get(Account, outlet.account_id)
        age_hours = 0.0
        if outlet.submitted_at:
            age_hours = round((now - outlet.submitted_at).total_seconds() / 3600, 1)

        rating, review_count = None, None
        if outlet.google_place_id:
            try:
                rating, review_count = get_place_snapshot(outlet.google_place_id)
            except PlacesUnavailableError:
                pass  # queue must still render if Places is briefly down

        items.append(
            ApprovalQueueItem(
                outlet_id=outlet.id,
                business_name=outlet.business_name,
                vertical=outlet.vertical,
                owner=OwnerInfo(
                    name=account.owner_name if account else None,
                    phone=account.owner_phone if account else "",
                    email=account.owner_email if account else "",
                ),
                google_match=GoogleMatchInfo(
                    place_id=outlet.google_place_id,
                    name=outlet.business_name,
                    address=None,  # SRS-19.2 wants full address; requires Places details call
                    rating=rating,
                    review_count=review_count,
                ),
                preview_url=f"/admin/preview/{outlet.id}",
                payment_status=_payment_status(db, outlet.account_id),
                submitted_at=outlet.submitted_at.isoformat() if outlet.submitted_at else None,
                age_hours=age_hours,
            )
        )
    return ApprovalQueueResponse(items=items)


def _payment_status(db: Session, account_id: uuid.UUID) -> str:
    sub = db.scalar(
        select(Subscription)
        .where(Subscription.account_id == account_id, Subscription.status != "abandoned")
        .order_by(Subscription.created_at.desc())
    )
    if sub is None:
        return "none"
    if sub.razorpay_order_id:
        return "paid" if sub.status == "active" else sub.status
    return "mandate_authorised" if sub.mandate_status == "active" else f"mandate_{sub.mandate_status}"


@router.get("/{outlet_id}/preview", response_model=FlowConfigResponse)
def preview_outlet(outlet_id: uuid.UUID, db: Session = Depends(get_db)) -> FlowConfigResponse:
    # SRS-19.2 — "a working preview link to their customer flow, fully
    # branded". Served by id because a pending outlet has no real slug yet.
    return build_flow_config(db, _get_pending_outlet_or_404(db, outlet_id), force_preview=True)


def _get_pending_outlet_or_404(db: Session, outlet_id: uuid.UUID) -> Outlet:
    outlet = db.get(Outlet, outlet_id)
    if outlet is None or outlet.state != "pending_approval":
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


@router.post("/{outlet_id}/approve", response_model=ApproveResponse)
def approve_outlet(
    outlet_id: uuid.UUID, body: ApproveRequest, db: Session = Depends(get_db)
) -> ApproveResponse:
    outlet = _get_pending_outlet_or_404(db, outlet_id)

    # SRS-19.3 — both checks required, explicitly, no implicit approval.
    if not (body.place_verified and body.placement_confirmed):
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_FAILED",
                    "message": "place_verified and placement_confirmed must both be true",
                }
            },
        )

    slug = generate_unique_slug(db)
    now = datetime.now(timezone.utc)

    outlet.slug = slug
    outlet.place_verified = True
    outlet.placement_confirmed = True
    outlet.approved_at = now
    outlet.approved_by = "founder"  # single-admin v1 (see core/admin_auth.py)
    outlet.state = "trial"
    outlet.activated_at = now

    if outlet.google_place_id:
        try:
            rating, review_count = get_place_snapshot(outlet.google_place_id)
            outlet.baseline_rating = rating
            outlet.baseline_review_count = review_count
        except PlacesUnavailableError:
            pass  # baseline capture is best-effort; approval must not block on it

    # SRS-19.5 — email the owner their dashboard link (QR + print files live
    # there). notify() logs failures instead of raising, so approval can't
    # fail on a send.
    account = db.get(Account, outlet.account_id)
    if account is not None:
        settings = get_settings()
        notify(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="outlet_activated",
            data={
                "business_name": outlet.business_name,
                "short_url": f"{settings.public_flow_base_url.rstrip('/')}/r/{outlet.slug}",
                "dashboard_url": f"{settings.frontend_base_url.rstrip('/')}/app/login",
            },
        )
    db.commit()

    return ApproveResponse(
        state=outlet.state,
        slug=outlet.slug,
        short_url=f"/r/{outlet.slug}",
        activated_at=outlet.activated_at.isoformat(),
    )


@router.post("/{outlet_id}/request-info", status_code=204)
def request_info(outlet_id: uuid.UUID, body: RequestInfoRequest, db: Session = Depends(get_db)) -> None:
    # SRS-19.6 — stays pending_approval, payment retained, owner emailed the
    # question; they reply by email (the notification row is the record).
    outlet = _get_pending_outlet_or_404(db, outlet_id)
    account = db.get(Account, outlet.account_id)
    if account is not None:
        notify(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="needs_info",
            data={"business_name": outlet.business_name, "message": body.message},
        )
    db.commit()


@router.post("/{outlet_id}/reject", status_code=204)
def reject_outlet(outlet_id: uuid.UUID, body: RejectRequest, db: Session = Depends(get_db)) -> None:
    outlet = _get_pending_outlet_or_404(db, outlet_id)
    outlet.state = "rejected"
    outlet.rejection_reason = body.reason

    # SRS-19.7 — refund captured payments and cancel any mandate. Gateway
    # failures are logged for manual follow-up rather than blocking rejection.
    one_time = _payment_status(db, outlet.account_id) == "paid"
    problems = release_signup_payment(db, outlet.account_id) if body.refund else []
    void_reward(db, outlet.account_id)

    account = db.get(Account, outlet.account_id)
    if account is not None:
        if not body.refund:
            refund_line = "Please contact us about your payment."
        elif problems:
            refund_line = "We're processing your refund and will confirm by email."
        elif one_time:
            refund_line = "Your payment has been refunded in full; it can take 5–7 business days to appear."
        else:
            refund_line = "Your payment authorisation has been cancelled — you will not be charged."
        notify(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="signup_rejected",
            data={"business_name": outlet.business_name, "reason": body.reason, "refund_line": refund_line},
        )
    db.commit()


@router.patch("/{outlet_id}/place", status_code=204)
def correct_place(outlet_id: uuid.UUID, body: CorrectPlaceRequest, db: Session = Depends(get_db)) -> None:
    # SRS-19.8 — admin may correct the Place ID before approving.
    from app.services.places import build_review_url

    outlet = _get_pending_outlet_or_404(db, outlet_id)
    outlet.google_place_id = body.place_id
    outlet.google_review_url = build_review_url(body.place_id)
    db.commit()
