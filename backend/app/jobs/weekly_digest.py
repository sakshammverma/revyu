"""Weekly owner WhatsApp/email digest (SRS-13.3, FR-28). Unprompted proof of
value in the channel the owner actually reads — the cheapest retention
mechanism available (documents/10-ROADMAP.md §2.4).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.event import Event
from app.models.outlet import Outlet
from app.models.place_snapshot import PlaceSnapshot
from app.models.session import CustomerSession
from app.services import competitors
from app.services.notifications import notify
from app.services.outlet_state import is_collecting


def run_weekly_digest(db: Session) -> int:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    outlets = db.scalars(select(Outlet)).all()
    sent = 0

    for outlet in outlets:
        if not is_collecting(outlet.state):
            continue  # a paused outlet has nothing new to report

        account = db.get(Account, outlet.account_id)
        if account is None:
            continue

        scans = db.scalar(
            select(func.count())
            .select_from(Event)
            .where(Event.outlet_id == outlet.id, Event.type == "scan", Event.occurred_at >= week_ago)
        ) or 0
        completed = db.scalar(
            select(func.count(func.distinct(CustomerSession.id))).where(
                CustomerSession.outlet_id == outlet.id,
                CustomerSession.completed.is_(True),
                CustomerSession.completed_at >= week_ago,
            )
        ) or 0
        latest_snapshot = db.scalar(
            select(PlaceSnapshot)
            .where(PlaceSnapshot.outlet_id == outlet.id)
            .order_by(PlaceSnapshot.polled_at.desc())
        )
        rating = latest_snapshot.rating if latest_snapshot else outlet.baseline_rating

        notify(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="weekly_digest",
            data={
                "business_name": outlet.business_name,
                "scans": scans,
                "completed": completed,
                "rating": rating,
                "competitor_line": _competitor_line(db, outlet),
            },
        )
        sent += 1

    db.commit()
    return sent


def _competitor_line(db: Session, outlet: Outlet) -> str | None:
    me, rivals = competitors.standings(db, outlet)
    if not rivals:
        return None
    return competitors.headline(me, [r for _, r in rivals])
