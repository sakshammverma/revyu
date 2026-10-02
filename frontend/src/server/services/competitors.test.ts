import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { DELETE as deleteWatch } from "@/app/api/app/competitors/[watchId]/route";
import { GET as listWatches, POST as addWatchRoute } from "@/app/api/app/competitors/route";
import { schema, type DbLike } from "@/server/db";
import {
  inRolledBackTx,
  issueOwnerSession,
  makeAccount,
  makeOutlet,
  makeRequest,
  routeCtx,
} from "@/server/testing/helpers";
import { addWatch, delta, headline, type Standing, WatchError } from "./competitors";

const { competitorSnapshots, competitorWatches, placeSnapshots } = schema;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const st = (name: string, d: number | null): Standing => ({ name, rating: 4.4, review_count: 100, delta: d });

describe("delta and headline (ported from test_ops_and_competitors.py)", () => {
  it("computes the gain between the two newest known counts", () => {
    expect(delta([110, 100])).toBe(10);
    expect(delta([110])).toBeNull();
    expect(delta([null, 5, 3])).toBe(2);
  });
  it("words the headline for each situation", () => {
    const me = st("Me", 6);
    expect(headline(me, [st("A", 2)])).toContain("more than anyone");
    expect(headline(me, [st("A", 9)])).toContain("A gained 9");
    expect(headline(me, [st("A", 6)])).toBe("You and A both gained 6 last week.");
    expect(headline(me, [])).toMatch(/^Follow up to three/);
    expect(headline(st("Me", null), [st("A", 1)])).toMatch(/^We're collecting/);
    expect(headline(me, [st("A", null)])).toMatch(/^We're collecting/);
    // ties on the top rival: first one wins, like Python max()
    expect(headline(st("Me", 1), [st("A", 5), st("B", 5)])).toBe("A gained 5 reviews last week; you gained 1.");
  });
});

describe("addWatch", () => {
  it("rejects self, duplicates and the 4th watch; snapshots a baseline", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx), { googlePlaceId: "ChIJ_me" });
      const code = async (placeId: string) => {
        try {
          await addWatch(tx, outlet, placeId, "Rival");
          return "ok";
        } catch (e) {
          if (e instanceof WatchError) return e.code;
          throw e;
        }
      };
      expect(await code("ChIJ_me")).toBe("CANNOT_WATCH_SELF");
      expect(await code("p1")).toBe("ok");
      expect(await code("p1")).toBe("ALREADY_WATCHING");
      expect(await code("p2")).toBe("ok");
      expect(await code("p3")).toBe("ok");
      expect(await code("p4")).toBe("LIMIT_REACHED");
      const watches = await tx.select().from(competitorWatches).where(eq(competitorWatches.outletId, outlet.id));
      expect(watches).toHaveLength(3);
      for (const w of watches) {
        const snaps = await tx.select().from(competitorSnapshots).where(eq(competitorSnapshots.watchId, w.id));
        expect(snaps).toHaveLength(1); // local-mode Places returns fake data
      }
    }));
});

describe("competitor API", () => {
  it("round-trips, shapes the response and enforces ownership (SRS-15.6)", () =>
    inTx(async (tx) => {
      const a = await makeAccount(tx, "a");
      const b = await makeAccount(tx, "b");
      await makeOutlet(tx, a, { baselineRating: "4.5", baselineReviewCount: 60 });
      await makeOutlet(tx, b);
      const sa = await issueOwnerSession(tx, a);
      const sb = await issueOwnerSession(tx, b);

      expect((await listWatches(makeRequest("/api/app/competitors"), undefined as never)).status).toBe(401);
      const post = (body: unknown) =>
        addWatchRoute(makeRequest("/api/app/competitors", { body, session: sa }), undefined as never);
      expect((await post({ place_id: "ab", name: "x" })).status).toBe(422);

      const res = await post({ place_id: "p-x", name: "  Rival X  " });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.limit).toBe(3);
      expect(body.me).toEqual({ id: null, name: "Test Clinic", rating: 4.5, review_count: 60, delta: null });
      expect(body.competitors).toHaveLength(1);
      expect(body.competitors[0]).toMatchObject({ name: "Rival X", rating: 4.9, review_count: 142, delta: null });

      const dup = await post({ place_id: "p-x", name: "Rival X" });
      expect(dup.status).toBe(409);
      expect(await dup.json()).toEqual({ detail: { error: { code: "ALREADY_WATCHING" } } });

      const watchId = body.competitors[0].id;
      const del = (session: string, id: string) =>
        deleteWatch(makeRequest(`/api/app/competitors/${id}`, { method: "DELETE", session }), routeCtx({ watchId: id }));
      expect((await del(sb, watchId)).status).toBe(404);
      expect((await del(sa, "bad")).status).toBe(422);
      const gone = await del(sa, watchId);
      expect(gone.status).toBe(200);
      expect((await gone.json()).competitors).toEqual([]);
      expect(await tx.select().from(competitorWatches).where(eq(competitorWatches.id, watchId))).toHaveLength(0);
      expect(await tx.select().from(competitorSnapshots).where(eq(competitorSnapshots.watchId, watchId))).toHaveLength(0);
    }));

  it("computes deltas for me and rivals from snapshots", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const outlet = await makeOutlet(tx, account, { baselineRating: "4.0", baselineReviewCount: 100 });
      const session = await issueOwnerSession(tx, account);
      // One own snapshot: delta against the baseline.
      await tx.insert(placeSnapshots).values({ outletId: outlet.id, rating: "4.1", reviewCount: 108 });
      const [w] = await tx
        .insert(competitorWatches)
        .values({ id: crypto.randomUUID(), outletId: outlet.id, placeId: "rival-1", name: "Rival" })
        .returning();
      await tx.insert(competitorSnapshots).values([
        { watchId: w.id, rating: "4.3", reviewCount: 200, polledAt: new Date("2026-01-01T00:00:00Z") },
        { watchId: w.id, rating: "4.4", reviewCount: 203, polledAt: new Date("2026-01-08T00:00:00Z") },
      ]);
      const body = await (await listWatches(makeRequest("/api/app/competitors", { session }), undefined as never)).json();
      expect(body.me).toMatchObject({ rating: 4.1, review_count: 108, delta: 8 });
      expect(body.competitors[0]).toMatchObject({ rating: 4.4, review_count: 203, delta: 3 });
      expect(body.headline).toBe("You gained 8 reviews last week, more than anyone you follow.");
    }));

  it("404 OUTLET_NOT_FOUND when the account has no outlet", () =>
    inTx(async (tx) => {
      const session = await issueOwnerSession(tx, await makeAccount(tx));
      const res = await listWatches(makeRequest("/api/app/competitors", { session }), undefined as never);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ detail: { error: { code: "OUTLET_NOT_FOUND" } } });
    }));
});
