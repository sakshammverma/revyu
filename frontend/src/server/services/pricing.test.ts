/**
 * Country-aware pricing (FR-71): country -> tier/currency -> plans, the business
 * country (not the request) deciding the charge, and the price-changed guard.
 * Uses its own tier and country codes so it does not depend on seeded prices.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return {
    ...actual,
    getEnv: () => ({ ...actual.getEnv(), environment: "local", isLocal: true, razorpayKeyId: "", razorpayKeySecret: "" }),
  };
});

import { POST as postSignup } from "@/app/api/signup/route";
import { GET as getPricing } from "@/app/api/pricing/route";
import { schema, type DbLike } from "@/server/db";
import { inRolledBackTx, makeRequest } from "@/server/testing/helpers";
import { adminSetCountry, adminSetPlanPrice, countryBody, planPriceBody } from "./pricingAdmin";
import { countryPricingFor, headerCountry, plansFor, publicPricing, visitorCountry } from "./pricing";

const { accounts, countryPricing, outlets, plans, pricingTiers } = schema;

/** A private tier with EUR prices, mapped to two made-up countries. */
async function seedTestMarket(db: DbLike) {
  await db.insert(pricingTiers).values({ code: "tiertest", name: "Test" });
  await db.insert(countryPricing).values([
    { countryCode: "ZY", tierCode: "tiertest", currencyCode: "EUR", locale: "de-DE", active: true },
    { countryCode: "ZX", tierCode: "tiertest", currencyCode: "EUR", locale: "fr-FR", active: true },
  ]);
  await db.insert(plans).values([
    { id: crypto.randomUUID(), code: "monthly", tierCode: "tiertest", currencyCode: "EUR", amountMinor: 1800, active: true, providerPlanId: "plan_eur_m" },
    { id: crypto.randomUUID(), code: "annual", tierCode: "tiertest", currencyCode: "EUR", amountMinor: 16200, active: true, providerPlanId: "plan_eur_a" },
  ]);
}

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
const payload = (over: Record<string, unknown> = {}) => ({
  business_name: "Cafe Test",
  vertical: "dental",
  owner_name: "Owner",
  owner_phone: `+49${String(Math.floor(Math.random() * 1e9)).padStart(9, "1")}`,
  owner_email: `owner-${uid()}@example.com`,
  place_id: `ChIJ_${uid()}`,
  plan: "monthly",
  placement_acknowledged: true,
  ...over,
});
const signup = (url: string, body: Record<string, unknown>, country?: string) =>
  postSignup(
    makeRequest(url, { body, headers: country ? { "x-vercel-ip-country": country } : {} }),
    undefined as never,
  );

describe("country pricing", () => {
  it("maps a country to its tier and currency, and falls back to '*'", async () => {
    await inRolledBackTx(async (tx) => {
      await seedTestMarket(tx);
      expect(await countryPricingFor(tx, "zy")).toEqual({ country_code: "ZY", tier_code: "tiertest", currency_code: "EUR", locale: "de-DE" });
      const fallback = await countryPricingFor(tx, "QQ"); // not mapped
      expect(fallback).toMatchObject({ country_code: "QQ", currency_code: "USD" });
      const india = await countryPricingFor(tx, "IN");
      expect(india).toMatchObject({ tier_code: "tier3", currency_code: "INR" });
    });
  });

  it("returns only the plans of that tier and currency, cheapest first", async () => {
    await inRolledBackTx(async (tx) => {
      await seedTestMarket(tx);
      const { plans: rows } = await plansFor(tx, "ZY");
      expect(rows.map((p) => [p.code, p.amountMinor])).toEqual([["monthly", 1800], ["annual", 16200]]);
      const body = await publicPricing(tx, "ZX");
      expect(body).toMatchObject({ currency_code: "EUR", locale: "fr-FR", annual_saving_minor: 1800 * 12 - 16200 });
    });
  });

  it("visitor country: header, then ?country for display; header only for charging", () => {
    const req = (url: string, h: Record<string, string> = {}) => new Request(`http://localhost:3000${url}`, { headers: h });
    expect(visitorCountry(req("/api/pricing", { "x-vercel-ip-country": "de" }))).toBe("DE");
    expect(visitorCountry(req("/api/pricing?country=us", { "x-vercel-ip-country": "DE" }))).toBe("US");
    expect(visitorCountry(req("/api/pricing?country=zzz"))).toBe("IN"); // invalid pick ignored; local default
    expect(headerCountry(req("/api/signup?country=US", { "x-vercel-ip-country": "DE" }))).toBe("DE");
  });

  it("GET /api/pricing serves the visitor's market and is not shared across countries", async () => {
    await inRolledBackTx(async (tx) => {
      holder.db = tx;
      try {
        await seedTestMarket(tx);
        const res = await getPricing(makeRequest("/api/pricing", { headers: { "x-vercel-ip-country": "ZY" } }), undefined as never);
        expect(res.status).toBe(200);
        expect(res.headers.get("vary")).toContain("x-vercel-ip-country");
        expect(await res.json()).toMatchObject({ country_code: "ZY", currency_code: "EUR" });
      } finally {
        holder.db = null;
      }
    });
  });
});

describe("signup uses the business market", () => {
  it("creates the outlet and charge in the country's currency, ignoring ?country=", async () => {
    await inRolledBackTx(async (tx) => {
      holder.db = tx;
      try {
        await seedTestMarket(tx);
        // Display override says IN; the IP header says ZY. Only the header counts.
        const res = await signup("/api/signup?country=IN", payload({ expected_currency: "EUR" }), "ZY");
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.checkout).toMatchObject({ amount_minor: 1800, currency_code: "EUR" });
        const [outlet] = await tx.select().from(outlets).where(eq(outlets.id, body.signup_id));
        expect(outlet).toMatchObject({ countryCode: "ZY", locale: "de-DE" });
        const [account] = await tx.select().from(accounts).where(eq(accounts.id, outlet.accountId));
        expect(account.currencyCode).toBe("EUR");
      } finally {
        holder.db = null;
      }
    });
  });

  it("409 PRICE_CHANGED when the visitor was shown another market's currency", async () => {
    await inRolledBackTx(async (tx) => {
      holder.db = tx;
      try {
        await seedTestMarket(tx);
        const res = await signup("/api/signup", payload({ expected_currency: "INR" }), "ZY");
        expect(res.status).toBe(409);
        const err = (await res.json()).detail.error;
        expect(err.code).toBe("PRICE_CHANGED");
        expect(JSON.parse(err.message)).toEqual({ country_code: "ZY", currency_code: "EUR", amount_minor: 1800 });
      } finally {
        holder.db = null;
      }
    });
  });
});

describe("pricing admin", () => {
  it("a price change deactivates the old row and keeps it as history", async () => {
    await inRolledBackTx(async (tx) => {
      await seedTestMarket(tx);
      const body = planPriceBody.parse({ code: "monthly", tier_code: "tiertest", currency_code: "eur", amount_minor: 2000 });
      const after = await adminSetPlanPrice(tx, body);
      expect(after.plans.filter((p) => p.tier_code === "tiertest" && p.code === "monthly")).toEqual([
        expect.objectContaining({ currency_code: "EUR", amount_minor: 2000 }),
      ]);
      const all = await tx.select().from(plans).where(eq(plans.tierCode, "tiertest"));
      expect(all.filter((p) => p.code === "monthly").map((p) => [p.amountMinor, p.active]).sort()).toEqual([[1800, false], [2000, true]]);
      expect((await plansFor(tx, "ZY")).plans.find((p) => p.code === "monthly")?.amountMinor).toBe(2000);
    });
  });

  it("rejects an unknown tier, a bad currency and disabling the fallback country", async () => {
    await inRolledBackTx(async (tx) => {
      await expect(
        adminSetPlanPrice(tx, planPriceBody.parse({ code: "monthly", tier_code: "nope", currency_code: "USD", amount_minor: 100 })),
      ).rejects.toMatchObject({ status: 400 });
      expect(planPriceBody.safeParse({ code: "monthly", tier_code: "tier1", currency_code: "XXQ", amount_minor: 100 }).success).toBe(false);
      expect(planPriceBody.safeParse({ code: "weekly", tier_code: "tier1", currency_code: "USD", amount_minor: 100 }).success).toBe(false);
      await expect(
        adminSetCountry(tx, countryBody.parse({ country_code: "*", tier_code: "tier1", currency_code: "USD", locale: "en-US", active: false })),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  it("upserts a country mapping", async () => {
    await inRolledBackTx(async (tx) => {
      await seedTestMarket(tx);
      await adminSetCountry(tx, countryBody.parse({ country_code: "zy", tier_code: "tiertest", currency_code: "GBP", locale: "en-GB" }));
      expect(await countryPricingFor(tx, "ZY")).toMatchObject({ currency_code: "GBP", locale: "en-GB" });
    });
  });
});
