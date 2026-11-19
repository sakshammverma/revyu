"use client";

import Link from "next/link";
import { useState } from "react";

import { FeedbackPeek } from "@/components/dashboard/FeedbackPeek";
import { FirstRunCard } from "@/components/dashboard/FirstRunCard";
import { JourneyCard } from "@/components/dashboard/JourneyCard";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { QrStandeeCard } from "@/components/dashboard/QrStandeeCard";
import { RatingCard } from "@/components/dashboard/RatingCard";
import { Icon } from "@/components/hub/Icons";
import { useOwner } from "@/components/portal/OwnerContext";
import { Button, ErrorState, Skeleton, StatTile } from "@/components/ui";
import { getHome, isDashboardLocked, type Overview, type PeriodTotals, type TrendRange } from "@/lib/dashboard/api";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const RANGES: { value: TrendRange; label: string; days: number }[] = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
];

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const GRID = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5";

export default function OverviewPage() {
  const { outlet, billing } = useOwner();
  const locked = isDashboardLocked(outlet.state);
  const [range, setRange] = useState<TrendRange>("30d");
  const [hello] = useState(greeting);
  // One request for the whole page; while locked it carries the all-time counts and nothing else.
  const home = useAsync(() => getHome(outlet.outlet_id, range), [outlet.outlet_id, range]);
  const data = home.data;
  const overview = data?.overview ?? null;
  const firstRun = !locked && overview?.scans === 0;
  const days = RANGES.find((r) => r.value === (data?.range ?? range))!.days;
  const monthly = billing?.plans.find((p) => p.code === "monthly");
  const price = monthly ? formatMoney(monthly.amount_minor, monthly.currency_code) : null;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl text-ink">{hello}</h1>
          <p className="text-sm text-text-2 mt-1">
            {locked
              ? "Your numbers are waiting for you."
              : firstRun
                ? "Let’s get your QR code in front of customers."
                : `Here’s how ${outlet.business_name} is doing.`}
          </p>
        </div>
        {!locked && !firstRun && data?.trend && (
          <div role="group" aria-label="Period" className="inline-flex rounded-[var(--r-control)] bg-paper-subtle p-1 self-start sm:self-auto">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={range === r.value}
                onClick={() => setRange(r.value)}
                className={`px-3.5 min-h-[40px] rounded-md text-sm font-semibold cursor-pointer ${
                  range === r.value ? "bg-sheet text-ink shadow-v2-rest" : "text-text-2 hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <StateBanner overview={overview} price={price} />

      {locked && billing && (
        <UnlockCard
          scans={overview?.scans ?? null}
          completed={billing.scans_waiting}
          feedbackCount={overview?.feedback_count ?? 0}
          creditsLeft={billing.credits_left}
          suspended={outlet.state === "suspended"}
          price={price}
        />
      )}

      {home.error && !data ? (
        <ErrorState message="We couldn't load your numbers." onRetry={home.reload} />
      ) : !data || !overview ? (
        <div className={GRID} role="status" aria-busy="true" aria-label="Loading your numbers">
          <Skeleton className="h-[26rem] md:col-span-2" />
          <Skeleton className="h-64 xl:h-[26rem]" />
        </div>
      ) : locked || !data.trend ? (
        <div className="blur-sm select-none pointer-events-none" aria-hidden>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatTile label="Total scans" value={overview.scans} note="QR opened" />
            <StatTile label="Drafts copied" value={overview.completed_flows} note="Ready to post" />
            <StatTile label="Conversion" value={`${(overview.conversion_rate * 100).toFixed(1)}%`} note="Scan to draft" highlight />
          </div>
        </div>
      ) : (
        // Switching period keeps the old numbers on screen, dimmed, until the new ones arrive.
        <div
          aria-busy={home.loading}
          className={`flex flex-col gap-4 sm:gap-5 transition-opacity ${home.loading ? "opacity-60" : ""}`}
        >
          {home.error ? <ErrorState message="We couldn't refresh your numbers." onRetry={home.reload} /> : null}

          {data.open_feedback && overview.unresolved_count > 0 && (
            <FeedbackPeek items={data.open_feedback} openCount={overview.unresolved_count} />
          )}

          {firstRun ? (
            <div className={GRID}>
              {/* A new owner's first job is getting the QR on a counter, not reading zeros. */}
              <div className="md:col-span-2 grid">
                <FirstRunCard outletId={outlet.outlet_id} slug={outlet.slug} businessName={outlet.business_name} />
              </div>
              {data.rating && (
                <div className="md:col-span-2 xl:col-span-1 grid xl:self-start">
                  <RatingCard data={data.rating} />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className={GRID}>
                <div className="md:col-span-2 grid min-w-0">
                  <PerformanceCard trend={data.trend} overview={overview} />
                </div>
                {data.rating && (
                  <div className="grid">
                    <RatingCard data={data.rating} />
                  </div>
                )}
                {data.funnel && (
                  <div className="md:col-span-2 md:order-last xl:order-none grid min-w-0">
                    <JourneyCard funnel={data.funnel} days={days} />
                  </div>
                )}
                <div className="grid">
                  <QrStandeeCard outletId={outlet.outlet_id} slug={outlet.slug} businessName={outlet.business_name} />
                </div>
              </div>
              {overview.unresolved_count === 0 && <Tip totals={data.trend.totals} days={days} />}
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Days left, as a ring that empties. The sentence beside it says the same thing in words. */
function TrialRing({ left, total }: { left: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  return (
    <span aria-hidden className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 60 60" className="w-12 h-12 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--sheet)" strokeWidth="7" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg text-ink">{left}</span>
    </span>
  );
}

/** Trial countdown / payment-failed strip. The locked state gets its own full card below. */
function StateBanner({ overview, price }: { overview: Overview | null; price: string | null }) {
  const { outlet, billing } = useOwner();
  if (!billing) return null;

  if (outlet.state === "trial" && billing.trial_days_left !== null) {
    const left = billing.trial_days_left;
    return (
      <section className="v2-sheet border border-accent/20 bg-gradient-to-r from-accent-50 to-sheet px-4 py-3 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <TrialRing left={left} total={billing.trial_days_total} />
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {left} {left === 1 ? "day" : "days"} left in your free trial
            </p>
            <p className="text-sm text-text-2 mt-0.5 leading-snug">
              {overview && overview.scans > 0 && (
                <>
                  So far: <span className="font-semibold text-ink tabular-nums">{overview.scans.toLocaleString("en-IN")}</span>{" "}
                  {overview.scans === 1 ? "scan" : "scans"} and{" "}
                  <span className="font-semibold text-ink tabular-nums">{overview.completed_flows.toLocaleString("en-IN")}</span>{" "}
                  {overview.completed_flows === 1 ? "draft" : "drafts"} copied.{" "}
                </>
              )}
              Then 10 review credits, then collection pauses. Your QR code never changes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {price && <p className="order-2 sm:order-1 text-xs text-text-2 tabular-nums">{price}/month</p>}
          <Button href="/app/billing" variant={left <= 3 ? "primary" : "secondary"} className="order-1 sm:order-2 flex-1 sm:flex-none">
            Choose a plan
          </Button>
        </div>
      </section>
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
  feedbackCount,
  creditsLeft,
  suspended,
  price,
}: {
  scans: number | null; // null until the overview request answers; never show a made-up 0
  completed: number;
  feedbackCount: number;
  creditsLeft: number | null;
  suspended: boolean;
  price: string | null;
}) {
  return (
    <section className="v2-card-elevated border border-accent/20 p-5 sm:p-7 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">
        {suspended ? "Collection paused" : "Dashboard locked"}
      </p>
      <h2 className="font-display text-2xl sm:text-3xl text-ink mt-2">
        {scans === null
          ? `${completed} completed ${completed === 1 ? "review is" : "reviews are"} waiting for you`
          : `${scans} ${scans === 1 ? "scan" : "scans"} and ${completed} completed ${completed === 1 ? "review" : "reviews"} are waiting for you`}
      </h2>
      {feedbackCount > 0 && (
        <p className="mt-1 font-semibold text-ink">
          Plus {feedbackCount} private {feedbackCount === 1 ? "message" : "messages"} from customers
        </p>
      )}
      <p className="text-text-2 mt-2 max-w-lg mx-auto">
        {suspended
          ? "Your QR now shows a neutral page. Pay to switch review collection back on, with the same QR code."
          : creditsLeft !== null
            ? `Your QR keeps collecting for ${creditsLeft} more ${creditsLeft === 1 ? "review" : "reviews"}. Unlock now to see every number and keep collecting.`
            : "Your QR keeps collecting. Unlock to see every number."}
      </p>
      <div className="mt-5 flex flex-col items-center gap-2">
        <Button href="/app/billing" className="w-full sm:w-auto sm:min-w-[260px] bg-warning hover:bg-[#92400e] shadow-none">
          {price ? `Unlock for ${price}/month` : "Unlock"}
        </Button>
        <p className="text-xs text-text-2">Pay with UPI AutoPay · cancel anytime · same QR code</p>
      </div>
    </section>
  );
}

/** One suggestion, chosen from the period on screen. Hidden while private feedback is waiting: that comes first. */
function Tip({ totals, days }: { totals: PeriodTotals; days: number }) {
  let title: string;
  let body: string;
  let cta: { href: string; label: string };

  if (totals.scans === 0) {
    title = `No scans in the last ${days} days`;
    body = "Move your QR to where people pay or wait. The payment counter and the receipt footer get the most scans.";
    cta = { href: "/app/qr", label: "Get print files" };
  } else if (totals.scans >= 20 && totals.conversion_rate < 0.1) {
    title = "People scan but few finish";
    body = "Short, specific compliments are easiest to tap. See which tags customers actually choose.";
    cta = { href: "/app/insights", label: "See insights" };
  } else {
    title = "You’re on track. Keep the QR visible.";
    body = "Invite another business owner and get 70% off your next bill when they subscribe.";
    cta = { href: "/app/referrals", label: "Refer & save" };
  }

  return (
    <section className="rounded-[var(--r-card)] border border-line bg-sheet/60 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
      <span aria-hidden className="hidden sm:flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-hover">
        <Icon name="sparkle" className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-text-2 mt-0.5">{body}</p>
      </div>
      <Link
        href={cta.href}
        className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-[var(--r-control)] border border-line-strong bg-sheet text-sm font-semibold text-ink hover:bg-paper-subtle shrink-0"
      >
        {cta.label}
      </Link>
    </section>
  );
}
