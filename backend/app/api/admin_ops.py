"""Founder operations: pending WhatsApp sends, the kill-metric cockpit, outlet
detail and the manual state override (SRS-11.9)."""

import statistics
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.db import get_db
from app.jobs.zero_scan_alert import find_zero_scan_outlets
from app.models.account import Account
from app.models.event import Event
from app.models.notification import Notification
from app.models.outlet import Outlet
from app.models.payment import Payment
from app.models.place_snapshot import PlaceSnapshot
from app.models.session import CustomerSession
from app.models.subscription import Subscription
from app.models.tag import Tag
from app.services.notifications.click_to_chat_backend import build_link

router = APIRouter(prefix="/api/admin", tags=["admin-ops"], dependencies=[Depends(require_admin)])

LIVE_STATES = ("trial", "locked", "active", "past_due", "suspended")
MIN_SCANS_FOR_MEDIAN = 10


# ── Pending sends ──────────────────────────────────────────────────────────
class PendingSend(BaseModel):
    id: uuid.UUID
    template: str
    business_name: str | None
    owner_name: str | None
    to_phone: str
    body: str
    link: str
    created_at: str


@router.get("/pending-sends", response_model=list[PendingSend])
def list_pending_sends(db: Session = Depends(get_db)) -> list[PendingSend]:
    rows = db.scalars(
        select(Notification)
        .where(Notification.channel == "click_to_chat", Notification.status == "queued")
        .order_by(Notification.created_at.desc())
        .limit(200)
    ).all()
    out = []
    for n in rows:
        if not n.to_phone or not n.body:
            continue
        outlet = db.get(Outlet, n.outlet_id) if n.outlet_id else None
        account = db.get(Account, n.account_id)
        out.append(
            PendingSend(
                id=n.id,
                template=n.template,
                business_name=outlet.business_name if outlet else None,
                owner_name=account.owner_name if account else None,
                to_phone=n.to_phone,
                body=n.body,
                link=build_link(n.to_phone, n.body),
                created_at=n.created_at.isoformat(),
            )
        )
    return out


def _queued(db: Session, send_id: uuid.UUID) -> Notification:
    n = db.get(Notification, send_id)
    if n is None or n.channel != "click_to_chat":
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND"}})
    return n


@router.post("/pending-sends/{send_id}/sent", status_code=204)
def mark_sent(send_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    n = _queued(db, send_id)
    n.status = "sent"
    n.sent_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/pending-sends/{send_id}/dismiss", status_code=204)
def dismiss(send_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    _queued(db, send_id).status = "dismissed"
    db.commit()


# ── Kill-metric cockpit ────────────────────────────────────────────────────
class OutletMetric(BaseModel):
    outlet_id: uuid.UUID
    business_name: str
    vertical: str
    source: str
    state: str
    scans: int
    completed: int
    conversion: float | None


class Cockpit(BaseModel):
    window_days: int
    installs: int
    by_source: dict[str, int]
    cohort_scans: int
    cohort_completed: int
    cohort_conversion: float | None
    median_conversion: float | None
    median_sample: int
    band: str  # stop | iterate | fix | push | unknown
    band_label: str
    tenth_install_at: str | None
    decision_date: str | None
    days_to_decision: int | None
    trial_to_paid: float | None
    trial_eligible: int
    zero_scan: list[str]
    outlets: list[OutletMetric]


def band_for(conversion: float | None) -> tuple[str, str]:
    """Bands from documents/07-METRICS.md."""
    if conversion is None:
        return "unknown", "Not enough scans yet"
    if conversion < 0.05:
        return "stop", "Under 5%: the product isn't working. Stop and rethink."
    if conversion < 0.10:
        return "iterate", "5-10%: iterate on the flow before pushing distribution."
    if conversion < 0.20:
        return "fix", "10-20%: find and fix the worst funnel step."
    return "push", "Over 20%: push distribution hard."


@router.get("/metrics", response_model=Cockpit)
def cockpit(db: Session = Depends(get_db)) -> Cockpit:
    window = 30
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window)

    installed = db.scalars(
        select(Outlet).where(Outlet.activated_at.is_not(None), Outlet.state.in_(LIVE_STATES + ("deactivated",)))
    ).all()

    scan_rows = dict(
        db.execute(
            select(Event.outlet_id, func.count())
            .where(Event.type == "scan", Event.occurred_at >= since)
            .group_by(Event.outlet_id)
        ).all()
    )
    done_rows = dict(
        db.execute(
            select(CustomerSession.outlet_id, func.count())
            .where(CustomerSession.completed.is_(True), CustomerSession.completed_at >= since)
            .group_by(CustomerSession.outlet_id)
        ).all()
    )

    metrics = []
    for o in installed:
        scans, done = scan_rows.get(o.id, 0), done_rows.get(o.id, 0)
        metrics.append(
            OutletMetric(
                outlet_id=o.id,
                business_name=o.business_name,
                vertical=o.vertical,
                source=o.source,
                state=o.state,
                scans=scans,
                completed=done,
                conversion=(done / scans) if scans else None,
            )
        )

    # The kill metric is measured on the direct-mode cohort only, so the hub's
    # extra step never confounds it (OD-26).
    cohort_ids = {o.id for o in installed if o.hub_mode == "direct"}
    cohort = [m for m in metrics if m.outlet_id in cohort_ids]
    c_scans = sum(m.scans for m in cohort)
    c_done = sum(m.completed for m in cohort)
    cohort_conv = (c_done / c_scans) if c_scans else None
    sample = [m.conversion for m in cohort if m.conversion is not None and m.scans >= MIN_SCANS_FOR_MEDIAN]
    median = statistics.median(sample) if sample else None
    # Judge on the median per-outlet, never a blended headline (07-METRICS).
    band, label = band_for(median)

    by_source: dict[str, int] = {}
    for o in installed:
        by_source[o.source] = by_source.get(o.source, 0) + 1

    ordered = sorted(o.activated_at for o in installed)
    tenth = ordered[9] if len(ordered) >= 10 else None
    decision = tenth + timedelta(days=30) if tenth else None

    eligible = [o for o in installed if o.activated_at <= now - timedelta(days=15)]
    paid = 0
    for o in eligible:
        has_payment = db.scalar(
            select(func.count())
            .select_from(Payment)
            .join(Subscription, Subscription.id == Payment.subscription_id)
            .where(Subscription.account_id == o.account_id, Payment.status == "captured")
        )
        paid += 1 if has_payment else 0

    return Cockpit(
        window_days=window,
        installs=len(installed),
        by_source=by_source,
        cohort_scans=c_scans,
        cohort_completed=c_done,
        cohort_conversion=cohort_conv,
        median_conversion=median,
        median_sample=len(sample),
        band=band,
        band_label=label,
        tenth_install_at=tenth.isoformat() if tenth else None,
        decision_date=decision.isoformat() if decision else None,
        days_to_decision=(decision - now).days if decision else None,
        trial_to_paid=(paid / len(eligible)) if eligible else None,
        trial_eligible=len(eligible),
        zero_scan=[o.business_name for o in find_zero_scan_outlets(db)],
        outlets=sorted(metrics, key=lambda m: m.scans, reverse=True),
    )


# ── Outlet detail + state override ─────────────────────────────────────────
class TagOut(BaseModel):
    id: uuid.UUID
    label: str
    phrases: list[str]
    sort_order: int
    active: bool


class OutletDetail(BaseModel):
    id: uuid.UUID
    business_name: str
    slug: str
    vertical: str
    state: str
    source: str
    hub_mode: str
    owner_name: str | None
    owner_email: str
    owner_phone: str
    google_place_id: str | None
    activated_at: str | None
    trial_flow_count: int
    scans_30d: int
    completed_30d: int
    tags: list[TagOut]
    payments: list[dict]
    notifications: list[dict]
    snapshots: list[dict]


@router.get("/outlets/{outlet_id}/detail", response_model=OutletDetail)
def outlet_detail(outlet_id: uuid.UUID, db: Session = Depends(get_db)) -> OutletDetail:
    o = db.get(Outlet, outlet_id)
    if o is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    account = db.get(Account, o.account_id)
    since = datetime.now(timezone.utc) - timedelta(days=30)

    tags = db.scalars(select(Tag).where(Tag.outlet_id == o.id).order_by(Tag.sort_order)).all()
    payments = db.execute(
        select(Payment.amount_minor, Payment.currency_code, Payment.status, Payment.created_at)
        .join(Subscription, Subscription.id == Payment.subscription_id)
        .where(Subscription.account_id == o.account_id)
        .order_by(Payment.created_at.desc())
        .limit(10)
    ).all()
    notes = db.scalars(
        select(Notification).where(Notification.outlet_id == o.id).order_by(Notification.created_at.desc()).limit(20)
    ).all()
    snaps = db.scalars(
        select(PlaceSnapshot).where(PlaceSnapshot.outlet_id == o.id).order_by(PlaceSnapshot.polled_at.desc()).limit(6)
    ).all()

    def lbl(d: dict) -> str:
        return d.get("en") or next(iter(d.values()), "")

    return OutletDetail(
        id=o.id,
        business_name=o.business_name,
        slug=o.slug,
        vertical=o.vertical,
        state=o.state,
        source=o.source,
        hub_mode=o.hub_mode,
        owner_name=account.owner_name if account else None,
        owner_email=account.owner_email if account else "",
        owner_phone=account.owner_phone if account else "",
        google_place_id=o.google_place_id,
        activated_at=o.activated_at.isoformat() if o.activated_at else None,
        trial_flow_count=o.trial_flow_count,
        scans_30d=db.scalar(
            select(func.count()).select_from(Event).where(Event.outlet_id == o.id, Event.type == "scan", Event.occurred_at >= since)
        ) or 0,
        completed_30d=db.scalar(
            select(func.count()).select_from(CustomerSession).where(
                CustomerSession.outlet_id == o.id, CustomerSession.completed.is_(True), CustomerSession.completed_at >= since
            )
        ) or 0,
        tags=[TagOut(id=t.id, label=lbl(t.label), phrases=t.phrases.get("en", []) if t.phrases else [],
                     sort_order=t.sort_order, active=t.active) for t in tags],
        payments=[
            {"amount_minor": a, "currency_code": c, "status": s, "created_at": d.isoformat()}
            for a, c, s, d in payments
        ],
        notifications=[
            {"template": n.template, "channel": n.channel, "status": n.status, "created_at": n.created_at.isoformat()}
            for n in notes
        ],
        snapshots=[
            {"rating": float(s.rating) if s.rating is not None else None, "review_count": s.review_count,
             "polled_at": s.polled_at.isoformat()}
            for s in snaps
        ],
    )


class StateOverride(BaseModel):
    state: str
    reason: str = Field(min_length=3, max_length=300)


OVERRIDABLE = {"trial", "locked", "active", "past_due", "suspended", "deactivated"}


@router.post("/outlets/{outlet_id}/state", status_code=204)
def override_state(outlet_id: uuid.UUID, body: StateOverride, db: Session = Depends(get_db)) -> None:
    """SRS-11.9: founder can force a state (comp an outlet, pause one). The
    reason is required and logged."""
    if body.state not in OVERRIDABLE:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_STATE"}})
    o = db.get(Outlet, outlet_id)
    if o is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    previous = o.state
    o.state = body.state
    db.add(
        Notification(
            id=uuid.uuid4(),
            account_id=o.account_id,
            outlet_id=o.id,
            template="admin_state_override",
            channel="internal",
            status="sent",
            error=f"{previous} -> {body.state}: {body.reason}"[:500],
            sent_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
