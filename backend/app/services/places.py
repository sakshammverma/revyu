"""Google Places integration — business search and review URL construction.

See documents/04-ARCHITECTURE.md §9.3. Used at signup (SRS-18.3) and at
admin activation (FR-34/35). Never used for trial metering (C-2).
"""

from dataclasses import dataclass

import httpx

from app.core.config import get_settings

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"


@dataclass
class PlaceResult:
    place_id: str
    name: str
    address: str
    rating: float | None
    review_count: int | None


class PlacesUnavailableError(RuntimeError):
    """Raised when the Places API key is not configured or the call fails."""


def search_places(query: str, near: str | None = None) -> list[PlaceResult]:
    settings = get_settings()
    if not settings.google_places_api_key:
        if settings.environment == "local":
            clean_q = query.strip() or "Sample Business"
            return [
                PlaceResult(
                    place_id=f"ChIJ_local_{abs(hash(clean_q)) % 100000}",
                    name=clean_q,
                    address="100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038",
                    rating=4.9,
                    review_count=142,
                ),
                PlaceResult(
                    place_id=f"ChIJ_local_alt_{abs(hash(clean_q)) % 100000}",
                    name=f"{clean_q} (Main Branch)",
                    address="12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560008",
                    rating=4.8,
                    review_count=89,
                ),
            ]
        raise PlacesUnavailableError("GOOGLE_PLACES_API_KEY is not configured")

    text_query = f"{query} near {near}" if near else query
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.rating,places.userRatingCount"
        ),
    }
    try:
        resp = httpx.post(
            PLACES_SEARCH_URL, json={"textQuery": text_query}, headers=headers, timeout=10.0
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise PlacesUnavailableError(f"Places search failed: {exc}") from exc

    data = resp.json()
    results = []
    for place in data.get("places", []):
        results.append(
            PlaceResult(
                place_id=place.get("id", ""),
                name=place.get("displayName", {}).get("text", ""),
                address=place.get("formattedAddress", ""),
                rating=place.get("rating"),
                review_count=place.get("userRatingCount"),
            )
        )
    return results


class AmbiguousPlaceError(RuntimeError):
    """Raised when a Maps link or name+city search returns >1 plausible
    match. SRS-11.12: ambiguous matches are queued for manual resolution,
    never guessed — attaching the wrong Place ID sends every review to a
    stranger's business (R-20)."""

    def __init__(self, candidates: list[PlaceResult]):
        self.candidates = candidates
        super().__init__(f"{len(candidates)} ambiguous matches")


def resolve_place_id(query: str) -> str:
    """Resolve a Google Maps share link, full maps.google.com URL, a raw
    Place ID, or a name+city search string to one Place ID (SRS-11.11).

    Short links (maps.app.goo.gl) redirect to a canonical URL containing
    either a `place_id=` param or a `/place/.../data=` segment we can't
    reliably parse without following the redirect — so the raw-ID and
    text-search paths are the ones actually exercised without a live key;
    short-link expansion needs an HTTP client that follows redirects, which
    is done here but requires GOOGLE_PLACES_API_KEY for the fallback search.
    """
    query = query.strip()

    # Already a raw Place ID (Google's format: starts with "ChIJ" typically,
    # but not guaranteed — treat anything without a URL scheme and without
    # spaces as a candidate raw ID first).
    if query.startswith("ChIJ") or (not query.startswith("http") and " " not in query):
        return query

    if query.startswith("http"):
        expanded = _expand_short_link(query)
        place_id = _extract_place_id_from_url(expanded)
        if place_id:
            return place_id
        # Fall through to text search using whatever business name can be
        # scraped from the URL path as a last resort.
        query = _extract_name_from_url(expanded) or query

    results = search_places(query)
    if len(results) == 0:
        raise PlacesUnavailableError(f"No match found for: {query}")
    if len(results) > 1:
        raise AmbiguousPlaceError(results)
    return results[0].place_id


# Only Google Maps link hosts may be fetched. The resolver takes an admin-typed
# URL and follows redirects, so without an allowlist it could be pointed at
# internal addresses (SSRF). Each redirect hop is re-checked.
_MAPS_HOSTS = {"maps.app.goo.gl", "goo.gl", "g.co", "share.google", "maps.google.com", "google.com", "www.google.com"}
_MAX_HOPS = 5


def _is_allowed_maps_url(url: str) -> bool:
    from urllib.parse import urlparse

    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (host in _MAPS_HOSTS or host.endswith(".google.com"))


def _expand_short_link(url: str) -> str:
    from urllib.parse import urljoin

    current = url
    try:
        for _ in range(_MAX_HOPS):
            if not _is_allowed_maps_url(current):
                return current  # never fetch an off-Google host; parse what we have
            resp = httpx.get(current, follow_redirects=False, timeout=10.0)
            if not resp.is_redirect or "location" not in resp.headers:
                return current
            current = urljoin(current, resp.headers["location"])
        return current
    except httpx.HTTPError:
        return current


def _extract_place_id_from_url(url: str) -> str | None:
    import re

    match = re.search(r"[?&]place_id=([^&]+)", url)
    if match:
        return match.group(1)
    match = re.search(r"!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)", url)
    if match:
        return match.group(1)  # CID-style identifier, not a Place ID proper
    return None


def _extract_name_from_url(url: str) -> str | None:
    import re

    match = re.search(r"/place/([^/@]+)", url)
    if match:
        return match.group(1).replace("+", " ")
    return None


def build_review_url(place_id: str) -> str:
    """Construct the Google review write URL for a Place ID (FR-35).

    This is the standard public write-review deep link — it still requires
    the customer to sign in and type/paste manually (C-1); no prefill exists.
    """
    return f"https://search.google.com/local/writereview?placeid={place_id}"


def get_place_snapshot(place_id: str) -> tuple[float | None, int | None]:
    """Fetch current rating + review count for baseline capture (FR-39) and
    the weekly poll (SRS-14.1)."""
    settings = get_settings()
    if not settings.google_places_api_key:
        if settings.environment == "local":
            return 4.9, 142
        raise PlacesUnavailableError("GOOGLE_PLACES_API_KEY is not configured")

    headers = {
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": "rating,userRatingCount",
    }
    try:
        resp = httpx.get(PLACES_DETAILS_URL.format(place_id=place_id), headers=headers, timeout=10.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise PlacesUnavailableError(f"Places details failed: {exc}") from exc

    data = resp.json()
    return data.get("rating"), data.get("userRatingCount")
