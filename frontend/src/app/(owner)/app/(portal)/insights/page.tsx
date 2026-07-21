"use client";

import { useState } from "react";

import { HubInsightsPanel } from "@/components/dashboard/HubInsightsPanel";
import { FunnelView } from "@/components/dashboard/FunnelView";
import { RatingView } from "@/components/dashboard/RatingView";
import { TagFrequencyView } from "@/components/dashboard/TagFrequencyView";
import { useOwner } from "@/components/portal/OwnerContext";
import { ErrorState, Skeleton } from "@/components/ui";
import { getFunnel, getRating, getTagFrequency } from "@/lib/dashboard/api";
import { useAsync } from "@/lib/useAsync";

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

export default function InsightsPage() {
  const { outlet } = useOwner();
  const [range, setRange] = useState("30d");
  const funnel = useAsync(() => getFunnel(outlet.outlet_id, range), [outlet.outlet_id, range]);
  const tags = useAsync(() => getTagFrequency(outlet.outlet_id, range), [outlet.outlet_id, range]);
  const rating = useAsync(() => getRating(outlet.outlet_id), [outlet.outlet_id]);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink">Insights</h1>
          <p className="text-sm text-text-2 mt-1">What customers praise, and where they drop off.</p>
        </div>
        <div role="group" aria-label="Date range" className="inline-flex rounded-[var(--r-control)] bg-paper-subtle p-1 self-start">
          {RANGES.map((r) => (
            <button
              key={r.value}
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              className={`px-3.5 min-h-[40px] rounded-md text-sm font-semibold cursor-pointer ${
                range === r.value ? "bg-sheet text-ink shadow-v2-rest" : "text-text-2"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {funnel.error ? (
        <ErrorState message="We couldn't load the funnel." onRetry={funnel.reload} />
      ) : funnel.data ? (
        <FunnelView funnel={funnel.data} />
      ) : (
        <Skeleton className="h-64" />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {tags.error ? (
          <ErrorState message="We couldn't load tags." onRetry={tags.reload} />
        ) : tags.data ? (
          <TagFrequencyView data={tags.data} />
        ) : (
          <Skeleton className="h-56" />
        )}
        {rating.error ? (
          <ErrorState message="We couldn't load your rating." onRetry={rating.reload} />
        ) : rating.data ? (
          <RatingView data={rating.data} />
        ) : (
          <Skeleton className="h-56" />
        )}
      </div>

      <HubInsightsPanel outletId={outlet.outlet_id} days={range === "7d" ? 7 : range === "30d" ? 30 : 365} />
    </>
  );
}
