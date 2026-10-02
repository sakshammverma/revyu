/**
 * Founder operations: pending WhatsApp sends, the kill-metric cockpit, outlet
 * detail and the manual state override (SRS-11.9). Port of
 * backend/app/api/admin_ops.py (+ find_zero_scan_outlets from jobs).
 */
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { normalisePhone } from "@/server/notifications";
import { pyIso } from "./pyDate";

const { accounts, events, notifications, outlets, payments, placeSnapshots, subscriptions, tags } = schema;
const customerSessions = schema.sessions;

const LIVE_STATES = ["trial", "locked", "active", "past_due", "suspended"];
const MIN_SCANS_FOR_MEDIAN = 10;
const DAY_MS = 86_400_000;

/* ---------------------------------------------------------- pending sends */

/** Python urllib.parse.quote(body): everything but letters, digits and _.-~/ is escaped. */
function pyQuote(text: string): string {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, "/");
}

export function buildLink(phone: string, body: string): string {
  return `https://wa.me/${normalisePhone(phone)}?text=${pyQuote(body)}`;
}

export async function listPendingSends(db: DbLike) {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.channel, "click_to_chat"), eq(notifications.status, "queued")))
    .orderBy(desc(notifications.createdAt))
    .limit(200);
  const out = [];
  for (const n of rows) {
    if (!n.toPhone || !n.body) continue;
    const [outlet] = n.outletId
      ? await db.select({ name: outlets.businessName }).from(outlets).where(eq(outlets.id, n.outletId)).limit(1)
      : [];
    const [account] = await db
      .select({ name: accounts.ownerName })
      .from(accounts)
      .where(eq(accounts.id, n.accountId))
      .limit(1);
    out.push({
      id: n.id,
      template: n.template,
      business_name: outlet?.name ?? null,
      owner_name: account?.name ?? null,
      to_phone: n.toPhone,
      body: n.body,
      link: buildLink(n.toPhone, n.body),
      created_at: pyIso(n.createdAt),
    });
  }
  return out;
}

async function requireClickToChat(db: DbLike, sendId: string) {
  const [n] = await db.select({ id: notifications.id, channel: notifications.channel }).from(notifications)
    .where(eq(notifications.id, sendId)).limit(1);
  if (!n || n.channel !== "click_to_chat") throw new HttpError(404, "NOT_FOUND");
}

/**
 * Only a queued send moves on. The Python overwrote any status, so a stale tab
 * could flip a sent message to dismissed; here the repeat is a no-op (still 204).
 */
async function resolveSend(db: DbLike, sendId: string, status: "sent" | "dismissed") {
  await requireClickToChat(db, sendId);
  await db
    .update(notifications)
    .set(status === "sent" ? { status, sentAt: new Date() } : { status })
    .where(and(eq(notifications.id, sendId), eq(notifications.status, "queued")));
}

export const markSent = (db: DbLike, sendId: string) => resolveSend(db, sendId, "sent");
export const dismissSend = (db: DbLike, sendId: string) => resolveSend(db, sendId, "dismissed");

/* ---------------------------------------------------------------- cockpit */

/** Bands from documents/07-METRICS.md. */
export function bandFor(conversion: number | null): [string, string] {
  if (conversion === null) return ["unknown", "Not enough scans yet"];
  if (conversion < 0.05) return ["stop", "Under 5%: the product isn't working. Stop and rethink."];
  if (conversion < 0.1) return ["iterate", "5-10%: iterate on the flow before pushing distribution."];
  if (conversion < 0.2) return ["fix", "10-20%: find and fix the worst funnel step."];
  return ["push", "Over 20%: push distribution hard."];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** R-8: live outlets a week past activation with no scan, ever. */
export async function findZeroScanOutlets(db: DbLike, now = new Date()) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  return db
    .select()
    .from(outlets)
    .where(
      and(
        inArray(outlets.state, ["trial", "locked", "active", "past_due"]),
        isNotNull(outlets.activatedAt),
        lte(outlets.activatedAt, sevenDaysAgo),
        sql`not exists (select 1 from events e where e.outlet_id = ${outlets.id} and e.type = 'scan')`,
      ),
    );
}

export async function cockpit(db: DbLike) {
  const windowDays = 30;
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * DAY_MS);

  const installed = await db
    .select()
    .from(outlets)
    .where(and(isNotNull(outlets.activatedAt), inArray(outlets.state, [...LIVE_STATES, "deactivated"])));

  const scanRows = await db
    .select({ outletId: events.outletId, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.type, "scan"), gte(events.occurredAt, since)))
    .groupBy(events.outletId);
  const doneRows = await db
    .select({ outletId: customerSessions.outletId, n: sql<number>`count(*)::int` })
    .from(customerSessions)
    .where(and(eq(customerSessions.completed, true), gte(customerSessions.completedAt, since)))
    .groupBy(customerSessions.outletId);
  const scanBy = new Map(scanRows.map((r) => [r.outletId, r.n]));
  const doneBy = new Map(doneRows.map((r) => [r.outletId, r.n]));

  const metrics = installed.map((o) => {
    const scans = scanBy.get(o.id) ?? 0;
    const completed = doneBy.get(o.id) ?? 0;
    return {
      outlet_id: o.id,
      business_name: o.businessName,
      vertical: o.vertical,
      source: o.source,
      state: o.state,
      scans,
      completed,
      conversion: scans ? completed / scans : null,
    };
  });

  // The kill metric is measured on the direct-mode cohort only, so the hub's
  // extra step never confounds it (OD-26).
  const cohortIds = new Set(installed.filter((o) => o.hubMode === "direct").map((o) => o.id));
  const cohort = metrics.filter((m) => cohortIds.has(m.outlet_id));
  const cScans = cohort.reduce((a, m) => a + m.scans, 0);
  const cDone = cohort.reduce((a, m) => a + m.completed, 0);
  const sample = cohort
    .filter((m) => m.conversion !== null && m.scans >= MIN_SCANS_FOR_MEDIAN)
    .map((m) => m.conversion as number);
  // Judge on the median per-outlet, never a blended headline (07-METRICS).
  const med = median(sample);
  const [band, bandLabel] = bandFor(med);

  const bySource: Record<string, number> = {};
  for (const o of installed) bySource[o.source] = (bySource[o.source] ?? 0) + 1;

  const activated = installed.map((o) => o.activatedAt as Date).sort((a, b) => a.getTime() - b.getTime());
  const tenth = activated.length >= 10 ? activated[9] : null;
  const decision = tenth ? new Date(tenth.getTime() + 30 * DAY_MS) : null;

  const cutoff = now.getTime() - 15 * DAY_MS;
  const eligible = installed.filter((o) => (o.activatedAt as Date).getTime() <= cutoff);
  let paid = 0;
  if (eligible.length) {
    const payers = await db
      .select({ accountId: subscriptions.accountId })
      .from(payments)
      .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
      .where(
        and(
          eq(payments.status, "captured"),
          inArray(subscriptions.accountId, [...new Set(eligible.map((o) => o.accountId))]),
        ),
      );
    const payerIds = new Set(payers.map((p) => p.accountId));
    paid = eligible.filter((o) => payerIds.has(o.accountId)).length;
  }

  return {
    window_days: windowDays,
    installs: installed.length,
    by_source: bySource,
    cohort_scans: cScans,
    cohort_completed: cDone,
    cohort_conversion: cScans ? cDone / cScans : null,
    median_conversion: med,
    median_sample: sample.length,
    band,
    band_label: bandLabel,
    tenth_install_at: tenth ? pyIso(tenth) : null,
    decision_date: decision ? pyIso(decision) : null,
    days_to_decision: decision ? Math.floor((decision.getTime() - now.getTime()) / DAY_MS) : null,
    trial_to_paid: eligible.length ? paid / eligible.length : null,
    trial_eligible: eligible.length,
    zero_scan: (await findZeroScanOutlets(db, now)).map((o) => o.businessName),
    outlets: [...metrics].sort((a, b) => b.scans - a.scans),
  };
}

/* ------------------------------------------------- outlet detail + state */

const label = (d: Record<string, string> | null): string => {
  if (!d) return "";
  return d.en || Object.values(d)[0] || "";
};

export async function outletDetail(db: DbLike, outletId: string) {
  const [o] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!o) throw new HttpError(404, "OUTLET_NOT_FOUND");
  const [account] = await db.select().from(accounts).where(eq(accounts.id, o.accountId)).limit(1);
  const since = new Date(Date.now() - 30 * DAY_MS);

  const tagRows = await db.select().from(tags).where(eq(tags.outletId, o.id)).orderBy(tags.sortOrder);
  const payRows = await db
    .select({
      amountMinor: payments.amountMinor,
      currencyCode: payments.currencyCode,
      status: payments.status,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
    .where(eq(subscriptions.accountId, o.accountId))
    .orderBy(desc(payments.createdAt))
    .limit(10);
  const notes = await db
    .select()
    .from(notifications)
    .where(eq(notifications.outletId, o.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20);
  const snaps = await db
    .select()
    .from(placeSnapshots)
    .where(eq(placeSnapshots.outletId, o.id))
    .orderBy(desc(placeSnapshots.polledAt))
    .limit(6);
  const [{ n: scans }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.outletId, o.id), eq(events.type, "scan"), gte(events.occurredAt, since)));
  const [{ n: completed }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customerSessions)
    .where(
      and(eq(customerSessions.outletId, o.id), eq(customerSessions.completed, true), gte(customerSessions.completedAt, since)),
    );

  return {
    id: o.id,
    business_name: o.businessName,
    slug: o.slug,
    vertical: o.vertical,
    state: o.state,
    source: o.source,
    hub_mode: o.hubMode,
    owner_name: account?.ownerName ?? null,
    owner_email: account?.ownerEmail ?? "",
    owner_phone: account?.ownerPhone ?? "",
    google_place_id: o.googlePlaceId,
    activated_at: o.activatedAt ? pyIso(o.activatedAt) : null,
    trial_flow_count: o.trialFlowCount,
    scans_30d: scans,
    completed_30d: completed,
    tags: tagRows.map((t) => {
      const phrases = t.phrases as Record<string, string[]> | null;
      return {
        id: t.id,
        label: label(t.label as Record<string, string>),
        phrases: phrases?.en ?? [],
        sort_order: t.sortOrder,
        active: t.active,
      };
    }),
    payments: payRows.map((p) => ({
      amount_minor: p.amountMinor,
      currency_code: p.currencyCode,
      status: p.status,
      created_at: pyIso(p.createdAt),
    })),
    notifications: notes.map((n) => ({
      template: n.template,
      channel: n.channel,
      status: n.status,
      created_at: pyIso(n.createdAt),
    })),
    snapshots: snaps.map((s) => ({
      rating: s.rating === null ? null : Number(s.rating),
      review_count: s.reviewCount,
      polled_at: pyIso(s.polledAt),
    })),
  };
}

const OVERRIDABLE = new Set(["trial", "locked", "active", "past_due", "suspended", "deactivated"]);

// Lengths count code points, like pydantic's min_length/max_length.
export const stateOverrideBody = z.object({
  state: z.string(),
  reason: z.string().refine((s) => {
    const n = Array.from(s).length;
    return n >= 3 && n <= 300;
  }),
});

/**
 * SRS-11.9: founder can force a state (comp an outlet, pause one). The reason
 * is required and logged. The row lock makes the logged "previous -> new" exact
 * under concurrent overrides, and the state change and its audit row commit
 * together.
 */
export async function overrideState(db: DbLike, outletId: string, body: z.infer<typeof stateOverrideBody>) {
  if (!OVERRIDABLE.has(body.state)) throw new HttpError(400, "INVALID_STATE");
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(outlets).where(eq(outlets.id, outletId)).for("update").limit(1);
    if (!o) throw new HttpError(404, "OUTLET_NOT_FOUND");
    await tx.update(outlets).set({ state: body.state, updatedAt: new Date() }).where(eq(outlets.id, o.id));
    await tx.insert(notifications).values({
      id: crypto.randomUUID(),
      accountId: o.accountId,
      outletId: o.id,
      template: "admin_state_override",
      channel: "internal",
      status: "sent",
      error: `${o.state} -> ${body.state}: ${body.reason}`.slice(0, 500),
      sentAt: new Date(),
    });
  });
}
