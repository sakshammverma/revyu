/**
 * Payment providers. Port of backend/app/services/payments/* (base,
 * mock_provider, razorpay_provider, get_provider/get_provider_by_name).
 *
 * Billing model at signup (SRS-18.6, OD-21): the owner authorises payment at
 * signup, before approval, and the first charge lands when the 15-day trial
 * ends. So the default checkout is a subscription (mandate) whose start is
 * deferred by the trial; the one-time order is the C-4 fallback when a mandate
 * cannot be created, and is charged immediately (refundable on rejection).
 *
 * Razorpay is reached over REST with fetch, exactly as the Python does. All
 * signature checks are HMAC-SHA256 compared in constant time.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/server/env";

export const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
export const MOCK_SIGNATURE = "mock-signature";

/** Upper bound on billing cycles; Razorpay requires a finite count. */
const TOTAL_COUNT: Record<string, number> = { monthly: 120, annual: 10 };

export class PaymentProviderUnavailableError extends Error {}

export interface CheckoutIntent {
  provider: string;
  mode: "mandate" | "one_time" | "mock";
  amountMinor: number;
  currencyCode: string;
  keyId: string | null;
  providerOrderId: string | null;
  providerSubscriptionId: string | null;
}

export interface CreateCheckoutArgs {
  planCode: string;
  amountMinor: number;
  currencyCode: string;
  customerEmail: string;
  trialDays: number;
}

export interface CreateOrderArgs {
  amountMinor: number;
  currencyCode: string;
  customerEmail: string;
}

export interface VerifyCheckoutArgs {
  paymentId: string;
  signature: string;
  subscriptionId?: string | null;
  orderId?: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(args: CreateCheckoutArgs): Promise<CheckoutIntent>;
  createOrder(args: CreateOrderArgs): Promise<CheckoutIntent>;
  verifyCheckoutSignature(args: VerifyCheckoutArgs): boolean;
  verifyWebhookSignature(payload: Uint8Array, signature: string): boolean;
  cancelSubscription(subscriptionId: string): Promise<void>;
  refundPayment(paymentId: string): Promise<void>;
}

/** Constant-time hex digest comparison; differing lengths are simply unequal. */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const hmacHex = (secret: string, message: string | Uint8Array) =>
  createHmac("sha256", secret).update(message).digest("hex");

/* ---------------------------------------------------------------- mock */

function assertLocal(): void {
  if (getEnv().environment !== "local") throw new Error("MockPaymentProvider is local-only");
}

const hex12 = () => crypto.randomUUID().replaceAll("-", "").slice(0, 12);

/**
 * Local-only stand-in for Razorpay so signup -> approval can run end to end
 * without gateway keys. Every method refuses outside local.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createCheckout(args: CreateCheckoutArgs): Promise<CheckoutIntent> {
    assertLocal();
    return {
      provider: this.name,
      mode: "mock",
      amountMinor: args.amountMinor,
      currencyCode: args.currencyCode,
      keyId: null,
      providerOrderId: null,
      providerSubscriptionId: `sub_mock_${hex12()}`,
    };
  }

  async createOrder(args: CreateOrderArgs): Promise<CheckoutIntent> {
    assertLocal();
    return {
      provider: this.name,
      mode: "mock",
      amountMinor: args.amountMinor,
      currencyCode: args.currencyCode,
      keyId: null,
      providerOrderId: `order_mock_${hex12()}`,
      providerSubscriptionId: null,
    };
  }

  verifyCheckoutSignature(args: VerifyCheckoutArgs): boolean {
    assertLocal();
    return args.signature === MOCK_SIGNATURE;
  }

  verifyWebhookSignature(): boolean {
    return false; // webhooks are never mocked
  }

  async cancelSubscription(): Promise<void> {
    assertLocal();
  }

  async refundPayment(): Promise<void> {
    assertLocal();
  }
}

/* ------------------------------------------------------------ razorpay */

export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly planIds: Record<string, string>;

  constructor() {
    const env = getEnv();
    this.keyId = env.razorpayKeyId;
    this.keySecret = env.razorpayKeySecret;
    this.webhookSecret = env.razorpayWebhookSecret;
    this.planIds = { monthly: env.razorpayPlanIdMonthly, annual: env.razorpayPlanIdAnnual };
  }

  get configured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  private async post(path: string, json: unknown, failure: string): Promise<Record<string, unknown>> {
    try {
      const resp = await fetch(RAZORPAY_API_BASE + path, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(json),
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as Record<string, unknown>;
    } catch (err) {
      throw new PaymentProviderUnavailableError(`${failure}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async createCheckout(args: CreateCheckoutArgs): Promise<CheckoutIntent> {
    if (!this.configured) throw new PaymentProviderUnavailableError("Razorpay keys are not configured");
    try {
      return await this.createMandate(args);
    } catch (err) {
      if (!(err instanceof PaymentProviderUnavailableError)) throw err;
      // C-4 / SRS-12.3: mandates fail on some banks and UPI apps. Offer the
      // same plan as a one-time payment rather than losing the signup.
      return this.createOrderIntent(args.amountMinor, args.currencyCode, args.customerEmail);
    }
  }

  private async createMandate(args: CreateCheckoutArgs): Promise<CheckoutIntent> {
    const planId = this.planIds[args.planCode];
    if (!planId) throw new PaymentProviderUnavailableError(`No Razorpay plan id configured for '${args.planCode}'`);
    const data = await this.post(
      "/subscriptions",
      {
        plan_id: planId,
        customer_notify: 1,
        total_count: TOTAL_COUNT[args.planCode] ?? 120,
        // First charge after the trial: nothing is charged today beyond the
        // gateway's mandate authorisation.
        start_at: Math.floor(Date.now() / 1000) + args.trialDays * 24 * 60 * 60,
        notes: { email: args.customerEmail, plan: args.planCode },
      },
      "Mandate creation failed",
    );
    return {
      provider: this.name,
      mode: "mandate",
      amountMinor: args.amountMinor,
      currencyCode: args.currencyCode,
      keyId: this.keyId,
      providerOrderId: null,
      providerSubscriptionId: (data.id as string | undefined) ?? null,
    };
  }

  async createOrder(args: CreateOrderArgs): Promise<CheckoutIntent> {
    if (!this.configured) throw new PaymentProviderUnavailableError("Razorpay keys are not configured");
    return this.createOrderIntent(args.amountMinor, args.currencyCode, args.customerEmail);
  }

  private async createOrderIntent(amountMinor: number, currencyCode: string, email: string): Promise<CheckoutIntent> {
    const data = await this.post(
      "/orders",
      { amount: amountMinor, currency: currencyCode, notes: { email } },
      "Order creation failed",
    );
    return {
      provider: this.name,
      mode: "one_time",
      amountMinor,
      currencyCode,
      keyId: this.keyId,
      providerOrderId: (data.id as string | undefined) ?? null,
      providerSubscriptionId: null,
    };
  }

  verifyCheckoutSignature({ paymentId, signature, subscriptionId, orderId }: VerifyCheckoutArgs): boolean {
    if (!this.keySecret) return false;
    // Razorpay's documented formats: subscriptions sign
    // "payment_id|subscription_id"; orders sign "order_id|payment_id".
    let message: string;
    if (subscriptionId) message = `${paymentId}|${subscriptionId}`;
    else if (orderId) message = `${orderId}|${paymentId}`;
    else return false;
    return safeEqual(hmacHex(this.keySecret, message), signature);
  }

  verifyWebhookSignature(payload: Uint8Array, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqual(hmacHex(this.webhookSecret, payload), signature);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.post(`/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 0 }, "Cancel failed");
  }

  async refundPayment(paymentId: string): Promise<void> {
    await this.post(`/payments/${paymentId}/refund`, {}, "Refund failed");
  }
}

/* ------------------------------------------------------------- factory */

/**
 * Selected by outlet country (documents/17-GLOBAL-READY.md section 2.5); only
 * India is live in v1. Local dev without gateway keys gets the mock so signup
 * can be exercised end to end; any other environment gets the real provider
 * and fails loudly (503 PAYMENT_UNAVAILABLE) if it isn't configured.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only India is live; the argument is the seam for other markets
export function getProvider(_countryCode: string): PaymentProvider {
  const provider = new RazorpayProvider();
  if (getEnv().environment === "local" && !provider.configured) return new MockPaymentProvider();
  return provider;
}

/** For follow-up actions (refund/cancel) on an existing subscription. */
export function getProviderByName(name: string): PaymentProvider {
  return name === "mock" ? new MockPaymentProvider() : new RazorpayProvider();
}
