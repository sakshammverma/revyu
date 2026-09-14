"""Review Gap Report - a public, no-login comparison of a business's Google
presence against the strongest nearby competitors in its category.

Uses only public Places data and makes no outcome promise (compliance: no
guaranteed-result claims). This is both a self-serve sales tool and the source
for walk-in leave-behinds.
"""

from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.services.places import PlacesUnavailableError

NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"
SEARCH_RADIUS_M = 3000


@dataclass
class Business:
    place_id: str
    name: str
    rating: float | None
    review_count: int | None


@dataclass
class GapReport:
    business: Business
    competitors: list[Business]
    top_competitor: Business | None
    review_gap: int  # top competitor's count minus ours (>= 0)
    rank_by_reviews: int  # 1 = most reviews among the group
    group_size: int
    headline: str


def _headline(me: Business, top: Business | None, gap: int, rank: int, n: int) -> str:
    if top is None or me.review_count is None:
        return "We could not find enough nearby businesses to compare yet."
    if gap == 0:
        return f"You lead your area with {me.review_count} reviews. Keep the gap wide."
    return (
        f"{top.name} has {top.review_count} reviews; you have {me.review_count}. "
        f"You rank {rank} of {n} nearby by review count."
    )


def build_report(place_id: str) -> GapReport:
    me, competitors = _fetch(place_id)
    with_counts = [c for c in competitors if c.review_count is not None]
    with_counts.sort(key=lambda c: c.review_count or 0, reverse=True)
    top3 = with_counts[:3]
    top = top3[0] if top3 else None

    mine = me.review_count or 0
    gap = max(0, (top.review_count or 0) - mine) if top else 0
    group = [mine] + [c.review_count or 0 for c in with_counts]
    rank = sorted(group, reverse=True).index(mine) + 1
    return GapReport(
        business=me,
        competitors=top3,
        top_competitor=top,
        review_gap=gap,
        rank_by_reviews=rank,
        group_size=len(group),
        headline=_headline(me, top, gap, rank, len(group)),
    )


def _fetch(place_id: str) -> tuple[Business, list[Business]]:
    settings = get_settings()
    if not settings.google_places_api_key:
        if settings.is_local:
            return _fake(place_id)
        raise PlacesUnavailableError("GOOGLE_PLACES_API_KEY is not configured")

    key = settings.google_places_api_key
    try:
        det = httpx.get(
            DETAILS_URL.format(place_id=place_id),
            headers={
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,location,primaryType",
            },
            timeout=10.0,
        )
        det.raise_for_status()
        d = det.json()
        me = Business(
            place_id=d.get("id", place_id),
            name=d.get("displayName", {}).get("text", ""),
            rating=d.get("rating"),
            review_count=d.get("userRatingCount"),
        )
        loc = d.get("location")
        ptype = d.get("primaryType")
        if not loc:
            return me, []
        body = {
            "maxResultCount": 20,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": loc["latitude"], "longitude": loc["longitude"]},
                    "radius": float(SEARCH_RADIUS_M),
                }
            },
        }
        if ptype:
            body["includedPrimaryTypes"] = [ptype]
        near = httpx.post(
            NEARBY_URL,
            json=body,
            headers={
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
            },
            timeout=10.0,
        )
        near.raise_for_status()
    except httpx.HTTPError as exc:
        raise PlacesUnavailableError(f"Places lookup failed: {exc}") from exc

    comps = [
        Business(
            place_id=p.get("id", ""),
            name=p.get("displayName", {}).get("text", ""),
            rating=p.get("rating"),
            review_count=p.get("userRatingCount"),
        )
        for p in near.json().get("places", [])
        if p.get("id") != me.place_id
    ]
    return me, comps


def _fake(place_id: str) -> tuple[Business, list[Business]]:
    """Deterministic local/dev data so the UI is buildable without a key."""
    me = Business(place_id, "Your Clinic", 4.3, 47)
    comps = [
        Business("local-c1", "Smile Care Dental", 4.6, 180),
        Business("local-c2", "Bright Teeth Clinic", 4.5, 132),
        Business("local-c3", "City Dental Studio", 4.4, 96),
    ]
    return me, comps
