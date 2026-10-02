import { readFileSync } from "node:fs";
import path from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { GET as cronGet, POST as cronPost } from "@/app/api/cron/[job]/route";
import { getDb, schema, type DbLike } from "@/server/db";
import { addEvent, inRolledBackTx, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";
import {
  JOBS,
  runCancellationExpiry,
  runEventRetentionPrune,
  runJob,
  runPaymentGraceReminders,
  runPlacesPoll,
  runTrialDay15Check,
  runWeeklyDigest,
  runZeroScanNudges,
} from "./jobs";

const { events, notifications, outlets, placeSnapshots, subscriptions } = schema;
const DAY = 86_400_000;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const reload = async (db: DbLike, id: string) => (await db.select().from(outlets).where(eq(outlets.id, id)))[0];
const mails = (db: DbLike, outletId: string, template: string, channel = "email") =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.outletId, outletId), eq(notifications.template, template), eq(notifications.channel, channel)));

async function makeSub(db: DbLike, accountId: string, over: Partial<typeof subscriptions.$inferInsert> = {}) {
  const [sub] = await db
    .insert(subscriptions)
    .values({ id: crypto.randomUUID(), accountId, plan: "monthly", status: "active", provider: "razorpay", ...over })
    .returning();
  return sub;
}

describe("trial day-15 check (ported from test_hardening.py)", () => {
  it("locks a 16-day-old trial once and sends trial_threshold once", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), {
        state: "trial",
        activatedAt: new Date(Date.now() - 16 * DAY),
        trialFlowCount: 4,
      });
      await runTrialDay15Check(db);
      await runTrialDay15Check(db);
      const o = await reload(db, outlet.id);
      expect(o.state).toBe("locked");
      expect(o.lockedAtFlowCount).toBe(4); // the credit countdown starts here (OD-21)
      expect(await mails(db, outlet.id, "trial_threshold")).toHaveLength(1);
    }));

  it("moves a paid-up trial to active instead of locking it", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const outlet = await makeOutlet(db, account, { state: "trial", activatedAt: new Date(Date.now() - 16 * DAY) });
      await makeSub(db, account.id, { currentPeriodEnd: new Date(Date.now() + 30 * DAY) });
      await runTrialDay15Check(db);
      expect((await reload(db, outlet.id)).state).toBe("active");
      expect(await mails(db, outlet.id, "trial_threshold")).toHaveLength(0);
    }));

  it("leaves young trials alone but reminds at day 10, once", () =>
    inRolledBackTx(async (db) => {
      const young = await makeOutlet(db, await makeAccount(db), { state: "trial", activatedAt: new Date(Date.now() - 3 * DAY) });
      const dueSoon = await makeOutlet(db, await makeAccount(db, "b"), { state: "trial", activatedAt: new Date(Date.now() - 11 * DAY) });
      await runTrialDay15Check(db);
      await runTrialDay15Check(db);
      expect((await reload(db, young.id)).state).toBe("trial");
      expect(await mails(db, young.id, "trial_reminder")).toHaveLength(0);
      expect((await reload(db, dueSoon.id)).state).toBe("trial");
      expect(await mails(db, dueSoon.id, "trial_reminder")).toHaveLength(1);
    }));
});

describe("event retention prune", () => {
  it("deletes events older than 24 months and keeps newer ones", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await db.insert(events).values([
        { outletId: outlet.id, type: "scan", occurredAt: new Date(Date.now() - 800 * DAY) },
        { outletId: outlet.id, type: "scan", occurredAt: new Date(Date.now() - 700 * DAY) },
        { outletId: outlet.id, type: "scan" },
      ]);
      const deleted = await runEventRetentionPrune(db);
      expect(deleted).toBeGreaterThanOrEqual(1);
      expect(await db.select().from(events).where(eq(events.outletId, outlet.id))).toHaveLength(2);
    }));
});

describe("cancellation expiry", () => {
  it("expires the subscription and deactivates a live outlet", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const outlet = await makeOutlet(db, account, { state: "active" });
      const sub = await makeSub(db, account.id, { cancelledAt: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - DAY) });
      await runCancellationExpiry(db);
      expect((await reload(db, outlet.id)).state).toBe("deactivated");
      expect((await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)))[0].status).toBe("expired");
    }));

  it("a newer active subscription keeps the outlet live", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const outlet = await makeOutlet(db, account, { state: "active" });
      await makeSub(db, account.id, { cancelledAt: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - DAY) });
      await makeSub(db, account.id, { status: "active", currentPeriodEnd: new Date(Date.now() + 20 * DAY) });
      await runCancellationExpiry(db);
      expect((await reload(db, outlet.id)).state).toBe("active");
    }));

  it("does not touch a suspended outlet or a period that has not ended", () =>
    inRolledBackTx(async (db) => {
      const a = await makeAccount(db);
      const suspended = await makeOutlet(db, a, { state: "suspended" });
      await makeSub(db, a.id, { cancelledAt: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - DAY) });
      const b = await makeAccount(db, "b");
      const running = await makeOutlet(db, b, { state: "active" });
      await makeSub(db, b.id, { cancelledAt: new Date(), currentPeriodEnd: new Date(Date.now() + 10 * DAY) });
      await runCancellationExpiry(db);
      expect((await reload(db, suspended.id)).state).toBe("suspended");
      expect((await reload(db, running.id)).state).toBe("active");
    }));
});

describe("payment grace reminders", () => {
  it("reminds on day 3, once a day, and ignores other days", () =>
    inRolledBackTx(async (db) => {
      // grace_until - 7 days = start of grace, so "day 3" means 3 full days elapsed.
      const a = await makeAccount(db);
      const day3 = await makeOutlet(db, a, { state: "past_due" });
      await makeSub(db, a.id, { status: "past_due", graceUntil: new Date(Date.now() + 4 * DAY - 3_600_000) });
      const b = await makeAccount(db, "b");
      const day1 = await makeOutlet(db, b, { state: "past_due" });
      await makeSub(db, b.id, { status: "past_due", graceUntil: new Date(Date.now() + 6 * DAY - 3_600_000) });

      expect(await runPaymentGraceReminders(db)).toBeGreaterThanOrEqual(1);
      expect(await mails(db, day3.id, "payment_failed")).toHaveLength(1);
      expect(await mails(db, day1.id, "payment_failed")).toHaveLength(0);
      await runPaymentGraceReminders(db); // already reminded today
      expect(await mails(db, day3.id, "payment_failed")).toHaveLength(1);
    }));
});

describe("zero-scan nudges", () => {
  it("nudges an outlet with no scans a week in, once; spares one that has scans", () =>
    inRolledBackTx(async (db) => {
      const quiet = await makeOutlet(db, await makeAccount(db), { state: "trial", activatedAt: new Date(Date.now() - 8 * DAY) });
      const busy = await makeOutlet(db, await makeAccount(db, "b"), { state: "trial", activatedAt: new Date(Date.now() - 8 * DAY) });
      await addEvent(db, busy, null, "scan");
      await runZeroScanNudges(db);
      await runZeroScanNudges(db);
      expect(await mails(db, quiet.id, "zero_scan_nudge")).toHaveLength(1);
      expect(await mails(db, busy.id, "zero_scan_nudge")).toHaveLength(0);
    }));
});

describe("weekly digest", () => {
  it("goes to collecting outlets only", () =>
    inRolledBackTx(async (db) => {
      const live = await makeOutlet(db, await makeAccount(db), { state: "active" });
      const paused = await makeOutlet(db, await makeAccount(db, "b"), { state: "suspended" });
      await addEvent(db, live, null, "scan");
      await runWeeklyDigest(db);
      expect(await mails(db, live.id, "weekly_digest")).toHaveLength(1);
      expect(await mails(db, paused.id, "weekly_digest")).toHaveLength(0);
    }));
});

describe("places poll", () => {
  it("snapshots live outlets with a place id and skips paused or id-less ones", () =>
    inRolledBackTx(async (db) => {
      const live = await makeOutlet(db, await makeAccount(db), { state: "active", googlePlaceId: "ChIJ_live" });
      const paused = await makeOutlet(db, await makeAccount(db, "b"), { state: "suspended", googlePlaceId: "ChIJ_paused" });
      const noId = await makeOutlet(db, await makeAccount(db, "c"), { state: "active" });
      await runPlacesPoll(db);
      const snaps = (id: string) => db.select().from(placeSnapshots).where(eq(placeSnapshots.outletId, id));
      expect(await snaps(live.id)).toHaveLength(1);
      expect((await snaps(live.id))[0]).toMatchObject({ rating: "4.9", reviewCount: 142 });
      expect(await snaps(paused.id)).toHaveLength(0);
      expect(await snaps(noId.id)).toHaveLength(0);
    }));
});

describe("runJob", () => {
  it("does not run a job that another runner is already running", async () => {
    const job = { key: "lock-probe", schedule: "* * * * *", run: vi.fn(async () => 1) };
    // Hold the lock from one connection, then try from another.
    await getDb().transaction(async (holderTx) => {
      const { crc32 } = await import("node:zlib");
      await holderTx.execute(sql`select pg_advisory_xact_lock(${crc32("revyu-job:lock-probe")})`);
      const second = await runJob(getDb(), job);
      expect(second).toEqual({ ran: false });
      expect(job.run).not.toHaveBeenCalled();
    });
    expect(await runJob(getDb(), job)).toEqual({ ran: true, result: 1 }); // lock released with the transaction
  });
});

describe("cron route", () => {
  const auth = { authorization: "Bearer test-cron-secret-0123456789abcdef" };

  it("refuses missing or wrong secrets", async () => {
    const ctx = routeCtx({ job: "event-prune" });
    expect((await cronGet(makeRequest("/api/cron/event-prune"), ctx)).status).toBe(401);
    expect((await cronGet(makeRequest("/api/cron/event-prune", { headers: { authorization: "Bearer nope" } }), ctx)).status).toBe(401);
  });

  it("404s an unknown job and runs a known one on GET and POST", () =>
    inTx(async () => {
      const unknown = await cronGet(makeRequest("/api/cron/nope", { headers: auth }), routeCtx({ job: "nope" }));
      expect(unknown.status).toBe(404);
      for (const handlerFn of [cronGet, cronPost]) {
        const res = await handlerFn(makeRequest("/api/cron/event-prune", { method: handlerFn === cronGet ? "GET" : "POST", headers: auth }), routeCtx({ job: "event-prune" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ job: "event-prune", ran: true });
      }
    }));
});

describe("schedule registry", () => {
  it("vercel.json lists exactly the registered jobs with the same schedules", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf-8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(vercel.crons.map((c) => [c.path, c.schedule])).toEqual(JOBS.map((j) => [`/api/cron/${j.key}`, j.schedule]));
  });

  it("matches the seven APScheduler jobs it replaces", () => {
    expect(JOBS.map((j) => j.key).sort()).toEqual(
      ["cancellation-expiry", "event-prune", "grace-reminders", "places-poll", "trial-day15", "weekly-digest", "zero-scan"].sort(),
    );
  });
});
