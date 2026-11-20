/**
 * The in-shop sales demo (/marketing): response shapes of /api/marketing/* and the
 * deck's on-device state. Shared by the route handlers and the client deck, so the
 * two can't drift. Types and plain constants only: safe on both sides.
 *
 * Privacy and compliance notes for anything built on these shapes:
 * - Everything here is public Google data about a business plus links we sign.
 *   No customer data, nothing written to the database.
 * - CR-1: no review-like text belongs in any of these shapes (tags carry labels only).
 */
import type { GapReport } from "@/lib/gap/api";
import type { QrShape } from "@/lib/marketing/qr";
import type { PlaceSearchResult } from "@/lib/signup/api";

export type { GapReport, PlaceSearchResult, QrShape };

/** Who unlocked the tool: the founder's admin secret, or the shared field-agent PIN. */
export type SalesRole = "admin" | "sales";

/** GET /api/marketing/session */
export interface SalesSession {
  role: SalesRole;
}

/** GET /api/marketing/search?q= */
export interface SalesSearchResponse {
  results: PlaceSearchResult[];
}

/** Listing details beyond the gap report, for the deck header. */
export interface ProspectShop {
  /** Google's own category label, e.g. "Clothing store". */
  type_label: string | null;
  /** Short address for the header, e.g. "Indiranagar, Bengaluru". */
  address: string | null;
  /** ISO 3166-1 alpha-2 country from the listing, uppercase; null if Google gave none. */
  country_code: string | null;
}

/** GET /api/marketing/prospect?place_id= (2 Places calls: details + nearby). */
export interface Prospect {
  place_id: string;
  /** Real public numbers: the shop, its top 3 same-category rivals within 3 km, the gap. */
  report: GapReport;
  shop: ProspectShop;
  /** Our category key (src/lib/verticals.ts) suggested from the Google place types. */
  vertical: string;
  /** ISO timestamp of the Google lookup. */
  fetched_at: string;
}

export interface SignupLink {
  /** Absolute /signup URL with the listing, category and plan pre-filled (src=sales). */
  url: string;
  qr: QrShape;
}

/** GET /api/marketing/kit?place_id=&name=&vertical= (no Google calls). */
export interface SalesKit {
  vertical: string;
  /** The category's real tag labels (the same set a new outlet is seeded with). */
  tags: { id: string; label: string }[];
  /** The customer flow with this shop's name, on any phone, for TRY_TTL_SECONDS. */
  try: { url: string; qr: QrShape; expires_at: string };
  signup: { monthly: SignupLink; annual: SignupLink };
}

export type DeckStep = "gap" | "try" | "dashboard" | "start";
export const DECK_STEPS: DeckStep[] = ["gap", "try", "dashboard", "start"];

/** What the deck keeps in sessionStorage, so it survives the trip to the try page and back. */
export interface DeckState {
  /** Display name: Google's name for the listing (falls back to the search result's name). */
  name: string;
  prospect: Prospect;
  kit: SalesKit;
  step: DeckStep;
}

/** One entry in the on-device "Recent shops" list (localStorage, never sent anywhere). */
export interface RecentShop {
  place_id: string;
  name: string;
  address: string;
  /** ISO timestamp of the last demo. */
  at: string;
}

/** localStorage: the admin secret or sales PIN, sent as a Bearer token. */
export const SALES_PIN_KEY = "revyu:sales-pin";
/** sessionStorage: the current DeckState. */
export const DECK_KEY = "revyu:sales:deck";
/** localStorage: RecentShop[], newest first, at most RECENT_MAX. */
export const RECENT_KEY = "revyu:sales:recent";
export const RECENT_MAX = 8;
/** How long a scan-to-try link works. Long enough for a visit, short enough not to linger. */
export const TRY_TTL_SECONDS = 3 * 3600;
/** The try page's ?via= value when the presenter opens it on their own device. */
export const VIA_DECK = "deck";
