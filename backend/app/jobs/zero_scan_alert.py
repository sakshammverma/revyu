"""Zero-scan alert at 7 days post-activation (R-8, documents/07-METRICS.md).

Founder-facing, not owner-facing: an outlet with no scans a week in means
nobody handed out the QR — an install-quality problem, not a product one
(documents/15-HOW-IT-WORKS.md). Surfaced by returning the list for the
founder's daily/weekly review rather than an automated owner notification,
since there's no admin alert inbox yet — the caller (a scheduled job runner)
logs or emails this list.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.outlet import Outlet


def find_zero_scan_outlets(db: Session) -> list[Outlet]:
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    candidates = db.scalars(
        select(Outlet).where(
            Outlet.state.in_(("trial", "locked", "active", "past_due")),
            Outlet.activated_at.is_not(None),
            Outlet.activated_at <= seven_days_ago,
        )
    ).all()

    zero_scan = []
    for outlet in candidates:
        has_scan = db.scalar(
            select(exists().where(Event.outlet_id == outlet.id, Event.type == "scan"))
        )
        if not has_scan:
            zero_scan.append(outlet)
    return zero_scan


def run_zero_scan_nudges(db: Session) -> int:
    """Email (and queue a WhatsApp tap for) each owner whose QR has had no
    scans a week in. Sent once per outlet."""
    from app.models.account import Account
    from app.services.notifications import notify_once

    sent = 0
    for outlet in find_zero_scan_outlets(db):
        account = db.get(Account, outlet.account_id)
        if account is None:
            continue
        if notify_once(
            db,
            account_id=account.id,
            outlet_id=outlet.id,
            to_email=account.owner_email,
            template="zero_scan_nudge",
            data={"business_name": outlet.business_name},
        ):
            sent += 1
    db.commit()
    return sent
