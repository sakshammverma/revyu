/**
 * Review Gap Report - a public, no-login comparison of a business's Google
 * presence against the strongest nearby competitors in its category. Port of
 * backend/app/services/gap_report.py + backend/app/api/gap_report.py.
 *
 * Uses only public Places data and makes no outcome promise (compliance: no
 * guaranteed-result claims). Both a self-serve sales tool and the source for
 * walk-in leave-behinds.
 */
import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { sendEmail } from "@/server/notifications";
import { PlacesUnavailableError } from "./places";

const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const SEARCH_RADIUS_M = 3000;

export interface Business {
  place_id: string;
  name: string;
  rating: number | null;
  review_count: number | null;
}

export interface GapReport {
  business: Business;
  competitors: Business[];
  review_gap: number; // top competitor's count minus ours (>= 0)
  rank_by_reviews: number; // 1 = most reviews among the group
  group_size: number;
  headline: string;
}

function headline(me: Business, top: Business | null, gap: number, rank: number, n: number): string {
  if (top === null || me.review_count === null) {
    return "We could not find enough nearby businesses to compare yet.";
  }
  if (gap === 0) return `You lead your area with ${me.review_count} reviews. Keep the gap wide.`;
  return (
    `${top.name} has ${top.review_count} reviews; you have ${me.review_count}. ` +
    `You rank ${rank} of ${n} nearby by review count.`
  );
}

export async function buildReport(placeId: string): Promise<GapReport> {
  const [me, competitors] = await fetchBusinesses(placeId);
  // Stable sort by count, descending (ties keep Places' order, like Python's sort).
  const withCounts = competitors
    .filter((c) => c.review_count !== null)
    .sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0));
  const top3 = withCounts.slice(0, 3);
  const top = top3[0] ?? null;

  const mine = me.review_count ?? 0;
  const gap = top ? Math.max(0, (top.review_count ?? 0) - mine) : 0;
  const group = [mine, ...withCounts.map((c) => c.review_count ?? 0)];
  const rank = [...group].sort((a, b) => b - a).indexOf(mine) + 1;
  return {
    business: me,
    competitors: top3,
    review_gap: gap,
    rank_by_reviews: rank,
    group_size: group.length,
    headline: headline(me, top, gap, rank, group.length),
  };
}

interface PlaceJson {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
}

const toBusiness = (p: PlaceJson, fallbackId: string): Business => ({
  place_id: p.id ?? fallbackId,
  name: p.displayName?.text ?? "",
  rating: p.rating ?? null,
  review_count: p.userRatingCount ?? null,
});

async function fetchBusinesses(placeId: string): Promise<[Business, Business[]]> {
  const env = getEnv();
  if (!env.googlePlacesApiKey) {
    if (env.isLocal) return fake(placeId);
    throw new PlacesUnavailableError("GOOGLE_PLACES_API_KEY is not configured");
  }
  const key = env.googlePlacesApiKey;
  try {
    const det = await fetch(DETAILS_URL + placeId, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,location,primaryType",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!det.ok) throw new Error(`HTTP ${det.status}`);
    const d = (await det.json()) as PlaceJson;
    const me = toBusiness(d, placeId);
    if (!d.location) return [me, []];

    const body: Record<string, unknown> = {
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: d.location.latitude, longitude: d.location.longitude }, radius: SEARCH_RADIUS_M },
      },
    };
    if (d.primaryType) body.includedPrimaryTypes = [d.primaryType];
    const near = await fetch(NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!near.ok) throw new Error(`HTTP ${near.status}`);
    const places = ((await near.json()) as { places?: PlaceJson[] }).places ?? [];
    return [me, places.filter((p) => p.id !== me.place_id).map((p) => toBusiness(p, ""))];
  } catch (err) {
    throw new PlacesUnavailableError(`Places lookup failed: ${err instanceof Error ? err.message : err}`);
  }
}

/** Deterministic local/dev data so the UI is buildable without a key. */
function fake(placeId: string): [Business, Business[]] {
  return [
    { place_id: placeId, name: "Your Clinic", rating: 4.3, review_count: 47 },
    [
      { place_id: "local-c1", name: "Smile Care Dental", rating: 4.6, review_count: 180 },
      { place_id: "local-c2", name: "Bright Teeth Clinic", rating: 4.5, review_count: 132 },
      { place_id: "local-c3", name: "City Dental Studio", rating: 4.4, review_count: 96 },
    ],
  ] as [Business, Business[]];
}

/**
 * Records the lead and emails the report. The email is used once, to send
 * this report; it is not added to any marketing list.
 */
export async function emailReport(db: DbLike, placeId: string, email: string): Promise<void> {
  const report = await buildReport(placeId);
  await db.insert(schema.leads).values({
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    placeId,
    businessName: report.business.name,
    source: "gap_report",
  });

  const lines = report.competitors
    .map((c) => `- ${c.name}: ${c.review_count} reviews, rating ${c.rating}`)
    .join("\n");
  await sendEmail(email, "gap_report", {
    business_name: report.business.name,
    headline: report.headline,
    competitor_lines: lines || "- (none found nearby)",
    signup_url: `${getEnv().frontendBaseUrl.replace(/\/+$/, "")}/signup?place=${placeId}`,
  });
}
