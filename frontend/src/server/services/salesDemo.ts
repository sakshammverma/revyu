/**
 * The in-shop sales demo (/marketing): category mapping, the signed
 * scan-to-try link, and the response shapes of /api/marketing/*.
 *
 * Nothing here writes to the database or records a customer. The try link
 * carries only the shop's display name and category, signed so nobody can
 * mint one for an arbitrary name, and it expires after TRY_TTL_SECONDS.
 * CR-1: tags carry labels only, and nothing here authors review-like text.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { qrPath } from "@/lib/marketing/qr";
import { TRY_TTL_SECONDS, type Prospect, type SalesKit, type SignupLink } from "@/lib/marketing/salesTypes";
import { VERTICAL_OPTIONS } from "@/lib/verticals";
import { getEnv } from "@/server/env";
import { verticalTags } from "@/server/verticals";
import { buildReportDetailed } from "./gapReport";

/* ------------------------------------------------------------ categories */

const VERTICAL_KEYS = new Set(VERTICAL_OPTIONS.map((o) => o.key));
export const isVerticalKey = (v: string): boolean => VERTICAL_KEYS.has(v);

const EXACT: Record<string, string> = {
  // restaurant
  restaurant: "restaurant",
  cafe: "restaurant",
  tea_house: "restaurant",
  food_court: "restaurant",
  // bakery
  bakery: "bakery",
  cake_shop: "bakery",
  pastry_shop: "bakery",
  dessert_shop: "bakery",
  confectionery: "bakery",
  candy_store: "bakery",
  chocolate_shop: "bakery",
  chocolate_factory: "bakery",
  donut_shop: "bakery",
  // grocery
  grocery_store: "grocery",
  supermarket: "grocery",
  convenience_store: "grocery",
  general_store: "grocery",
  food_store: "grocery",
  market: "grocery",
  hypermarket: "grocery",
  butcher_shop: "grocery",
  // electronics
  electronics_store: "electronics",
  cell_phone_store: "electronics",
  // pharmacy
  pharmacy: "pharmacy",
  drugstore: "pharmacy",
  // automotive
  car_repair: "automotive",
  car_wash: "automotive",
  car_dealer: "automotive",
  auto_parts_store: "automotive",
  tire_shop: "automotive",
  // salon
  beauty_salon: "salon",
  hair_salon: "salon",
  hair_care: "salon",
  barber_shop: "salon",
  nail_salon: "salon",
  beautician: "salon",
  makeup_artist: "salon",
  spa: "salon",
  massage: "salon",
  massage_spa: "salon",
  // gym
  gym: "gym",
  fitness_center: "gym",
  yoga_studio: "gym",
  sports_club: "gym",
  // coaching
  school: "coaching",
  educational_institution: "coaching",
  sports_coaching: "coaching",
  // dental
  dentist: "dental",
  dental_clinic: "dental",
  // physiotherapy
  physiotherapist: "physiotherapy",
  chiropractor: "physiotherapy",
  // retail
  clothing_store: "retail",
  shoe_store: "retail",
  jewelry_store: "retail",
  department_store: "retail",
  gift_shop: "retail",
  book_store: "retail",
  furniture_store: "retail",
  home_goods_store: "retail",
  home_improvement_store: "retail",
  hardware_store: "retail",
  cosmetics_store: "retail",
  toy_store: "retail",
  pet_store: "retail",
  sporting_goods_store: "retail",
  florist: "retail",
  tailor: "retail",
  store: "retail",
};

/** Families of Google types that share a suffix or prefix (checked after the exact table). */
function byPattern(t: string): string | null {
  if (t.endsWith("_restaurant") || t.startsWith("coffee") || t.startsWith("juice") || t.startsWith("snack") || t.startsWith("meal_")) {
    return "restaurant";
  }
  if (t.endsWith("_bakery") || t.startsWith("candy") || t.startsWith("chocolate") || t.startsWith("donut")) return "bakery";
  if (t.endsWith("grocery_store") || t.endsWith("_market") || t.endsWith("supermarket")) return "grocery";
  if (t.startsWith("auto_parts")) return "automotive";
  if (t.startsWith("massage")) return "salon";
  if (t.endsWith("_school")) return "coaching";
  return null;
}

function mapType(t: string): string | null {
  const v = EXACT[t] ?? byPattern(t);
  return v && VERTICAL_KEYS.has(v) ? v : null;
}

/**
 * Our category for a Google listing: the primary type first, then the other
 * types in Google's order; "general" when none is known. Always a key of
 * VERTICAL_OPTIONS. Only a suggestion: the presenter can override it.
 */
export function verticalForPlaceType(primary: string | null, types: string[]): string {
  for (const t of [primary, ...types]) {
    if (!t) continue;
    const v = mapType(t.toLowerCase());
    if (v) return v;
  }
  return "general";
}

/* ------------------------------------------------------------ try token */

const NAME_MAX = 60; // keeps the try QR small enough to scan off a phone screen
const SIG_LEN = 22;

function signingKey(): string {
  const { authSecret, isLocal } = getEnv();
  if (!isLocal && (authSecret === "" || authSecret === "change-me" || authSecret.length < 24)) {
    throw new Error("AUTH_SECRET must be set to a random value of 24+ characters");
  }
  return authSecret;
}

const sign = (payload: string) =>
  createHmac("sha256", signingKey()).update(`mkt-try:${payload}`).digest("base64url").slice(0, SIG_LEN);

/* ------------------------------------------------------------ signup attribution */

/** How long a deck signup link still credits the sales deck: the owner may sign up days later. */
export const SALES_REF_TTL_SECONDS = 14 * 24 * 3600;
const REF_SIG_LEN = 16;
const REF_RE = /^(\d{9,11})\.([A-Za-z0-9_-]{16})$/;

const signRef = (placeId: string, e: number) =>
  createHmac("sha256", signingKey()).update(`mkt-src:${placeId}:${e}`).digest("base64url").slice(0, REF_SIG_LEN);

/**
 * The deck's signup links carry `src=<expiry>.<hmac>` bound to the shop's place_id, so
 * `outlets.source = "sales_demo"` can't be claimed by adding a query parameter.
 */
export function mintSalesRef(placeId: string, now: number = Date.now()): string {
  const e = Math.floor(now / 1000) + SALES_REF_TTL_SECONDS;
  return `${e}.${signRef(placeId, e)}`;
}

/** True when `ref` was minted by the deck for this place_id and hasn't expired. */
export function salesRefValid(ref: string, placeId: string, now: number = Date.now()): boolean {
  const m = REF_RE.exec(ref);
  if (!m) return false;
  const e = Number(m[1]);
  if (e * 1000 <= now) return false;
  const given = Buffer.from(m[2]);
  const expected = Buffer.from(signRef(placeId, e));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Display name for the try link: control characters removed, whitespace collapsed, at most 60 characters. */
export function cleanShopName(raw: string): string {
  // C0/C1 controls, zero-width and bidi override characters (they could disguise the name).
  const flat = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(flat).slice(0, NAME_MAX).join("").trim();
}

export function mintTryToken(
  input: { name: string; vertical: string },
  now: number = Date.now(),
): { token: string; expiresAt: Date } {
  const name = cleanShopName(input.name);
  if (!name) throw new RangeError("name is empty");
  if (!VERTICAL_KEYS.has(input.vertical)) throw new RangeError("unknown vertical");
  const e = Math.floor(now / 1000) + TRY_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ n: name, v: input.vertical, e })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(e * 1000) };
}

export type TryTokenResult = { name: string; vertical: string; expiresAt: Date } | { expired: true } | null;

/** The signed name and category, `{expired:true}` for a genuine but old link, null for anything else. */
export function readTryToken(token: string, now: number = Date.now()): TryTokenResult {
  if (typeof token !== "string" || token.length > 1000) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || parts[1].length !== SIG_LEN) return null;
  const given = Buffer.from(parts[1]);
  const expected = Buffer.from(sign(parts[0]));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { n, v, e } = data as { n?: unknown; v?: unknown; e?: unknown };
  if (typeof n !== "string" || typeof v !== "string" || typeof e !== "number" || !Number.isFinite(e)) return null;
  const name = cleanShopName(n);
  if (!name || !VERTICAL_KEYS.has(v)) return null;
  if (e * 1000 <= now) return { expired: true };
  return { name, vertical: v, expiresAt: new Date(e * 1000) };
}

/* ------------------------------------------------------------ origin */

const HOST_RE = /^[A-Za-z0-9.-]+(?::\d{1,5})?$|^\[[0-9A-Fa-f:.]+\](?::\d{1,5})?$/;

function isPrivateHost(host: string): boolean {
  const h = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".local")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * The origin the presenter's browser used, so the QR codes work from the
 * prospect's phone (localhost is useless there; an ngrok or LAN address works).
 */
export function requestOrigin(request: Request): string {
  const first = (v: string | null) => v?.split(",")[0].trim() || null;
  const fwdHost = first(request.headers.get("x-forwarded-host"));
  const host = [fwdHost, first(request.headers.get("host")), new URL(request.url).host].find(
    (h): h is string => !!h && HOST_RE.test(h),
  ) as string;
  const fwdProto = first(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  const proto = fwdProto === "http" || fwdProto === "https" ? fwdProto : isPrivateHost(host) ? "http" : "https";
  return `${proto}://${host}`;
}

/* ------------------------------------------------------------ responses */

export async function buildProspect(placeId: string): Promise<Prospect> {
  const { report, shop } = await buildReportDetailed(placeId);
  return {
    place_id: placeId,
    report,
    shop: { type_label: shop.type_label, address: shop.address, country_code: shop.country_code },
    vertical: verticalForPlaceType(shop.primary_type, shop.types),
    fetched_at: new Date().toISOString(),
  };
}

/** Links and QR codes for one shop. No Google calls; the caller validated the inputs. */
export function buildKit(
  origin: string,
  input: { placeId: string; name: string; vertical: string },
  now: number = Date.now(),
): SalesKit {
  const base = origin.replace(/\/+$/, "");
  const { token, expiresAt } = mintTryToken({ name: input.name, vertical: input.vertical }, now);
  const tryUrl = `${base}/marketing/try/${token}`;
  const signup = (plan: "monthly" | "annual"): SignupLink => {
    const qs = new URLSearchParams({
      place: input.placeId,
      name: input.name.trim(),
      plan,
      type: input.vertical,
      src: mintSalesRef(input.placeId, now),
    });
    const url = `${base}/signup?${qs.toString()}`;
    return { url, qr: qrPath(url) };
  };
  return {
    vertical: input.vertical,
    tags: verticalTags(input.vertical).map((t, i) => ({ id: `${input.vertical}-${i}`, label: t.label })),
    try: { url: tryUrl, qr: qrPath(tryUrl), expires_at: expiresAt.toISOString() },
    signup: { monthly: signup("monthly"), annual: signup("annual") },
  };
}
