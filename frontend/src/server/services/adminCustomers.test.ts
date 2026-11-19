/**
 * Founder customer monitor: the health rules (pure) and the overview/profile
 * queries against the dev DB inside a rolled-back transaction.
 */
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return { ...actual, getEnv: () => ({ ...actual.getEnv(), adminSessionSecret: "test-admin-secret" }) };
});

import { GET as counts } from "@/app/api/admin/counts/route";
import { GET as overview } from "@/app/api/admin/customers/route";
import { GET as profile } from "@/app/api/admin/customers/[outletId]/route";
import { schema, type DbLike } from "@/server/db";
import { assessHealth, monthlyEquivalent, type CustomerRow } from "@/server/services/adminCustomers";
import { inRolledBackTx, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";

const { events, payments, placeSnapshots, sessions, subscriptions } = schema;
const DAY = 86_400_000;
const NOW = new Date("2026-11-20T10:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const get = (path: string, auth = true) =>
  makeRequest(path, { method: "GET", headers: auth ? { authorization: "Bearer test-admin-secret" } : {} });

type RowOverrides = Omit<Partial<CustomerRow>, "usage" | "billing"> & {
  usage?: Partial<CustomerRow["usage"]>;
  billing?: Partial<CustomerRow["billing"]>;
};

function row(over: RowOverrides = {}) {
  return {
    state: "active",
    stage: "paying" as const,
    activated_at: ago(60),
    owner_last_seen_at: ago(2),
    trial: null,
    ...over,
    billing: {
      plan: "monthly", status: "active", mrr_minor: 49900, currency_code: "INR", lifetime_minor: 49900,
      last_paid_at: ago(5), renews_at: ago(-25), grace_until: null, cancelled: false, will_convert: true,
      ...over.billing,
    },
    usage: {
      scans_30d: 40, scans_prev_30d: 35, reviews_30d: 12, reviews_prev_30d: 10, conversion_30d: 0.3, last_scan_at: ago(1),
      ...over.usage,
    },
  };
}

describe("assessHealth", () => {
  it("a busy paying customer is healthy", () => {
    expect(assessHealth(row(), NOW)).toEqual({ health: "healthy", reasons: [] });
  });

  it("money problems are at risk and listed first", () => {
    const r = assessHealth(row({ state: "past_due", billing: { grace_until: ago(-3) }, usage: { last_scan_at: ago(9) } }), NOW);
    expect(r.health).toBe("at_risk");
    expect(r.reasons).toEqual(["Payment failed, 3 days of grace left", "Quiet for 9 days"]);
  });

  it("a trial ending soon with no payment set up is at risk; one that will convert is not", () => {
    const trial = { state: "trial", stage: "trial" as const, activated_at: ago(13), trial: { days_left: 2, credits_left: null } };
    expect(assessHealth(row({ ...trial, billing: { will_convert: false } }), NOW).reasons[0]).toBe(
      "Trial ends in 2 days, no payment set up",
    );
    expect(assessHealth(row({ ...trial, billing: { will_convert: true } }), NOW).health).toBe("healthy");
  });

  it("usage decay: never scanned, long silence, halved scans, low conversion, absent owner", () => {
    expect(assessHealth(row({ usage: { last_scan_at: null, scans_30d: 0 } }), NOW).reasons).toContain("No scans since going live");
    expect(assessHealth(row({ usage: { last_scan_at: ago(20) } }), NOW).reasons).toContain("No scans in 20 days");
    expect(assessHealth(row({ usage: { scans_30d: 10, scans_prev_30d: 40 } }), NOW).reasons).toContain("Scans down 75% vs last month");
    expect(assessHealth(row({ usage: { scans_30d: 50, conversion_30d: 0.02 } }), NOW).reasons).toContain(
      "Only 2% of scans become reviews",
    );
    expect(assessHealth(row({ owner_last_seen_at: null }), NOW).reasons).toContain("Owner never opened the dashboard");
  });

  it("onboarding and inactive are not judged", () => {
    expect(assessHealth(row({ stage: "onboarding", usage: { last_scan_at: null } }), NOW).health).toBe("onboarding");
    expect(assessHealth(row({ stage: "inactive" }), NOW).health).toBe("inactive");
  });

  it("annual plans count a twelfth toward MRR", () => {
    expect(monthlyEquivalent("annual", 449900)).toBe(37492);
    expect(monthlyEquivalent("monthly", 49900)).toBe(49900);
  });
});

describe("customers API", () => {
  it("needs the admin token", async () => {
    expect((await overview(get("/api/admin/customers", false))).status).toBe(401);
    expect((await counts(get("/api/admin/counts", false))).status).toBe(401);
  });

  it("overview and profile reflect money, usage and Google growth", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const outlet = await makeOutlet(tx, account, {
        state: "active",
        businessName: "Monitor Cafe",
        activatedAt: new Date(Date.now() - 40 * DAY),
        baselineRating: "4.1",
        baselineReviewCount: 100,
      });
      const [sub] = await tx
        .insert(subscriptions)
        .values({ id: crypto.randomUUID(), accountId: account.id, plan: "annual", status: "active", provider: "mock",
          currentPeriodEnd: new Date(Date.now() + 300 * DAY) })
        .returning();
      await tx.insert(payments).values({
        id: crypto.randomUUID(), subscriptionId: sub.id, providerPaymentId: `pay_${crypto.randomUUID()}`,
        amountMinor: 449900, currencyCode: "INR", status: "captured", webhookVerified: true,
      });
      await tx.insert(events).values([
        { outletId: outlet.id, type: "scan" },
        { outletId: outlet.id, type: "scan" },
        { outletId: outlet.id, type: "scan", occurredAt: new Date(Date.now() - 45 * DAY) },
      ]);
      await tx.insert(sessions).values({
        id: crypto.randomUUID(), outletId: outlet.id, completed: true, countedForTrial: false, completedAt: new Date(),
      });
      await tx.insert(placeSnapshots).values([
        { outletId: outlet.id, rating: "4.2", reviewCount: 110, polledAt: new Date(Date.now() - 7 * DAY) },
        { outletId: outlet.id, rating: "4.4", reviewCount: 118 },
      ]);

      const data = await (await overview(get("/api/admin/customers"))).json();
      const mine = data.customers.find((c: CustomerRow) => c.outlet_id === outlet.id) as CustomerRow;
      expect(mine).toMatchObject({
        business_name: "Monitor Cafe",
        stage: "paying",
        billing: { plan: "annual", mrr_minor: 37492, lifetime_minor: 449900, currency_code: "INR", will_convert: true },
        usage: { scans_30d: 2, scans_prev_30d: 1, reviews_30d: 1, conversion_30d: 0.5 },
        google: { rating: 4.4, review_count: 118, baseline_review_count: 100, gained: 18 },
      });
      expect(mine.usage.last_scan_at).not.toBeNull();
      expect(data.summary.mrr.INR).toBeGreaterThanOrEqual(37492);
      expect(data.queue).toEqual({ approvals: expect.any(Number), pending_sends: expect.any(Number) });

      const p = await (await profile(get("/api/x"), routeCtx({ outletId: outlet.id }))).json();
      expect(p.series).toHaveLength(31);
      expect(p.series.reduce((a: number, d: { scans: number }) => a + d.scans, 0)).toBe(2);
      expect(p.series.at(-1)).toMatchObject({ scans: 2, reviews: 1 });
      expect((await profile(get("/api/x"), routeCtx({ outletId: crypto.randomUUID() }))).status).toBe(404);
      expect((await profile(get("/api/x"), routeCtx({ outletId: "nope" }))).status).toBe(422);
    }));
  it("an expired paid period is not revenue", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const outlet = await makeOutlet(tx, account, { state: "trial", activatedAt: new Date(Date.now() - 20 * DAY) });
      const [sub] = await tx
        .insert(subscriptions)
        .values({ id: crypto.randomUUID(), accountId: account.id, plan: "monthly", status: "active", provider: "mock",
          currentPeriodEnd: new Date(Date.now() - 2 * DAY) })
        .returning();
      await tx.insert(payments).values({
        id: crypto.randomUUID(), subscriptionId: sub.id, providerPaymentId: `pay_${crypto.randomUUID()}`,
        amountMinor: 49900, currencyCode: "INR", status: "captured", webhookVerified: true,
      });
      const data = await (await overview(get("/api/admin/customers"))).json();
      const mine = data.customers.find((c: CustomerRow) => c.outlet_id === outlet.id) as CustomerRow;
      expect(mine.billing).toMatchObject({ mrr_minor: 0, lifetime_minor: 49900, will_convert: false });
      expect(mine.health).toBe("at_risk");
    }));
});
