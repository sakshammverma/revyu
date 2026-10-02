import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { POST as postEmail } from "@/app/api/gap-report/email/route";
import { GET as getReport } from "@/app/api/gap-report/route";
import { GET as getHealth } from "@/app/api/health/route";
import { schema, type DbLike } from "@/server/db";
import { inRolledBackTx, makeRequest } from "@/server/testing/helpers";
import { buildReport } from "./gapReport";

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

describe("buildReport (local fake data; ported from test_referrals_and_gap.py)", () => {
  it("ranks the business against the strongest three nearby", async () => {
    const r = await buildReport("ChIJ_me");
    expect(r.business).toEqual({ place_id: "ChIJ_me", name: "Your Clinic", rating: 4.3, review_count: 47 });
    expect(r.competitors.map((c) => c.review_count)).toEqual([180, 132, 96]);
    expect(r.review_gap).toBe(133);
    expect(r.rank_by_reviews).toBe(4);
    expect(r.group_size).toBe(4);
    expect(r.headline).toBe(
      "Smile Care Dental has 180 reviews; you have 47. You rank 4 of 4 nearby by review count.",
    );
  });
});

describe("gap report endpoints", () => {
  it("GET returns the report and validates place_id", () =>
    inTx(async () => {
      const ok = await getReport(makeRequest("/api/gap-report?place_id=ChIJabc"));
      expect(ok.status).toBe(200);
      expect(Object.keys(await ok.json()).sort()).toEqual(
        ["business", "competitors", "group_size", "headline", "rank_by_reviews", "review_gap"],
      );
      expect((await getReport(makeRequest("/api/gap-report?place_id=ab"))).status).toBe(422);
      expect((await getReport(makeRequest("/api/gap-report"))).status).toBe(422);
    }));

  it("POST /email records a lowercased lead and answers 202", () =>
    inTx(async (tx) => {
      const email = `Lead-${crypto.randomUUID().slice(0, 8)}@Example.com`;
      const res = await postEmail(makeRequest("/api/gap-report/email", { body: { place_id: "ChIJabc", email } }));
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ status: "sent" });
      const [lead] = await tx.select().from(schema.leads).where(eq(schema.leads.email, email.toLowerCase()));
      expect(lead).toMatchObject({ placeId: "ChIJabc", businessName: "Your Clinic", source: "gap_report" });

      const bad = await postEmail(makeRequest("/api/gap-report/email", { body: { place_id: "ChIJabc", email: "nope" } }));
      expect(bad.status).toBe(422);
    }));
});

describe("health", () => {
  it("reports the database as reachable", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: true });
  });
});
