import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { PATCH as patchFeedback } from "@/app/api/app/feedback/[feedbackId]/route";
import { GET as getFeedback } from "@/app/api/app/outlets/[outletId]/feedback/route";
import { GET as getFunnel } from "@/app/api/app/outlets/[outletId]/funnel/route";
import { GET as getOverview } from "@/app/api/app/outlets/[outletId]/overview/route";
import { GET as getRating } from "@/app/api/app/outlets/[outletId]/rating/route";
import { GET as getTags } from "@/app/api/app/outlets/[outletId]/tags/route";
import { GET as getMine } from "@/app/api/app/outlets/mine/route";
import { schema, type DbLike } from "@/server/db";
import {
  inRolledBackTx,
  issueOwnerSession,
  makeAccount,
  makeOutlet,
  makeRequest,
  makeSession,
  routeCtx,
} from "@/server/testing/helpers";
import { pgTextToIso, pyRound } from "./dashboard";

const { events, placeSnapshots, privateFeedback, sessions, tags } = schema;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const ev = (tx: DbLike, outletId: string, type: string, sessionId: string | null, extra: object = {}) =>
  tx.insert(events).values({ outletId, sessionId, type, ...extra });

async function owner(tx: DbLike, overrides: Partial<typeof schema.outlets.$inferInsert> = {}) {
  const account = await makeAccount(tx);
  const outlet = await makeOutlet(tx, account, overrides);
  const session = await issueOwnerSession(tx, account);
  return { account, outlet, session };
}

describe("helpers", () => {
  it("pyRound matches Python (half-even on exact ties)", () => {
    expect(pyRound(12.25, 1)).toBe(12.2);
    expect(pyRound(2 / 3, 4)).toBe(0.6667);
    expect(pyRound(0.5, 0)).toBe(0);
  });
  it("pgTextToIso reproduces datetime.isoformat()", () => {
    expect(pgTextToIso("2026-10-01 10:00:00+00")).toBe("2026-10-01T10:00:00+00:00");
    expect(pgTextToIso("2026-10-01 10:00:00.12+00")).toBe("2026-10-01T10:00:00.120000+00:00");
    expect(pgTextToIso("2026-10-01 15:30:00.123456+05:30")).toBe("2026-10-01T15:30:00.123456+05:30");
  });
});

describe("auth and ownership (SRS-15.6)", () => {
  it("401 without a session, 403 for another owner's outlet, 422 for a bad id", () =>
    inTx(async (tx) => {
      const a = await owner(tx);
      const b = await owner(tx);
      const url = `/api/app/outlets/${a.outlet.id}/overview`;
      const ctx = routeCtx({ outletId: a.outlet.id });
      expect((await getOverview(makeRequest(url), ctx)).status).toBe(401);
      const res = await getOverview(makeRequest(url, { session: b.session }), ctx);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ detail: { error: { code: "FORBIDDEN" } } });
      const bad = await getOverview(makeRequest(url, { session: a.session }), routeCtx({ outletId: "nope" }));
      expect(bad.status).toBe(422);
      const unknown = await getOverview(
        makeRequest(url, { session: a.session }),
        routeCtx({ outletId: crypto.randomUUID() }),
      );
      expect(unknown.status).toBe(403);
    }));
});

describe("overview", () => {
  it("counts scans and completed sessions; empty outlet gives 0 conversion", () =>
    inTx(async (tx) => {
      const { outlet, session } = await owner(tx, { state: "locked", trialFlowCount: 10 });
      const ctx = routeCtx({ outletId: outlet.id });
      const url = `/api/app/outlets/${outlet.id}/overview`;
      let body = await (await getOverview(makeRequest(url, { session }), ctx)).json();
      expect(body).toMatchObject({
        scans: 0,
        completed_flows: 0,
        conversion_rate: 0,
        dashboard_locked: true,
        trial_flow_count: 10,
      });

      for (let i = 0; i < 3; i++) await ev(tx, outlet.id, "scan", null);
      const s = await makeSession(tx, outlet);
      await tx.update(sessions).set({ completed: true }).where(eq(sessions.id, s.id));
      body = await (await getOverview(makeRequest(url, { session }), ctx)).json();
      expect(body).toMatchObject({
        outlet_id: outlet.id,
        scans: 3,
        completed_flows: 1,
        conversion_rate: 0.3333,
        state: "locked",
      });
    }));
});

describe("funnel", () => {
  it("counts rows for scan, distinct sessions after, drop-off rounded, range windows", () =>
    inTx(async (tx) => {
      const { outlet, session } = await owner(tx);
      const s1 = await makeSession(tx, outlet);
      const s2 = await makeSession(tx, outlet);
      const s3 = await makeSession(tx, outlet);
      const old = new Date(Date.now() - 10 * 86_400_000);
      for (let i = 0; i < 4; i++) await ev(tx, outlet.id, "scan", null);
      await ev(tx, outlet.id, "scan", null, { occurredAt: old });
      for (const s of [s1, s2, s3]) await ev(tx, outlet.id, "flow_start", s.id);
      await ev(tx, outlet.id, "flow_start", s1.id); // duplicate session counts once
      await ev(tx, outlet.id, "rating_selected", s1.id);
      await ev(tx, outlet.id, "rating_selected", s2.id, { occurredAt: old });

      const call = async (q: string) =>
        (
          await getFunnel(
            makeRequest(`/api/app/outlets/${outlet.id}/funnel${q}`, { session }),
            routeCtx({ outletId: outlet.id }),
          )
        ).json();
      const all = await call("?range=all");
      expect(all.steps.map((x: { count: number }) => x.count)).toEqual([5, 3, 2, 0, 0, 0, 0]);
      expect(all.steps[0].drop_off_pct).toBeNull();
      expect(all.steps[1].drop_off_pct).toBe(40);
      expect(all.steps[2].drop_off_pct).toBe(33.3);
      expect(all.steps[3].drop_off_pct).toBe(100);
      expect(all.steps[4].drop_off_pct).toBeNull(); // previous step is 0
      expect(all.note).toContain("cannot be measured (C-1)");

      const d7 = await call("?range=7d");
      expect(d7.steps.slice(0, 3).map((x: { count: number }) => x.count)).toEqual([4, 3, 1]);
      expect((await call("")).steps[0].count).toBe(5); // default 30d includes the 10-day-old scan
      expect((await call("?range=bogus")).steps[0].count).toBe(5); // unknown range = all
    }));
});

describe("tags", () => {
  it("counts tag ids, labels them, falls back to id/first label, ties keep first-seen order", () =>
    inTx(async (tx) => {
      const { outlet, session } = await owner(tx);
      const mk = async (label: object, sortOrder: number) =>
        (
          await tx
            .insert(tags)
            .values({ id: crypto.randomUUID(), outletId: outlet.id, label, phrases: {}, sortOrder, active: true })
            .returning()
        )[0];
      const t1 = await mk({ en: "Friendly staff" }, 0);
      const t2 = await mk({ hi: "clean" }, 1);
      const t3 = await mk({ en: "Fast" }, 2);
      const ghost = crypto.randomUUID();
      await ev(tx, outlet.id, "tags_selected", null, { payload: { tag_ids: [t3.id, t1.id] } });
      await ev(tx, outlet.id, "tags_selected", null, { payload: { tag_ids: [t2.id, t1.id, ghost] } });
      await ev(tx, outlet.id, "tags_selected", null, { payload: null });
      await ev(tx, outlet.id, "tags_selected", null, { payload: {} });
      await ev(tx, outlet.id, "tags_selected", null, {
        payload: { tag_ids: [t1.id] },
        occurredAt: new Date(Date.now() - 40 * 86_400_000),
      });
      const get = async (q: string) =>
        (
          await getTags(
            makeRequest(`/api/app/outlets/${outlet.id}/tags${q}`, { session }),
            routeCtx({ outletId: outlet.id }),
          )
        ).json();
      expect((await get("")).tags).toEqual([
        { label: "Friendly staff", count: 2 },
        { label: "Fast", count: 1 },
        { label: "clean", count: 1 },
        { label: ghost, count: 1 },
      ]);
      expect((await get("?range=all")).tags[0]).toEqual({ label: "Friendly staff", count: 3 });
    }));
});

describe("rating", () => {
  it("falls back to the baseline, then uses the latest snapshot", () =>
    inTx(async (tx) => {
      const { outlet, session } = await owner(tx, { baselineRating: "4.2", baselineReviewCount: 50 });
      const get = async () =>
        (
          await getRating(
            makeRequest(`/api/app/outlets/${outlet.id}/rating`, { session }),
            routeCtx({ outletId: outlet.id }),
          )
        ).json();
      expect(await get()).toEqual({
        baseline_rating: 4.2,
        baseline_review_count: 50,
        current_rating: 4.2,
        current_review_count: 50,
        polled_at: null,
      });
      await tx
        .insert(placeSnapshots)
        .values({ outletId: outlet.id, rating: "4.0", reviewCount: 55, polledAt: new Date("2026-01-01T00:00:00Z") });
      await tx.insert(placeSnapshots).values({
        outletId: outlet.id,
        rating: "4.5",
        reviewCount: 60,
        polledAt: new Date("2026-02-01T10:20:30.250Z"),
      });
      const r = await get();
      expect(r).toMatchObject({ current_rating: 4.5, current_review_count: 60, baseline_rating: 4.2 });
      expect(r.polled_at).toMatch(/^2026-02-01T\d\d:20:30\.250000[+-]\d\d:\d\d$/);
    }));
});

describe("feedback inbox and resolve", () => {
  it("lists newest first and PATCH toggles resolved, owner only", () =>
    inTx(async (tx) => {
      const a = await owner(tx);
      const b = await owner(tx);
      const s = await makeSession(tx, a.outlet);
      const mk = async (message: string, createdAt: Date, rating: number | null) =>
        (
          await tx
            .insert(privateFeedback)
            .values({
              id: crypto.randomUUID(),
              outletId: a.outlet.id,
              sessionId: s.id,
              rating,
              message,
              contact: null,
              resolved: false,
              createdAt,
            })
            .returning()
        )[0];
      const older = await mk("old", new Date("2026-03-01T00:00:00Z"), 2);
      const newer = await mk("new", new Date("2026-03-02T00:00:00Z"), null);

      const list = await (
        await getFeedback(
          makeRequest(`/api/app/outlets/${a.outlet.id}/feedback`, { session: a.session }),
          routeCtx({ outletId: a.outlet.id }),
        )
      ).json();
      expect(list.items.map((i: { message: string }) => i.message)).toEqual(["new", "old"]);
      expect(list.items[0]).toMatchObject({ id: newer.id, rating: null, contact: null, resolved: false });

      const patch = (session: string, id: string, body: unknown) =>
        patchFeedback(makeRequest(`/api/app/feedback/${id}`, { method: "PATCH", body, session }), routeCtx({ feedbackId: id }));
      expect((await patch(b.session, older.id, { resolved: true })).status).toBe(403);
      expect((await patch(a.session, crypto.randomUUID(), { resolved: true })).status).toBe(404);
      expect((await patch(a.session, older.id, { resolved: "yes" })).status).toBe(422);
      const ok = await patch(a.session, older.id, { resolved: true });
      expect(ok.status).toBe(204);
      let [row] = await tx.select().from(privateFeedback).where(eq(privateFeedback.id, older.id));
      expect(row.resolved).toBe(true);
      expect(row.resolvedAt).toBeInstanceOf(Date);
      await patch(a.session, older.id, { resolved: false });
      [row] = await tx.select().from(privateFeedback).where(eq(privateFeedback.id, older.id));
      expect(row.resolved).toBe(false);
      expect(row.resolvedAt).toBeNull();
    }));
});

describe("outlets/mine", () => {
  it("returns the owner's outlet with collecting flag; 404 when none", () =>
    inTx(async (tx) => {
      const { outlet, session } = await owner(tx, { state: "suspended" });
      const res = await getMine(makeRequest("/api/app/outlets/mine", { session }), undefined as never);
      expect(await res.json()).toEqual({
        outlet_id: outlet.id,
        business_name: "Test Clinic",
        state: "suspended",
        collecting: false,
      });
      const lone = await issueOwnerSession(tx, await makeAccount(tx));
      const none = await getMine(makeRequest("/api/app/outlets/mine", { session: lone }), undefined as never);
      expect(none.status).toBe(404);
    }));
});
