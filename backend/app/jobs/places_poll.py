"""Weekly Google Places poll (documents/04-ARCHITECTURE.md §8, SRS-14.1).

Never used for trial metering (C-2) — purely a lagging business indicator
recorded in place_snapshots for the owner's rating-delta view.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.outlet import Outlet
from app.models.place_snapshot import PlaceSnapshot
from app.services import competitors
from app.services.outlet_state import is_collecting
from app.services.places import PlacesUnavailableError, get_place_snapshot

logger = logging.getLogger("revyu.jobs.places_poll")


def run_places_poll(db: Session) -> int:
    """Polls every active (collecting) outlet with a Place ID. Returns the
    number of outlets successfully polled."""
    outlets = db.scalars(
        select(Outlet).where(Outlet.google_place_id.is_not(None))
    ).all()

    polled = 0
    for outlet in outlets:
        if not is_collecting(outlet.state):
            continue  # no reason to poll an outlet that isn't live
        try:
            rating, review_count = get_place_snapshot(outlet.google_place_id)
        except PlacesUnavailableError as exc:
            logger.warning("Places poll failed for outlet %s: %s", outlet.id, exc)
            continue

        db.add(
            PlaceSnapshot(outlet_id=outlet.id, rating=rating, review_count=review_count)
        )
        polled += 1

    competitors.poll_all(db)
    db.commit()
    return polled
