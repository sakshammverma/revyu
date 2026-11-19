import type { ReactNode } from "react";

import { TREND_SERIES, TrendChart } from "@/components/dashboard/TrendChart";
import type { Overview, Trend } from "@/lib/dashboard/api";

type Change = { direction: "up" | "down" | "flat"; text: string; spoken: string } | null;

/** Percent change in a count. Null when there is nothing honest to compare with. */
function countChange(now: number, before: number | undefined): Change {
  if (before === undefined) return null;
  if (before === 0) return now > 0 ? { direction: "up", text: "New", spoken: "none in the period before" } : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { direction: "flat", text: "0%", spoken: "no change" };
  return { direction: pct > 0 ? "up" : "down", text: `${Math.abs(pct)}%`, spoken: `${pct > 0 ? "up" : "down"} ${Math.abs(pct)} percent` };
}

/** Change in a rate, in percentage points. */
function rateChange(now: number, before: number | undefined, comparable: boolean): Change {
  if (before === undefined || !comparable) return null;
  const pts = Math.round((now - before) * 1000) / 10;
  if (pts === 0) return { direction: "flat", text: "0 pts", spoken: "no change" };
  return {
    direction: pts > 0 ? "up" : "down",
    text: `${Math.abs(pts)} pts`,
    spoken: `${pts > 0 ? "up" : "down"} ${Math.abs(pts)} percentage points`,
  };
}

const TONE = {
  up: "text-success-strong bg-success-50",
  down: "text-alert bg-alert-50",
  flat: "text-text-2 bg-paper-subtle",
};

function ChangeChip({ change }: { change: Change }) {
  if (!change) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${TONE[change.direction]}`}>
      {change.direction !== "flat" && (
        <svg aria-hidden viewBox="0 0 12 12" className={`w-2.5 h-2.5 ${change.direction === "down" ? "rotate-180" : ""}`} fill="currentColor">
          <path d="M6 2l4.5 7h-9L6 2z" />
        </svg>
      )}
      <span aria-hidden>{change.text}</span>
      <span className="sr-only">{change.spoken}</span>
    </span>
  );
}

function Kpi({ label, lineKey, value, change, note }: { label: string; lineKey?: string; value: ReactNode; change: Change; note: string }) {
  return (
    <div className="min-w-0 px-3 sm:px-5 first:pl-0 last:pr-0">
      {/* Two lines of room on a phone, where "Drafts copied" wraps, so the three numbers stay level. */}
      <p className="flex items-start gap-1.5 text-xs sm:text-sm font-semibold text-text-2 leading-tight min-h-[2lh] sm:min-h-0">
        {lineKey && <span aria-hidden className="w-3 h-0.5 rounded-full shrink-0 mt-[0.5lh] -translate-y-px" style={{ background: lineKey }} />}
        <span>{label}</span>
      </p>
      <p className="font-display text-[1.75rem] sm:text-4xl leading-none text-ink mt-2">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[22px]">
        <ChangeChip change={change} />
        <span className="hidden sm:inline text-xs text-text-2">{note}</span>
      </div>
    </div>
  );
}

/**
 * The top of the Overview: three numbers for the chosen period, each with its
 * change against the period before, and the daily chart they add up from. The
 * line keys beside the first two labels are the chart's legend.
 */
export function PerformanceCard({ trend, overview }: { trend: Trend; overview: Overview }) {
  const days = trend.days.length;
  const { totals, previous } = trend;
  return (
    <section className="v2-sheet border border-line p-4 sm:p-6 flex flex-col">
      <div className="grid grid-cols-3 divide-x divide-line">
        <Kpi
          label={TREND_SERIES[0].label}
          lineKey={TREND_SERIES[0].color}
          value={totals.scans.toLocaleString("en-IN")}
          change={countChange(totals.scans, previous?.scans)}
          note="opened your page"
        />
        <Kpi
          label={TREND_SERIES[1].label}
          lineKey={TREND_SERIES[1].color}
          value={totals.completed.toLocaleString("en-IN")}
          change={countChange(totals.completed, previous?.completed)}
          note="ready to post"
        />
        <Kpi
          label="Conversion"
          value={`${(totals.conversion_rate * 100).toFixed(totals.conversion_rate > 0 && totals.conversion_rate < 0.1 ? 1 : 0)}%`}
          change={rateChange(totals.conversion_rate, previous?.conversion_rate, (previous?.scans ?? 0) > 0)}
          note="scan to draft"
        />
      </div>

      <div className="mt-5 sm:mt-6">
        <TrendChart days={trend.days} />
      </div>

      <p className="mt-3 pt-3 border-t border-line text-xs text-text-2 flex flex-wrap gap-x-4 gap-y-1 justify-between">
        <span>{previous ? `Changes compare with the ${days} days before.` : `Comparisons start once you have ${days * 2} days of history.`}</span>
        <span className="tabular-nums">
          All time: {overview.scans.toLocaleString("en-IN")} scans · {overview.completed_flows.toLocaleString("en-IN")} drafts copied
        </span>
      </p>
    </section>
  );
}
