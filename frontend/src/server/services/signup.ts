/**
 * Self-serve signup: places search, signup + checkout, confirm, status.
 * Port of backend/app/api/signup.py (SRS-18).
 */
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { listVerticals, verticalTags } from "@/server/verticals";
import { latestSubscription, markCheckoutComplete, recordPayment } from "./billing";
import { getProvider, getProviderByName, PaymentProviderUnavailableError } from "./payments";
import { buildReviewUrl, PlacesUnavailableError, searchPlaces } from "./places";
import { pyIso } from "./pyDate";
import { attachReferral } from "./referrals";
import { TRIAL_DAYS } from "./trial";

const { accounts, outlets, plans, subscriptions, tags } = schema;

export const DEFAULT_COUNTRY = "IN"; // v1 launch market (OD-4)

/** pydantic's EmailStr normalises the domain to lower case; the local part is kept. */
const email = z.email().transform((v) => {
  const at = v.lastIndexOf("@");
  return v.slice(0, at + 1) + v.slice(at + 1).toLowerCase();
});

export const signupBody = z.object({
  business_name: z.string(),
  vertical: z.string(),
  owner_name: z.string(),
  owner_phone: z.string(),
  owner_email: email,
  place_id: z.string(),
  plan: z.string(), // monthly | annual
  placement_acknowledged: z.boolean(),
  referral_code: z.string().nullish(),
});
export type SignupBody = z.infer<typeof signupBody>;

/** What Razorpay Checkout's success handler returns (mock: "mock" / "mock-signature"). */
export const confirmBody = z.object({
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  razorpay_subscription_id: z.string().nullish(),
  razorpay_order_id: z.string().nullish(),
});
export type ConfirmBody = z.infer<typeof confirmBody>;

export interface CheckoutInfo {
  provider: string;
  mode: string;
  amount_minor: number;
  currency_code: string;
  key_id: string | null;
  subscription_id: string | null;
  order_id: string | null;
  trial_days: number;
  prefill: { name: string; email: string; contact: string } | null;
}

/** Shared by signup and owner billing checkout responses. */
export function checkoutInfo(
  intent: {
    provider: string;
    mode: string;
    amountMinor: number;
    currencyCode: string;
    keyId: string | null;
    providerSubscriptionId: string | null;
    providerOrderId: string | null;
  },
  trialDays: number,
  prefill: CheckoutInfo["prefill"],
): CheckoutInfo {
  return {
    provider: intent.provider,
    mode: intent.mode,
    amount_minor: intent.amountMinor,
    currency_code: intent.currencyCode,
    key_id: intent.keyId,
    subscription_id: intent.providerSubscriptionId,
    order_id: intent.providerOrderId,
    trial_days: trialDays,
    prefill,
  };
}

export const paymentUnavailable = (err: PaymentProviderUnavailableError) =>
  new HttpError(503, "PAYMENT_UNAVAILABLE", err.message);

/** SRS-18.3: search-and-pick against Google Places, never free text. */
export async function placesSearch(q: string, near: string | null) {
  try {
    const results = await searchPlaces(q, near);
    return { results: results.map((r) => ({ ...r })) };
  } catch (err) {
    if (err instanceof PlacesUnavailableError) throw new HttpError(503, "PLACES_UNAVAILABLE", err.message);
    throw err;
  }
}

// A real, unguessable slug is only generated at approval (SRS-19.4) since no
// QR may exist before verification. This satisfies the NOT NULL + unique
// constraint in the interim without ever being printed anywhere.
const placeholderSlug = () => `pending-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

/** Port of seeds/tags.py seed_tags_for_outlet (CR-1: short fragments only). */
export async function seedTags(db: DbLike, outletId: string, vertical: string, locale = "en") {
  const rows = verticalTags(vertical).map((def, sortOrder) => ({
    id: crypto.randomUUID(),
    outletId,
    label: { [locale]: def.label },
    phrases: { [locale]: def.phrases },
    sortOrder,
    active: true,
  }));
  if (rows.length) await db.insert(tags).values(rows);
}

/**
 * If every duplicate hit belongs to one signup still stuck at checkout,
 * return its outlet so the owner can retry; otherwise null.
 */
async function abandonedOutlet(db: DbLike, accountIds: string[], outletIds: string[]) {
  // Two different accounts matched (e.g. this email, someone else's phone):
  // never a retry, whatever state their outlets are in.
  if (accountIds.length > 1) return null;
  const ids = new Set(outletIds);
  if (accountIds.length) {
    const rows = await db.select({ id: outlets.id }).from(outlets).where(inArray(outlets.accountId, accountIds));
    for (const r of rows) ids.add(r.id);
  }
  if (ids.size !== 1) return null;
  const [outlet] = await db
    .select()
    .from(outlets)
    .where(eq(outlets.id, [...ids][0]))
    .limit(1);
  return outlet && outlet.state === "pending_payment" ? outlet : null;
}

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export async function createSignup(db: DbLike, body: SignupBody) {
  if (!body.placement_acknowledged) {
    // SRS-18.10: the CR-4 checkbox is mandatory, not a formality.
    throw new HttpError(400, "VALIDATION_FAILED", "placement_acknowledged required");
  }
  if (!listVerticals().includes(body.vertical)) {
    // Otherwise the tag seeder silently falls back to dental tags.
    throw new HttpError(400, "VALIDATION_FAILED", "unknown vertical");
  }

  // SRS-18.5: duplicate detection on email, phone, and Place ID. A signup
  // abandoned at checkout (still `pending_payment`) is not a duplicate: the
  // owner is simply retrying, so we reuse those rows. Every hit is considered
  // (the Python looked at only one account), so an email that belongs to an
  // abandoned signup cannot be combined with a phone that belongs to a live
  // account.
  const dupAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(or(eq(accounts.ownerEmail, body.owner_email), eq(accounts.ownerPhone, body.owner_phone)));
  const dupOutlets = await db.select({ id: outlets.id }).from(outlets).where(eq(outlets.googlePlaceId, body.place_id));
  const retryOutlet = await abandonedOutlet(
    db,
    dupAccounts.map((a) => a.id),
    dupOutlets.map((o) => o.id),
  );
  if (!retryOutlet && (dupAccounts.length || dupOutlets.length)) throw new HttpError(409, "DUPLICATE_BUSINESS");

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, body.plan), eq(plans.countryCode, DEFAULT_COUNTRY), eq(plans.active, true)))
    .limit(1);
  if (!plan) throw new HttpError(400, "VALIDATION_FAILED", "unknown plan");

  // SRS-18.6/FR-40b: payment is authorised at signup, before approval. The
  // first charge is deferred by the trial.
  let checkout;
  try {
    checkout = await getProvider(DEFAULT_COUNTRY).createCheckout({
      planCode: plan.code,
      amountMinor: plan.amountMinor,
      currencyCode: plan.currencyCode,
      customerEmail: body.owner_email,
      trialDays: TRIAL_DAYS,
    });
  } catch (err) {
    if (err instanceof PaymentProviderUnavailableError) throw paymentUnavailable(err);
    throw err;
  }

  let signupId: string;
  try {
    signupId = await db.transaction(async (tx) => {
      let outletId: string;
      let accountId: string;
      if (retryOutlet) {
        outletId = retryOutlet.id;
        accountId = retryOutlet.accountId;
        await tx
          .update(accounts)
          .set({
            ownerPhone: body.owner_phone,
            ownerEmail: body.owner_email,
            ownerName: body.owner_name,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, accountId));
        if (retryOutlet.vertical !== body.vertical) {
          await tx.delete(tags).where(eq(tags.outletId, outletId));
          await seedTags(tx, outletId, body.vertical);
        }
        await tx
          .update(outlets)
          .set({
            businessName: body.business_name,
            vertical: body.vertical,
            googlePlaceId: body.place_id,
            googleReviewUrl: buildReviewUrl(body.place_id),
            updatedAt: new Date(),
          })
          .where(eq(outlets.id, outletId));
        await tx
          .update(subscriptions)
          .set({ status: "abandoned" })
          .where(and(eq(subscriptions.accountId, accountId), eq(subscriptions.status, "pending")));
      } else {
        accountId = crypto.randomUUID();
        outletId = crypto.randomUUID();
        await tx.insert(accounts).values({
          id: accountId,
          ownerPhone: body.owner_phone,
          ownerEmail: body.owner_email,
          ownerName: body.owner_name,
          otpChannel: "email",
          currencyCode: "INR",
          paymentProvider: "razorpay",
        });
        await attachReferral(
          tx,
          { id: accountId, ownerEmail: body.owner_email, referredByAccountId: null },
          body.referral_code,
        );
        await tx.insert(outlets).values({
          id: outletId,
          accountId,
          slug: placeholderSlug(), // replaced with a real slug at approval (SRS-19.4)
          businessName: body.business_name,
          vertical: body.vertical,
          countryCode: DEFAULT_COUNTRY,
          locale: "en-IN",
          timezone: "Asia/Kolkata",
          googlePlaceId: body.place_id,
          googleReviewUrl: buildReviewUrl(body.place_id),
          // Invisible until checkout completes (services/billing.ts).
          state: "pending_payment",
          source: "self_serve",
          placementConfirmed: false,
          placeVerified: false,
          trialFlowCount: 0,
          hubMode: "direct",
        });
        await seedTags(tx, outletId, body.vertical);
      }

      await tx.insert(subscriptions).values({
        id: crypto.randomUUID(),
        accountId,
        plan: plan.code,
        status: "pending",
        provider: checkout.provider,
        razorpaySubscriptionId: checkout.providerSubscriptionId,
        razorpayOrderId: checkout.providerOrderId,
        mandateStatus: checkout.mode === "one_time" ? "not_applicable" : "pending",
      });
      return outletId;
    });
  } catch (err) {
    // Two simultaneous signups racing past the duplicate check hit the unique indexes.
    if (isUniqueViolation(err)) throw new HttpError(409, "DUPLICATE_BUSINESS");
    throw err;
  }

  return {
    signup_id: signupId,
    checkout: checkoutInfo(checkout, TRIAL_DAYS, {
      name: body.owner_name,
      email: body.owner_email,
      contact: body.owner_phone,
    }),
  };
}

type OutletRow = typeof outlets.$inferSelect;

export async function signupStatus(db: DbLike, outlet: OutletRow) {
  const subscription = await latestSubscription(db, outlet.accountId);
  const oneTime = Boolean(subscription?.razorpayOrderId);
  const paidLine = oneTime
    ? "Payment received."
    : `Payment method authorised — nothing is charged until your ${TRIAL_DAYS}-day trial ends.`;
  const messages: Record<string, string> = {
    pending_payment: "Waiting for payment. If you closed the payment window, start again from the signup page.",
    pending_approval: `${paidLine} We're verifying your business details — usually within a few hours.`,
    trial: "You're live! Check your email for your QR code and print files.",
    rejected:
      (outlet.rejectionReason || "We couldn't verify this business.") +
      (oneTime
        ? " Your payment has been refunded in full."
        : " Your payment authorisation has been cancelled — you will not be charged."),
  };
  return {
    state: outlet.state,
    submitted_at: outlet.submittedAt ? pyIso(outlet.submittedAt) : null,
    message: messages[outlet.state] ?? "You're live! Log in to your dashboard to see your numbers.",
  };
}

export async function getSignupOutlet(db: DbLike, signupId: string): Promise<OutletRow> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, signupId)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}

/**
 * Called by the signup page with what Razorpay Checkout returns on success.
 * The signature is verified server-side with the key secret, so this is not
 * trusting a client redirect (SRS-12.8); the matching webhook performs the
 * same idempotent transition if it lands first or this call never arrives.
 */
export async function confirmSignup(db: DbLike, signupId: string, body: ConfirmBody) {
  const outlet = await getSignupOutlet(db, signupId);
  const subscription = await latestSubscription(db, outlet.accountId);
  if (!subscription) throw new HttpError(404, "CHECKOUT_NOT_FOUND");

  if (outlet.state !== "pending_payment") return signupStatus(db, outlet); // already confirmed: idempotent

  // The ids must be the ones we created for *this* signup.
  if (
    (body.razorpay_subscription_id || null) !== (subscription.razorpaySubscriptionId || null) &&
    (body.razorpay_order_id || null) !== (subscription.razorpayOrderId || null)
  ) {
    throw new HttpError(400, "CHECKOUT_MISMATCH");
  }

  const provider = getProviderByName(subscription.provider);
  if (
    !provider.verifyCheckoutSignature({
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
      subscriptionId: subscription.razorpaySubscriptionId,
      orderId: subscription.razorpayOrderId,
    })
  ) {
    throw new HttpError(400, "PAYMENT_SIGNATURE_INVALID");
  }

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, subscription.plan), eq(plans.countryCode, outlet.countryCode)))
    .limit(1);
  // Money: the amount comes from our own plan row, never from the client. A
  // mandate is only authorised here (nothing charged yet); a one-time order is captured.
  await db.transaction(async (tx) => {
    await recordPayment(tx, subscription, {
      providerPaymentId: subscription.provider === "mock" ? null : body.razorpay_payment_id,
      amountMinor: plan && subscription.razorpayOrderId ? plan.amountMinor : 0,
      currencyCode: plan?.currencyCode ?? "INR",
      status: subscription.razorpayOrderId ? "captured" : "authorized",
      webhookVerified: false,
    });
    await markCheckoutComplete(tx, subscription);
  });
  return signupStatus(db, await getSignupOutlet(db, signupId));
}
