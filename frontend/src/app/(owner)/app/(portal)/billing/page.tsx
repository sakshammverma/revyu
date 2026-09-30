"use client";

import { useState } from "react";

import { useOwner } from "@/components/portal/OwnerContext";
import { Button, Card, EmptyState, StatusPill, useToast } from "@/components/ui";
import { confirmBilling, createBillingCheckout, type BillingStatus } from "@/lib/dashboard/api";
import { formatDate, formatMoney } from "@/lib/format";
import { CheckoutCancelled, runCheckout } from "@/lib/signup/checkout";

const PAYMENT_TONE = { captured: "success", refunded: "neutral", failed: "alert", authorized: "info" } as const;

export default function BillingPage() {
  const { billing, outlet, refresh } = useOwner();
  const { toast } = useToast();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  if (!billing) {
    return (
      <Card title="Billing">
        <EmptyState title="Billing isn't available right now" body="Please refresh in a moment. Your QR code keeps working." />
      </Card>
    );
  }

  async function pay(plan: string) {
    if (!billing) return;
    setBusyPlan(plan);
    try {
      const { checkout } = await createBillingCheckout(plan);
      const result = await runCheckout(checkout, outlet.business_name);
      await confirmBilling(result);
      await refresh();
      toast("Payment received. You're all set.");
    } catch (e) {
      if (!(e instanceof CheckoutCancelled)) {
        toast("We couldn't complete the payment. You haven't been charged twice. Please try again.", { tone: "error" });
      }
    } finally {
      setBusyPlan(null);
    }
  }

  const monthly = billing.plans.find((p) => p.code === "monthly");
  const annual = billing.plans.find((p) => p.code === "annual");
  const isPaid = billing.subscription_status === "active" && outlet.state === "active";

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Billing</h1>
        <p className="text-sm text-text-2 mt-1">One flat price. No contracts, no hidden fees.</p>
      </div>

      <StatusCard billing={billing} isPaid={isPaid} />

      {billing.referral_discounts_earned > 0 && (
        <div className="rounded-xl border border-success/25 bg-success-50 p-4 text-sm">
          <p className="font-semibold text-[#2f6b1a]">
            You&rsquo;ve earned {billing.referral_discounts_earned} referral {billing.referral_discounts_earned === 1 ? "discount" : "discounts"}: 70% off your next bill.
          </p>
          <p className="text-text-2 mt-0.5">We apply it to your next invoice. You don&rsquo;t need to do anything.</p>
        </div>
      )}

      {billing.can_pay && (
        <Card title={isPaid ? "Switch or renew" : "Choose your plan"}>
          <div className="grid gap-3 sm:grid-cols-2">
            {monthly && (
              <PlanCard
                name="Monthly"
                price={formatMoney(monthly.amount_minor, monthly.currency_code)}
                unit="/month"
                note="Pay with UPI AutoPay. Cancel anytime."
                loading={busyPlan === "monthly"}
                disabled={busyPlan !== null}
                onPick={() => pay("monthly")}
              />
            )}
            {annual && (
              <PlanCard
                highlight
                badge={billing.annual_saving_minor > 0 ? `Save ${formatMoney(billing.annual_saving_minor, annual.currency_code)}` : undefined}
                name="Annual"
                price={formatMoney(annual.amount_minor, annual.currency_code)}
                unit="/year"
                note={`About ${formatMoney(Math.round(annual.amount_minor / 12), annual.currency_code)}/month. One payment.`}
                loading={busyPlan === "annual"}
                disabled={busyPlan !== null}
                onPick={() => pay("annual")}
              />
            )}
          </div>
          <p className="text-xs text-text-2 mt-4">
            Payments are processed securely by Razorpay. Your QR code stays the same whichever plan you pick.
          </p>
        </Card>
      )}

      <Card title="Payment history">
        {billing.payments.length === 0 ? (
          <EmptyState title="No payments yet" body="Your first charge appears here after your free trial." />
        ) : (
          <ul className="divide-y divide-line">
            {billing.payments.map((p, i) => (
              <li key={i} className="py-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-text-2 tabular-nums">{formatDate(p.created_at)}</span>
                <span className="font-semibold text-ink tabular-nums">{formatMoney(p.amount_minor, p.currency_code)}</span>
                <StatusPill tone={PAYMENT_TONE[p.status as keyof typeof PAYMENT_TONE] ?? "neutral"}>{p.status}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function StatusCard({ billing, isPaid }: { billing: BillingStatus; isPaid: boolean }) {
  let title: string;
  let body: string;
  if (isPaid) {
    title = `Subscribed${billing.plan ? ` · ${billing.plan}` : ""}`;
    body = billing.current_period_end ? `Renews on ${formatDate(billing.current_period_end)}.` : "Your subscription is active.";
  } else if (billing.state === "trial") {
    title = `Free trial · ${billing.trial_days_left ?? 0} days left`;
    body = "You won't be charged until your trial ends, unless you choose a plan now.";
  } else if (billing.state === "locked") {
    title = "Dashboard locked";
    body = `Your QR still collects for ${billing.credits_left ?? 0} more reviews. Choose a plan to unlock everything.`;
  } else if (billing.state === "suspended") {
    title = "Review collection paused";
    body = "Your QR shows a neutral page. Choose a plan to switch it back on instantly, with the same QR code.";
  } else if (billing.state === "past_due") {
    title = "Payment failed";
    body = "Choose a plan below to update your payment method and keep collecting.";
  } else {
    title = "Not subscribed";
    body = "Choose a plan below to continue.";
  }
  return (
    <Card>
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-sm text-text-2 mt-0.5">{body}</p>
    </Card>
  );
}

function PlanCard({
  name,
  price,
  unit,
  note,
  badge,
  highlight,
  loading,
  disabled,
  onPick,
}: {
  name: string;
  price: string;
  unit: string;
  note: string;
  badge?: string;
  highlight?: boolean;
  loading: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col ${highlight ? "border-accent bg-accent-50/40" : "border-line bg-sheet"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{name}</p>
        {badge && <span className="text-xs font-bold text-[#2f6b1a] bg-success-50 border border-success/25 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <p className="mt-2 font-display text-4xl text-ink tabular-nums">
        {price}
        <span className="text-base text-text-2 font-sans">{unit}</span>
      </p>
      <p className="text-sm text-text-2 mt-1 flex-1">{note}</p>
      <Button onClick={onPick} loading={loading} disabled={disabled} full className="mt-4" variant={highlight ? "primary" : "secondary"}>
        Pay {price}
      </Button>
    </div>
  );
}
