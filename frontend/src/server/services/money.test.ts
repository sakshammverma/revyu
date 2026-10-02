/**
 * Money endpoints: signup + checkout, owner billing, Razorpay webhook,
 * referrals, one-time payments (service quotes, print kit). Ports of
 * backend/tests/test_billing_api.py, test_growth_api.py (owner side) and
 * test_referrals_and_gap.py, plus webhook idempotency. Everything runs in a
 * rolled-back transaction on the dev DB with the local mock provider.
 */
import { createHmac } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return {
    ...actual,
    // Mock provider (no gateway keys), a known webhook secret, no admin email.
    getEnv: () => ({
      ...actual.getEnv(),
      environment: "local",
      isLocal: true,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      razorpayWebhookSecret: "hook-secret",
      adminNotifyEmail: "",
    }),
  };
});

import { GET as getBillingStatus } from "@/app/api/app/billing/status/route";
import { POST as postBillingCheckout } from "@/app/api/app/billing/checkout/route";
import { POST as postBillingConfirm } from "@/app/api/app/billing/confirm/route";
import { GET as getReferrals } from "@/app/api/app/referrals/route";
import { GET as listMyRequests, POST as postRequest } from "@/app/api/app/service-requests/route";
import { GET as getMyRequest } from "@/app/api/app/service-requests/[request_id]/route";
import { POST as postAccept } from "@/app/api/app/service-requests/[request_id]/accept/route";
import { POST as postCancel } from "@/app/api/app/service-requests/[request_id]/cancel/route";
import { POST as postMessage } from "@/app/api/app/service-requests/[request_id]/messages/route";
import { POST as postPayRequest } from "@/app/api/app/service-requests/[request_id]/pay/route";
import { POST as postPayRequestConfirm } from "@/app/api/app/service-requests/[request_id]/pay/confirm/route";
import { GET as getPrintKit, POST as postPrintKit } from "@/app/api/app/print-kit/route";
import { POST as postPayKit } from "@/app/api/app/print-kit/[kit_id]/pay/route";
import { POST as postPayKitConfirm } from "@/app/api/app/print-kit/[kit_id]/pay/confirm/route";
import { GET as getServices } from "@/app/api/app/services/route";
import { POST as postSignup } from "@/app/api/signup/route";
import { GET as searchPlaces } from "@/app/api/signup/places/search/route";
import { POST as postSignupConfirm } from "@/app/api/signup/[signup_id]/confirm/route";
import { GET as getSignupStatus } from "@/app/api/signup/[signup_id]/status/route";
import { POST as postWebhook } from "@/app/api/webhooks/razorpay/route";
import { schema, type DbLike } from "@/server/db";
import { recordPayment } from "@/server/services/billing";
import { attachReferral, getOrCreateCode, markRefereePaid, normaliseCode, summary, voidReward } from "@/server/services/referrals";
import { inRolledBackTx, issueOwnerSession, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";

const { accounts, notifications, outlets, payments, plans, referralRewards, serviceCatalog, serviceRequestEvents, serviceRequests, subscriptions, tags } = schema;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

async function seedPlans(db: DbLike) {
  for (const [code, amount] of [
    ["monthly", 49900],
    ["annual", 449900],
  ] as const) {
    const [have] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.code, code), eq(plans.countryCode, "IN"), eq(plans.active, true)));
    if (!have) {
      await db.insert(plans).values({ id: crypto.randomUUID(), code, countryCode: "IN", currencyCode: "INR", amountMinor: amount, active: true });
    }
  }
  const rows = await db.select().from(plans).where(and(eq(plans.countryCode, "IN"), eq(plans.active, true)));
  return Object.fromEntries(rows.map((p) => [p.code, p.amountMinor])) as Record<string, number>;
}

const signupPayload = (over: Record<string, unknown> = {}) => {
  const n = uid();
  return {
    business_name: "Smile Dental",
    vertical: "dental",
    owner_name: "Dr Test",
    owner_phone: `+91${n}`,
    owner_email: `owner-${n}@Example.COM`,
    place_id: `ChIJ_${n}`,
    plan: "monthly",
    placement_acknowledged: true,
    ...over,
  };
};

const signup = (payload: Record<string, unknown>) => postSignup(makeRequest("/api/signup", { body: payload }), undefined as never);
const confirmSignup = (id: string, body: Record<string, unknown>) =>
  postSignupConfirm(makeRequest(`/api/signup/${id}/confirm`, { body }), routeCtx({ signup_id: id }));
const statusOf = (id: string) => getSignupStatus(makeRequest(`/api/signup/${id}/status`), routeCtx({ signup_id: id }));

const hook = (secret: string, raw: string) => createHmac("sha256", secret).update(raw).digest("hex");
const webhook = (event: Record<string, unknown>, sig?: string) => {
  const raw = JSON.stringify(event);
  return postWebhook(
    new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": sig ?? hook("hook-secret", raw) },
      body: raw,
    }),
    undefined as never,
  );
};

describe("signup (SRS-18)", () => {
  it("search returns the local fake places", async () => {
    const res = await searchPlaces(makeRequest("/api/signup/places/search?q=Smile"), undefined as never);
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results).toHaveLength(2);
    expect(Object.keys(results[0]).sort()).toEqual(["address", "name", "place_id", "rating", "review_count"]);
    expect((await searchPlaces(makeRequest("/api/signup/places/search"), undefined as never)).status).toBe(422);
  });

  it("creates a pending_payment signup, confirms with the mock signature, and is idempotent", () =>
    inTx(async (tx) => {
      const amounts = await seedPlans(tx);
      const payload = signupPayload();
      const res = await signup(payload);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.checkout).toMatchObject({
        provider: "mock",
        mode: "mock",
        amount_minor: amounts.monthly,
        currency_code: "INR",
        key_id: null,
        order_id: null,
        trial_days: 15,
        prefill: { name: "Dr Test", contact: payload.owner_phone },
      });
      expect(body.checkout.subscription_id).toMatch(/^sub_mock_/);
      // EmailStr lower-cases only the domain.
      expect(body.checkout.prefill.email).toBe((payload.owner_email as string).replace("Example.COM", "example.com"));

      const id = body.signup_id as string;
      const [outlet] = await tx.select().from(outlets).where(eq(outlets.id, id));
      expect(outlet).toMatchObject({ state: "pending_payment", source: "self_serve", countryCode: "IN", placeVerified: false });
      expect(outlet.slug).toMatch(/^pending-[0-9a-f]{10}$/);
      expect(outlet.googleReviewUrl).toBe(`https://search.google.com/local/writereview?placeid=${payload.place_id}`);
      expect((await tx.select().from(tags).where(eq(tags.outletId, id))).length).toBeGreaterThan(3);

      expect(await (await statusOf(id)).json()).toMatchObject({ state: "pending_payment", submitted_at: null });

      // Forged signature: nothing changes (SRS-12.8).
      const bad = await confirmSignup(id, { razorpay_payment_id: "mock", razorpay_signature: "forged", razorpay_subscription_id: body.checkout.subscription_id });
      expect(bad.status).toBe(400);
      expect((await bad.json()).detail.error.code).toBe("PAYMENT_SIGNATURE_INVALID");
      // Ids from some other checkout (Python semantics: rejected only when both differ).
      const mismatch = await confirmSignup(id, { razorpay_payment_id: "mock", razorpay_signature: "mock-signature", razorpay_subscription_id: "sub_other", razorpay_order_id: "order_other" });
      expect((await mismatch.json()).detail.error.code).toBe("CHECKOUT_MISMATCH");
      expect((await statusOf(id).then((r) => r.json())).state).toBe("pending_payment");

      const ok = await confirmSignup(id, { razorpay_payment_id: "mock", razorpay_signature: "mock-signature", razorpay_subscription_id: body.checkout.subscription_id });
      expect(ok.status).toBe(200);
      const done = await ok.json();
      expect(done.state).toBe("pending_approval");
      expect(done.submitted_at).toMatch(/^\d{4}-\d\d-\d\dT.*\+00:00$/);
      expect(done.message).toContain("nothing is charged until your 15-day trial ends");

      const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.accountId, outlet.accountId));
      expect(sub).toMatchObject({ status: "pending", mandateStatus: "active", provider: "mock" });
      // Mandate only authorised: recorded at amount 0, never as a capture.
      const [pay] = await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id));
      expect(pay).toMatchObject({ status: "authorized", amountMinor: 0, providerPaymentId: null, webhookVerified: false });

      const again = await confirmSignup(id, { razorpay_payment_id: "mock", razorpay_signature: "garbage" });
      expect((await again.json()).state).toBe("pending_approval"); // already confirmed: no second payment row
      expect((await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id))).length).toBe(1);
    }));

  it("validates input and rejects duplicates, reusing an abandoned checkout on retry", () =>
    inTx(async (tx) => {
      await seedPlans(tx);
      const code = async (p: Record<string, unknown>) => {
        const r = await signup(p);
        return [r.status, (await r.json()) as Record<string, any>] as const; // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      expect((await code(signupPayload({ placement_acknowledged: false })))[1].detail.error.code).toBe("VALIDATION_FAILED");
      expect((await code(signupPayload({ vertical: "astrology" })))[0]).toBe(400);
      expect((await code(signupPayload({ plan: "platinum" })))[0]).toBe(400);
      expect((await code(signupPayload({ owner_email: "not-an-email" })))[0]).toBe(422);

      const first = signupPayload();
      const [s1, b1] = await code(first);
      expect(s1).toBe(201);
      // Same email, phone and place while still pending_payment is a retry, not a duplicate.
      const [s2, b2] = await code({ ...first, vertical: "salon", business_name: "Renamed", plan: "annual" });
      expect(s2).toBe(201);
      expect(b2.signup_id).toBe(b1.signup_id);
      const [outlet] = await tx.select().from(outlets).where(eq(outlets.id, b1.signup_id));
      expect(outlet).toMatchObject({ businessName: "Renamed", vertical: "salon" });
      const subs = await tx.select().from(subscriptions).where(eq(subscriptions.accountId, outlet.accountId));
      expect(subs.map((s) => s.status).sort()).toEqual(["abandoned", "pending"]);
      expect(subs.find((s) => s.status === "pending")?.plan).toBe("annual");
      // Tags were reseeded for the new vertical, not doubled.
      const t = await tx.select().from(tags).where(eq(tags.outletId, outlet.id));
      expect(new Set(t.map((x) => x.sortOrder)).size).toBe(t.length);

      // Once confirmed, the same details are a duplicate.
      await confirmSignup(b1.signup_id, { razorpay_payment_id: "mock", razorpay_signature: "mock-signature" });
      expect((await code(first))[1].detail.error.code).toBe("DUPLICATE_BUSINESS");

      // An abandoned signup's email combined with another account's phone must not hijack that account.
      const live = await makeAccount(tx, "live");
      const abandoned = signupPayload();
      expect((await code(abandoned))[0]).toBe(201);
      const [sa, ba] = await code({ ...abandoned, owner_phone: live.ownerPhone });
      expect([sa, ba.detail.error.code]).toEqual([409, "DUPLICATE_BUSINESS"]);
      const [stillLive] = await tx.select().from(accounts).where(eq(accounts.id, live.id));
      expect(stillLive.ownerPhone).toBe(live.ownerPhone);
    }));

  it("status and confirm 404/422 for unknown or malformed ids", async () => {
    const unknown = crypto.randomUUID();
    expect((await statusOf(unknown)).status).toBe(404);
    expect((await statusOf("not-a-uuid")).status).toBe(422);
    expect((await confirmSignup(unknown, { razorpay_payment_id: "x", razorpay_signature: "y" })).status).toBe(404);
  });
});

describe("referrals (Python test_referrals_and_gap.py)", () => {
  it("code is stable and unambiguous", () =>
    inTx(async (tx) => {
      const a = await makeAccount(tx);
      const code = await getOrCreateCode(tx, a);
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{7}$/);
      const [fresh] = await tx.select().from(accounts).where(eq(accounts.id, a.id));
      expect(await getOrCreateCode(tx, fresh)).toBe(code);
      expect(normaliseCode("  ab12 ")).toBe("AB12");
      expect(normaliseCode("   ")).toBeNull();
    }));

  it("reward is earned only when the referee actually pays", () =>
    inTx(async (tx) => {
      const referrer = await makeAccount(tx, "r");
      const referred = await makeAccount(tx, "d");
      const code = await getOrCreateCode(tx, referrer);
      expect(await attachReferral(tx, referred, code.toLowerCase())).toBe(true);
      expect(await summary(tx, referrer.id)).toEqual({ pending: 1, earned: 0, applied: 0 });

      await seedPlans(tx);
      const [sub] = await tx
        .insert(subscriptions)
        .values({ id: crypto.randomUUID(), accountId: referred.id, plan: "monthly", status: "pending", provider: "mock" })
        .returning();
      // Authorised mandate / failed attempts are not payments.
      await recordPayment(tx, sub, { providerPaymentId: "pay_a", amountMinor: 0, currencyCode: "INR", status: "authorized", webhookVerified: false });
      await recordPayment(tx, sub, { providerPaymentId: "pay_f", amountMinor: 100, currencyCode: "INR", status: "failed", webhookVerified: true });
      expect((await summary(tx, referrer.id)).earned).toBe(0);
      // The first capture earns it, once.
      await recordPayment(tx, sub, { providerPaymentId: "pay_c", amountMinor: 49900, currencyCode: "INR", status: "captured", webhookVerified: true });
      expect(await summary(tx, referrer.id)).toEqual({ pending: 0, earned: 1, applied: 0 });
      const [r1] = await tx.select().from(referralRewards).where(eq(referralRewards.referredAccountId, referred.id));
      expect(r1.discountPercent).toBe(70);
      await recordPayment(tx, sub, { providerPaymentId: "pay_c", amountMinor: 49900, currencyCode: "INR", status: "captured", webhookVerified: true });
      await markRefereePaid(tx, referred.id);
      const [r2] = await tx.select().from(referralRewards).where(eq(referralRewards.referredAccountId, referred.id));
      expect(r2.earnedAt).toEqual(r1.earnedAt);
      expect(await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id))).toHaveLength(3);
    }));

  it("a later capture upgrades an authorisation and never a refund", () =>
    inTx(async (tx) => {
      const acc = await makeAccount(tx);
      const [sub] = await tx
        .insert(subscriptions)
        .values({ id: crypto.randomUUID(), accountId: acc.id, plan: "monthly", status: "pending", provider: "razorpay" })
        .returning();
      const rec = (id: string, status: string, wh = false) =>
        recordPayment(tx, sub, { providerPaymentId: id, amountMinor: 5, currencyCode: "INR", status, webhookVerified: wh });
      await rec("p1", "authorized");
      await rec("p1", "captured", true);
      const [p1] = await tx.select().from(payments).where(eq(payments.providerPaymentId, "p1"));
      expect(p1).toMatchObject({ status: "captured", webhookVerified: true });
      await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, p1.id));
      await rec("p1", "captured", true);
      expect((await tx.select().from(payments).where(eq(payments.id, p1.id)))[0].status).toBe("refunded");
    }));

  it("self-referral, unknown codes and repeats are ignored; a rejected referee voids", () =>
    inTx(async (tx) => {
      const referrer = await makeAccount(tx, "r");
      const referred = await makeAccount(tx, "d");
      const code = await getOrCreateCode(tx, referrer);
      expect(await attachReferral(tx, referrer, code)).toBe(false);
      expect(await attachReferral(tx, referred, "NOPE123")).toBe(false);
      expect(await attachReferral(tx, referred, null)).toBe(false);
      // Same email as the referrer (different case) is a self-referral too.
      expect(await attachReferral(tx, { ...referred, ownerEmail: referrer.ownerEmail.toUpperCase() }, code)).toBe(false);
      expect(await attachReferral(tx, referred, code)).toBe(true);
      const [stored] = await tx.select().from(accounts).where(eq(accounts.id, referred.id));
      expect(stored.referredByAccountId).toBe(referrer.id);
      expect(await attachReferral(tx, stored, code)).toBe(false);
      await voidReward(tx, referred.id);
      expect(await summary(tx, referrer.id)).toEqual({ pending: 0, earned: 0, applied: 0 });
    }));

  it("GET /api/app/referrals: stable code, link, discount and the referred list", () =>
    inTx(async (tx) => {
      await seedPlans(tx);
      const owner = await makeAccount(tx, "o");
      await makeOutlet(tx, owner);
      const session = await issueOwnerSession(tx, owner);
      const call = async () => (await getReferrals(makeRequest("/api/app/referrals", { session }), undefined as never)).json();
      const first = await call();
      expect(first).toMatchObject({ discount_percent: 70, pending: 0, earned: 0, applied: 0, referrals: [] });
      expect(first.link).toMatch(/\/signup\?ref=[2-9A-Z]{7}$/);
      expect((await call()).code).toBe(first.code);

      // A real signup using the code shows up as pending, by business name.
      await signup(signupPayload({ referral_code: ` ${first.code.toLowerCase()} `, business_name: "Referred Biz" }));
      const after = await call();
      expect(after.pending).toBe(1);
      expect(after.referrals).toMatchObject([{ business_name: "Referred Biz", status: "pending" }]);

      expect((await getReferrals(makeRequest("/api/app/referrals"), undefined as never)).status).toBe(401);
    }));
});

describe("owner billing (Python test_billing_api.py)", () => {
  it("locked owner sees credits, pays, and is unlocked", () =>
    inTx(async (tx) => {
      const amounts = await seedPlans(tx);
      const owner = await makeAccount(tx);
      const outlet = await makeOutlet(tx, owner, { state: "locked", trialFlowCount: 14, lockedAtFlowCount: 10, activatedAt: new Date() });
      const session = await issueOwnerSession(tx, owner);
      const get = () => getBillingStatus(makeRequest("/api/app/billing/status", { session }), undefined as never);

      const status = await (await get()).json();
      expect(status).toMatchObject({ state: "locked", credits_left: 6, can_pay: true, scans_waiting: 14, subscription_status: null, payments: [], referral_discounts_earned: 0 });
      expect(status.outlet_id).toBe(outlet.id);
      expect(status.annual_saving_minor).toBe(amounts.monthly * 12 - amounts.annual);

      const res = await postBillingCheckout(makeRequest("/api/app/billing/checkout", { session, body: { plan: "monthly" } }), undefined as never);
      expect(res.status).toBe(201);
      const co = await res.json();
      expect(co.checkout.trial_days).toBe(0);
      expect(co.checkout.prefill.name).toBe(owner.ownerName);

      const done = await postBillingConfirm(
        makeRequest("/api/app/billing/confirm", {
          session,
          body: { razorpay_payment_id: "pay_x", razorpay_signature: "mock-signature", razorpay_subscription_id: co.checkout.subscription_id },
        }),
        undefined as never,
      );
      expect(done.status).toBe(200);
      const after = await done.json();
      expect(after).toMatchObject({ state: "active", subscription_status: "active", plan: "monthly" });
      expect(after.current_period_end).toBeTruthy();
      expect(after.payments).toMatchObject([{ status: "authorized", currency_code: "INR" }]);
      const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, co.subscription_id));
      expect(sub.mandateStatus).toBe("active");

      // A second confirm has nothing pending: idempotent, no extra payment.
      const twice = await postBillingConfirm(
        makeRequest("/api/app/billing/confirm", { session, body: { razorpay_payment_id: "pay_x", razorpay_signature: "x" } }),
        undefined as never,
      );
      expect((await twice.json()).payments).toHaveLength(1);
    }));

  it("a forged signature does not unlock; unknown plans and unpayable states are refused", () =>
    inTx(async (tx) => {
      await seedPlans(tx);
      const owner = await makeAccount(tx);
      await makeOutlet(tx, owner, { state: "suspended" });
      const session = await issueOwnerSession(tx, owner);
      const post = (path: string, body: unknown) => (path.endsWith("checkout") ? postBillingCheckout : postBillingConfirm)(makeRequest(path, { session, body }), undefined as never);

      expect((await post("/api/app/billing/checkout", { plan: "annual" })).status).toBe(201);
      const bad = await post("/api/app/billing/confirm", { razorpay_payment_id: "pay_y", razorpay_signature: "forged" });
      expect(bad.status).toBe(400);
      expect((await bad.json()).detail.error.code).toBe("PAYMENT_SIGNATURE_INVALID");
      const status = await (await getBillingStatus(makeRequest("/api/app/billing/status", { session }), undefined as never)).json();
      expect(status).toMatchObject({ state: "suspended", credits_left: 0 });

      const plat = await post("/api/app/billing/checkout", { plan: "platinum" });
      expect(plat.status).toBe(400);
      expect((await plat.json()).detail.error.code).toBe("UNKNOWN_PLAN");

      // Mid-signup outlets cannot use the owner checkout.
      await tx.update(outlets).set({ state: "pending_approval" }).where(eq(outlets.accountId, owner.id));
      const np = await post("/api/app/billing/checkout", { plan: "monthly" });
      expect([np.status, (await np.json()).detail.error.code]).toEqual([409, "NOT_PAYABLE"]);
      expect((await postBillingCheckout(makeRequest("/api/app/billing/checkout", { body: { plan: "monthly" } }), undefined as never)).status).toBe(401);
    }));

  it("trial_days_left counts the current day", () =>
    inTx(async (tx) => {
      await seedPlans(tx);
      const owner = await makeAccount(tx);
      await makeOutlet(tx, owner, { state: "trial", activatedAt: new Date(Date.now() - 2 * 86_400_000 - 1000) });
      const session = await issueOwnerSession(tx, owner);
      const s = await (await getBillingStatus(makeRequest("/api/app/billing/status", { session }), undefined as never)).json();
      expect(s.trial_days_left).toBe(13); // 15 - 2 days elapsed, + 1 for the running day, floored
      expect(s.credits_left).toBeNull();
    }));
});

describe("Razorpay webhook", () => {
  async function fixture(tx: DbLike, outletState: string, sub: Partial<typeof subscriptions.$inferInsert> = {}) {
    const acc = await makeAccount(tx, "w");
    const outlet = await makeOutlet(tx, acc, { state: outletState });
    const [s] = await tx
      .insert(subscriptions)
      .values({ id: crypto.randomUUID(), accountId: acc.id, plan: "monthly", status: "pending", provider: "razorpay", razorpaySubscriptionId: `sub_${uid()}`, mandateStatus: "pending", ...sub })
      .returning();
    return { acc, outlet, sub: s };
  }
  const subEvent = (event: string, subId: string, payment?: Record<string, unknown>) => ({
    event,
    payload: { subscription: { entity: { id: subId } }, ...(payment ? { payment: { entity: payment } } : {}) },
  });

  it("rejects missing, wrong and body-mismatched signatures", () =>
    inTx(async (tx) => {
      const { sub } = await fixture(tx, "trial");
      const ev = subEvent("subscription.halted", sub.razorpaySubscriptionId!);
      for (const sig of ["", "deadbeef", hook("other-secret", JSON.stringify(ev))]) {
        const r = await webhook(ev, sig === "" ? "" : sig);
        expect(r.status).toBe(400);
        expect((await r.json()).detail.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
      }
      // A valid signature of a different body does not authorise this body.
      expect((await webhook(ev, hook("hook-secret", JSON.stringify({ ...ev, event: "x" })))).status).toBe(400);
      const [fresh] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(fresh.status).toBe("pending");
      expect((await webhook({ event: "something.new", payload: {} })).status).toBe(200); // unknown events are ignored
    }));

  it("subscription.charged is idempotent and moves a live outlet to active", () =>
    inTx(async (tx) => {
      const { acc, outlet, sub } = await fixture(tx, "locked");
      const referrer = await makeAccount(tx, "ref");
      await attachReferral(tx, acc, await getOrCreateCode(tx, referrer));
      const ev = subEvent("subscription.charged", sub.razorpaySubscriptionId!, { id: "pay_w1", amount: 49900, currency: "INR" });
      for (let i = 0; i < 3; i++) expect(await (await webhook(ev)).json()).toEqual({ status: "ok" });

      const rows = await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ providerPaymentId: "pay_w1", amountMinor: 49900, status: "captured", webhookVerified: true });
      const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(s.status).toBe("active");
      expect(s.graceUntil).toBeNull();
      expect(s.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("active");
      // First captured payment of a referred business earns the referrer's 70%.
      expect((await summary(tx, referrer.id)).earned).toBe(1);
    }));

  it("a paid signup still waits for approval; order.paid is how one-time signups arrive", () =>
    inTx(async (tx) => {
      const { outlet, sub } = await fixture(tx, "pending_payment", { razorpaySubscriptionId: null, razorpayOrderId: `order_${uid()}`, mandateStatus: "not_applicable" });
      const ev = { event: "order.paid", payload: { payment: { entity: { id: "pay_o1", order_id: sub.razorpayOrderId, amount: 449900, currency: "INR" } } } };
      await webhook(ev);
      await webhook(ev);
      const [o] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(o.state).toBe("pending_approval"); // never straight to a live state (SRS-19)
      expect(o.submittedAt).toBeTruthy();
      const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(s.status).toBe("active");
      expect(s.currentPeriodEnd).toBeTruthy();
      expect(await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id))).toHaveLength(1);
    }));

  it("mandate authenticated -> approval queue; activated at trial end -> active", () =>
    inTx(async (tx) => {
      const { outlet, sub } = await fixture(tx, "pending_payment");
      await webhook(subEvent("subscription.authenticated", sub.razorpaySubscriptionId!));
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("pending_approval");
      expect((await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)))[0].mandateStatus).toBe("active");
      await tx.update(outlets).set({ state: "trial" }).where(eq(outlets.id, outlet.id));
      await webhook(subEvent("subscription.activated", sub.razorpaySubscriptionId!));
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("active");
      expect((await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)))[0].status).toBe("active");
    }));

  it("payment.failed starts the 7-day grace and notifies once; halted suspends; cancelled keeps access", () =>
    inTx(async (tx) => {
      const { acc, outlet, sub } = await fixture(tx, "active", { status: "active" });
      const failed = subEvent("payment.failed", "ignored", { id: "pay_f1", subscription_id: sub.razorpaySubscriptionId, amount: 49900, currency: "INR" });
      await webhook(failed);
      await webhook(failed);
      const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(s.status).toBe("past_due");
      const days = (s.graceUntil!.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.9);
      expect(days).toBeLessThanOrEqual(7);
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("past_due");
      const mails = await tx.select().from(notifications).where(and(eq(notifications.accountId, acc.id), eq(notifications.template, "payment_failed"), eq(notifications.channel, "email")));
      expect(mails).toHaveLength(1);
      const [fp] = await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id));
      expect(fp).toMatchObject({ status: "failed", providerPaymentId: "pay_f1" });
      // The failed payment never earns a referral reward or unlocks anything.

      await webhook(subEvent("subscription.cancelled", sub.razorpaySubscriptionId!));
      expect((await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)))[0].cancelledAt).toBeTruthy();
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("past_due");

      await webhook(subEvent("subscription.halted", sub.razorpaySubscriptionId!));
      expect((await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)))[0].status).toBe("cancelled");
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("suspended");
    }));

  it("events for unknown subscriptions are ignored; a charge without a payment id records no payment row", () =>
    inTx(async (tx) => {
      const { outlet, sub } = await fixture(tx, "trial");
      await webhook(subEvent("subscription.charged", "sub_unknown", { id: "pay_zz", amount: 1, currency: "INR" }));
      await webhook(subEvent("subscription.charged", sub.razorpaySubscriptionId!, { amount: 1 })); // no payment id: no row
      expect(await tx.select().from(payments).where(eq(payments.subscriptionId, sub.id))).toHaveLength(0);
      expect((await tx.select().from(outlets).where(eq(outlets.id, outlet.id)))[0].state).toBe("active");
    }));
});

describe("growth services and print kit (Python test_growth_api.py, owner side)", () => {
  async function setup(tx: DbLike) {
    const owner = await makeAccount(tx, "g");
    const outlet = await makeOutlet(tx, owner);
    const key = `t_${uid()}`;
    const [svc] = await tx
      .insert(serviceCatalog)
      .values({ id: crypto.randomUUID(), key, name: "Website", tagline: "t", questions: [], deliverables: [], descriptionMd: "", active: true, sortOrder: -1000 })
      .returning();
    const session = await issueOwnerSession(tx, owner);
    const call = (fn: (r: Request, c: never) => Promise<Response>, path: string, body?: unknown, params?: Record<string, string>) =>
      fn(makeRequest(path, { session, body }), (params ? routeCtx(params) : undefined) as never);
    const post = (fn: (r: Request, c: never) => Promise<Response>, path: string, params?: Record<string, string>) =>
      fn(makeRequest(path, { session, method: "POST" }), (params ? routeCtx(params) : undefined) as never);
    return { owner, outlet, key, svc, session, call, post };
  }

  it("request -> quote -> accept; duplicates, privacy of internal notes, late cancel", () =>
    inTx(async (tx) => {
      const { svc, key, call, post } = await setup(tx);
      expect((await (await call(getServices as never, "/api/app/services")).json()).items[0]).toMatchObject({ key, name: "Website", lead_time_days: null });

      const r = await call(postRequest, "/api/app/service-requests", { service_key: key, brief: "  Need a site ", answers: { domain: "No", ["k".repeat(50)]: "v".repeat(600) } });
      expect(r.status).toBe(201);
      const created = await r.json();
      expect(created).toMatchObject({ status: "requested", brief: "Need a site", paid: false, service_key: key, currency_code: "INR", quoted_amount_minor: null });
      expect(Object.keys(created.answers)).toEqual(["domain", "k".repeat(40)]);
      expect(created.answers["k".repeat(40)]).toHaveLength(500);
      expect(created.events).toMatchObject([{ kind: "status_changed", body: "Request received", actor: "owner" }]);
      const rid = created.id as string;

      const dup = await call(postRequest, "/api/app/service-requests", { service_key: key });
      expect(dup.status).toBe(409);
      expect((await dup.json()).detail.error).toMatchObject({ code: "ALREADY_REQUESTED", id: rid });
      expect((await call(postRequest, "/api/app/service-requests", { service_key: "nope" })).status).toBe(404);

      // Admin side (still FastAPI): quote with an internal note and a visible message.
      await tx.update(serviceRequests).set({ status: "quoted", quotedAmountMinor: 1_500_000 }).where(eq(serviceRequests.id, rid));
      await tx.insert(serviceRequestEvents).values([
        { id: crypto.randomUUID(), requestId: rid, kind: "note", body: "margin is thin", actor: "admin" },
        { id: crypto.randomUUID(), requestId: rid, kind: "message", body: "Here is your quote", actor: "admin" },
      ]);
      const mine = await (await call(getMyRequest, `/api/app/service-requests/${rid}`, undefined, { request_id: rid })).json();
      expect(mine).toMatchObject({ status: "quoted", quoted_amount_minor: 1_500_000 });
      expect(mine.events.every((e: { kind: string }) => e.kind !== "note")).toBe(true); // internal note stays private
      expect(mine.events.some((e: { kind: string }) => e.kind === "message")).toBe(true);
      expect((await (await call(listMyRequests, "/api/app/service-requests")).json()).items.map((i: { id: string }) => i.id)).toContain(rid);

      const msg = await call(postMessage, `/api/app/service-requests/${rid}/messages`, { body: " hello " }, { request_id: rid });
      expect(msg.status).toBe(201);
      expect((await msg.json()).events.at(-1)).toMatchObject({ kind: "message", body: "hello", actor: "owner" });
      expect((await call(postMessage, `/api/app/service-requests/${rid}/messages`, { body: "" }, { request_id: rid })).status).toBe(422);

      expect((await (await post(postAccept, `/api/app/service-requests/${rid}/accept`, { request_id: rid })).json()).status).toBe("accepted");
      expect((await post(postAccept, `/api/app/service-requests/${rid}/accept`, { request_id: rid })).status).toBe(409);
      const late = await post(postCancel, `/api/app/service-requests/${rid}/cancel`, { request_id: rid });
      expect([late.status, (await late.json()).detail.error.code]).toEqual([409, "CANNOT_CANCEL"]);

      // Another owner can neither see nor touch it.
      const other = await makeAccount(tx, "x");
      await makeOutlet(tx, other);
      const otherSession = await issueOwnerSession(tx, other);
      const peek = await getMyRequest(makeRequest(`/api/app/service-requests/${rid}`, { session: otherSession }), routeCtx({ request_id: rid }));
      expect(peek.status).toBe(404);
      expect(svc.id).toBeTruthy();
    }));

  it("quote payment uses our amount, verifies the signature, and marks paid once", () =>
    inTx(async (tx) => {
      const { key, call, post } = await setup(tx);
      const rid = (await (await call(postRequest, "/api/app/service-requests", { service_key: key })).json()).id as string;
      const pay = () => post(postPayRequest, `/api/app/service-requests/${rid}/pay`, { request_id: rid });
      expect((await pay()).status).toBe(409); // not accepted yet
      await tx.update(serviceRequests).set({ status: "accepted", quotedAmountMinor: 500_000 }).where(eq(serviceRequests.id, rid));

      const start = await pay();
      expect(start.status).toBe(200);
      const info = await start.json();
      expect(info).toMatchObject({ provider: "mock", amount_minor: 500_000, currency_code: "INR", trial_days: 0, subscription_id: null });
      expect(info.order_id).toMatch(/^order_mock_/);

      const confirm = (order: string, signature: string) =>
        call(postPayRequestConfirm, `/api/app/service-requests/${rid}/pay/confirm`, { razorpay_payment_id: "mock", razorpay_order_id: order, razorpay_signature: signature }, { request_id: rid });
      expect((await confirm(info.order_id, "wrong")).status).toBe(400); // signature must verify
      expect((await confirm("order_nope", "mock-signature")).status).toBe(404);
      const ok = await confirm(info.order_id, "mock-signature");
      expect(ok.status).toBe(200);
      const paid = await ok.json();
      expect(paid.paid).toBe(true);
      expect(paid.events.filter((e: { body: string }) => e.body === "Payment received")).toHaveLength(1);
      await confirm(info.order_id, "mock-signature"); // double submit is not an error...
      const again = await (await call(getMyRequest, `/api/app/service-requests/${rid}`, undefined, { request_id: rid })).json();
      expect(again.events.filter((e: { body: string }) => e.body === "Payment received")).toHaveLength(1); // ...nor a second event
      expect((await pay()).status).toBe(409); // already paid
      const [row] = await tx.select().from(schema.servicePayments).where(eq(schema.servicePayments.providerOrderId, info.order_id));
      expect(row).toMatchObject({ status: "paid", providerPaymentId: null, amountMinor: 500_000 });
    }));

  it("a quote of zero has nothing to pay", () =>
    inTx(async (tx) => {
      const { key, call, post } = await setup(tx);
      const rid = (await (await call(postRequest, "/api/app/service-requests", { service_key: key })).json()).id as string;
      await tx.update(serviceRequests).set({ status: "accepted" }).where(eq(serviceRequests.id, rid));
      const r = await post(postPayRequest, `/api/app/service-requests/${rid}/pay`, { request_id: rid });
      expect([r.status, (await r.json()).detail.error.code]).toEqual([409, "NOTHING_TO_PAY"]);
    }));

  it("print kit: delivery needs an address and charges the flat fee; payment marks it paid", () =>
    inTx(async (tx) => {
      const { call, post } = await setup(tx);
      const noAddr = await call(postPrintKit, "/api/app/print-kit", { method: "deliver" });
      expect([noAddr.status, (await noAddr.json()).detail.error.code]).toEqual([422, "ADDRESS_REQUIRED"]);
      expect((await call(postPrintKit, "/api/app/print-kit", { method: "courier" })).status).toBe(422);

      const r = await call(postPrintKit, "/api/app/print-kit", { method: "deliver", address: " 12 MG Road ", phone: "9876543210" });
      expect(r.status).toBe(201);
      const kit = await r.json();
      expect(kit).toMatchObject({ fee_minor: 19_900, status: "requested", address: "12 MG Road", currency_code: "INR" });
      const own = await (await call(postPrintKit, "/api/app/print-kit", { method: "self_print" })).json();
      expect(own).toMatchObject({ fee_minor: 0, status: "delivered", address: null });
      expect((await post(postPayKit, `/api/app/print-kit/${own.id}/pay`, { kit_id: own.id })).status).toBe(409);

      const info = await (await call(getPrintKit, "/api/app/print-kit")).json();
      expect(info).toMatchObject({ delivery_fee_minor: 19_900, currency_code: "INR" });
      expect(info.orders).toHaveLength(2);

      const start = await (await post(postPayKit, `/api/app/print-kit/${kit.id}/pay`, { kit_id: kit.id })).json();
      expect(start.amount_minor).toBe(19_900);
      const confirm = (signature: string) =>
        call(postPayKitConfirm, `/api/app/print-kit/${kit.id}/pay/confirm`, { razorpay_payment_id: "mock", razorpay_order_id: start.order_id, razorpay_signature: signature }, { kit_id: kit.id });
      expect((await confirm("wrong")).status).toBe(400);
      expect((await (await confirm("mock-signature")).json()).status).toBe("paid");
      expect((await post(postPayKit, `/api/app/print-kit/${kit.id}/pay`, { kit_id: kit.id })).status).toBe(409); // no longer 'requested'
      // Someone else's kit is a 404.
      const other = await makeAccount(tx, "k");
      await makeOutlet(tx, other);
      const s2 = await issueOwnerSession(tx, other);
      expect((await postPayKit(makeRequest(`/api/app/print-kit/${kit.id}/pay`, { session: s2, method: "POST" }), routeCtx({ kit_id: kit.id }))).status).toBe(404);
    }));
});
