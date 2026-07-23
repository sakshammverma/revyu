import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.models.account import Account
from app.models.event import Event
from app.models.outlet import Outlet
from app.models.place_snapshot import PlaceSnapshot
from app.models.private_feedback import PrivateFeedback
from app.models.session import CustomerSession
from app.models.tag import Tag
from app.schemas.dashboard import (
    FeedbackInboxResponse,
    FeedbackItem,
    FunnelResponse,
    FunnelStep,
    OverviewResponse,
    RatingInfo,
    ResolveFeedbackRequest,
    TagFrequencyItem,
    TagFrequencyResponse,
)
from app.services.outlet_state import is_collecting

router = APIRouter(prefix="/api/app", tags=["dashboard"])

# scan -> ... -> handoff is measurable; anything past it is not (C-1).
FUNNEL_ORDER = [
    "scan",
    "flow_start",
    "rating_selected",
    "tags_selected",
    "draft_viewed",
    "copy_tapped",
    "handoff",
]

INSTRUMENTATION_BOUNDARY_NOTE = (
    "The funnel ends at 'handoff' — everything after (sign-in, paste, submit) "
    "happens on Google's UI and cannot be measured (C-1)."
)


def _get_own_outlet_or_403(db: Session, owner: Account, outlet_id: uuid.UUID) -> Outlet:
    # SRS-15.6 — never scope by client-supplied outlet ID alone.
    outlet = db.get(Outlet, outlet_id)
    if outlet is None or outlet.account_id != owner.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN"}})
    return outlet


def _range_start(range_param: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if range_param == "7d":
        return now - timedelta(days=7)
    if range_param == "30d":
        return now - timedelta(days=30)
    return None  # "all"


@router.get("/outlets/{outlet_id}/overview", response_model=OverviewResponse)
def get_overview(
    outlet_id: uuid.UUID,
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> OverviewResponse:
    outlet = _get_own_outlet_or_403(db, owner, outlet_id)

    scans = db.scalar(
        select(func.count()).select_from(Event).where(Event.outlet_id == outlet.id, Event.type == "scan")
    ) or 0
    completed = db.scalar(
        select(func.count(func.distinct(CustomerSession.id))).where(
            CustomerSession.outlet_id == outlet.id, CustomerSession.completed.is_(True)
        )
    ) or 0

    return OverviewResponse(
        outlet_id=outlet.id,
        business_name=outlet.business_name,
        state=outlet.state,
        scans=scans,
        completed_flows=completed,
        conversion_rate=round(completed / scans, 4) if scans else 0.0,
        trial_flow_count=outlet.trial_flow_count,
        dashboard_locked=outlet.state == "locked",
    )


@router.get("/outlets/{outlet_id}/funnel", response_model=FunnelResponse)
def get_funnel(
    outlet_id: uuid.UUID,
    range: str = Query(default="30d"),
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> FunnelResponse:
    outlet = _get_own_outlet_or_403(db, owner, outlet_id)
    start = _range_start(range)

    steps = []
    prev_count: int | None = None
    for step_type in FUNNEL_ORDER:
        query = select(func.count(func.distinct(Event.session_id))).where(
            Event.outlet_id == outlet.id, Event.type == step_type
        )
        if step_type == "scan":
            # scan has no session_id yet in most cases; count rows instead.
            query = select(func.count()).select_from(Event).where(
                Event.outlet_id == outlet.id, Event.type == "scan"
            )
        if start:
            query = query.where(Event.occurred_at >= start)
        count = db.scalar(query) or 0

        drop_off = None
        if prev_count is not None and prev_count > 0:
            drop_off = round((1 - count / prev_count) * 100, 1)
        steps.append(FunnelStep(step=step_type, count=count, drop_off_pct=drop_off))
        prev_count = count

    return FunnelResponse(steps=steps, note=INSTRUMENTATION_BOUNDARY_NOTE)


@router.get("/outlets/{outlet_id}/tags", response_model=TagFrequencyResponse)
def get_tag_frequency(
    outlet_id: uuid.UUID,
    range: str = Query(default="30d"),
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> TagFrequencyResponse:
    outlet = _get_own_outlet_or_403(db, owner, outlet_id)
    start = _range_start(range)

    query = select(Event.payload).where(Event.outlet_id == outlet.id, Event.type == "tags_selected")
    if start:
        query = query.where(Event.occurred_at >= start)
    rows = db.scalars(query).all()

    tag_ids: Counter[str] = Counter()
    for payload in rows:
        for tag_id in (payload or {}).get("tag_ids", []):
            tag_ids[tag_id] += 1

    tags = db.scalars(select(Tag).where(Tag.outlet_id == outlet.id)).all()
    label_by_id = {str(t.id): t.label.get("en", next(iter(t.label.values()), "")) for t in tags}

    items = [
        TagFrequencyItem(label=label_by_id.get(tid, tid), count=count)
        for tid, count in tag_ids.most_common()
    ]
    return TagFrequencyResponse(tags=items)


@router.get("/outlets/{outlet_id}/rating", response_model=RatingInfo)
def get_rating(
    outlet_id: uuid.UUID,
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> RatingInfo:
    outlet = _get_own_outlet_or_403(db, owner, outlet_id)
    latest = db.scalar(
        select(PlaceSnapshot)
        .where(PlaceSnapshot.outlet_id == outlet.id)
        .order_by(PlaceSnapshot.polled_at.desc())
    )
    return RatingInfo(
        baseline_rating=outlet.baseline_rating,
        baseline_review_count=outlet.baseline_review_count,
        current_rating=latest.rating if latest else outlet.baseline_rating,
        current_review_count=latest.review_count if latest else outlet.baseline_review_count,
        polled_at=latest.polled_at.isoformat() if latest else None,
    )


@router.get("/outlets/{outlet_id}/feedback", response_model=FeedbackInboxResponse)
def get_feedback_inbox(
    outlet_id: uuid.UUID,
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> FeedbackInboxResponse:
    outlet = _get_own_outlet_or_403(db, owner, outlet_id)
    rows = db.scalars(
        select(PrivateFeedback)
        .where(PrivateFeedback.outlet_id == outlet.id)
        .order_by(PrivateFeedback.created_at.desc())
    ).all()
    return FeedbackInboxResponse(
        items=[
            FeedbackItem(
                id=f.id,
                rating=f.rating,
                message=f.message,
                contact=f.contact,
                resolved=f.resolved,
                created_at=f.created_at.isoformat(),
            )
            for f in rows
        ]
    )


@router.patch("/feedback/{feedback_id}", status_code=204)
def resolve_feedback(
    feedback_id: uuid.UUID,
    body: ResolveFeedbackRequest,
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> None:
    feedback = db.get(PrivateFeedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    outlet = db.get(Outlet, feedback.outlet_id)
    if outlet is None or outlet.account_id != owner.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN"}})

    feedback.resolved = body.resolved
    feedback.resolved_at = datetime.now(timezone.utc) if body.resolved else None
    db.commit()


@router.get("/outlets/mine")
def get_my_outlet(
    owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)
) -> dict:
    # v1: one outlet per account (SRS-1.3). Dashboard landing resolves this
    # first to get the outlet_id for the routes above.
    outlet = db.scalar(select(Outlet).where(Outlet.account_id == owner.id))
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return {
        "outlet_id": str(outlet.id),
        "business_name": outlet.business_name,
        "state": outlet.state,
        "collecting": is_collecting(outlet.state),
    }
