/**
 * Razorpay webhook event handling. Port of backend/app/api/webhooks.py.
 * Signature-verified (in the route), idempotent, and the source of truth for
 * every billing state change: never a client redirect (SRS-12.8,
 * documents/06-API-SPEC.md section 5).
 */
import { eq } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { notify } from "@/server/notifications";
import { DAY_MS, markCheckoutComplete, periodDays, recordPayment, type Outlet, type Subscription } from "./billing";

const { accounts, outlets, subscriptions } = schema;

export const GRACE_PERIOD_DAYS = 7; // SRS-12.5, OD-13

// Outlet states a successful charge may move to `active`. Never the pre-live
// states: a paid signup still has to pass approval (SRS-19) first.
const PAYABLE_STATES = ["trial", "locked", "past_due", "suspended", "deactivated", "active"];

type Json = Record<string, unknown>;

/** Safe nested lookup: Razorpay's payload shape is theirs to change. */
function dig(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Json)[key];
  }
  return cur;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

async function findByProviderSubscriptionId(db: DbLike, providerSubId: string): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubscriptionId, providerSubId))
    .limit(1);
  return sub ?? null;
}

const subscriptionFromEntity = async (db: DbLike, entity: unknown) => {
  const id = str(dig(entity, "subscription", "entity", "id"));
  return id ? findByProviderSubscriptionId(db, id) : null;
};

async function accountOutlet(db: DbLike, accountId: string): Promise<Outlet | null> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, accountId)).limit(1);
  return outlet ?? null;
}

async function activateIfLive(db: DbLike, outlet: Outlet | null): Promise<void> {
  if (outlet && PAYABLE_STATES.includes(outlet.state)) {
    // SRS-12.4 unlock dashboard; SRS-12.9 reactivates collection.
    await db.update(outlets).set({ state: "active", updatedAt: new Date() }).where(eq(outlets.id, outlet.id));
  }
}

async function recordPaymentIdempotent(db: DbLike, sub: Subscription, paymentEntity: unknown, status: string) {
  const providerPaymentId = str(dig(paymentEntity, "id"));
  if (!providerPaymentId) return;
  const amount = dig(paymentEntity, "amount");
  const currency = dig(paymentEntity, "currency");
  // SRS-12.8 / API spec section 5: dedup on provider_payment_id (in recordPayment).
  await recordPayment(db, sub, {
    providerPaymentId,
    amountMinor: typeof amount === "number" && Number.isFinite(amount) ? Math.trunc(amount) : 0,
    currencyCode: typeof currency === "string" && currency ? currency : "INR",
    status,
    webhookVerified: true,
  });
}

async function onSubscriptionAuthenticated(db: DbLike, entity: unknown) {
  // Mandate authorised at signup: same transition as the signed checkout
  // confirm, whichever arrives first.
  const sub = await subscriptionFromEntity(db, entity);
  if (sub) await markCheckoutComplete(db, sub);
}

async function onSubscriptionActivated(db: DbLike, entity: unknown) {
  // Fires when the deferred start date arrives (end of trial).
  const sub = await subscriptionFromEntity(db, entity);
  if (!sub) return;
  await db
    .update(subscriptions)
    .set({ status: "active", mandateStatus: "active" })
    .where(eq(subscriptions.id, sub.id));
  sub.status = "active";
  sub.mandateStatus = "active";
  await activateIfLive(db, await markCheckoutComplete(db, sub));
}

async function onSubscriptionCharged(db: DbLike, entity: unknown) {
  const sub = await subscriptionFromEntity(db, entity);
  if (!sub) return;
  await recordPaymentIdempotent(db, sub, dig(entity, "payment", "entity"), "captured");
  await db
    .update(subscriptions)
    .set({
      status: "active",
      graceUntil: null,
      currentPeriodEnd: new Date(Date.now() + periodDays(sub.plan) * DAY_MS),
    })
    .where(eq(subscriptions.id, sub.id));
  await activateIfLive(db, await accountOutlet(db, sub.accountId));
}

async function onPaymentFailed(db: DbLike, entity: unknown) {
  const paymentEntity = dig(entity, "payment", "entity");
  const providerSubId = str(dig(paymentEntity, "subscription_id"));
  const sub = providerSubId ? await findByProviderSubscriptionId(db, providerSubId) : null;
  if (!sub) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due", graceUntil: new Date(Date.now() + GRACE_PERIOD_DAYS * DAY_MS) })
    .where(eq(subscriptions.id, sub.id));

  const outlet = await accountOutlet(db, sub.accountId);
  if (outlet && ["trial", "locked", "active"].includes(outlet.state)) {
    await db.update(outlets).set({ state: "past_due", updatedAt: new Date() }).where(eq(outlets.id, outlet.id));
    // SRS-12.5: full flow stays live during the 7-day grace period.
    const [account] = await db.select().from(accounts).where(eq(accounts.id, sub.accountId)).limit(1);
    if (account) {
      await notify(db, {
        accountId: account.id,
        outletId: outlet.id,
        toEmail: account.ownerEmail,
        template: "payment_failed",
        data: {
          business_name: outlet.businessName,
          grace_days: GRACE_PERIOD_DAYS,
          payment_link: `${getEnv().frontendBaseUrl.replace(/\/+$/, "")}/app/login`,
        },
      });
    }
  }
  await recordPaymentIdempotent(db, sub, paymentEntity, "failed");
}

async function onSubscriptionHalted(db: DbLike, entity: unknown) {
  // Grace expired, unpaid -> suspended, collection stops (OD-18).
  const sub = await subscriptionFromEntity(db, entity);
  if (!sub) return;
  await db.update(subscriptions).set({ status: "cancelled" }).where(eq(subscriptions.id, sub.id));
  const outlet = await accountOutlet(db, sub.accountId);
  if (outlet) await db.update(outlets).set({ state: "suspended", updatedAt: new Date() }).where(eq(outlets.id, outlet.id));
}

async function onSubscriptionCancelled(db: DbLike, entity: unknown) {
  const sub = await subscriptionFromEntity(db, entity);
  if (!sub) return;
  // Access and collection continue to period end, then the cancellation-expiry
  // job transitions the outlet to deactivated.
  await db.update(subscriptions).set({ cancelledAt: new Date() }).where(eq(subscriptions.id, sub.id));
}

async function onOrderPaid(db: DbLike, entity: unknown) {
  // Annual or one-time-fallback payment. Reactivates collection if previously
  // suspended (SRS-12.9).
  const paymentEntity = dig(entity, "payment", "entity");
  const orderId = str(dig(paymentEntity, "order_id"));
  if (!orderId) return;
  // One-time orders aren't linked via razorpay_subscription_id (mandate-only):
  // the checkout stored the order id on the subscription row.
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.razorpayOrderId, orderId)).limit(1);
  if (!sub) return;
  await recordPaymentIdempotent(db, sub, paymentEntity, "captured");
  const outlet = await markCheckoutComplete(db, sub); // signup: -> pending_approval
  await activateIfLive(db, outlet); // renewal / reactivation after suspension
}

export async function handleEvent(db: DbLike, event: string, payload: unknown): Promise<void> {
  const entity = dig(payload, "payload");
  switch (event) {
    case "subscription.authenticated":
      return onSubscriptionAuthenticated(db, entity);
    case "subscription.activated":
      return onSubscriptionActivated(db, entity);
    case "subscription.charged":
      return onSubscriptionCharged(db, entity);
    case "payment.failed":
      return onPaymentFailed(db, entity);
    case "subscription.halted":
      return onSubscriptionHalted(db, entity);
    case "subscription.cancelled":
      return onSubscriptionCancelled(db, entity);
    case "order.paid":
      return onOrderPaid(db, entity);
    // Unknown event types are ignored, not errored: Razorpay's event set grows
    // over time and an unhandled type must never fail the webhook.
  }
}
