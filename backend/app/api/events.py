from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.models.account import Account
from app.models.event import Event
from app.models.outlet import Outlet
from app.models.session import CustomerSession
from app.schemas.events import VALID_EVENT_TYPES, EventBatchRequest, EventBatchResponse
from app.services.notifications import notify
from app.services.trial_metering import record_completed_flow

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post(
    "",
    response_model=EventBatchResponse,
    status_code=202,
    dependencies=[Depends(rate_limit("events", 300, 3600))],
)
def post_events(body: EventBatchRequest, db: Session = Depends(get_db)) -> EventBatchResponse:
    # Events are the instrumentation the product's purpose depends on
    # (04-ARCHITECTURE.md §1.3) — accept generously, never block the customer
    # flow on a malformed batch. Unknown event types are silently dropped
    # rather than erroring the whole batch (05-DATA-MODEL.md §5).
    outlet = db.get(Outlet, body.outlet_id)
    if outlet is None:
        return EventBatchResponse(accepted=0)

    if outlet.state in ("draft", "pending_payment", "pending_approval", "rejected"):
        # SRS-11.17 — draft/preview outlets record no events at all: no
        # trial clock, no metering, no funnel pollution from prospecting demos
        # or from the founder previewing a signup before approval.
        return EventBatchResponse(accepted=0)

    accepted = 0
    session = None
    first_scan = any(i.type == "scan" for i in body.events) and (
        db.query(Event.id).filter(Event.outlet_id == outlet.id, Event.type == "scan").first() is None
    )
    if body.session_id is not None:
        session = db.get(CustomerSession, body.session_id)
        if session is not None and session.outlet_id != outlet.id:
            # A session from another outlet must never meter this one.
            session = None

    for item in body.events:
        if item.type not in VALID_EVENT_TYPES:
            continue
        db.add(
            Event(
                outlet_id=body.outlet_id,
                session_id=body.session_id,
                type=item.type,
                payload=_sanitize_payload(item.payload),
            )
        )
        accepted += 1

        if item.type == "copy_tapped" and session is not None:
            # A trial credit is only earned by a believable journey: the
            # session must have rated, and not be implausibly fresh. Stops a
            # script from burning an outlet's credits with bare copy_tapped.
            db.flush()
            if _is_plausible_completion(db, session):
                record_completed_flow(db, outlet, session)

    if first_scan:
        account = db.get(Account, outlet.account_id)
        if account is not None:
            notify(
                db,
                account_id=account.id,
                outlet_id=outlet.id,
                to_email=account.owner_email,
                template="first_scan",
                data={"business_name": outlet.business_name},
            )

    db.commit()
    return EventBatchResponse(accepted=accepted)


MIN_FLOW_SECONDS = 5


def _is_plausible_completion(db: Session, session: CustomerSession) -> bool:
    started = session.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - started < timedelta(seconds=MIN_FLOW_SECONDS):
        return False
    rated = db.query(Event.id).filter(
        Event.session_id == session.id, Event.type == "rating_selected"
    ).first()
    return rated is not None


# CR-1: event payloads carry counts, ids and flags only (e.g. {length},
# {changed: true}, {tag_ids}). Drop any free text so a buggy or hostile client
# can never get review-like text stored in the events table.
_MAX_PAYLOAD_STR = 64


def _sanitize_payload(payload: dict | None) -> dict | None:
    if not payload:
        return payload
    clean: dict = {}
    for key, value in payload.items():
        if isinstance(value, str) and len(value) > _MAX_PAYLOAD_STR:
            continue
        if isinstance(value, list):
            value = [v for v in value if not (isinstance(v, str) and len(v) > _MAX_PAYLOAD_STR)]
        if isinstance(value, dict):
            continue
        clean[key] = value
    return clean
