/**
 * Opens the payment step for a signup and resolves with what the backend's
 * /api/signup/{id}/confirm needs. Razorpay Checkout in real environments; a
 * local-only simulated authorisation when the backend returns provider "mock"
 * (no gateway keys configured in local dev).
 */

import type { CheckoutInfo } from "@/lib/signup/api";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

export interface CheckoutResult {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
}

export class CheckoutCancelled extends Error {
  constructor() {
    super("CHECKOUT_CANCELLED");
  }
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PAYMENT_UNAVAILABLE"));
    document.body.appendChild(script);
  });
}

export async function runCheckout(
  checkout: CheckoutInfo,
  businessName: string
): Promise<CheckoutResult> {
  if (checkout.provider === "mock") {
    // Local dev only — the backend refuses the mock outside ENVIRONMENT=local.
    const ok = window.confirm(
      "Local development: no payment gateway is configured.\n\nSimulate a successful payment authorisation?"
    );
    if (!ok) throw new CheckoutCancelled();
    return {
      razorpay_payment_id: "mock",
      razorpay_signature: "mock-signature",
      razorpay_subscription_id: checkout.subscription_id ?? undefined,
      razorpay_order_id: checkout.order_id ?? undefined,
    };
  }

  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay || !checkout.key_id) throw new Error("PAYMENT_UNAVAILABLE");

  return new Promise<CheckoutResult>((resolve, reject) => {
    const rzp = new Razorpay({
      key: checkout.key_id,
      name: "Revyu",
      description:
        checkout.mode === "mandate"
          ? `Authorise payment · first charge after your ${checkout.trial_days}-day trial`
          : `Revyu for ${businessName}`,
      ...(checkout.subscription_id
        ? { subscription_id: checkout.subscription_id }
        : { order_id: checkout.order_id, amount: checkout.amount_minor, currency: checkout.currency_code }),
      prefill: checkout.prefill ?? undefined,
      theme: { color: "#2f6df0" },
      handler: (resp: CheckoutResult) => resolve(resp),
      modal: { ondismiss: () => reject(new CheckoutCancelled()) },
    });
    rzp.on("payment.failed", () => {
      // Razorpay keeps its modal open for a retry; only a dismiss rejects.
    });
    rzp.open();
  });
}
