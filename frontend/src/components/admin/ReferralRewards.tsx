"use client";

import { useState } from "react";

import { Button, Card, EmptyState, ErrorState, Skeleton, StatusPill, ToastProvider, useToast } from "@/components/ui";
import { applyReferralReward, listReferralRewards, type ReferralRewardRow } from "@/lib/admin/api";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const TONE = { pending: "warning", earned: "success", applied: "neutral", void: "alert" } as const;

export function ReferralRewards() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

function Inner() {
  const { data, error, reload } = useAsync(listReferralRewards, []);
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function apply(row: ReferralRewardRow) {
    setBusy(row.id);
    try {
      await applyReferralReward(row.id);
      toast(`Marked applied for ${row.referrer_email}`);
      reload();
    } catch {
      toast("Couldn't mark that as applied.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState message="Couldn't load referral rewards. Check your admin token." onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 max-w-5xl mx-auto" />;

  const earned = data.filter((r) => r.status === "earned");

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <Card
        title="To apply"
        description="The referred business has paid. Apply 70% off the referrer's next invoice in Razorpay, then mark it applied here."
      >
        {earned.length === 0 ? (
          <EmptyState icon="✓" title="Nothing waiting" body="Earned rewards show up here the moment a referred business pays." />
        ) : (
          <ul className="divide-y divide-line">
            {earned.map((r) => (
              <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink truncate">
                    {r.referrer_name ?? r.referrer_email} <span className="text-text-2 font-normal">({r.referrer_email})</span>
                  </p>
                  <p className="text-text-2">
                    referred {r.referred_business} · earned {r.earned_at ? formatDate(r.earned_at) : ""} · {r.discount_percent}% off
                  </p>
                </div>
                <Button onClick={() => apply(r)} loading={busy === r.id} variant="secondary">
                  Mark applied
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="All referrals">
        {data.length === 0 ? (
          <EmptyState title="No referrals yet" />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">
                  {r.referrer_email} → <strong>{r.referred_business}</strong>
                </span>
                <StatusPill tone={TONE[r.status]}>{r.status}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
