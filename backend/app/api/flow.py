import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.private_feedback import PrivateFeedback
from app.models.session import CustomerSession
from app.models.tag import Tag
from app.schemas.flow import (
    FeedbackCreateRequest,
    FeedbackCreateResponse,
    FlowConfigResponse,
    OutletConfig,
    SessionCreateRequest,
    SessionCreateResponse,
    TagConfig,
)
from app.services.notifications import notify
from app.services.outlet_state import is_collecting

router = APIRouter(prefix="/api/flow", tags=["flow"])

DEFAULT_LOCALE = "en"


def _get_outlet_or_404(db: Session, slug: str) -> Outlet:
    # SRS-1.1: slugs resolve case-insensitively (people retype printed URLs).
    outlet = db.scalar(select(Outlet).where(func.lower(Outlet.slug) == slug.lower()))
    if outlet is None:
        # SRS-1.4 — unknown slug gives a branded 404, no existence leak.
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


@router.get("/{slug}/config", response_model=FlowConfigResponse)
def get_flow_config(slug: str, db: Session = Depends(get_db)) -> FlowConfigResponse:
    return build_flow_config(db, _get_outlet_or_404(db, slug))


def build_flow_config(db: Session, outlet: Outlet, *, force_preview: bool = False) -> FlowConfigResponse:
    """Shared by the public flow and the admin approval preview (SRS-19.2)."""
    collecting = is_collecting(outlet.state) and not force_preview
    preview = force_preview or outlet.state == "draft"  # SRS-11.17
    show_full_flow = collecting or preview

    tags: list[TagConfig] = []
    if show_full_flow:
        # Client-side draft assembly (OD-8) — phrases ship with config so the
        # draft screen needs no round trip, the worst drop-off point.
        rows = (
            db.scalars(
                select(Tag)
                .where(Tag.outlet_id == outlet.id, Tag.active.is_(True))
                .order_by(Tag.sort_order)
            )
            .all()
        )
        for tag in rows:
            label = tag.label.get(DEFAULT_LOCALE) or next(iter(tag.label.values()), "")
            phrases = tag.phrases.get(DEFAULT_LOCALE) or next(iter(tag.phrases.values()), [])
            tags.append(
                TagConfig(id=tag.id, label=label, phrases=phrases, sort_order=tag.sort_order)
            )

    return FlowConfigResponse(
        collecting=collecting,
        preview=preview,
        outlet=OutletConfig(
            id=outlet.id,
            business_name=outlet.business_name,
            logo_url=outlet.logo_url,
            vertical=outlet.vertical,
            google_review_url=outlet.google_review_url if show_full_flow else None,
        ),
        tags=tags,
    )


@router.post(
    "/{slug}/session",
    response_model=SessionCreateResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("session", 60, 3600))],
)
def create_session(
    slug: str, body: SessionCreateRequest, db: Session = Depends(get_db)
) -> SessionCreateResponse:
    outlet = _get_outlet_or_404(db, slug)

    existing = db.get(CustomerSession, body.session_id)
    if existing is not None:
        return SessionCreateResponse(
            session_id=existing.id, started_at=existing.started_at.isoformat()
        )

    session = CustomerSession(
        id=body.session_id,
        outlet_id=outlet.id,
        device_hash=body.device_hash,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent duplicate create (double-invoke from a client retry or a
        # React effect firing twice) — idempotent by session_id, so return
        # the row that won the race rather than erroring the customer flow.
        db.rollback()
        existing = db.get(CustomerSession, body.session_id)
        if existing is None:
            raise
        return SessionCreateResponse(
            session_id=existing.id, started_at=existing.started_at.isoformat()
        )
    return SessionCreateResponse(session_id=session.id, started_at=session.started_at.isoformat())


@router.post(
    "/{slug}/feedback",
    response_model=FeedbackCreateResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("feedback", 10, 3600))],
)
def submit_feedback(
    slug: str, body: FeedbackCreateRequest, db: Session = Depends(get_db)
) -> FeedbackCreateResponse:
    outlet = _get_outlet_or_404(db, slug)

    session = db.get(CustomerSession, body.session_id)
    if session is None or session.outlet_id != outlet.id:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_SESSION"}})

    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "EMPTY_MESSAGE"}})

    feedback = PrivateFeedback(
        id=uuid.uuid4(),
        outlet_id=outlet.id,
        session_id=session.id,
        rating=body.rating,
        message=body.message.strip(),
        contact=body.contact,
        created_at=datetime.now(timezone.utc),
    )
    db.add(feedback)
    account = db.get(Account, outlet.account_id)
    if account is not None:
        notify(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="private_feedback_received",
            data={"business_name": outlet.business_name, "rating": body.rating or "n/a"},
        )
    db.commit()

    # CR-3 / SRS-7.5: submitting feedback never suppresses the Google link.
    # No field here instructs the client to hide anything, by design.
    return FeedbackCreateResponse(id=feedback.id, created_at=feedback.created_at.isoformat())
