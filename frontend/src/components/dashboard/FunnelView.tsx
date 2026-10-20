import type { Funnel } from "@/lib/dashboard/api";

// Owner-facing wording for the server's event keys (server/services/dashboard.ts FUNNEL_ORDER).
const STEP_LABELS: Record<string, string> = {
  scan: "Scanned your QR",
  flow_start: "Opened the review page",
  rating_selected: "Picked a star rating",
  tags_selected: "Chose what stood out",
  draft_viewed: "Saw a draft",
  copy_tapped: "Copied the draft",
  handoff: "Went to Google",
};

export function FunnelView({ funnel }: { funnel: Funnel }) {
  const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h2 className="font-display text-xl text-ink">How customers move through</h2>
          <p className="text-sm text-[#515a63] mt-0.5">Where customers drop off, step by step</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-2.5">
        {funnel.steps.map((step) => {
          const pct = Math.round((step.count / maxCount) * 100);
          return (
            <div key={step.step} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
              <p className="sm:w-44 shrink-0 text-sm text-ink font-semibold">
                {STEP_LABELS[step.step] ?? step.step}
              </p>
              <div className="relative h-2 shrink-0 w-full sm:w-auto sm:flex-1 bg-[#eef2f2] rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#397dff] rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-32 shrink-0">
                <span className="font-mono tabular-nums text-sm font-semibold text-[#1a1e23]">{step.count}</span>
                {step.drop_off_pct !== null ? (
                  <span className="font-mono tabular-nums text-xs text-[#c62445] bg-[#fdf2f4] px-2 py-0.5 rounded-full border border-[#c62445]/20">
                    -{step.drop_off_pct}%
                  </span>
                ) : (
                  <span className="font-mono tabular-nums text-xs text-[#515a63]">100%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 p-3 rounded-lg bg-[#f7fafa] border border-dashed border-[#d5dcdc]">
        <p className="text-xs text-[#515a63] leading-relaxed">
          Counts stop at &ldquo;Went to Google&rdquo;. What happens on Google&rsquo;s own page (signing in, pasting, submitting) can&rsquo;t be measured.
        </p>
      </div>
    </div>
  );
}
