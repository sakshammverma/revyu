"""Trial metering: dedup, completed-flow counting, and the lock/suspend
transitions.

See documents/04-ARCHITECTURE.md §7 and documents/11-OPEN-DECISIONS.md OD-21.

Authority note: documents/06-API-SPEC.md §2.1 still says "trial_flow_count >=
30" — that is a stale, unresolved copy predating OD-21 (15 days, then 10
review credits, then collection stops — not a flat 30-flow count). Per
documents/INDEX.md §5, the topic doc / resolved decision wins over the API
spec.

Two transitions, driven by different triggers:
- `trial` -> `locked` at day 15, regardless of flow count. Proactive, so an
  outlet with few scans still locks on schedule — see
  app/jobs/trial_day15_check.py (04-ARCHITECTURE.md §8).
- `locked` -> `suspended` once 10 more completed flows land after locking
  (OD-21). Reactive, driven by copy_tapped, handled here.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.session import CustomerSession
from app.services.notifications import notify_once

DEDUP_WINDOW = timedelta(hours=24)  # OD-11
TRIAL_CREDITS = 10  # OD-21
# No genuine outlet completes this many flows in an hour at v1 volume; beyond
# it the flows are recorded but stop consuming credits (abuse / burst guard).
MAX_CREDITS_PER_HOUR = 6


def record_completed_flow(db: Session, outlet: Outlet, session: CustomerSession) -> None:
    """Call when a `copy_tapped` event lands for this session. Idempotent:
    a customer who taps copy twice is still one completed flow."""
    if session.completed:
        return
    session.completed = True
    session.completed_at = datetime.now(timezone.utc)

    if _is_duplicate(db, outlet, session):
        db.flush()
        return

    if _hourly_ceiling_hit(db, outlet, session):
        db.flush()
        return

    session.counted_for_trial = True
    outlet.trial_flow_count += 1

    if outlet.state == "locked" and outlet.locked_at_flow_count is not None:
        credits_used = outlet.trial_flow_count - outlet.locked_at_flow_count
        _notify_credit_milestones(db, outlet, credits_used)
        if credits_used >= TRIAL_CREDITS:
            outlet.state = "suspended"
            # Collection stops here — the resolution path reads `state` to
            # decide full-flow vs neutral screen (ANCHOR: collection-stops).

    db.flush()


def _is_duplicate(db: Session, outlet: Outlet, session: CustomerSession) -> bool:
    if not session.device_hash:
        return False
    window_start = datetime.now(timezone.utc) - DEDUP_WINDOW
    prior = (
        db.query(CustomerSession)
        .filter(
            CustomerSession.outlet_id == outlet.id,
            CustomerSession.device_hash == session.device_hash,
            CustomerSession.counted_for_trial.is_(True),
            CustomerSession.started_at >= window_start,
            CustomerSession.id != session.id,
        )
        .first()
    )
    return prior is not None


def _hourly_ceiling_hit(db: Session, outlet: Outlet, session: CustomerSession) -> bool:
    window_start = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (
        db.query(CustomerSession)
        .filter(
            CustomerSession.outlet_id == outlet.id,
            CustomerSession.counted_for_trial.is_(True),
            CustomerSession.completed_at >= window_start,
            CustomerSession.id != session.id,
        )
        .count()
    )
    return recent >= MAX_CREDITS_PER_HOUR


def _notify_credit_milestones(db: Session, outlet: Outlet, credits_used: int) -> None:
    """3-credits-left and collection-paused emails (SRS-9.7, FR-46). Each is
    sent once per outlet, so a burst of flows can't spam the owner."""
    account = db.get(Account, outlet.account_id)
    if account is None:
        return
    link = f"{get_settings().frontend_base_url.rstrip('/')}/app/billing"
    base = {"business_name": outlet.business_name, "payment_link": link}
    left = TRIAL_CREDITS - credits_used
    if credits_used >= TRIAL_CREDITS:
        notify_once(db, account_id=account.id, outlet_id=outlet.id, to_email=account.owner_email,
                    template="collection_paused", data=base)
    elif left <= 3:
        notify_once(db, account_id=account.id, outlet_id=outlet.id, to_email=account.owner_email,
                    template="credits_low", data={**base, "credits_left": left})
