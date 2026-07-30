"use client";

import { useMemo } from "react";

import { Card, ErrorState, Skeleton } from "@/components/ui";
import { ownerHubApi } from "@/lib/hub/api";
import { useAsync } from "@/lib/useAsync";

const MODULE_LABEL: Record<string, string> = {
  review: "Share your experience",
  connect: "Connect with us",
  menu: "Services / Menu",
  rewards: "Rewards",
};
const LINK_LABEL: Record<string, string> = {
  google_maps: "Directions",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  website: "Website",
  phone: "Call",
  email: "Email",
  custom: "Other",
};

function Bars({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="text-sm text-text-2">Nothing yet.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map(([k, v]) => (
        <li key={k}>
          <div className="flex justify-between text-sm">
            <span className="text-ink">{labels[k] ?? k}</span>
            <span className="font-semibold text-ink">{v}</span>
          </div>
          <div className="h-2 rounded-full bg-paper-subtle mt-1" aria-hidden="true">
            <div className="h-2 rounded-full bg-[#2f68db]" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Activity on the owner's QR page. Deliberately separate from the review
// funnel and from rewards numbers (CR-6.4).
export function HubInsightsPanel({ outletId, days }: { outletId: string; days: number }) {
  const api = useMemo(() => ownerHubApi(outletId), [outletId]);
  const q = useAsync(() => api.insights(days), [api, days]);

  if (q.error) return <ErrorState message="We couldn't load your QR page activity." onRetry={q.reload} />;
  if (!q.data) return <Skeleton className="h-56" />;
  const d = q.data;
  if (d.hub_views === 0 && d.menu_views === 0 && Object.keys(d.links).length === 0)
    return (
      <Card title="QR page activity" description="How customers use the page they see after scanning.">
        <p className="text-sm text-text-2">No activity yet. It shows here once customers open your QR page.</p>
      </Card>
    );

  return (
    <Card title="QR page activity" description={`Last ${d.days} days`}>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          ["Page opens", d.hub_views],
          ["Menu views", d.menu_views],
          ["Rewards views", d.rewards_views],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-paper-subtle/60 p-3">
            <p className="text-xl font-bold text-ink">{v}</p>
            <p className="text-xs text-text-2">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">What people open</h3>
          <Bars data={d.modules} labels={MODULE_LABEL} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">Connect clicks</h3>
          <Bars data={d.links} labels={LINK_LABEL} />
        </div>
      </div>
    </Card>
  );
}
