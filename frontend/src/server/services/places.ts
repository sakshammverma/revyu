/**
 * Google Places integration - business search and review URL construction.
 * Port of backend/app/services/places.py. See documents/04-ARCHITECTURE.md
 * section 9.3. Used at signup (SRS-18.3) and at admin activation (FR-34/35).
 * Never used for trial metering (C-2).
 */
import { getEnv } from "@/server/env";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/";

export interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  review_count: number | null;
}

/** Raised when the Places API key is not configured or the call fails. */
export class PlacesUnavailableError extends Error {}

/**
 * SRS-11.12: ambiguous matches are queued for manual resolution, never
 * guessed - attaching the wrong Place ID sends every review to a stranger's
 * business (R-20).
 */
export class AmbiguousPlaceError extends Error {
  constructor(public candidates: PlaceResult[]) {
    super(`${candidates.length} ambiguous matches`);
  }
}

/** Stable stand-in for Python's per-process string hash, for local fake ids only. */
function fakeHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h % 100000;
}

export async function searchPlaces(query: string, near?: string | null): Promise<PlaceResult[]> {
  const env = getEnv();
  if (!env.googlePlacesApiKey) {
    if (env.isLocal) {
      const clean = query.trim() || "Sample Business";
      const n = fakeHash(clean);
      return [
        {
          place_id: `ChIJ_local_${n}`,
          name: clean,
          address: "100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038",
          rating: 4.9,
          review_count: 142,
        },
        {
          place_id: `ChIJ_local_alt_${n}`,
          name: `${clean} (Main Branch)`,
          address: "12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560008",
          rating: 4.8,
          review_count: 89,
        },
      ];
    }
    throw new PlacesUnavailableError("GOOGLE_PLACES_API_KEY is not configured");
  }

  try {
    const resp = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.googlePlacesApiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: near ? `${query} near ${near}` : query }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as {
      places?: {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
      }[];
    };
    return (data.places ?? []).map((p) => ({
      place_id: p.id ?? "",
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? null,
      review_count: p.userRatingCount ?? null,
    }));
  } catch (err) {
    throw new PlacesUnavailableError(`Places search failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * The standard public write-review deep link (FR-35). It still requires the
 * customer to sign in and type/paste manually (C-1); no prefill exists.
 */
export function buildReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

/** Current rating + review count, for baseline capture (FR-39) and the weekly poll (SRS-14.1). */
export async function getPlaceSnapshot(placeId: string): Promise<[rating: number | null, count: number | null]> {
  const env = getEnv();
  if (!env.googlePlacesApiKey) {
    if (env.isLocal) return [4.9, 142];
    throw new PlacesUnavailableError("GOOGLE_PLACES_API_KEY is not configured");
  }
  try {
    const resp = await fetch(PLACES_DETAILS_URL + placeId, {
      headers: { "X-Goog-Api-Key": env.googlePlacesApiKey, "X-Goog-FieldMask": "rating,userRatingCount" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { rating?: number; userRatingCount?: number };
    return [data.rating ?? null, data.userRatingCount ?? null];
  } catch (err) {
    throw new PlacesUnavailableError(`Places details failed: ${err instanceof Error ? err.message : err}`);
  }
}

/* ------------------------------------------------- Maps link resolution */

// Only Google Maps link hosts may be fetched. The resolver takes an
// admin-typed URL and follows redirects, so without an allowlist it could be
// pointed at internal addresses (SSRF). Each redirect hop is re-checked.
const MAPS_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
  "share.google",
  "maps.google.com",
  "google.com",
  "www.google.com",
]);
const MAX_HOPS = 5;

export function isAllowedMapsUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return parsed.protocol === "https:" && (MAPS_HOSTS.has(host) || host.endsWith(".google.com"));
}

async function expandShortLink(url: string): Promise<string> {
  let current = url;
  try {
    for (let i = 0; i < MAX_HOPS; i++) {
      if (!isAllowedMapsUrl(current)) return current; // never fetch an off-Google host
      const resp = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
      const location = resp.headers.get("location");
      if (resp.status < 300 || resp.status >= 400 || !location) return current;
      current = new URL(location, current).toString();
    }
  } catch {
    // fall through: parse what we have
  }
  return current;
}

export function extractPlaceIdFromUrl(url: string): string | null {
  const direct = /[?&]place_id=([^&]+)/.exec(url);
  if (direct) return direct[1];
  const cid = /!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/.exec(url);
  return cid ? cid[1] : null; // CID-style identifier, not a Place ID proper
}

export function extractNameFromUrl(url: string): string | null {
  const match = /\/place\/([^/@]+)/.exec(url);
  return match ? match[1].replaceAll("+", " ") : null;
}

/**
 * Resolve a Google Maps share link, full maps.google.com URL, a raw Place ID,
 * or a name+city search string to one Place ID (SRS-11.11).
 */
export async function resolvePlaceId(input: string): Promise<string> {
  let query = input.trim();

  // Anything without a URL scheme and without spaces is a candidate raw ID.
  if (query.startsWith("ChIJ") || (!query.startsWith("http") && !query.includes(" "))) return query;

  if (query.startsWith("http")) {
    const expanded = await expandShortLink(query);
    const placeId = extractPlaceIdFromUrl(expanded);
    if (placeId) return placeId;
    query = extractNameFromUrl(expanded) ?? query;
  }

  const results = await searchPlaces(query);
  if (results.length === 0) throw new PlacesUnavailableError(`No match found for: ${query}`);
  if (results.length > 1) throw new AmbiguousPlaceError(results);
  return results[0].place_id;
}
