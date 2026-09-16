"""Daily trial day-15 lock check (documents/04-ARCHITECTURE.md §8).

Credit exhaustion (10 completed flows) is event-driven and handled inline in
app/services/trial_metering.py on copy_tapped. This job covers the case that
reactive check cannot: an outlet that reaches day 15 without hitting 10
flows yet still needs its dashboard locked and its credit countdown started
(OD-21) — otherwise a low-scan outlet would stay in unlimited `trial` state
forever, which was exactly the leak OD-21 closed.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.account import Account
from app.models.event import Event
from app.models.outlet import Outlet
from app.services.billing import has_paid_period
from app.services.notifications import notify_once

TRIAL_DAYS = 15  # OD-21


def run_trial_day15_check(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=TRIAL_DAYS)

    outlets = db.scalars(
        select(Outlet).where(
            Outlet.state == "trial",
            Outlet.activated_at.is_not(None),
            Outlet.activated_at <= cutoff,
        )
    ).all()

    for outlet in outlets:
        if has_paid_period(db, outlet.account_id):
            # Paid up front (annual / one-time fallback): nothing to lock.
            outlet.state = "active"
            continue
        outlet.state = "locked"
        outlet.locked_at_flow_count = outlet.trial_flow_count
        _send_lifecycle(db, outlet, "trial_threshold")
        # Collection is unaffected — the resolution path treats `locked`
        # identically to `trial` (app/services/outlet_state.py). Only the
        # dashboard gate reads this transition (FR-45). The 10-credit
        # countdown to `suspended` is measured from locked_at_flow_count
        # (app/services/trial_metering.py), not from zero.

    _send_day10_reminders(db)
    db.commit()
    return len(outlets)


REMINDER_DAY = 10  # 5 days before the lock


def _payment_link() -> str:
    return f"{get_settings().frontend_base_url.rstrip('/')}/app/billing"


def _send_lifecycle(db: Session, outlet: Outlet, template: str, **extra) -> None:
    account = db.get(Account, outlet.account_id)
    if account is None:
        return
    scans = db.scalar(
        select(func.count()).select_from(Event).where(Event.outlet_id == outlet.id, Event.type == "scan")
    ) or 0
    notify_once(
        db,
        account_id=account.id,
        outlet_id=outlet.id,
        to_email=account.owner_email,
        template=template,
        data={
            "business_name": outlet.business_name,
            "scans": scans,
            "completed": outlet.trial_flow_count,
            "payment_link": _payment_link(),
            **extra,
        },
    )


def _send_day10_reminders(db: Session) -> None:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=TRIAL_DAYS)
    due = db.scalars(
        select(Outlet).where(
            Outlet.state == "trial",
            Outlet.activated_at.is_not(None),
            Outlet.activated_at <= now - timedelta(days=REMINDER_DAY),
            Outlet.activated_at > window_start,
        )
    ).all()
    for outlet in due:
        if has_paid_period(db, outlet.account_id):
            continue
        _send_lifecycle(db, outlet, "trial_reminder", days_left=TRIAL_DAYS - REMINDER_DAY)
