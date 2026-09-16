"""Monthly event retention prune (NFR-10, 24 months). Events are append-only
and never deleted before this expiry (documents/05-DATA-MODEL.md §1).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.event import Event

RETENTION_MONTHS = 24


def run_event_retention_prune(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_MONTHS * 30)
    result = db.execute(delete(Event).where(Event.occurred_at < cutoff))
    db.commit()
    return result.rowcount
