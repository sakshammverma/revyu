/**
 * Owner dashboard queries. Port of backend/app/api/dashboard.py.
 * The funnel ends at "handoff": everything after happens on Google's UI and
 * cannot be measured (C-1). No query here reads review text (CR-1/CR-4).
 */
import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { isCollecting } from "@/server/services/outletState";

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

export async function getOverview(db: DbLike, outlet: Outlet) {
  const [{ n: scans }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.outletId, outlet.id), eq(events.type, "scan")));
  const [{ n: completed }] = await db
    .select({ n: sql<number>`count(distinct ${sessions.id})::int` })
    .from(sessions)
    .where(and(eq(sessions.outletId, outlet.id), eq(sessions.completed, true)));
  return {
    outlet_id: outlet.id,
    business_name: outlet.businessName,
    state: outlet.state,
    scans,
    completed_flows: completed,
    conversion_rate: scans ? pyRound(completed / scans, 4) : 0,
    trial_flow_count: outlet.trialFlowCount,
    dashboard_locked: outlet.state === "locked",
  };
}

export async function getFunnel(db: DbLike, outlet: Outlet, range: string, now: Date = new Date()) {
  const start = rangeStart(range, now);
  const steps: { step: string; count: number; drop_off_pct: number | null }[] = [];
  let prev: number | null = null;
  for (const step of FUNNEL_ORDER) {
    const where: SQL[] = [eq(events.outletId, outlet.id), eq(events.type, step)];
    if (start) where.push(gte(events.occurredAt, start));
    // scan has no session_id in most cases, so count rows; later steps count distinct sessions.
    const countExpr =
      step === "scan" ? sql<number>`count(*)::int` : sql<number>`count(distinct ${events.sessionId})::int`;
    const [{ n: count }] = await db
      .select({ n: countExpr })
      .from(events)
      .where(and(...where));
    const dropOff = prev !== null && prev > 0 ? pyRound((1 - count / prev) * 100, 1) : null;
    steps.push({ step, count, drop_off_pct: dropOff });
    prev = count;
  }
  return { steps, note: INSTRUMENTATION_BOUNDARY_NOTE };
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

export async function getFeedbackInbox(db: DbLike, outlet: Outlet) {
  const rows = await db
    .select({
      id: privateFeedback.id,
      rating: privateFeedback.rating,
      message: privateFeedback.message,
      contact: privateFeedback.contact,
      resolved: privateFeedback.resolved,
      createdAt: asText(privateFeedback.createdAt),
    })
    .from(privateFeedback)
    .where(eq(privateFeedback.outletId, outlet.id))
    .orderBy(desc(privateFeedback.createdAt));
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
  };
}
