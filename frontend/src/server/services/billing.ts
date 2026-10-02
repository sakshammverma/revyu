/**
 * Billing state transitions shared by signup confirm, webhooks and admin
 * rejection. Port of backend/app/services/billing.py. Keeping them here means
 * a browser confirm and the matching webhook (whichever lands first) produce
 * exactly the same result, once.
 *
 * Signup lifecycle (SRS-18.6/18.7, 05-DATA-MODEL.md section 4.1):
 *
 *   pending_payment -(checkout verified)-> pending_approval -approve-> trial
 *                                               \-reject-> rejected (+ refund / mandate cancelled)
 *
 * `pending_payment` rows are invisible everywhere (no queue entry, no QR, no
 * flow): they exist only so the checkout has something to attach to.
 */
import { and, desc, eq, gt, isNotNull, ne } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getProviderByName, PaymentProviderUnavailableError } from "./payments";
import { markRefereePaid } from "./referrals";

const { outlets, payments, subscriptions } = schema;

export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;

export const PERIOD_DAYS: Record<string, number> = { monthly: 30, annual: 365 };
export const periodDays = (plan: string) => PERIOD_DAYS[plan] ?? 30;
export const DAY_MS = 86_400_000;

export interface RecordPaymentArgs {
  providerPaymentId: string | null;
  amountMinor: number;
  currencyCode: string;
  status: string;
  webhookVerified: boolean;
}

/**
 * Idempotent on provider_payment_id (API spec section 5). A captured payment
 * is the moment a referred business "actually pays" (referral reward).
 */
export async function recordPayment(
  db: DbLike,
  subscription: Pick<Subscription, "id" | "accountId">,
  args: RecordPaymentArgs,
): Promise<void> {
  const { providerPaymentId, amountMinor, currencyCode, status, webhookVerified } = args;

  const upgradeExisting = async (): Promise<boolean> => {
    if (!providerPaymentId) return false;
    const [existing] = await db.select().from(payments).where(eq(payments.providerPaymentId, providerPaymentId)).limit(1);
    if (!existing) return false;
    if (webhookVerified && !existing.webhookVerified) {
      await db.update(payments).set({ webhookVerified: true }).where(eq(payments.id, existing.id));
    }
    // A later capture supersedes an earlier authorisation record, but never a refund.
    if (status === "captured" && existing.status !== "refunded") {
      await db.update(payments).set({ status: "captured" }).where(eq(payments.id, existing.id));
      await markRefereePaid(db, subscription.accountId);
    }
    return true;
  };

  if (await upgradeExisting()) return;

  // ON CONFLICT: two concurrent deliveries of the same payment id (webhook +
  // confirm, or a Razorpay retry) must not blow up on the unique index.
  const inserted = await db
    .insert(payments)
    .values({
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      providerPaymentId,
      amountMinor,
      currencyCode,
      status,
      webhookVerified,
    })
    .onConflictDoNothing({ target: payments.providerPaymentId })
    .returning({ id: payments.id });
  if (inserted.length === 0) {
    await upgradeExisting();
    return;
  }
  if (status === "captured") await markRefereePaid(db, subscription.accountId);
}

/**
 * Checkout succeeded (verified signature or webhook): mandate authorised, or
 * one-time order paid. Moves the signup into the approval queue.
 */
export async function markCheckoutComplete(db: DbLike, subscription: Subscription): Promise<Outlet | null> {
  const now = new Date();
  if (subscription.razorpayOrderId || subscription.mandateStatus === "not_applicable") {
    // One-time payment: the period is paid for up front.
    const patch: Partial<typeof subscriptions.$inferInsert> = { status: "active", mandateStatus: "not_applicable" };
    if (!subscription.currentPeriodEnd) {
      patch.currentPeriodEnd = new Date(now.getTime() + periodDays(subscription.plan) * DAY_MS);
    }
    await db.update(subscriptions).set(patch).where(eq(subscriptions.id, subscription.id));
    Object.assign(subscription, patch);
  } else {
    // Mandate authorised; first charge lands when the trial ends.
    await db.update(subscriptions).set({ mandateStatus: "active" }).where(eq(subscriptions.id, subscription.id));
    subscription.mandateStatus = "active";
  }

  const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, subscription.accountId)).limit(1);
  if (outlet && outlet.state === "pending_payment") {
    await db.update(outlets).set({ state: "pending_approval", submittedAt: now, updatedAt: now }).where(eq(outlets.id, outlet.id));
    outlet.state = "pending_approval";
    outlet.submittedAt = now;
  }
  return outlet ?? null;
}

/**
 * True if the account has an active, currently-paid subscription, so a paid
 * outlet goes to `active` instead of `locked` at day 15.
 */
export async function hasPaidPeriod(db: DbLike, accountId: string): Promise<boolean> {
  const [sub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, accountId),
        eq(subscriptions.status, "active"),
        isNotNull(subscriptions.currentPeriodEnd),
        gt(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .limit(1);
  return Boolean(sub);
}

/**
 * SRS-19.7: on rejection, cancel any mandate and refund any captured payment.
 * Returns human-readable problems (empty if all clean); never throws on a
 * gateway hiccup so it can't block the admin's rejection.
 */
export async function releaseSignupPayment(db: DbLike, accountId: string): Promise<string[]> {
  const problems: string[] = [];
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.accountId, accountId));
  for (const sub of subs) {
    const provider = getProviderByName(sub.provider);
    if (sub.razorpaySubscriptionId && sub.status !== "cancelled" && sub.status !== "abandoned") {
      try {
        await provider.cancelSubscription(sub.razorpaySubscriptionId);
      } catch (err) {
        if (!(err instanceof PaymentProviderUnavailableError)) throw err;
        problems.push(`mandate ${sub.razorpaySubscriptionId}: ${err.message}`);
      }
    }
    const subPayments = await db.select().from(payments).where(eq(payments.subscriptionId, sub.id));
    for (const payment of subPayments) {
      if (payment.status === "captured" && payment.providerPaymentId) {
        try {
          await provider.refundPayment(payment.providerPaymentId);
          await db.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
        } catch (err) {
          if (!(err instanceof PaymentProviderUnavailableError)) throw err;
          problems.push(`refund ${payment.providerPaymentId}: ${err.message}`);
        }
      }
    }
    await db.update(subscriptions).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(subscriptions.id, sub.id));
  }
  for (const p of problems) console.error(`Signup payment release needs manual follow-up: ${p}`);
  return problems;
}

/** Latest non-abandoned subscription for an account. */
export async function latestSubscription(db: DbLike, accountId: string): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, accountId), ne(subscriptions.status, "abandoned")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return sub ?? null;
}
