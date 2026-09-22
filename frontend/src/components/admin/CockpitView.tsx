"use client";

import { Card, EmptyState, ErrorState, Skeleton, StatTile, StatusPill } from "@/components/ui";
import { fetchCockpit, type Cockpit } from "@/lib/admin/api";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const BAND_STYLE: Record<Cockpit["band"], { tone: "alert" | "warning" | "success" | "neutral"; cls: string }> = {
  stop: { tone: "alert", cls: "bg-alert-50 border-alert/30" },
  iterate: { tone: "warning", cls: "bg-warning-50 border-warning/30" },
  fix: { tone: "warning", cls: "bg-warning-50 border-warning/30" },
  push: { tone: "success", cls: "bg-success-50 border-success/30" },
  unknown: { tone: "neutral", cls: "bg-paper-subtle border-line-strong" },
};

const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)}%`);

export function CockpitView() {
  const { data, error, reload } = useAsync(fetchCockpit, []);

  if (error) return <ErrorState message="Couldn't load metrics. Check your admin token." onRetry={reload} />;
  if (!data) return <Skeleton className="h-64 max-w-5xl mx-auto" />;

  const band = BAND_STYLE[data.band];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-5">
      {/* The one number the product is a bet on. */}
      <section className={`rounded-2xl border p-5 sm:p-7 ${band.cls}`} aria-labelledby="kill-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="kill-heading" className="text-xs font-semibold uppercase tracking-wider text-text-2">
            Kill metric · scan to completed review · last {data.window_days} days
          </h2>
          <StatusPill tone={band.tone}>{data.band === "unknown" ? "Collecting data" : data.band}</StatusPill>
        </div>
        <p className="font-display text-5xl sm:text-6xl text-ink tabular-nums mt-3">{pct(data.median_conversion)}</p>
        <p className="text-sm text-text-2 mt-1">
          Median across {data.median_sample} outlet{data.median_sample === 1 ? "" : "s"} with 10+ scans. Blended:{" "}
          <strong className="text-ink">{pct(data.cohort_conversion)}</strong> ({data.cohort_completed} of {data.cohort_scans} scans).
        </p>
        <p className="text-sm font-semibold text-ink mt-3">{data.band_label}</p>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatTile label="Installs" value={data.installs} note={Object.entries(data.by_source).map(([k, v]) => `${v} ${k}`).join(" · ") || "none yet"} />
        <StatTile
          label="Day-30 decision"
          value={data.days_to_decision === null ? "–" : data.days_to_decision <= 0 ? "Due" : `${data.days_to_decision}d`}
          note={
            data.decision_date
              ? `${formatDate(data.decision_date)} (30 days after install #10)`
              : `${Math.max(0, 10 - data.installs)} more installs to start the clock`
          }
          highlight={data.days_to_decision !== null && data.days_to_decision <= 7}
        />
        <StatTile label="Trial to paid" value={pct(data.trial_to_paid)} note={`${data.trial_eligible} past day 15`} />
        <StatTile label="Zero scans at 7d" value={data.zero_scan.length} note={data.zero_scan.slice(0, 2).join(", ") || "all outlets scanning"} />
      </div>

      <Card title="Per outlet" description="Report each outlet, then the median. Never a blended headline.">
        {data.outlets.length === 0 ? (
          <EmptyState title="No live outlets yet" body="Approve your first signup and it appears here." />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-2">
                  <th scope="col" className="px-2 py-2 font-semibold">Outlet</th>
                  <th scope="col" className="px-2 py-2 font-semibold">State</th>
                  <th scope="col" className="px-2 py-2 font-semibold text-right">Scans</th>
                  <th scope="col" className="px-2 py-2 font-semibold text-right">Completed</th>
                  <th scope="col" className="px-2 py-2 font-semibold text-right">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.outlets.map((o) => (
                  <tr key={o.outlet_id}>
                    <td className="px-2 py-2.5">
                      <a href={`/admin/outlets/${o.outlet_id}/detail`} className="font-semibold text-ink hover:text-accent-hover hover:underline">
                        {o.business_name}
                      </a>
                      <span className="block text-xs text-text-2">
                        {o.vertical} · {o.source}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-text-2">{o.state}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{o.scans}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{o.completed}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink">{pct(o.conversion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
