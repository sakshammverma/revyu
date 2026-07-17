"use client";

import Link from "next/link";

import { FunnelView } from "@/components/dashboard/FunnelView";
import { useOwner } from "@/components/portal/OwnerContext";
import { Button, Card, ErrorState, Skeleton, StatTile } from "@/components/ui";
import { getFeedbackInbox, getFunnel, getOverview } from "@/lib/dashboard/api";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function OverviewPage() {
  const { outlet, billing } = useOwner();
  const overview = useAsync(() => getOverview(outlet.outlet_id), [outlet.outlet_id]);
  const funnel = useAsync(() => getFunnel(outlet.outlet_id), [outlet.outlet_id]);
  const feedback = useAsync(() => getFeedbackInbox(outlet.outlet_id), [outlet.outlet_id]);

  const locked = outlet.state === "locked" || outlet.state === "suspended";
  const monthly = billing?.plans.find((p) => p.code === "monthly");

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Overview</h1>
        <p className="text-sm text-text-2 mt-1">How your QR code is performing, last 30 days.</p>
      </div>

      <StateBanner />

      {locked && billing && (
        <UnlockCard
          scans={overview.data?.scans ?? 0}
          completed={billing.scans_waiting}
          creditsLeft={billing.credits_left}
          suspended={outlet.state === "suspended"}
          price={monthly ? formatMoney(monthly.amount_minor, monthly.currency_code) : "₹499"}
        />
      )}

      {overview.error ? (
        <ErrorState message="We couldn't load your numbers." onRetry={overview.reload} />
      ) : (
        <div className={locked ? "blur-sm select-none pointer-events-none" : ""} aria-hidden={locked || undefined}>
          {overview.loading || !overview.data ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <StatTile label="Total scans" value={overview.data.scans} note="QR opened" />
              <StatTile label="Completed flows" value={overview.data.completed_flows} note="Copied their draft" />
              <StatTile
                label="Conversion"
                value={`${(overview.data.conversion_rate * 100).toFixed(1)}%`}
                note="Scan to complete"
                highlight
              />
            </div>
          )}
        </div>
      )}

      {!locked && overview.data && (
        <NextBestAction
          scans={overview.data.scans}
          conversion={overview.data.conversion_rate}
          unresolved={feedback.data?.items.filter((i) => !i.resolved).length ?? 0}
        />
      )}

      {funnel.data ? (
        <div className={locked ? "blur-sm select-none pointer-events-none" : ""} aria-hidden={locked || undefined}>
          <FunnelView funnel={funnel.data} />
        </div>
      ) : funnel.error ? (
        <ErrorState message="We couldn't load the funnel." onRetry={funnel.reload} />
      ) : (
        <Skeleton className="h-64" />
      )}
    </>
  );
}

/** Trial countdown / payment-failed strip. The locked state gets its own full card below. */
function StateBanner() {
  const { outlet, billing } = useOwner();
  if (!billing) return null;

  if (outlet.state === "trial" && billing.trial_days_left !== null) {
    const pct = Math.round(((15 - billing.trial_days_left) / 15) * 100);
    return (
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {billing.trial_days_left} {billing.trial_days_left === 1 ? "day" : "days"} left in your free trial
            </p>
            <p className="text-sm text-text-2">Then 10 review credits, then collection pauses. Your QR code never changes.</p>
            <div
              className="mt-3 h-2 rounded-full bg-paper-subtle overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Trial progress"
            >
              <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Button href="/app/billing" variant="secondary" className="shrink-0">
            Choose a plan
          </Button>
        </div>
      </Card>
    );
  }

  if (outlet.state === "past_due") {
    return (
      <div role="alert" className="rounded-xl border border-alert/25 bg-alert-50 p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div>
          <p className="font-semibold text-alert">Your last payment didn&rsquo;t go through</p>
          <p className="text-sm text-text-2">Update your payment method within 7 days to keep collecting reviews.</p>
        </div>
        <Button href="/app/billing" variant="danger" className="shrink-0">
          Fix payment
        </Button>
      </div>
    );
  }
  return null;
}

function UnlockCard({
  scans,
  completed,
  creditsLeft,
  suspended,
  price,
}: {
  scans: number;
  completed: number;
  creditsLeft: number | null;
  suspended: boolean;
  price: string;
}) {
  return (
    <section className="v2-card-elevated border border-accent/20 p-5 sm:p-7 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">
        {suspended ? "Collection paused" : "Dashboard locked"}
      </p>
      <h2 className="font-display text-2xl sm:text-3xl text-ink mt-2">
        {scans} scans and {completed} completed reviews are waiting for you
      </h2>
      <p className="text-text-2 mt-2 max-w-lg mx-auto">
        {suspended
          ? "Your QR now shows a neutral page. Pay to switch review collection back on, with the same QR code."
          : creditsLeft !== null
            ? `Your QR keeps collecting for ${creditsLeft} more ${creditsLeft === 1 ? "review" : "reviews"}. Unlock now to see every number and keep collecting.`
            : "Your QR keeps collecting. Unlock to see every number."}
      </p>
      <div className="mt-5 flex flex-col items-center gap-2">
        <Button href="/app/billing" className="w-full sm:w-auto sm:min-w-[260px] bg-[#b45309] hover:bg-[#92400e] shadow-none">
          Unlock for {price}/month
        </Button>
        <p className="text-xs text-text-2">Pay with UPI AutoPay · cancel anytime · same QR code</p>
      </div>
    </section>
  );
}

function NextBestAction({ scans, conversion, unresolved }: { scans: number; conversion: number; unresolved: number }) {
  let title: string;
  let body: string;
  let cta: { href: string; label: string };

  if (unresolved > 0) {
    title = `${unresolved} customer${unresolved === 1 ? "" : "s"} left private feedback`;
    body = "Replying quickly turns a bad visit into a returning customer.";
    cta = { href: "/app/feedback", label: "Open inbox" };
  } else if (scans === 0) {
    title = "No scans yet. Move your QR where people are waiting.";
    body = "The payment counter and the receipt footer get the most scans. Print the receipt footer and hand out cards at checkout.";
    cta = { href: "/app/qr", label: "Get print files" };
  } else if (scans >= 20 && conversion < 0.1) {
    title = "People scan but few finish. Check your tags.";
    body = "Short, specific compliments are easiest to tap. Look at which tags customers actually choose.";
    cta = { href: "/app/insights", label: "See insights" };
  } else {
    title = "You're on track. Keep the QR visible.";
    body = "Invite a colleague and get 70% off your next bill when they subscribe.";
    cta = { href: "/app/referrals", label: "Refer & save" };
  }

  return (
    <Card className="border-accent/20 bg-accent-50/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Next best action</p>
          <p className="font-semibold text-ink mt-1">{title}</p>
          <p className="text-sm text-text-2 mt-0.5">{body}</p>
        </div>
        <Link
          href={cta.href}
          className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-[var(--r-control)] bg-accent text-white text-sm font-semibold hover:bg-accent-hover shrink-0"
        >
          {cta.label}
        </Link>
      </div>
    </Card>
  );
}
