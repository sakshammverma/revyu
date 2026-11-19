/**
 * Founder's customer monitor: one row per business with money, usage, Google
 * outcome and a health verdict, so the admin home answers "who needs me
 * today?" without opening each outlet. Every figure comes from a fixed number
 * of grouped queries, whatever the customer count.
 */
import { and, desc, eq, gte, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { pyIso } from "./pyDate";
import { TRIAL_DAYS } from "./trial";
import { TRIAL_CREDITS } from "./trialMetering";

const { accounts, events, notifications, outlets, ownerSessions, payments, placeSnapshots, subscriptions } = schema;
const customerSessions = schema.sessions;

const DAY_MS = 86_400_000;

/* ----------------------------------------------------------------- types */

export type Stage = "onboarding" | "trial" | "paying" | "paused" | "inactive";
export type Health = "at_risk" | "watch" | "healthy" | "onboarding" | "inactive";

const STAGE_BY_STATE: Record<string, Stage> = {
  draft: "onboarding",
  pending_payment: "onboarding",
  pending_approval: "onboarding",
  trial: "trial",
  locked: "trial",
  active: "paying",
  past_due: "paying",
  suspended: "paused",
  deactivated: "inactive",
  rejected: "inactive",
};

export interface CustomerRow {
  outlet_id: string;
  business_name: string;
  slug: string;
  vertical: string;
  country_code: string;
  state: string;
  stage: Stage;
  owner: { name: string | null; phone: string; email: string };
  joined_at: string;
  activated_at: string | null;
  owner_last_seen_at: string | null;
  billing: {
    plan: string | null;
    status: string | null;
    /** Monthly-equivalent revenue in minor units; annual plans count a twelfth. 0 when not paying. */
    mrr_minor: number;
    currency_code: string;
    lifetime_minor: number;
    last_paid_at: string | null;
    /** End of the paid period, or the grace deadline when a charge failed. */
    renews_at: string | null;
    grace_until: string | null;
    cancelled: boolean;
    /** Paid up front or an authorised mandate: the trial converts on its own. */
    will_convert: boolean;
  };
  trial: { days_left: number | null; credits_left: number | null } | null;
  usage: {
    scans_30d: number;
    scans_prev_30d: number;
    reviews_30d: number;
    reviews_prev_30d: number;
    conversion_30d: number | null;
    last_scan_at: string | null;
  };
  google: {
    rating: number | null;
    review_count: number | null;
    baseline_rating: number | null;
    baseline_review_count: number | null;
    /** Reviews added on Google since Revyu went live. */
    gained: number | null;
  };
  health: Health;
  /** Short, most-urgent-first reasons behind the health verdict. Empty when healthy. */
  reasons: string[];
}

/* --------------------------------------------------------------- health */

type HealthInput = Pick<CustomerRow, "state" | "stage" | "activated_at" | "owner_last_seen_at" | "billing" | "trial" | "usage">;

const daysSince = (iso: string | null, now: Date): number | null =>
  iso === null ? null : Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Pure verdict so the rules are testable without a database. `at_risk` means
 * revenue is leaving or the product has stopped being used; `watch` means a
 * trend worth a call this week.
 */
export function assessHealth(c: HealthInput, now: Date = new Date()): { health: Health; reasons: string[] } {
  if (c.stage === "onboarding") return { health: "onboarding", reasons: [] };
  if (c.stage === "inactive") return { health: "inactive", reasons: [] };

  const risk: string[] = [];
  const watch: string[] = [];
  const u = c.usage;
  const live = daysSince(c.activated_at, now);
  const quiet = daysSince(u.last_scan_at, now);

  // Money first: these are revenue leaving today.
  if (c.state === "past_due") {
    const grace = c.billing.grace_until ? Math.ceil((new Date(c.billing.grace_until).getTime() - now.getTime()) / DAY_MS) : null;
    risk.push(grace !== null && grace > 0 ? `Payment failed, ${plural(grace, "day")} of grace left` : "Payment failed");
  }
  if (c.state === "suspended") risk.push("Collection stopped (unpaid)");
  if (c.state === "locked") {
    const left = c.trial?.credits_left;
    risk.push(left !== null && left !== undefined ? `Trial over, not paid · ${plural(left, "review")} left` : "Trial over, not paid");
  }
  if (c.stage === "trial" && c.state === "trial" && !c.billing.will_convert && c.trial?.days_left !== null && c.trial?.days_left !== undefined) {
    const d = c.trial.days_left;
    if (d <= 3) risk.push(d <= 0 ? "Trial ends today, no payment set up" : `Trial ends in ${plural(d, "day")}, no payment set up`);
    else if (d <= 7) watch.push(`Trial ends in ${plural(d, "day")}`);
  }
  if (c.billing.cancelled && c.billing.renews_at) {
    watch.push(`Cancelled, access ends ${new Date(c.billing.renews_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`);
  }

  // Usage: a QR nobody scans is a churn waiting to happen.
  if (live !== null && live >= 7 && u.last_scan_at === null) risk.push("No scans since going live");
  else if (quiet !== null && quiet >= 14) risk.push(`No scans in ${quiet} days`);
  else if (quiet !== null && quiet >= 7) watch.push(`Quiet for ${quiet} days`);

  if (u.scans_prev_30d >= 10 && u.scans_30d <= u.scans_prev_30d / 2) {
    const drop = Math.round((1 - u.scans_30d / u.scans_prev_30d) * 100);
    watch.push(`Scans down ${drop}% vs last month`);
  }
  if (u.scans_30d >= 10 && u.conversion_30d !== null && u.conversion_30d < 0.05) {
    watch.push(`Only ${Math.round(u.conversion_30d * 100)}% of scans become reviews`);
  }

  const seen = daysSince(c.owner_last_seen_at, now);
  if (live !== null && live >= 14 && (seen === null || seen >= 21)) {
    watch.push(seen === null ? "Owner never opened the dashboard" : `Owner last seen ${seen} days ago`);
  }

  if (risk.length) return { health: "at_risk", reasons: [...risk, ...watch] };
  if (watch.length) return { health: "watch", reasons: watch };
  return { health: "healthy", reasons: [] };
}

/* ---------------------------------------------------------------- query */

const num = (v: unknown): number => Number(v ?? 0);
const isoOrNull = (d: Date | string | null | undefined): string | null =>
  d ? pyIso(d instanceof Date ? d : new Date(d)) : null;

/** First row per key of an already-ordered list (DISTINCT ON without the driver API). */
function firstBy<T>(rows: T[], key: (r: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) if (!out.has(key(r))) out.set(key(r), r);
  return out;
}

/** Monthly-equivalent price of a payment on a plan. */
export function monthlyEquivalent(plan: string | null, amountMinor: number): number {
  return plan === "annual" ? Math.round(amountMinor / 12) : amountMinor;
}

export async function customerRows(db: DbLike, opts: { outletIds?: string[]; now?: Date } = {}): Promise<CustomerRow[]> {
  const now = opts.now ?? new Date();
  const d30 = new Date(now.getTime() - 30 * DAY_MS);
  const d60 = new Date(now.getTime() - 60 * DAY_MS);
  // Raw `sql` params skip column mapping, so dates go in as ISO text with a cast.
  const t30 = sql`${d30.toISOString()}::timestamptz`;
  const t60 = sql`${d60.toISOString()}::timestamptz`;
  const only = (col: typeof outlets.id | typeof events.outletId | typeof customerSessions.outletId | typeof placeSnapshots.outletId): SQL | undefined =>
    opts.outletIds ? inArray(col, opts.outletIds) : undefined;

  const base = await db
    .select({ o: outlets, a: accounts })
    .from(outlets)
    .innerJoin(accounts, eq(accounts.id, outlets.accountId))
    .where(only(outlets.id))
    .orderBy(desc(outlets.createdAt));
  if (!base.length) return [];
  const accountIds = [...new Set(base.map((r) => r.a.id))];

  const scanRows = await db
    .select({
      outletId: events.outletId,
      cur: sql<number>`count(*) filter (where ${events.occurredAt} >= ${t30})::int`,
      prev: sql<number>`count(*) filter (where ${events.occurredAt} >= ${t60} and ${events.occurredAt} < ${t30})::int`,
      last: sql<Date | string | null>`max(${events.occurredAt})`,
    })
    .from(events)
    .where(and(eq(events.type, "scan"), only(events.outletId)))
    .groupBy(events.outletId);

  const reviewRows = await db
    .select({
      outletId: customerSessions.outletId,
      cur: sql<number>`count(*) filter (where ${customerSessions.completedAt} >= ${t30})::int`,
      prev: sql<number>`count(*) filter (where ${customerSessions.completedAt} >= ${t60} and ${customerSessions.completedAt} < ${t30})::int`,
    })
    .from(customerSessions)
    .where(and(eq(customerSessions.completed, true), gte(customerSessions.completedAt, d60), only(customerSessions.outletId)))
    .groupBy(customerSessions.outletId);

  // Latest poll per outlet only.
  const snapRows = await db
    .select({ outletId: placeSnapshots.outletId, rating: placeSnapshots.rating, reviewCount: placeSnapshots.reviewCount })
    .from(placeSnapshots)
    .where(
      and(
        only(placeSnapshots.outletId),
        sql`${placeSnapshots.polledAt} = (select max(p2.polled_at) from place_snapshots p2 where p2.outlet_id = ${placeSnapshots.outletId})`,
      ),
    );

  // The newest non-abandoned subscription is the one that matters ("created"
  // with an active mandate is a trial that will charge on its own).
  const subRows = await db
    .select({
      accountId: subscriptions.accountId,
      id: subscriptions.id,
      plan: subscriptions.plan,
      status: subscriptions.status,
      mandateStatus: subscriptions.mandateStatus,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      graceUntil: subscriptions.graceUntil,
      cancelledAt: subscriptions.cancelledAt,
    })
    .from(subscriptions)
    .where(and(inArray(subscriptions.accountId, accountIds), ne(subscriptions.status, "abandoned")))
    .orderBy(subscriptions.accountId, desc(subscriptions.createdAt));

  const payRows = await db
    .select({
      accountId: subscriptions.accountId,
      lifetime: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
      last: sql<Date | string | null>`max(${payments.createdAt})`,
      currency: sql<string | null>`max(${payments.currencyCode})`,
    })
    .from(payments)
    .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
    .where(and(eq(payments.status, "captured"), inArray(subscriptions.accountId, accountIds)))
    .groupBy(subscriptions.accountId);

  // MRR is the last captured charge on the current subscription, not lifetime / months.
  const lastChargeRows = await db
    .select({ subscriptionId: payments.subscriptionId, amountMinor: payments.amountMinor })
    .from(payments)
    .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
    .where(and(eq(payments.status, "captured"), inArray(subscriptions.accountId, accountIds)))
    .orderBy(payments.subscriptionId, desc(payments.createdAt));

  const seenRows = await db
    .select({ accountId: ownerSessions.accountId, last: sql<Date | string | null>`max(${ownerSessions.createdAt})` })
    .from(ownerSessions)
    .where(inArray(ownerSessions.accountId, accountIds))
    .groupBy(ownerSessions.accountId);

  const scans = new Map(scanRows.map((r) => [r.outletId, r]));
  const reviews = new Map(reviewRows.map((r) => [r.outletId, r]));
  const snaps = new Map(snapRows.map((r) => [r.outletId, r]));
  const subs = firstBy(subRows, (r) => r.accountId);
  const pays = new Map(payRows.map((r) => [r.accountId, r]));
  const lastCharge = new Map([...firstBy(lastChargeRows, (r) => r.subscriptionId)].map(([k, r]) => [k, r.amountMinor]));
  const seen = new Map(seenRows.map((r) => [r.accountId, r.last]));

  return base.map(({ o, a }) => {
    const stage = STAGE_BY_STATE[o.state] ?? "inactive";
    const s = scans.get(o.id);
    const r = reviews.get(o.id);
    const snap = snaps.get(o.id);
    const sub = subs.get(a.id);
    const pay = pays.get(a.id);

    const scans30 = num(s?.cur);
    const reviews30 = num(r?.cur);
    const charge = sub ? lastCharge.get(sub.id) : undefined;
    const periodLive = !!sub?.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now.getTime();
    // Revenue only while a paid period is running (a mandate sub may not have an end date yet).
    const paying =
      sub?.status === "active" && charge !== undefined && (periodLive || !sub.currentPeriodEnd) &&
      !["deactivated", "rejected"].includes(o.state);

    let trial: CustomerRow["trial"] = null;
    if (o.state === "trial") {
      const elapsed = o.activatedAt ? Math.floor((now.getTime() - o.activatedAt.getTime()) / DAY_MS) : null;
      trial = { days_left: elapsed === null ? null : Math.max(0, TRIAL_DAYS - elapsed), credits_left: null };
    } else if (o.state === "locked") {
      const used = o.lockedAtFlowCount === null ? null : o.trialFlowCount - o.lockedAtFlowCount;
      trial = { days_left: 0, credits_left: used === null ? null : Math.max(0, TRIAL_CREDITS - used) };
    }

    const rating = snap?.rating === null || snap?.rating === undefined ? null : Number(snap.rating);
    const count = snap?.reviewCount ?? null;
    const baseCount = o.baselineReviewCount;

    const row: Omit<CustomerRow, "health" | "reasons"> = {
      outlet_id: o.id,
      business_name: o.businessName,
      slug: o.slug,
      vertical: o.vertical,
      country_code: o.countryCode,
      state: o.state,
      stage,
      owner: { name: a.ownerName, phone: a.ownerPhone, email: a.ownerEmail },
      joined_at: pyIso(o.createdAt),
      activated_at: isoOrNull(o.activatedAt),
      owner_last_seen_at: isoOrNull(seen.get(a.id)),
      billing: {
        plan: sub?.plan ?? null,
        status: sub?.status ?? null,
        mrr_minor: paying ? monthlyEquivalent(sub!.plan, charge!) : 0,
        currency_code: pay?.currency ?? a.currencyCode,
        lifetime_minor: num(pay?.lifetime),
        last_paid_at: isoOrNull(pay?.last),
        renews_at: isoOrNull(sub?.currentPeriodEnd),
        grace_until: isoOrNull(sub?.graceUntil),
        cancelled: !!sub?.cancelledAt,
        will_convert: (sub?.status === "active" && periodLive) || sub?.mandateStatus === "active",
      },
      trial,
      usage: {
        scans_30d: scans30,
        scans_prev_30d: num(s?.prev),
        reviews_30d: reviews30,
        reviews_prev_30d: num(r?.prev),
        conversion_30d: scans30 ? reviews30 / scans30 : null,
        last_scan_at: isoOrNull(s?.last),
      },
      google: {
        rating,
        review_count: count,
        baseline_rating: o.baselineRating === null ? null : Number(o.baselineRating),
        baseline_review_count: baseCount,
        gained: count !== null && baseCount !== null ? count - baseCount : null,
      },
    };
    return { ...row, ...assessHealth(row, now) };
  });
}

/* -------------------------------------------------------------- summary */

export async function adminQueueCounts(db: DbLike) {
  const [{ approvals }] = await db
    .select({ approvals: sql<number>`count(*)::int` })
    .from(outlets)
    .where(eq(outlets.state, "pending_approval"));
  const [{ sends }] = await db
    .select({ sends: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.channel, "click_to_chat"), eq(notifications.status, "queued"), isNotNull(notifications.toPhone)));
  return { approvals, pending_sends: sends };
}

export async function customersOverview(db: DbLike, now: Date = new Date()) {
  const rows = await customerRows(db, { now });
  const mrr: Record<string, number> = {};
  for (const r of rows) {
    if (r.billing.mrr_minor > 0) mrr[r.billing.currency_code] = (mrr[r.billing.currency_code] ?? 0) + r.billing.mrr_minor;
  }
  const count = (f: (r: CustomerRow) => boolean) => rows.filter(f).length;
  const live = rows.filter((r) => r.stage === "trial" || r.stage === "paying");
  const sum = (f: (r: CustomerRow) => number) => rows.reduce((acc, r) => acc + f(r), 0);
  const scans30 = sum((r) => r.usage.scans_30d);
  const reviews30 = sum((r) => r.usage.reviews_30d);

  return {
    generated_at: pyIso(now),
    summary: {
      mrr,
      paying: count((r) => r.billing.mrr_minor > 0),
      live: live.length,
      trials: count((r) => r.stage === "trial"),
      new_30d: count((r) => !!r.activated_at && new Date(r.activated_at).getTime() >= now.getTime() - 30 * DAY_MS),
      at_risk: count((r) => r.health === "at_risk"),
      watch: count((r) => r.health === "watch"),
      scans_30d: scans30,
      reviews_30d: reviews30,
      reviews_prev_30d: sum((r) => r.usage.reviews_prev_30d),
      conversion_30d: scans30 ? reviews30 / scans30 : null,
      google_gained: sum((r) => (r.stage === "trial" || r.stage === "paying" ? Math.max(0, r.google.gained ?? 0) : 0)),
    },
    queue: await adminQueueCounts(db),
    customers: rows,
  };
}

/* --------------------------------------------------------------- detail */

/** One customer's row plus a daily series covering the rolling 30-day window, for the activity chart. */
export async function customerProfile(db: DbLike, outletId: string, now: Date = new Date()) {
  const [row] = await customerRows(db, { outletIds: [outletId], now });
  if (!row) throw new HttpError(404, "OUTLET_NOT_FOUND");

  // Days are bucketed in the outlet's own timezone so "today" matches the owner's day.
  const [o] = await db.select({ tz: outlets.timezone }).from(outlets).where(eq(outlets.id, outletId)).limit(1);
  const tz = o?.tz || "Asia/Kolkata";
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const scanDays = await db
    .select({
      day: sql<string>`to_char((${events.occurredAt} at time zone ${tz})::date, 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(and(eq(events.outletId, outletId), eq(events.type, "scan"), gte(events.occurredAt, since)))
    .groupBy(sql`1`);
  const reviewDays = await db
    .select({
      day: sql<string>`to_char((${customerSessions.completedAt} at time zone ${tz})::date, 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(customerSessions)
    .where(and(eq(customerSessions.outletId, outletId), eq(customerSessions.completed, true), gte(customerSessions.completedAt, since)))
    .groupBy(sql`1`);

  const scanBy = new Map(scanDays.map((d) => [d.day, d.n]));
  const reviewBy = new Map(reviewDays.map((d) => [d.day, d.n]));
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  // 31 local days: the first is partial, so the chart totals equal the rolling 30-day numbers.
  const series = Array.from({ length: 31 }, (_, i) => {
    const day = fmt.format(new Date(now.getTime() - (30 - i) * DAY_MS));
    return { day, scans: scanBy.get(day) ?? 0, reviews: reviewBy.get(day) ?? 0 };
  });

  return { ...row, series };
}
