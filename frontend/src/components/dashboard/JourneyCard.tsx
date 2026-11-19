import Link from "next/link";

import type { Funnel } from "@/lib/dashboard/api";

// Four of the seven measured steps: enough to see where people stop. The full list is on Insights.
const STAGES = [
  { step: "scan", label: "Scanned" },
  { step: "rating_selected", label: "Rated" },
  { step: "draft_viewed", label: "Saw a draft" },
  { step: "handoff", label: "Went to Google" },
];

const VB_W = 400;
const VB_H = 72;
const MID = VB_H / 2;

/** One continuous band whose thickness at each stage is that stage's share of scans. */
function ribbon(shares: number[]): string {
  const n = shares.length;
  const col = VB_W / n;
  const flat = col * 0.55;
  const half = shares.map((s) => Math.max(1.5, (s * (VB_H - 4)) / 2));
  const bend = (i: number) => i * col + flat + (col - flat) / 2;

  // Top edge left to right, then the mirrored bottom edge back again.
  let d = `M0,${MID - half[0]}`;
  for (let i = 0; i < n; i++) {
    d += `H${i * col + flat}`;
    d += i < n - 1 ? `C${bend(i)},${MID - half[i]} ${bend(i)},${MID - half[i + 1]} ${(i + 1) * col},${MID - half[i + 1]}` : `H${VB_W}`;
  }
  d += `V${MID + half[n - 1]}`;
  for (let i = n - 1; i > 0; i--) {
    d += `H${i * col}`;
    d += `C${bend(i - 1)},${MID + half[i]} ${bend(i - 1)},${MID + half[i - 1]} ${(i - 1) * col + flat},${MID + half[i - 1]}`;
  }
  return `${d}H0Z`;
}

export function JourneyCard({ funnel, days }: { funnel: Funnel; days: number }) {
  const count = (step: string) => funnel.steps.find((s) => s.step === step)?.count ?? 0;
  const stages = STAGES.map((s) => ({ ...s, count: count(s.step) }));
  const scans = stages[0].count;
  const shares = stages.map((s) => (scans > 0 ? Math.min(1, s.count / scans) : 0));
  const told = funnel.self_reported;

  return (
    <section className="v2-sheet border border-line p-4 sm:p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-ink">From scan to Google</h2>
          <p className="text-sm text-text-2 mt-0.5">How far customers got, last {days} days</p>
        </div>
        <Link
          href="/app/insights"
          className="shrink-0 inline-flex items-center min-h-[44px] -my-2.5 text-sm font-semibold text-accent-hover hover:underline underline-offset-2"
        >
          All steps<span aria-hidden>&nbsp;→</span>
        </Link>
      </div>

      <ol className="mt-5 grid grid-cols-4">
        {stages.map((s, i) => (
          <li key={s.step} className="min-w-0 pr-2">
            <p className="font-display text-2xl sm:text-3xl leading-none text-ink">{s.count.toLocaleString("en-IN")}</p>
            <p className="text-xs sm:text-sm font-semibold text-ink mt-1.5 leading-tight">{s.label}</p>
            <p className="text-xs text-text-2 mt-0.5 tabular-nums">
              {i === 0 ? "everyone" : scans > 0 ? `${Math.round(shares[i] * 100)}% of scans` : "no scans yet"}
            </p>
          </li>
        ))}
      </ol>

      <div className="flex-1 flex flex-col justify-center pb-4">
      <svg aria-hidden viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="mt-4 w-full h-16 sm:h-24 xl:h-28">
        <defs>
          <linearGradient id="journey-fill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {[1, 2, 3].map((i) => (
          <line key={i} x1={(VB_W / 4) * i} x2={(VB_W / 4) * i} y1="0" y2={VB_H} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={ribbon(shares)} fill="url(#journey-fill)" />
      </svg>
      </div>

      <p className="mt-auto pt-3 border-t border-line text-xs text-text-2 leading-relaxed">
        Counting stops when a customer leaves for Google; what they do on Google&rsquo;s page can&rsquo;t be measured.
        {told && told.came_back > 0 && (
          <>
            {" "}
            <span className="font-semibold text-ink tabular-nums">{told.said_posted}</span> of the{" "}
            <span className="tabular-nums">{told.came_back}</span> who came back told us they posted.
          </>
        )}
      </p>
    </section>
  );
}
