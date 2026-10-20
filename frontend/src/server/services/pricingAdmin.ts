/**
 * Founder-only pricing admin (FR-71): prices, tiers and the country map live in
 * the database and are edited here, never in code. A price change deactivates
 * the current plans row and inserts a new one, so old rows stay as history.
 */
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";

const { countryPricing, plans, pricingTiers } = schema;

// Intl.NumberFormat accepts any three letters, so check the real ISO 4217 list.
const CURRENCIES = new Set(Intl.supportedValuesOf("currency"));
const isCurrency = (code: string) => CURRENCIES.has(code);

const currency = z
  .string()
  .length(3)
  .transform((v) => v.toUpperCase())
  .refine(isCurrency, "unknown currency");

export const planPriceBody = z.object({
  code: z.enum(["monthly", "annual"]),
  tier_code: z.string().min(1).max(40),
  currency_code: currency,
  amount_minor: z.number().int().positive().max(100_000_000),
  /** The gateway's recurring-plan id for this exact price; empty means "none yet". */
  provider_plan_id: z.string().trim().max(80).nullish(),
});
export type PlanPriceBody = z.infer<typeof planPriceBody>;

export const countryBody = z.object({
  country_code: z
    .string()
    .trim()
    .regex(/^([A-Za-z]{2}|\*)$/)
    .transform((v) => v.toUpperCase()),
  tier_code: z.string().min(1).max(40),
  currency_code: currency,
  locale: z.string().trim().min(2).max(20),
  active: z.boolean().default(true),
});
export type CountryBody = z.infer<typeof countryBody>;

export async function adminPricing(db: DbLike) {
  const [tiers, countries, planRows] = await Promise.all([
    db.select().from(pricingTiers).orderBy(asc(pricingTiers.code)),
    db.select().from(countryPricing).orderBy(asc(countryPricing.tierCode), asc(countryPricing.countryCode)),
    db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.tierCode), asc(plans.currencyCode), asc(plans.code)),
  ]);
  return {
    tiers: tiers.map((t) => ({ code: t.code, name: t.name })),
    countries: countries.map((c) => ({
      country_code: c.countryCode,
      tier_code: c.tierCode,
      currency_code: c.currencyCode,
      locale: c.locale,
      active: c.active,
    })),
    plans: planRows.map((p) => ({
      code: p.code,
      tier_code: p.tierCode,
      currency_code: p.currencyCode,
      amount_minor: p.amountMinor,
      provider_plan_id: p.providerPlanId,
    })),
  };
}

async function requireTier(db: DbLike, tier: string) {
  const [row] = await db.select({ code: pricingTiers.code }).from(pricingTiers).where(eq(pricingTiers.code, tier));
  if (!row) throw new HttpError(400, "VALIDATION_FAILED", "unknown tier");
}

/** Set the price of (plan, tier, currency). Existing subscriptions keep what they were charged. */
export async function adminSetPlanPrice(db: DbLike, body: PlanPriceBody) {
  await requireTier(db, body.tier_code);
  await db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ active: false })
      .where(
        and(
          eq(plans.code, body.code),
          eq(plans.tierCode, body.tier_code),
          eq(plans.currencyCode, body.currency_code),
          eq(plans.active, true),
        ),
      );
    await tx.insert(plans).values({
      id: crypto.randomUUID(),
      code: body.code,
      tierCode: body.tier_code,
      currencyCode: body.currency_code,
      amountMinor: body.amount_minor,
      providerPlanId: body.provider_plan_id || null,
      active: true,
    });
  });
  return adminPricing(db);
}

export async function adminSetCountry(db: DbLike, body: CountryBody) {
  await requireTier(db, body.tier_code);
  if (body.country_code === "*" && !body.active) {
    throw new HttpError(400, "VALIDATION_FAILED", "the fallback country cannot be disabled");
  }
  await db
    .insert(countryPricing)
    .values({
      countryCode: body.country_code,
      tierCode: body.tier_code,
      currencyCode: body.currency_code,
      locale: body.locale,
      active: body.active,
    })
    .onConflictDoUpdate({
      target: countryPricing.countryCode,
      set: { tierCode: body.tier_code, currencyCode: body.currency_code, locale: body.locale, active: body.active },
    });
  return adminPricing(db);
}
