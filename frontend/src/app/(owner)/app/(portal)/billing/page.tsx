"use client";

import { useEffect, useRef, useState } from "react";

import { useOwner } from "@/components/portal/OwnerContext";
import { Button, Card, EmptyState, ErrorState, StatusPill, useToast } from "@/components/ui";
import { confirmBilling, createBillingCheckout, type BillingStatus } from "@/lib/dashboard/api";
import { formatDate, formatMoney } from "@/lib/format";
import { CheckoutCancelled, runCheckout } from "@/lib/signup/checkout";

const PAYMENT_TONE = { captured: "success", refunded: "neutral", failed: "alert", authorized: "info" } as const;

export default function BillingPage() {
  const { billing, outlet, refresh } = useOwner();
  const { toast } = useToast();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  // Set once a checkout succeeds: "confirmed" by us, or "pending" on Razorpay's webhook.
  const [paid, setPaid] = useState<{ plan: string; confirmed: boolean } | null>(null);

  if (!billing) {
    return (
      <Card title="Billing">
        <ErrorState message="We couldn't load your billing details. Your QR code keeps working." onRetry={() => void refresh()} />
      </Card>
    );
  }

  async function pay(plan: string) {
    if (!billing) return;
    setBusyPlan(plan);
    let result;
    try {
      const { checkout } = await createBillingCheckout(plan);
      result = await runCheckout(checkout, outlet.business_name);
    } catch (e) {
      if (!(e instanceof CheckoutCancelled)) {
        toast("We couldn't start the payment. You haven't been charged. Please try again.", { tone: "error" });
      }
      setBusyPlan(null);
      return;
    }
    try {
      await confirmBilling(result);
      setPaid({ plan, confirmed: true });
    } catch {
      // Razorpay has the payment; its webhook activates the account even if this
      // confirm call failed, so don't tell the owner to pay again.
      setPaid({ plan, confirmed: false });
    } finally {
      await refresh();
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

      {paid ? <PaidCard billing={billing} plan={paid.plan} confirmed={paid.confirmed} onRefresh={refresh} /> : <StatusCard billing={billing} isPaid={isPaid} />}

      {billing.referral_discounts_earned > 0 && (
        <div className="rounded-xl border border-success/25 bg-success-50 p-4 text-sm">
          <p className="font-semibold text-success-strong">
            You&rsquo;ve earned {billing.referral_discounts_earned} referral {billing.referral_discounts_earned === 1 ? "discount" : "discounts"}: 70% off your next bill.
          </p>
          <p className="text-text-2 mt-0.5">We apply it to your next invoice. You don&rsquo;t need to do anything.</p>
        </div>
      )}

      {billing.can_pay && !paid && (
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
          <EmptyState title="No payments yet" body={outlet.state === "trial" ? "Your first charge appears here after your free trial." : "Payments appear here once you subscribe."} />
        ) : (
          <ul className="divide-y divide-line">
            {billing.payments.map((p) => (
              <li key={`${p.created_at}-${p.amount_minor}`} className="py-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-text-2 tabular-nums">{formatDate(p.created_at)}</span>
                <span className="font-semibold text-ink tabular-nums">{formatMoney(p.amount_minor, p.currency_code)}</span>
                <StatusPill tone={PAYMENT_TONE[p.status as keyof typeof PAYMENT_TONE] ?? "neutral"}>{PAYMENT_LABEL[p.status] ?? p.status}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// Raw provider statuses mean nothing to an owner.
const PAYMENT_LABEL: Record<string, string> = {
  captured: "Paid",
  authorized: "Authorised",
  created: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

function PaidCard({
  billing,
  plan,
  confirmed,
  onRefresh,
}: {
  billing: BillingStatus;
  plan: string;
  confirmed: boolean;
  onRefresh: () => Promise<void>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const option = billing.plans.find((p) => p.code === plan);
  const settled = billing.subscription_status === "active";

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Not confirmed by us yet: Razorpay's webhook settles it within seconds to a minute.
  useEffect(() => {
    if (settled) return;
    const id = setInterval(() => void onRefresh(), 5000);
    const stop = setTimeout(() => clearInterval(id), 120_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [settled, onRefresh]);

  return (
    <section className="rounded-2xl border border-success/25 bg-success-50 p-5 sm:p-7" aria-live="polite">
      <div className="flex items-start gap-3">
        <span aria-hidden className="w-10 h-10 shrink-0 rounded-full bg-success text-white flex items-center justify-center">
          <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl text-ink outline-none">
            Payment received. Thank you!
          </h2>
          <p className="text-sm text-text-2 mt-1">
            {option ? `${plan === "annual" ? "Annual" : "Monthly"} plan · ${formatMoney(option.amount_minor, option.currency_code)}${plan === "annual" ? "/year" : "/month"}. ` : ""}
            {settled
              ? billing.current_period_end
                ? `Your dashboard is fully unlocked. Next renewal on ${formatDate(billing.current_period_end)}.`
                : "Your dashboard is fully unlocked."
              : confirmed
                ? "Unlocking your dashboard now."
                : "We're confirming it with Razorpay; this page updates by itself. Don't pay again."}
          </p>
          <p className="text-xs text-text-2 mt-2">Razorpay emails your receipt. Your QR code stays exactly the same.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        <Button href="/app" className="sm:min-w-[200px]">
          Go to my dashboard
        </Button>
        <Button href="/app/qr" variant="secondary">
          QR &amp; print files
        </Button>
      </div>
    </section>
  );
}

function StatusCard({ billing, isPaid }: { billing: BillingStatus; isPaid: boolean }) {
  let title: string;
  let body: string;
  if (isPaid) {
    title = `Subscribed${billing.plan ? ` · ${billing.plan}` : ""}`;
    body = billing.current_period_end ? `Renews on ${formatDate(billing.current_period_end)}.` : "Your subscription is active.";
  } else if (billing.state === "trial") {
    title = `Free trial · ${billing.trial_days_left ?? 0} ${billing.trial_days_left === 1 ? "day" : "days"} left`;
    body = "You won't be charged until your trial ends, unless you choose a plan now.";
  } else if (billing.state === "locked") {
    title = "Dashboard locked";
    body = `Your QR still collects for ${billing.credits_left ?? 0} more ${billing.credits_left === 1 ? "review" : "reviews"}. Choose a plan to unlock everything.`;
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
        {badge && <span className="text-xs font-bold text-success-strong bg-success-50 border border-success/25 px-2 py-0.5 rounded-full">{badge}</span>}
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
