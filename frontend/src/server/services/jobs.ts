/**
 * Scheduled jobs (documents/04-ARCHITECTURE.md section 8). Port of
 * backend/app/jobs/*.py. Each job takes a transaction and returns a count; the
 * cron route (src/app/api/cron/[job]/route.ts) runs it inside one transaction
 * guarded by a Postgres advisory lock, which is the same "one commit at the
 * end, one runner at a time" behaviour the APScheduler version had.
 *
 * Schedules are UTC (the Python ran on a UTC server without a timezone set).
 */
import { crc32 } from "node:zlib";
import { and, desc, eq, gt, gte, isNotNull, lt, lte, ne, sql } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { notify, notifyOnce } from "@/server/notifications";
import { hasPaidPeriod } from "./billing";
import { findZeroScanOutlets } from "./adminOps";
import { standings, headline, takeSnapshot } from "./competitors";
import { isCollecting } from "./outletState";
import { getPlaceSnapshot, PlacesUnavailableError } from "./places";
import { TRIAL_DAYS } from "./trial";

const { accounts, competitorWatches, events, notifications, outlets, placeSnapshots, sessions, subscriptions } = schema;

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_STATES = ["trial", "locked", "active", "past_due"] as const;

/* ------------------------------------------------------------ places poll */

/**
 * Weekly Google Places poll (SRS-14.1). Never used for trial metering (C-2):
 * purely a lagging business indicator for the owner's rating-delta view.
 */
export async function runPlacesPoll(db: DbLike): Promise<number> {
  const rows = await db.select().from(outlets).where(isNotNull(outlets.googlePlaceId));
  let polled = 0;
  for (const outlet of rows) {
    if (!isCollecting(outlet.state)) continue; // no reason to poll an outlet that isn't live
    try {
      const [rating, reviewCount] = await getPlaceSnapshot(outlet.googlePlaceId!);
      await db
        .insert(placeSnapshots)
        .values({ outletId: outlet.id, rating: rating === null ? null : String(rating), reviewCount });
      polled += 1;
    } catch (err) {
      if (!(err instanceof PlacesUnavailableError)) throw err;
      console.warn(`Places poll failed for outlet ${outlet.id}: ${err.message}`);
    }
  }
  await pollAllCompetitors(db);
  return polled;
}

/** Snapshot every watched competitor of a live outlet. */
export async function pollAllCompetitors(db: DbLike): Promise<number> {
  let polled = 0;
  for (const watch of await db.select().from(competitorWatches)) {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, watch.outletId)).limit(1);
    if (!outlet || !isCollecting(outlet.state)) continue;
    if (await takeSnapshot(db, watch)) polled += 1;
  }
  return polled;
}

/* -------------------------------------------------------- trial day 15 */

const REMINDER_DAY = 10; // 5 days before the lock

const paymentLink = () => `${getEnv().frontendBaseUrl.replace(/\/+$/, "")}/app/billing`;

async function sendLifecycle(
  db: DbLike,
  outlet: typeof outlets.$inferSelect,
  template: string,
  extra: Record<string, unknown> = {},
) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
  if (!account) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.outletId, outlet.id), eq(events.type, "scan")));
  await notifyOnce(db, {
    accountId: account.id,
    outletId: outlet.id,
    toEmail: account.ownerEmail,
    template,
    data: {
      business_name: outlet.businessName,
      scans: n,
      completed: outlet.trialFlowCount,
      payment_link: paymentLink(),
      ...extra,
    },
  });
}

/**
 * Daily. Credit exhaustion is event-driven (trialMetering.ts); this covers an
 * outlet that reaches day 15 without using its credits yet still needs its
 * dashboard locked and its credit countdown started (OD-21).
 */
export async function runTrialDay15Check(db: DbLike, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRIAL_DAYS * DAY_MS);
  const due = await db
    .select()
    .from(outlets)
    .where(and(eq(outlets.state, "trial"), isNotNull(outlets.activatedAt), lte(outlets.activatedAt, cutoff)));

  for (const outlet of due) {
    if (await hasPaidPeriod(db, outlet.accountId)) {
      // Paid up front (annual / one-time fallback): nothing to lock.
      await db.update(outlets).set({ state: "active" }).where(eq(outlets.id, outlet.id));
      continue;
    }
    // Collection is unaffected: `locked` collects like `trial` (outletState.ts).
    // The 10-credit countdown to `suspended` is measured from this count.
    await db
      .update(outlets)
      .set({ state: "locked", lockedAtFlowCount: outlet.trialFlowCount })
      .where(eq(outlets.id, outlet.id));
    await sendLifecycle(db, outlet, "trial_threshold");
  }

  const reminders = await db
    .select()
    .from(outlets)
    .where(
      and(
        eq(outlets.state, "trial"),
        isNotNull(outlets.activatedAt),
        lte(outlets.activatedAt, new Date(now.getTime() - REMINDER_DAY * DAY_MS)),
        gt(outlets.activatedAt, cutoff),
      ),
    );
  for (const outlet of reminders) {
    if (await hasPaidPeriod(db, outlet.accountId)) continue;
    await sendLifecycle(db, outlet, "trial_reminder", { days_left: TRIAL_DAYS - REMINDER_DAY });
  }
  return due.length;
}

/* ---------------------------------------------------------- weekly digest */

/** Unprompted proof of value in the channel the owner reads (SRS-13.3, FR-28). */
export async function runWeeklyDigest(db: DbLike, now: Date = new Date()): Promise<number> {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  let sent = 0;
  for (const outlet of await db.select().from(outlets)) {
    if (!isCollecting(outlet.state)) continue; // a paused outlet has nothing new to report
    const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
    if (!account) continue;

    const [{ scans }] = await db
      .select({ scans: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.outletId, outlet.id), eq(events.type, "scan"), gte(events.occurredAt, weekAgo)));
    const [{ completed }] = await db
      .select({ completed: sql<number>`count(distinct ${sessions.id})::int` })
      .from(sessions)
      .where(and(eq(sessions.outletId, outlet.id), eq(sessions.completed, true), gte(sessions.completedAt, weekAgo)));
    const [latest] = await db
      .select()
      .from(placeSnapshots)
      .where(eq(placeSnapshots.outletId, outlet.id))
      .orderBy(desc(placeSnapshots.polledAt))
      .limit(1);
    const rating = latest ? latest.rating : outlet.baselineRating;

    const { me, rivals } = await standings(db, outlet);
    await notify(db, {
      accountId: account.id,
      outletId: outlet.id,
      toEmail: account.ownerEmail,
      template: "weekly_digest",
      data: {
        business_name: outlet.businessName,
        scans,
        completed,
        rating,
        competitor_line: rivals.length ? headline(me, rivals.map(([, s]) => s)) : null,
      },
    });
    sent += 1;
  }
  return sent;
}

/* ---------------------------------------------------- event retention */

const RETENTION_MONTHS = 24; // NFR-10

/** Monthly. Events are append-only and never deleted before this expiry. */
export async function runEventRetentionPrune(db: DbLike, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_MONTHS * 30 * DAY_MS);
  const deleted = await db.delete(events).where(lt(events.occurredAt, cutoff)).returning({ id: events.id });
  return deleted.length;
}

/* --------------------------------------------------- cancellation expiry */

/**
 * Daily. Cancelled subscriptions whose paid period has ended -> outlet
 * `deactivated` (SRS-12.7). Reactivation is a new payment webhook (SRS-12.9);
 * the slug never changes, so printed codes come back.
 */
export async function runCancellationExpiry(db: DbLike, now: Date = new Date()): Promise<number> {
  const expired = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        isNotNull(subscriptions.cancelledAt),
        isNotNull(subscriptions.currentPeriodEnd),
        lte(subscriptions.currentPeriodEnd, now),
        ne(subscriptions.status, "expired"),
      ),
    );
  let count = 0;
  for (const sub of expired) {
    // A newer, active subscription on the same account wins (re-subscribed).
    const [newerActive] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.accountId, sub.accountId), ne(subscriptions.id, sub.id), eq(subscriptions.status, "active")))
      .limit(1);
    await db.update(subscriptions).set({ status: "expired" }).where(eq(subscriptions.id, sub.id));
    if (newerActive) continue;
    const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, sub.accountId)).limit(1);
    // Only live states are deactivated; suspended/rejected/pre-live are left alone.
    if (outlet && (LIVE_STATES as readonly string[]).includes(outlet.state)) {
      await db.update(outlets).set({ state: "deactivated" }).where(eq(outlets.id, outlet.id));
      count += 1;
    }
  }
  return count;
}

/* ------------------------------------------------ payment grace reminders */

const GRACE_DAYS = 7;
const REMINDER_DAYS = [3, 6];

/** Daily. Follow-ups on days 3 and 6 of the 7-day grace period (SRS-12.5). */
export async function runPaymentGraceReminders(db: DbLike, now: Date = new Date()): Promise<number> {
  let sent = 0;
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "past_due"), isNotNull(subscriptions.graceUntil)));
  for (const sub of subs) {
    const graceStart = new Date(sub.graceUntil!.getTime() - GRACE_DAYS * DAY_MS);
    const elapsed = Math.floor((now.getTime() - graceStart.getTime()) / DAY_MS);
    if (!REMINDER_DAYS.includes(elapsed)) continue;

    const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, sub.accountId)).limit(1);
    const [account] = await db.select().from(accounts).where(eq(accounts.id, sub.accountId)).limit(1);
    if (!outlet || !account) continue;

    const [recent] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.outletId, outlet.id),
          eq(notifications.template, "payment_failed"),
          gte(notifications.createdAt, new Date(now.getTime() - 20 * 60 * 60 * 1000)),
        ),
      )
      .limit(1);
    if (recent) continue; // already reminded today

    await notify(db, {
      accountId: account.id,
      outletId: outlet.id,
      toEmail: account.ownerEmail,
      template: "payment_failed",
      data: {
        business_name: outlet.businessName,
        grace_days: Math.max(0, GRACE_DAYS - elapsed),
        payment_link: paymentLink(),
      },
    });
    sent += 1;
  }
  return sent;
}

/* ------------------------------------------------------- zero-scan nudge */

/**
 * Weekly (R-8). Email the owner whose QR has had no scans a week in; sent once
 * per outlet. (Also queues a WhatsApp tap for the founder via notify.)
 */
export async function runZeroScanNudges(db: DbLike, now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const outlet of await findZeroScanOutlets(db, now)) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
    if (!account) continue;
    if (
      await notifyOnce(db, {
        accountId: account.id,
        outletId: outlet.id,
        toEmail: account.ownerEmail,
        template: "zero_scan_nudge",
        data: { business_name: outlet.businessName },
      })
    ) {
      sent += 1;
    }
  }
  return sent;
}

/* ------------------------------------------------------------- registry */

export interface JobDef {
  /** Route segment: /api/cron/<key>. */
  key: string;
  /** Cron expression, UTC. Mirrors backend/app/jobs/scheduler.py. */
  schedule: string;
  run: (db: DbLike) => Promise<number>;
}

export const JOBS: readonly JobDef[] = [
  { key: "places-poll", schedule: "0 3 * * 1", run: runPlacesPoll },
  { key: "trial-day15", schedule: "0 2 * * *", run: runTrialDay15Check },
  { key: "weekly-digest", schedule: "0 8 * * 1", run: runWeeklyDigest },
  { key: "event-prune", schedule: "0 4 1 * *", run: runEventRetentionPrune },
  { key: "cancellation-expiry", schedule: "30 2 * * *", run: runCancellationExpiry },
  { key: "grace-reminders", schedule: "0 10 * * *", run: runPaymentGraceReminders },
  { key: "zero-scan", schedule: "0 9 * * 1", run: runZeroScanNudges },
];

/**
 * Runs one job inside a single transaction behind a Postgres advisory lock, so
 * overlapping or retried cron calls cannot run it twice (no duplicate digests,
 * no double lock transitions). Returns null when another runner holds the lock.
 */
export async function runJob(db: DbLike, job: JobDef): Promise<{ ran: boolean; result?: number }> {
  const key = crc32(`revyu-job:${job.key}`);
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(${key}) as locked`);
    if (!rows[0]?.locked) return { ran: false };
    return { ran: true, result: await job.run(tx) };
  });
}
