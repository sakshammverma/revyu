/**
 * Event beacon ingestion. Port of backend/app/api/events.py.
 *
 * Events are the instrumentation the product's purpose depends on
 * (04-ARCHITECTURE.md section 1.3): accept generously, never block the
 * customer flow on a malformed batch. Unknown event types are silently dropped
 * rather than erroring the whole batch (05-DATA-MODEL.md section 5).
 */
import { and, eq, sql } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { notify } from "@/server/notifications";
import { NON_RECORDING_STATES } from "./outletState";
import { recordCompletedFlow } from "./trialMetering";

const { accounts, events, outlets, sessions } = schema;

export const VALID_EVENT_TYPES: ReadonlySet<string> = new Set([
  "scan",
  "flow_start",
  "rating_selected",
  "tags_selected",
  "draft_viewed",
  "draft_edited",
  "copy_tapped",
  "handoff",
  "private_feedback_opened",
  "private_feedback_submitted",
  "hub_viewed",
  "module_selected",
  "link_clicked",
  "menu_viewed",
  "rewards_viewed",
]);

export const MIN_FLOW_SECONDS = 5;

export interface EventIn {
  type: string;
  payload?: Record<string, unknown> | null;
}

export interface EventBatch {
  outletId: string;
  sessionId: string | null;
  events: EventIn[];
  /** Caller's IP; caps how many trial credits one network can consume per outlet. */
  clientIp?: string;
}

/** Credits one IP can consume per outlet per day. Undercounting only ever favours the outlet. */
export const MAX_CREDITS_PER_IP_PER_DAY = 3;

const MAX_PAYLOAD_STR = 64;

/**
 * CR-1: event payloads carry counts, ids and flags only (e.g. {length},
 * {changed: true}, {tag_ids}). Drop any free text so a buggy or hostile client
 * can never get review-like text stored in the events table.
 */
export function sanitizePayload(payload: Record<string, unknown> | null | undefined) {
  if (!payload || Object.keys(payload).length === 0) return payload ?? null;
  const clean: Record<string, unknown> = {};
  for (const [key, original] of Object.entries(payload)) {
    let value = original;
    if (typeof value === "string" && value.length > MAX_PAYLOAD_STR) continue;
    if (Array.isArray(value)) {
      value = value.filter((v) => !(typeof v === "string" && v.length > MAX_PAYLOAD_STR));
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * A trial credit is only earned by a believable journey: the session must have
 * rated in an earlier request (checked before the current batch is stored),
 * and not be implausibly fresh. Stops a script from burning an outlet's
 * credits with a bare copy_tapped, or with rating + copy in one batch.
 */
export async function isPlausibleCompletion(
  db: DbLike,
  session: { id: string; startedAt: Date },
  now: Date = new Date(),
): Promise<boolean> {
  if (now.getTime() - session.startedAt.getTime() < MIN_FLOW_SECONDS * 1000) return false;
  const [rated] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.sessionId, session.id), eq(events.type, "rating_selected")))
    .limit(1);
  return rated !== undefined;
}

async function ipMayConsumeCredit(db: DbLike, outletId: string, ip: string | undefined): Promise<boolean> {
  if (!ip || ip === "unknown") return true;
  const rows = await db.execute<{ ok: boolean }>(
    sql`select hit_rate_limit(${`credit:${outletId}:${ip}`}, ${MAX_CREDITS_PER_IP_PER_DAY}, 86400) as ok`,
  );
  return rows[0]?.ok !== false;
}

export async function recordEvents(db: DbLike, batch: EventBatch): Promise<{ accepted: number }> {
  return db.transaction(async (tx) => {
    const [outlet] = await tx.select().from(outlets).where(eq(outlets.id, batch.outletId)).limit(1);
    if (!outlet) return { accepted: 0 };

    // SRS-11.17: draft/preview outlets record no events at all - no trial
    // clock, no metering, no funnel pollution from demos or previews.
    if (NON_RECORDING_STATES.has(outlet.state)) return { accepted: 0 };

    const valid = batch.events.filter((e) => VALID_EVENT_TYPES.has(e.type));

    let firstScan = false;
    if (batch.events.some((e) => e.type === "scan")) {
      const [existing] = await tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.outletId, outlet.id), eq(events.type, "scan")))
        .limit(1);
      firstScan = existing === undefined;
    }

    let session: typeof sessions.$inferSelect | undefined;
    let sessionId = batch.sessionId;
    if (batch.sessionId) {
      [session] = await tx.select().from(sessions).where(eq(sessions.id, batch.sessionId)).limit(1);
      // A session from another outlet must never meter, or be linked to, this one.
      if (session && session.outletId !== outlet.id) {
        session = undefined;
        sessionId = null;
      }
    }

    // Decided before this batch is stored, so its own rating_selected can't vouch for it.
    const meter =
      session !== undefined &&
      !session.completed && // a repeat copy tap is never a second credit
      session.deviceHash !== null && // real clients always send one; dedup needs it
      valid.some((e) => e.type === "copy_tapped") &&
      (await isPlausibleCompletion(tx, session));

    if (valid.length > 0) {
      await tx.insert(events).values(
        valid.map((e) => ({
          outletId: batch.outletId,
          sessionId,
          type: e.type,
          payload: sanitizePayload(e.payload),
        })),
      );
    }

    if (meter && session && (await ipMayConsumeCredit(tx, outlet.id, batch.clientIp))) {
      await recordCompletedFlow(tx, outlet, session);
    }

    if (firstScan) {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
      if (account) {
        await notify(tx, {
          accountId: account.id,
          outletId: outlet.id,
          toEmail: account.ownerEmail,
          template: "first_scan",
          data: { business_name: outlet.businessName },
        });
      }
    }

    return { accepted: valid.length };
  });
}
