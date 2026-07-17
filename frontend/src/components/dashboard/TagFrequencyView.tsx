import type { TagFrequency } from "@/lib/dashboard/api";

export function TagFrequencyView({ data }: { data: TagFrequency }) {
  const max = Math.max(...data.tags.map((t) => t.count), 1);

  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-display text-xl text-[#1a1e23]">Customer Compliments</h2>
          <span className="text-[11px] font-semibold tracking-wider text-[#515a63] uppercase shrink-0 mt-1.5">Top tags</span>
        </div>

        {data.tags.length === 0 ? (
          <p className="text-sm text-[#515a63] py-6 text-center">No customer tags recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.tags.map((tag) => {
              const pct = Math.round((tag.count / max) * 100);
              return (
                <div key={tag.label} className="flex items-center gap-3">
                  <p className="w-28 sm:w-36 shrink-0 text-sm font-medium text-[#1a1e23] capitalize truncate">
                    {tag.label}
                  </p>
                  <div className="relative h-2 flex-1 bg-[#eef2f2] rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#397dff] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono tabular-nums text-sm text-[#1a1e23] font-semibold">
                    {tag.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-5 pt-4 border-t border-[#e8ecec] text-xs text-[#515a63]">
        Aggregated from all completed customer review sessions.
      </p>
    </div>
  );
}
