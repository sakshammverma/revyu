/**
 * Country-aware pricing (FR-71). A country maps to a purchasing-power tier and
 * a currency through `country_pricing`; plans are one active row per
 * (code, tier, currency). Country '*' is the fallback for unmapped countries.
 *
 * Two different countries are involved and must not be mixed up:
 * - the *business* country (from its Google listing) decides what is charged;
 * - the *visitor* country (IP header) only decides what the marketing pages show.
 */
import { and, asc, eq } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";

const { countryPricing, plans } = schema;

export type PlanRow = typeof plans.$inferSelect;

export interface CountryPrice {
  country_code: string;
  tier_code: string;
  currency_code: string;
  locale: string;
}

export const FALLBACK_COUNTRY = "*";
const COUNTRY_RE = /^[A-Za-z]{2}$/;

export function normalizeCountry(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  return v && COUNTRY_RE.test(v) ? v.toUpperCase() : null;
}

/** Tier, currency and locale for a country; the '*' row when it has none. */
export async function countryPricingFor(db: DbLike, countryCode: string): Promise<CountryPrice> {
  const code = normalizeCountry(countryCode) ?? FALLBACK_COUNTRY;
  const rows = await db.select().from(countryPricing).where(eq(countryPricing.active, true));
  const row = rows.find((r) => r.countryCode === code) ?? rows.find((r) => r.countryCode === FALLBACK_COUNTRY);
  if (!row) throw new Error("country_pricing has no fallback row");
  return {
    country_code: code,
    tier_code: row.tierCode,
    currency_code: row.currencyCode,
    locale: row.locale,
  };
}

/** Active plans for a country's tier + currency, cheapest first. */
export async function plansFor(db: DbLike, countryCode: string) {
  const price = await countryPricingFor(db, countryCode);
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.tierCode, price.tier_code), eq(plans.currencyCode, price.currency_code), eq(plans.active, true)))
    .orderBy(asc(plans.amountMinor));
  return { price, plans: rows };
}

/** One plan by code for a country, or null. */
export async function planFor(db: DbLike, countryCode: string, planCode: string) {
  const { price, plans: rows } = await plansFor(db, countryCode);
  return { price, plan: rows.find((p) => p.code === planCode) ?? null };
}

/** The caller's country from the platform's IP header only; cannot be set by a query string. */
export function headerCountry(request: Request): string {
  const header = normalizeCountry(request.headers.get("x-vercel-ip-country"));
  if (header) return header;
  return getEnv().isLocal ? "IN" : FALLBACK_COUNTRY;
}

/**
 * Where the visitor is, for display only. Vercel sets x-vercel-ip-country.
 * ?country=XX is the visitor's own picker choice (and stands in for the header
 * locally); it is never used for charging.
 */
export function visitorCountry(request: Request): string {
  return normalizeCountry(new URL(request.url).searchParams.get("country")) ?? headerCountry(request);
}

/** Body of GET /api/pricing. */
export async function publicPricing(db: DbLike, countryCode: string) {
  const { price, plans: rows } = await plansFor(db, countryCode);
  const monthly = rows.find((p) => p.code === "monthly");
  const annual = rows.find((p) => p.code === "annual");
  return {
    country_code: price.country_code,
    currency_code: price.currency_code,
    locale: price.locale,
    plans: rows.map((p) => ({ code: p.code, amount_minor: p.amountMinor })),
    annual_saving_minor: monthly && annual ? Math.max(0, monthly.amountMinor * 12 - annual.amountMinor) : 0,
  };
}

/** Default IANA timezone for a new outlet; the owner can change it later (FR-69). */
const DEFAULT_TIMEZONE: Record<string, string> = {
  IN: "Asia/Kolkata", US: "America/New_York", CA: "America/Toronto", GB: "Europe/London",
  IE: "Europe/Dublin", DE: "Europe/Berlin", FR: "Europe/Paris", IT: "Europe/Rome",
  ES: "Europe/Madrid", NL: "Europe/Amsterdam", BE: "Europe/Brussels", AT: "Europe/Vienna",
  PT: "Europe/Lisbon", FI: "Europe/Helsinki", PL: "Europe/Warsaw", TR: "Europe/Istanbul",
  AU: "Australia/Sydney", NZ: "Pacific/Auckland", SG: "Asia/Singapore", MY: "Asia/Kuala_Lumpur",
  TH: "Asia/Bangkok", ID: "Asia/Jakarta", AE: "Asia/Dubai", SA: "Asia/Riyadh", QA: "Asia/Qatar",
  BR: "America/Sao_Paulo", MX: "America/Mexico_City", ZA: "Africa/Johannesburg",
};

export const defaultTimezone = (countryCode: string): string => DEFAULT_TIMEZONE[countryCode] ?? "UTC";
