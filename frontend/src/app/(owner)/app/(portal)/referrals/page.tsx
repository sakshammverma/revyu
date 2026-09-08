"use client";

import { Button, Card, EmptyState, ErrorState, Skeleton, StatTile, StatusPill, useToast } from "@/components/ui";
import { getReferrals } from "@/lib/dashboard/api";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const TONE = { pending: "warning", earned: "success", applied: "neutral", void: "alert" } as const;
const LABEL = {
  pending: "Signed up, not paid yet",
  earned: "Paid. Discount earned",
  applied: "Discount applied",
  void: "Didn't go ahead",
} as const;

export default function ReferralsPage() {
  const { data, error, reload } = useAsync(getReferrals, []);
  const { toast } = useToast();

  async function copyLink() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Select the link and copy it manually.", { tone: "error" });
    }
  }

  async function share() {
    if (!data) return;
    const text = `I use Revyu to get more Google reviews for my business. Try it free for 15 days: ${data.link}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Refer &amp; save</h1>
        <p className="text-sm text-text-2 mt-1">
          Know another business owner? Get {data?.discount_percent ?? 70}% off your next bill when they subscribe.
        </p>
      </div>

      {error ? (
        <ErrorState message="We couldn't load your referral details." onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <Card>
            <p className="text-sm font-semibold text-ink">Your personal link</p>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={data.link}
                aria-label="Your referral link"
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-h-[44px] rounded-[var(--r-control)] border border-line-strong bg-paper-subtle/50 px-3.5 text-sm text-ink"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={copyLink} className="flex-1 sm:flex-none">
                  Copy
                </Button>
                <Button onClick={share} className="flex-1 sm:flex-none">
                  Share
                </Button>
              </div>
            </div>
            <p className="text-xs text-text-2 mt-3">
              Your code is <strong className="text-ink tracking-wider">{data.code}</strong>. You earn the discount only once
              the business you referred actually pays. A signup or free trial alone doesn&rsquo;t count.
            </p>
          </Card>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatTile label="Signed up" value={data.pending} note="Waiting to pay" />
            <StatTile label="Discounts earned" value={data.earned} note="Applied to your next bill" highlight />
            <StatTile label="Discounts used" value={data.applied} />
          </div>

          <Card title="Your referrals">
            {data.referrals.length === 0 ? (
              <EmptyState icon="🤝" title="No referrals yet" body="Send your link to a friend who owns a shop or local business." />
            ) : (
              <ul className="divide-y divide-line">
                {data.referrals.map((r, i) => (
                  <li key={i} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{r.business_name}</p>
                      <p className="text-xs text-text-2">{formatDate(r.created_at)}</p>
                    </div>
                    <StatusPill tone={TONE[r.status as keyof typeof TONE] ?? "neutral"}>
                      {LABEL[r.status as keyof typeof LABEL] ?? r.status}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
