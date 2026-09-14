"""Competitor Watch.

An owner follows up to three nearby businesses. The weekly Places poll records
each one's public rating and review count, and the owner sees who is gaining
reviews fastest. Only public Google data is used. Nothing is read about whether
a rival also uses Revyu, so it behaves identically either way.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.competitor import CompetitorSnapshot, CompetitorWatch
from app.models.outlet import Outlet
from app.models.place_snapshot import PlaceSnapshot
from app.services.outlet_state import is_collecting
from app.services.places import PlacesUnavailableError, get_place_snapshot

MAX_WATCHES = 3


class WatchError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass
class Standing:
    name: str
    rating: float | None
    review_count: int | None
    delta: int | None  # reviews gained since the previous check; None = no history yet


def add_watch(db: Session, outlet: Outlet, place_id: str, name: str) -> CompetitorWatch:
    if place_id == outlet.google_place_id:
        raise WatchError("CANNOT_WATCH_SELF")
    existing = db.scalars(select(CompetitorWatch).where(CompetitorWatch.outlet_id == outlet.id)).all()
    if any(w.place_id == place_id for w in existing):
        raise WatchError("ALREADY_WATCHING")
    if len(existing) >= MAX_WATCHES:
        raise WatchError("LIMIT_REACHED")

    watch = CompetitorWatch(id=uuid.uuid4(), outlet_id=outlet.id, place_id=place_id, name=name.strip()[:120])
    db.add(watch)
    db.flush()
    take_snapshot(db, watch)  # baseline so the first delta is meaningful
    return watch


def take_snapshot(db: Session, watch: CompetitorWatch) -> bool:
    try:
        rating, count = get_place_snapshot(watch.place_id)
    except PlacesUnavailableError:
        return False
    db.add(CompetitorSnapshot(watch_id=watch.id, rating=rating, review_count=count))
    db.flush()
    return True


def poll_all(db: Session) -> int:
    """Snapshot every watched competitor of a live outlet (called weekly)."""
    polled = 0
    for watch in db.scalars(select(CompetitorWatch)):
        outlet = db.get(Outlet, watch.outlet_id)
        if outlet is None or not is_collecting(outlet.state):
            continue
        if take_snapshot(db, watch):
            polled += 1
    return polled


def _delta(counts: list[int | None]) -> int | None:
    """counts: newest first. Gain between the two most recent checks."""
    known = [c for c in counts if c is not None]
    if len(known) < 2:
        return None
    return known[0] - known[1]


def standings(db: Session, outlet: Outlet) -> tuple[Standing, list[tuple[CompetitorWatch, Standing]]]:
    mine = db.scalars(
        select(PlaceSnapshot).where(PlaceSnapshot.outlet_id == outlet.id).order_by(PlaceSnapshot.polled_at.desc()).limit(2)
    ).all()
    my_counts = [s.review_count for s in mine]
    if len(my_counts) == 1 and outlet.baseline_review_count is not None:
        my_counts.append(outlet.baseline_review_count)
    me = Standing(
        name=outlet.business_name,
        rating=float(mine[0].rating) if mine and mine[0].rating is not None else (
            float(outlet.baseline_rating) if outlet.baseline_rating is not None else None
        ),
        review_count=mine[0].review_count if mine else outlet.baseline_review_count,
        delta=_delta(my_counts),
    )

    rivals = []
    for watch in db.scalars(
        select(CompetitorWatch).where(CompetitorWatch.outlet_id == outlet.id).order_by(CompetitorWatch.created_at)
    ):
        snaps = db.scalars(
            select(CompetitorSnapshot)
            .where(CompetitorSnapshot.watch_id == watch.id)
            .order_by(CompetitorSnapshot.polled_at.desc())
            .limit(2)
        ).all()
        rivals.append(
            (
                watch,
                Standing(
                    name=watch.name,
                    rating=float(snaps[0].rating) if snaps and snaps[0].rating is not None else None,
                    review_count=snaps[0].review_count if snaps else None,
                    delta=_delta([s.review_count for s in snaps]),
                ),
            )
        )
    return me, rivals


def headline(me: Standing, rivals: list[Standing]) -> str:
    if not rivals:
        return "Follow up to three nearby businesses to see who is gaining reviews fastest."
    moving = [r for r in rivals if r.delta is not None]
    if me.delta is None or not moving:
        return "We're collecting the first numbers. Check back after the next weekly update."
    top = max(moving, key=lambda r: r.delta or 0)
    if me.delta > (top.delta or 0):
        return f"You gained {me.delta} reviews last week, more than anyone you follow."
    if me.delta == (top.delta or 0):
        return f"You and {top.name} both gained {me.delta} last week."
    return f"{top.name} gained {top.delta} reviews last week; you gained {me.delta}."
