/**
 * Trial metering: dedup, completed-flow counting, and the lock/suspend
 * transitions. Port of backend/app/services/trial_metering.py.
 *
 * See documents/04-ARCHITECTURE.md section 7 and documents/11-OPEN-DECISIONS.md
 * OD-21: 15 days, then 10 review credits, then collection stops.
 *
 * - `trial` -> `locked` at day 15 is proactive (the day-15 job, not here).
 * - `locked` -> `suspended` once 10 more completed flows land after locking
 *   is reactive, driven by copy_tapped, handled here.
 */
import { and, count, eq, gte, ne, sql } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { notifyOnce } from "@/server/notifications";

const { accounts, outlets, sessions } = schema;

export type Outlet = typeof outlets.$inferSelect;
export type CustomerSession = typeof sessions.$inferSelect;

export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // OD-11
export const TRIAL_CREDITS = 10; // OD-21
/**
 * No genuine outlet completes this many flows in an hour at v1 volume; beyond
 * it the flows are recorded but stop consuming credits (abuse / burst guard).
 */
export const MAX_CREDITS_PER_HOUR = 6;

/**
 * Call when a `copy_tapped` event lands for this session. Idempotent: a
 * customer who taps copy twice is still one completed flow. Returns whether a
 * trial credit was consumed.
 */
export async function recordCompletedFlow(
  db: DbLike,
  outlet: Pick<Outlet, "id" | "accountId" | "businessName">,
  session: Pick<CustomerSession, "id" | "deviceHash">,
): Promise<boolean> {
  // Claim the completion atomically so concurrent taps can't both count.
  const claimed = await db
    .update(sessions)
    .set({ completed: true, completedAt: new Date() })
    .where(and(eq(sessions.id, session.id), eq(sessions.completed, false)))
    .returning({ id: sessions.id });
  if (claimed.length === 0) return false;

  if (await isDuplicate(db, outlet.id, session)) return false;
  if (await hourlyCeilingHit(db, outlet.id, session.id)) return false;

  await db.update(sessions).set({ countedForTrial: true }).where(eq(sessions.id, session.id));
  const [updated] = await db
    .update(outlets)
    .set({ trialFlowCount: sql`${outlets.trialFlowCount} + 1` })
    .where(eq(outlets.id, outlet.id))
    .returning({
      state: outlets.state,
      trialFlowCount: outlets.trialFlowCount,
      lockedAtFlowCount: outlets.lockedAtFlowCount,
    });

  if (updated.state === "locked" && updated.lockedAtFlowCount !== null) {
    const creditsUsed = updated.trialFlowCount - updated.lockedAtFlowCount;
    await notifyCreditMilestones(db, outlet, creditsUsed);
    if (creditsUsed >= TRIAL_CREDITS) {
      // Collection stops here - resolution reads `state` to decide full flow
      // vs neutral screen (ANCHOR: collection-stops).
      await db.update(outlets).set({ state: "suspended" }).where(eq(outlets.id, outlet.id));
    }
  }
  return true;
}

async function isDuplicate(
  db: DbLike,
  outletId: string,
  session: Pick<CustomerSession, "id" | "deviceHash">,
): Promise<boolean> {
  if (!session.deviceHash) return false;
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS);
  const [prior] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.outletId, outletId),
        eq(sessions.deviceHash, session.deviceHash),
        eq(sessions.countedForTrial, true),
        gte(sessions.startedAt, windowStart),
        ne(sessions.id, session.id),
      ),
    )
    .limit(1);
  return prior !== undefined;
}

async function hourlyCeilingHit(db: DbLike, outletId: string, sessionId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(sessions)
    .where(
      and(
        eq(sessions.outletId, outletId),
        eq(sessions.countedForTrial, true),
        gte(sessions.completedAt, windowStart),
        ne(sessions.id, sessionId),
      ),
    );
  return row.n >= MAX_CREDITS_PER_HOUR;
}

/**
 * 3-credits-left and collection-paused emails (SRS-9.7, FR-46). Each is sent
 * once per outlet, so a burst of flows can't spam the owner.
 */
async function notifyCreditMilestones(
  db: DbLike,
  outlet: Pick<Outlet, "id" | "accountId" | "businessName">,
  creditsUsed: number,
): Promise<void> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
  if (!account) return;
  const link = `${getEnv().frontendBaseUrl.replace(/\/+$/, "")}/app/billing`;
  const base = { business_name: outlet.businessName, payment_link: link };
  const left = TRIAL_CREDITS - creditsUsed;
  const args = { accountId: account.id, outletId: outlet.id, toEmail: account.ownerEmail };
  if (creditsUsed >= TRIAL_CREDITS) {
    await notifyOnce(db, { ...args, template: "collection_paused", data: base });
  } else if (left <= 3) {
    await notifyOnce(db, { ...args, template: "credits_low", data: { ...base, credits_left: left } });
  }
}
