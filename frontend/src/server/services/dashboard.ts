/**
 * Owner dashboard queries. Port of backend/app/api/dashboard.py.
 * The funnel ends at "handoff": everything after happens on Google's UI and
 * cannot be measured (C-1). No query here reads review text (CR-1/CR-4).
 */
import { and, asc, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { DASHBOARD_LOCKED_STATES, isCollecting } from "@/server/services/outletState";

const { events, outlets, placeSnapshots, privateFeedback, sessions, tags } = schema;

export const FUNNEL_ORDER = [
  "scan",
  "flow_start",
  "rating_selected",
  "tags_selected",
  "draft_viewed",
  "copy_tapped",
  "handoff",
] as const;

/**
 * Past the boundary, and only what customers chose to tell us: how many came
 * back to the page after Google, and how many of those said they had posted.
 * Self-reported, so it is shown beside the funnel, never as a step in it.
 */
export const SELF_REPORTED_EVENTS = ["review_return", "post_confirmed"] as const;

export const INSTRUMENTATION_BOUNDARY_NOTE =
  "The funnel ends at 'handoff' — everything after (sign-in, paste, submit) " +
  "happens on Google's UI and cannot be measured (C-1).";

export type Outlet = typeof outlets.$inferSelect;

/** Python round(): correctly rounded, exact ties go to even. */
export function pyRound(x: number, digits: number): number {
  const scaled = x * 10 ** digits;
  if (Math.abs(scaled - Math.trunc(scaled)) === 0.5) {
    const lo = Math.floor(scaled);
    return (lo % 2 === 0 ? lo : lo + 1) / 10 ** digits;
  }
  return Number(x.toFixed(digits));
}

/** Postgres `timestamptz::text` -> Python datetime.isoformat() (keeps microseconds, which a JS Date drops). */
export function pgTextToIso(text: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?(?::?\d{2})?$/.exec(text);
  if (!m) return text;
  const frac = m[3] ? "." + m[3].slice(1).padEnd(6, "0") : "";
  return `${m[1]}T${m[2]}${frac}${m[4]}:${m[5] ?? "00"}`;
}

const asText = (col: unknown) => sql<string>`${col}::text`;

/** SRS-15.6: never scope by a client-supplied outlet ID alone. */
export async function getOwnOutletOr403(db: DbLike, accountId: string, outletId: string): Promise<Outlet> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet || outlet.accountId !== accountId) throw new HttpError(403, "FORBIDDEN");
  return outlet;
}

/** "7d" / "30d" windows end now (UTC instants); anything else means all time. */
export function rangeStart(range: string, now: Date = new Date()): Date | null {
  if (range === "7d") return new Date(now.getTime() - 7 * 86_400_000);
  if (range === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

/** 402 for the detailed dashboard while it is locked; pay to unlock (SRS-12.4). */
export function requireUnlocked(outlet: Pick<Outlet, "state">): void {
  if (DASHBOARD_LOCKED_STATES.has(outlet.state)) throw new HttpError(402, "DASHBOARD_LOCKED");
}

export async function getOverview(db: DbLike, outlet: Outlet) {
  const [{ n: scans }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.outletId, outlet.id), eq(events.type, "scan")));
  const [{ n: completed }] = await db
    .select({ n: sql<number>`count(distinct ${sessions.id})::int` })
    .from(sessions)
    .where(and(eq(sessions.outletId, outlet.id), eq(sessions.completed, true)));
  // SRS-9.8: the private-feedback count is part of what a locked owner sees waiting.
  const [{ n: feedbackCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(privateFeedback)
    .where(eq(privateFeedback.outletId, outlet.id));
  const [{ n: unresolved }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(privateFeedback)
    .where(and(eq(privateFeedback.outletId, outlet.id), eq(privateFeedback.resolved, false)));
  return {
    outlet_id: outlet.id,
    business_name: outlet.businessName,
    state: outlet.state,
    scans,
    completed_flows: completed,
    conversion_rate: scans ? pyRound(completed / scans, 4) : 0,
    trial_flow_count: outlet.trialFlowCount,
    feedback_count: feedbackCount,
    unresolved_count: unresolved,
    dashboard_locked: DASHBOARD_LOCKED_STATES.has(outlet.state),
  };
}

export async function getFunnel(db: DbLike, outlet: Outlet, range: string, now: Date = new Date()) {
  return funnelSince(db, outlet, rangeStart(range, now));
}

/** The funnel from an instant onwards (null = all time). */
async function funnelSince(db: DbLike, outlet: Outlet, start: Date | null) {
  const steps: { step: string; count: number; drop_off_pct: number | null }[] = [];
  let prev: number | null = null;
  // One grouped query instead of one per step: this sits behind every Overview load.
  const where: SQL[] = [eq(events.outletId, outlet.id), inArray(events.type, [...FUNNEL_ORDER, ...SELF_REPORTED_EVENTS])];
  if (start) where.push(gte(events.occurredAt, start));
  const grouped = await db
    .select({
      type: events.type,
      rows: sql<number>`count(*)::int`,
      sessions: sql<number>`count(distinct ${events.sessionId})::int`,
    })
    .from(events)
    .where(and(...where))
    .groupBy(events.type);
  const byType = new Map(grouped.map((g) => [g.type, g]));
  for (const step of FUNNEL_ORDER) {
    // scan has no session_id in most cases, so count rows; later steps count distinct sessions.
    const g = byType.get(step);
    const count = g ? (step === "scan" ? g.rows : g.sessions) : 0;
    const dropOff = prev !== null && prev > 0 ? pyRound((1 - count / prev) * 100, 1) : null;
    steps.push({ step, count, drop_off_pct: dropOff });
    prev = count;
  }
  return {
    steps,
    note: INSTRUMENTATION_BOUNDARY_NOTE,
    self_reported: {
      came_back: byType.get("review_return")?.sessions ?? 0,
      said_posted: byType.get("post_confirmed")?.sessions ?? 0,
    },
  };
}

/* ------------------------------------------------------------------ trend */

/** Offset of `timeZone` from UTC at `instant`, in ms (east of Greenwich is positive). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant a calendar day ("2026-11-17") starts in `timeZone`. */
function zonedDayStart(day: string, timeZone: string): Date {
  const utcMidnight = new Date(`${day}T00:00:00Z`).getTime();
  const first = utcMidnight - zoneOffsetMs(new Date(utcMidnight), timeZone);
  // The offset at the guess can differ from the offset at the answer on a DST change day.
  return new Date(utcMidnight - zoneOffsetMs(new Date(first), timeZone));
}

const addDays = (day: string, n: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

export const TREND_DAYS = { "7d": 7, "30d": 30 } as const;
export type TrendRange = keyof typeof TREND_DAYS;
export const trendRange = (range: string | null): TrendRange => (range === "7d" ? "7d" : "30d");

type PeriodTotals = { scans: number; completed: number; conversion_rate: number };
const periodTotals = (scans: number, completed: number): PeriodTotals => ({
  scans,
  completed,
  conversion_rate: scans ? Math.min(1, pyRound(completed / scans, 4)) : 0,
});

/**
 * Scans and completed flows per calendar day in the outlet's own timezone, for
 * the last 7 or 30 days including today, with the totals of the period before
 * for comparison. `previous` is null when the outlet was not live for the whole
 * of that earlier period: a partial period would overstate growth.
 */
export async function getTrend(db: DbLike, outlet: Outlet, range: TrendRange, now: Date = new Date()) {
  const n = TREND_DAYS[range];
  const tz = safeTimeZone(outlet.timezone);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const firstDay = addDays(today, -(n - 1));
  const start = zonedDayStart(firstDay, tz);
  const previousStart = zonedDayStart(addDays(firstDay, -n), tz);

  const localDay = (col: unknown) => sql<string>`to_char(${col} at time zone ${tz}, 'YYYY-MM-DD')`;
  // Grouped by position: the day expression carries a bind parameter, and Postgres
  // does not treat two separately bound copies of it as the same expression.
  const scanRows = await db
    .select({ day: localDay(events.occurredAt), n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.outletId, outlet.id), eq(events.type, "scan"), gte(events.occurredAt, previousStart)))
    .groupBy(sql`1`);
  const doneAt = sql`coalesce(${sessions.completedAt}, ${sessions.startedAt})`;
  const doneRows = await db
    .select({ day: localDay(doneAt), n: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.outletId, outlet.id), eq(sessions.completed, true), sql`${doneAt} >= ${previousStart.toISOString()}`))
    .groupBy(sql`1`);

  const scansBy = new Map(scanRows.map((r) => [r.day, r.n]));
  const doneBy = new Map(doneRows.map((r) => [r.day, r.n]));
  const days = Array.from({ length: n }, (_, i) => {
    const date = addDays(firstDay, i);
    return { date, scans: scansBy.get(date) ?? 0, completed: doneBy.get(date) ?? 0 };
  });
  const sum = (rows: { day: string; n: number }[], keep: (day: string) => boolean) =>
    rows.reduce((total, r) => (keep(r.day) ? total + r.n : total), 0);
  const inPeriod = (day: string) => day >= firstDay && day <= today;
  const before = (day: string) => day < firstDay;
  const liveSince = outlet.activatedAt ?? outlet.createdAt;

  return {
    range,
    timezone: tz,
    since: start,
    days,
    totals: periodTotals(sum(scanRows, inPeriod), sum(doneRows, inPeriod)),
    previous: liveSince <= previousStart ? periodTotals(sum(scanRows, before), sum(doneRows, before)) : null,
  };
}

/** How many open private messages the Overview shows inline; the rest are in the inbox. */
export const HOME_FEEDBACK_LIMIT = 3;

/**
 * Everything the Overview page shows, in one response. The all-time counts are
 * always there (SRS-9.8); the detailed parts are null while the dashboard is
 * locked, the same paywall the separate endpoints answer 402 for (SRS-12.4).
 */
export async function getHome(db: DbLike, outlet: Outlet, range: TrendRange, now: Date = new Date()) {
  const overview = await getOverview(db, outlet);
  if (overview.dashboard_locked) {
    return { overview, range, trend: null, funnel: null, rating: null, open_feedback: null };
  }
  const { since, ...trend } = await getTrend(db, outlet, range, now);
  const [funnel, rating, inbox] = await Promise.all([
    // Same window as the trend, so the funnel's first step equals the scans total above it.
    funnelSince(db, outlet, since),
    getRating(db, outlet),
    getFeedbackInbox(db, outlet, { openOnly: true, limit: HOME_FEEDBACK_LIMIT }),
  ]);
  return { overview, range, trend, funnel, rating, open_feedback: inbox.items };
}

export async function getTagFrequency(db: DbLike, outlet: Outlet, range: string, now: Date = new Date()) {
  const start = rangeStart(range, now);
  const where: SQL[] = [eq(events.outletId, outlet.id), eq(events.type, "tags_selected")];
  if (start) where.push(gte(events.occurredAt, start));
  const rows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(...where))
    .orderBy(asc(events.id));

  // Insertion-ordered counts, then a stable sort: same tie order as Counter.most_common().
  const counts = new Map<string, number>();
  for (const { payload } of rows) {
    const ids = (payload as { tag_ids?: unknown } | null)?.tag_ids;
    if (!Array.isArray(ids)) continue;
    for (const id of ids) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
  }

  const tagRows = await db.select().from(tags).where(eq(tags.outletId, outlet.id));
  const labelById = new Map<string, string>();
  for (const t of tagRows) {
    const label = (t.label ?? {}) as Record<string, string>;
    labelById.set(t.id, label.en ?? Object.values(label)[0] ?? "");
  }

  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ label: labelById.get(id) ?? id, count }));
  return { tags: items };
}

const numOrNull = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export async function getRating(db: DbLike, outlet: Outlet) {
  const [latest] = await db
    .select({
      rating: placeSnapshots.rating,
      reviewCount: placeSnapshots.reviewCount,
      polledAt: asText(placeSnapshots.polledAt),
    })
    .from(placeSnapshots)
    .where(eq(placeSnapshots.outletId, outlet.id))
    .orderBy(desc(placeSnapshots.polledAt))
    .limit(1);
  return {
    baseline_rating: numOrNull(outlet.baselineRating),
    baseline_review_count: outlet.baselineReviewCount,
    current_rating: latest ? numOrNull(latest.rating) : numOrNull(outlet.baselineRating),
    current_review_count: latest ? latest.reviewCount : outlet.baselineReviewCount,
    polled_at: latest ? pgTextToIso(latest.polledAt) : null,
  };
}

export async function getFeedbackInbox(
  db: DbLike,
  outlet: Outlet,
  { openOnly = false, limit }: { openOnly?: boolean; limit?: number } = {},
) {
  const query = db
    .select({
      id: privateFeedback.id,
      rating: privateFeedback.rating,
      message: privateFeedback.message,
      contact: privateFeedback.contact,
      resolved: privateFeedback.resolved,
      createdAt: asText(privateFeedback.createdAt),
    })
    .from(privateFeedback)
    .where(and(eq(privateFeedback.outletId, outlet.id), openOnly ? eq(privateFeedback.resolved, false) : undefined))
    .orderBy(desc(privateFeedback.createdAt));
  const rows = await (limit ? query.limit(limit) : query);
  return {
    items: rows.map((f) => ({
      id: f.id,
      rating: f.rating,
      message: f.message,
      contact: f.contact,
      resolved: f.resolved,
      created_at: pgTextToIso(f.createdAt),
    })),
  };
}

export async function resolveFeedback(db: DbLike, accountId: string, feedbackId: string, resolved: boolean) {
  const [feedback] = await db.select().from(privateFeedback).where(eq(privateFeedback.id, feedbackId)).limit(1);
  if (!feedback) throw new HttpError(404, "OUTLET_NOT_FOUND");
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, feedback.outletId)).limit(1);
  if (!outlet || outlet.accountId !== accountId) throw new HttpError(403, "FORBIDDEN");
  requireUnlocked(outlet);
  await db
    .update(privateFeedback)
    .set({ resolved, resolvedAt: resolved ? new Date() : null })
    .where(eq(privateFeedback.id, feedbackId));
}

/** v1: one outlet per account (SRS-1.3); the dashboard landing resolves this first. */
export async function getMyOutlet(db: DbLike, accountId: string) {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, accountId)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return {
    outlet_id: outlet.id,
    business_name: outlet.businessName,
    state: outlet.state,
    collecting: isCollecting(outlet.state),
    // Lets the owner open their own customer page (the "scan it yourself" step) without a second request.
    slug: outlet.slug,
  };
}
