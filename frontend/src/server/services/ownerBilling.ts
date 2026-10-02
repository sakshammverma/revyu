/**
 * Owner billing: see plan/trial status, pay to unlock from the dashboard.
 * Port of backend/app/api/billing.py. Closes the gap where a locked or
 * past-due owner had no way to pay (SRS-12.3, FR-47). Reuses the provider
 * interface and webhook machinery of signup; the synchronous confirm just
 * makes the unlock instant instead of waiting for the webhook.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { DAY_MS, latestSubscription, periodDays, recordPayment } from "./billing";
import { getProvider, getProviderByName, PaymentProviderUnavailableError } from "./payments";
import { pyIso } from "./pyDate";
import { summary as referralSummary } from "./referrals";
import { checkoutInfo, paymentUnavailable } from "./signup";
import { TRIAL_DAYS } from "./trial";
import { TRIAL_CREDITS } from "./trialMetering";

const { outlets, payments, plans, subscriptions } = schema;

type Account = typeof schema.accounts.$inferSelect;
type OutletRow = typeof outlets.$inferSelect;

export const PAYABLE_STATES = ["trial", "locked", "past_due", "suspended", "deactivated", "active"];

export const checkoutBodySchema = z.object({ plan: z.string() }); // monthly | annual

export async function ownOutlet(db: DbLike, owner: Pick<Account, "id">): Promise<OutletRow> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, owner.id)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}

const activePlans = (db: DbLike, outlet: OutletRow) =>
  db
    .select()
    .from(plans)
    .where(and(eq(plans.countryCode, outlet.countryCode), eq(plans.active, true)))
    // The Python has no ORDER BY (heap order, in practice cheapest first); pin it.
    .orderBy(asc(plans.amountMinor));

export async function billingStatus(db: DbLike, owner: Pick<Account, "id">) {
  const outlet = await ownOutlet(db, owner);
  const sub = await latestSubscription(db, owner.id);
  const planRows = await activePlans(db, outlet);
  const byCode = new Map(planRows.map((p) => [p.code, p]));

  let trialDaysLeft: number | null = null;
  if (outlet.state === "trial" && outlet.activatedAt) {
    const end = outlet.activatedAt.getTime() + TRIAL_DAYS * DAY_MS;
    // Python timedelta.days floors toward -infinity; so does Math.floor.
    trialDaysLeft = Math.max(0, Math.floor((end - Date.now()) / DAY_MS) + 1);
  }

  let creditsLeft: number | null = null;
  if (outlet.state === "locked" && outlet.lockedAtFlowCount !== null) {
    const used = outlet.trialFlowCount - outlet.lockedAtFlowCount;
    creditsLeft = Math.max(0, TRIAL_CREDITS - used);
  } else if (outlet.state === "suspended") {
    creditsLeft = 0;
  }

  const monthly = byCode.get("monthly");
  const annual = byCode.get("annual");
  const saving = monthly && annual ? Math.max(0, monthly.amountMinor * 12 - annual.amountMinor) : 0;

  const paymentRows = sub
    ? await db
        .select({
          amountMinor: payments.amountMinor,
          currencyCode: payments.currencyCode,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
        .where(eq(subscriptions.accountId, owner.id))
        .orderBy(desc(payments.createdAt))
        .limit(24)
    : [];

  return {
    outlet_id: outlet.id,
    state: outlet.state,
    subscription_status: sub?.status ?? null,
    plan: sub?.plan ?? null,
    current_period_end: sub?.currentPeriodEnd ? pyIso(sub.currentPeriodEnd) : null,
    trial_days_left: trialDaysLeft,
    credits_left: creditsLeft,
    scans_waiting: outlet.trialFlowCount,
    can_pay: PAYABLE_STATES.includes(outlet.state),
    plans: planRows.map((p) => ({ code: p.code, amount_minor: p.amountMinor, currency_code: p.currencyCode })),
    annual_saving_minor: saving,
    payments: paymentRows.map((p) => ({
      amount_minor: p.amountMinor,
      currency_code: p.currencyCode,
      status: p.status,
      created_at: pyIso(p.createdAt),
    })),
    referral_discounts_earned: (await referralSummary(db, owner.id)).earned,
  };
}

export async function createBillingCheckout(db: DbLike, owner: Account, planCode: string) {
  const outlet = await ownOutlet(db, owner);
  if (!PAYABLE_STATES.includes(outlet.state)) throw new HttpError(409, "NOT_PAYABLE");
  const plan = (await activePlans(db, outlet)).find((p) => p.code === planCode);
  if (!plan) throw new HttpError(400, "UNKNOWN_PLAN");

  let intent;
  try {
    // No trial here: the owner is paying now, so the first charge is immediate.
    intent = await getProvider(outlet.countryCode).createCheckout({
      planCode: plan.code,
      amountMinor: plan.amountMinor,
      currencyCode: plan.currencyCode,
      customerEmail: owner.ownerEmail,
      trialDays: 0,
    });
  } catch (err) {
    if (err instanceof PaymentProviderUnavailableError) throw paymentUnavailable(err);
    throw err;
  }

  const subId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    // Earlier unpaid attempts are superseded.
    await tx
      .update(subscriptions)
      .set({ status: "abandoned" })
      .where(and(eq(subscriptions.accountId, owner.id), eq(subscriptions.status, "pending")));
    await tx.insert(subscriptions).values({
      id: subId,
      accountId: owner.id,
      plan: plan.code,
      status: "pending",
      provider: intent.provider,
      razorpaySubscriptionId: intent.providerSubscriptionId,
      razorpayOrderId: intent.providerOrderId,
      mandateStatus: intent.mode === "one_time" ? "not_applicable" : "pending",
    });
  });

  return {
    checkout: checkoutInfo(intent, 0, {
      name: owner.ownerName || "",
      email: owner.ownerEmail,
      contact: owner.ownerPhone,
    }),
    subscription_id: subId,
  };
}

export interface ConfirmArgs {
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Verified-signature confirm so the unlock is instant. The matching webhook
 * performs the same idempotent transition and records the capture.
 */
export async function confirmBillingCheckout(db: DbLike, owner: Account, body: ConfirmArgs) {
  const outlet = await ownOutlet(db, owner);
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, owner.id), eq(subscriptions.status, "pending")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  // Already confirmed (webhook beat us): idempotent.
  if (!sub) return billingStatus(db, owner);

  const provider = getProviderByName(sub.provider);
  if (
    !provider.verifyCheckoutSignature({
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
      subscriptionId: sub.razorpaySubscriptionId,
      orderId: sub.razorpayOrderId,
    })
  ) {
    throw new HttpError(400, "PAYMENT_SIGNATURE_INVALID");
  }

  const plan = (await activePlans(db, outlet)).find((p) => p.code === sub.plan);
  const now = new Date();
  await db.transaction(async (tx) => {
    // Claim the transition atomically so a double submit (or a webhook racing
    // this call) records the payment and unlocks exactly once.
    const claimed = await tx
      .update(subscriptions)
      .set({
        status: "active",
        graceUntil: null,
        ...(sub.razorpaySubscriptionId && !sub.razorpayOrderId ? { mandateStatus: "active" } : {}),
        currentPeriodEnd: new Date(now.getTime() + periodDays(sub.plan) * DAY_MS),
      })
      .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, "pending")))
      .returning({ id: subscriptions.id });
    if (claimed.length === 0) return;
    await recordPayment(tx, sub, {
      providerPaymentId: sub.provider === "mock" ? null : body.razorpay_payment_id,
      amountMinor: plan?.amountMinor ?? 0,
      currencyCode: plan?.currencyCode ?? "INR",
      // A mandate is only authorised here; its charge is confirmed by the webhook.
      status: sub.razorpayOrderId ? "captured" : "authorized",
      webhookVerified: false,
    });
    if (PAYABLE_STATES.includes(outlet.state)) {
      // Dashboard unlocks, collection resumes.
      await tx.update(outlets).set({ state: "active", updatedAt: now }).where(eq(outlets.id, outlet.id));
    }
  });
  return billingStatus(db, owner);
}
