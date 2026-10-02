import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

const envOverride = vi.hoisted(() => ({ v: {} as Record<string, unknown> }));
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return { ...actual, getEnv: () => ({ ...actual.getEnv(), ...envOverride.v }) };
});

import {
  getProvider,
  getProviderByName,
  MockPaymentProvider,
  PaymentProviderUnavailableError,
  RazorpayProvider,
} from "./payments";

const KEYS = { razorpayKeyId: "rzp_test_x", razorpayKeySecret: "key-secret", razorpayWebhookSecret: "hook-secret" };
const hmac = (secret: string, msg: string | Uint8Array) => createHmac("sha256", secret).update(msg).digest("hex");

afterEach(() => {
  envOverride.v = {};
  vi.unstubAllGlobals();
});

describe("provider selection", () => {
  it("local without keys uses the mock; with keys uses Razorpay", () => {
    envOverride.v = { environment: "local", razorpayKeyId: "", razorpayKeySecret: "" };
    expect(getProvider("IN")).toBeInstanceOf(MockPaymentProvider);
    envOverride.v = { environment: "local", ...KEYS };
    expect(getProvider("IN")).toBeInstanceOf(RazorpayProvider);
  });

  it("outside local there is never a mock: Razorpay, unconfigured, fails loudly", async () => {
    envOverride.v = { environment: "staging", razorpayKeyId: "", razorpayKeySecret: "" };
    const provider = getProvider("IN");
    expect(provider).toBeInstanceOf(RazorpayProvider);
    await expect(
      provider.createCheckout({ planCode: "monthly", amountMinor: 1, currencyCode: "INR", customerEmail: "a@b.c", trialDays: 15 }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
    // ...and the mock refuses to run at all outside local.
    envOverride.v = { environment: "production" };
    await expect(new MockPaymentProvider().createOrder({ amountMinor: 1, currencyCode: "INR", customerEmail: "a@b.c" })).rejects.toThrow(
      /local-only/,
    );
    expect(getProviderByName("mock")).toBeInstanceOf(MockPaymentProvider);
    expect(getProviderByName("razorpay")).toBeInstanceOf(RazorpayProvider);
  });
});

describe("mock provider (local)", () => {
  const mock = new MockPaymentProvider();
  it("checkout shape and signature", async () => {
    const c = await mock.createCheckout({ planCode: "monthly", amountMinor: 49900, currencyCode: "INR", customerEmail: "a@b.c", trialDays: 15 });
    expect(c).toMatchObject({ provider: "mock", mode: "mock", amountMinor: 49900, keyId: null, providerOrderId: null });
    expect(c.providerSubscriptionId).toMatch(/^sub_mock_[0-9a-f]{12}$/);
    const o = await mock.createOrder({ amountMinor: 100, currencyCode: "INR", customerEmail: "a@b.c" });
    expect(o.providerOrderId).toMatch(/^order_mock_[0-9a-f]{12}$/);
    expect(mock.verifyCheckoutSignature({ paymentId: "p", signature: "mock-signature" })).toBe(true);
    expect(mock.verifyCheckoutSignature({ paymentId: "p", signature: "forged" })).toBe(false);
    expect(mock.verifyWebhookSignature()).toBe(false); // webhooks are never mocked
  });
});

describe("Razorpay signatures", () => {
  it("verifies the documented subscription and order formats and rejects forgeries", () => {
    envOverride.v = KEYS;
    const p = new RazorpayProvider();
    const sub = hmac("key-secret", "pay_1|sub_1");
    expect(p.verifyCheckoutSignature({ paymentId: "pay_1", signature: sub, subscriptionId: "sub_1" })).toBe(true);
    expect(p.verifyCheckoutSignature({ paymentId: "pay_2", signature: sub, subscriptionId: "sub_1" })).toBe(false);
    const order = hmac("key-secret", "order_1|pay_1");
    expect(p.verifyCheckoutSignature({ paymentId: "pay_1", signature: order, orderId: "order_1" })).toBe(true);
    // The order format must not validate against a subscription id and vice versa.
    expect(p.verifyCheckoutSignature({ paymentId: "pay_1", signature: order, subscriptionId: "order_1" })).toBe(false);
    expect(p.verifyCheckoutSignature({ paymentId: "pay_1", signature: "", orderId: "order_1" })).toBe(false);
    expect(p.verifyCheckoutSignature({ paymentId: "pay_1", signature: "short", orderId: "order_1" })).toBe(false);
    expect(p.verifyCheckoutSignature({ paymentId: "pay_1", signature: order })).toBe(false); // no ids at all
  });

  it("no key secret means nothing verifies", () => {
    envOverride.v = { razorpayKeySecret: "", razorpayWebhookSecret: "" };
    const p = new RazorpayProvider();
    expect(p.verifyCheckoutSignature({ paymentId: "p", signature: hmac("", "p|s"), subscriptionId: "s" })).toBe(false);
    expect(p.verifyWebhookSignature(Buffer.from("{}"), hmac("", "{}"))).toBe(false);
  });

  it("webhook signature is over the exact raw bytes", () => {
    envOverride.v = KEYS;
    const p = new RazorpayProvider();
    const body = Buffer.from('{"event":"order.paid"}');
    expect(p.verifyWebhookSignature(body, hmac("hook-secret", body))).toBe(true);
    expect(p.verifyWebhookSignature(Buffer.from('{"event": "order.paid"}'), hmac("hook-secret", body))).toBe(false);
    expect(p.verifyWebhookSignature(body, hmac("key-secret", body))).toBe(false);
  });
});

describe("Razorpay REST", () => {
  const args = { planCode: "monthly", amountMinor: 49900, currencyCode: "INR", customerEmail: "o@x.in", trialDays: 15 };

  it("creates a deferred-start mandate with basic auth", async () => {
    envOverride.v = { ...KEYS, razorpayPlanIdMonthly: "plan_m" };
    const fetchMock = vi.fn(async () => Response.json({ id: "sub_real" }));
    vi.stubGlobal("fetch", fetchMock);
    const before = Math.floor(Date.now() / 1000);
    const intent = await new RazorpayProvider().createCheckout(args);
    expect(intent).toMatchObject({ mode: "mandate", providerSubscriptionId: "sub_real", providerOrderId: null, keyId: "rzp_test_x" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Basic " + Buffer.from("rzp_test_x:key-secret").toString("base64"),
    );
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({ plan_id: "plan_m", total_count: 120, customer_notify: 1 });
    expect(sent.start_at).toBeGreaterThanOrEqual(before + 15 * 86400);
  });

  it("C-4: falls back to a one-time order when the mandate cannot be created", async () => {
    envOverride.v = { ...KEYS, razorpayPlanIdMonthly: "plan_m" };
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/subscriptions") ? new Response("nope", { status: 400 }) : Response.json({ id: "order_9" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const intent = await new RazorpayProvider().createCheckout(args);
    expect(intent).toMatchObject({ mode: "one_time", providerOrderId: "order_9", providerSubscriptionId: null, amountMinor: 49900 });
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({
      amount: 49900,
      currency: "INR",
    });
  });

  it("no plan id configured also falls back; both failing is PAYMENT_UNAVAILABLE", async () => {
    envOverride.v = { ...KEYS, razorpayPlanIdMonthly: "" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "order_x" })));
    expect((await new RazorpayProvider().createCheckout(args)).mode).toBe("one_time");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
    await expect(new RazorpayProvider().createCheckout(args)).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
  });

  it("refund and cancel hit the documented endpoints and surface gateway errors", async () => {
    envOverride.v = KEYS;
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    const p = new RazorpayProvider();
    await p.refundPayment("pay_1");
    await p.cancelSubscription("sub_1");
    expect((fetchMock.mock.calls as unknown as [string][]).map((c) => c[0])).toEqual([
      "https://api.razorpay.com/v1/payments/pay_1/refund",
      "https://api.razorpay.com/v1/subscriptions/sub_1/cancel",
    ]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    await expect(p.refundPayment("pay_1")).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
  });
});
