/**
 * Owner referral programme. Port of backend/app/services/referrals.py.
 *
 * The referrer gets 70% off their next invoice when a business they referred
 * actually PAYS: a signup, an approval or a started trial is not enough.
 * "Pays" means the first captured payment on the referred account, hooked from
 * billing.recordPayment.
 *
 * Incentive scope (compliance): this rewards owners for referring other
 * owners. It is never tied to a customer leaving a review (CR-5).
 */
import { randomInt } from "node:crypto";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";
import { pyIso } from "./pyDate";

const { accounts, outlets, referralRewards } = schema;

export type Account = typeof accounts.$inferSelect;

export const DISCOUNT_PERCENT = 70;
// Unambiguous alphabet: no 0/O/1/I/L.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const newCode = () => Array.from({ length: 7 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function getOrCreateCode(db: DbLike, account: Pick<Account, "id" | "referralCode">): Promise<string> {
  if (account.referralCode) return account.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const [taken] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.referralCode, code)).limit(1);
    if (taken) continue;
    // Only fill an empty slot, so two concurrent requests keep one stable code.
    const [set] = await db
      .update(accounts)
      .set({ referralCode: code })
      .where(and(eq(accounts.id, account.id), isNull(accounts.referralCode)))
      .returning({ code: accounts.referralCode });
    if (set?.code) return set.code;
    const [current] = await db.select({ code: accounts.referralCode }).from(accounts).where(eq(accounts.id, account.id));
    if (current?.code) return current.code;
  }
  throw new Error("could not allocate a referral code");
}

export function normaliseCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase() || null;
}

/**
 * Link a new account to its referrer. Silently ignores bad, self or repeated
 * codes: a typo must never block a signup.
 */
export async function attachReferral(
  db: DbLike,
  referred: Pick<Account, "id" | "ownerEmail" | "referredByAccountId">,
  rawCode: string | null | undefined,
): Promise<boolean> {
  const code = normaliseCode(rawCode);
  if (code === null || referred.referredByAccountId) return false;
  const [referrer] = await db.select().from(accounts).where(eq(accounts.referralCode, code)).limit(1);
  if (!referrer || referrer.id === referred.id) return false;
  if (referrer.ownerEmail.toLowerCase() === referred.ownerEmail.toLowerCase()) return false;
  await db.update(accounts).set({ referredByAccountId: referrer.id }).where(eq(accounts.id, referred.id));
  await db.insert(referralRewards).values({
    id: crypto.randomUUID(),
    referrerAccountId: referrer.id,
    referredAccountId: referred.id,
    status: "pending",
    discountPercent: DISCOUNT_PERCENT,
  });
  return true;
}

/**
 * Called when the referred account's first payment is captured. The status
 * guard in the UPDATE makes it atomic and one-shot: a replayed webhook or a
 * confirm + webhook race can never earn the reward twice.
 */
export async function markRefereePaid(db: DbLike, referredAccountId: string): Promise<void> {
  await db
    .update(referralRewards)
    .set({ status: "earned", earnedAt: new Date() })
    .where(and(eq(referralRewards.referredAccountId, referredAccountId), eq(referralRewards.status, "pending")));
}

/** Referred signup was rejected/refunded before it ever paid for real. */
export async function voidReward(db: DbLike, referredAccountId: string): Promise<void> {
  await db
    .update(referralRewards)
    .set({ status: "void" })
    .where(
      and(
        eq(referralRewards.referredAccountId, referredAccountId),
        inArray(referralRewards.status, ["pending", "earned"]),
      ),
    );
}

export async function summary(db: DbLike, accountId: string) {
  const rows = await db
    .select({ status: referralRewards.status, n: count() })
    .from(referralRewards)
    .where(eq(referralRewards.referrerAccountId, accountId))
    .groupBy(referralRewards.status);
  const counts = new Map(rows.map((r) => [r.status, Number(r.n)]));
  return {
    pending: counts.get("pending") ?? 0,
    earned: counts.get("earned") ?? 0,
    applied: counts.get("applied") ?? 0,
  };
}

/* ---------------------------------------------------------------- admin */

async function adminRow(db: DbLike, reward: typeof referralRewards.$inferSelect) {
  const [referrer] = await db.select().from(accounts).where(eq(accounts.id, reward.referrerAccountId)).limit(1);
  const [outlet] = await db
    .select({ businessName: outlets.businessName })
    .from(outlets)
    .where(eq(outlets.accountId, reward.referredAccountId))
    .limit(1);
  return {
    id: reward.id,
    referrer_email: referrer.ownerEmail,
    referrer_name: referrer.ownerName,
    referred_business: outlet?.businessName ?? "-",
    status: reward.status,
    discount_percent: reward.discountPercent,
    earned_at: reward.earnedAt ? pyIso(reward.earnedAt) : null,
  };
}

/** GET /api/admin/referrals */
export async function adminListRewards(db: DbLike, status: string | null) {
  const q = db.select().from(referralRewards);
  const rows = await (status ? q.where(eq(referralRewards.status, status)) : q)
    .orderBy(desc(referralRewards.createdAt))
    .limit(200);
  return Promise.all(rows.map((r) => adminRow(db, r)));
}

/**
 * POST /api/admin/referrals/{id}/apply. The founder applies the 70% discount
 * to the referrer's next invoice in the payment dashboard, then marks it
 * applied here. The status guard in the UPDATE makes it atomic and one-shot:
 * a double click or two admins can never apply the same reward twice.
 */
export async function adminApplyReward(db: DbLike, rewardId: string) {
  const [applied] = await db
    .update(referralRewards)
    .set({ status: "applied", appliedAt: new Date() })
    .where(and(eq(referralRewards.id, rewardId), eq(referralRewards.status, "earned")))
    .returning();
  if (applied) return adminRow(db, applied);
  const [exists] = await db.select({ id: referralRewards.id }).from(referralRewards).where(eq(referralRewards.id, rewardId));
  throw new HttpError(exists ? 409 : 404, exists ? "NOT_EARNED" : "NOT_FOUND");
}

/** GET /api/app/referrals */
export async function referralOverview(db: DbLike, owner: Pick<Account, "id" | "referralCode">) {
  const code = await getOrCreateCode(db, owner);
  const rows = await db
    .select({ status: referralRewards.status, createdAt: referralRewards.createdAt, businessName: outlets.businessName })
    .from(referralRewards)
    .innerJoin(outlets, eq(outlets.accountId, referralRewards.referredAccountId))
    .where(eq(referralRewards.referrerAccountId, owner.id))
    .orderBy(desc(referralRewards.createdAt));
  const counts = await summary(db, owner.id);
  const base = getEnv().frontendBaseUrl.replace(/\/+$/, "");
  return {
    code,
    link: `${base}/signup?ref=${code}`,
    discount_percent: DISCOUNT_PERCENT,
    ...counts,
    referrals: rows.map((r) => ({
      business_name: r.businessName,
      status: r.status,
      created_at: pyIso(r.createdAt),
    })),
  };
}
