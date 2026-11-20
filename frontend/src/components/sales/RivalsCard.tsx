import type { GapReport } from "@/lib/gap/api";

interface Row {
  key: string;
  name: string;
  rating: number | null;
  reviews: number;
  you: boolean;
}

/**
 * "You vs nearby": the shop and up to three same-category shops within 3 km, by
 * Google review count. Real public numbers only; no forecast and no claim about
 * any named shop beyond what Google shows.
 */
export function RivalsCard({ report }: { report: GapReport }) {
  const you: Row = {
    key: report.business.place_id,
    name: report.business.name,
    rating: report.business.rating,
    reviews: report.business.review_count ?? 0,
    you: true,
  };
  const rivals: Row[] = report.competitors.slice(0, 3).map((c) => ({
    key: c.place_id,
    name: c.name,
    rating: c.rating,
    reviews: c.review_count ?? 0,
    you: false,
  }));
  const rows = [you, ...rivals].sort((a, b) => b.reviews - a.reviews || Number(b.you) - Number(a.you));
  const max = Math.max(1, ...rows.map((r) => r.reviews));

  return (
    <section className="v2-sheet border border-line p-4 sm:p-6 flex flex-col">
      <h2 className="font-display text-xl text-ink">You vs nearby</h2>
      <p className="text-sm text-text-2 mt-0.5">Google reviews, similar shops within 3 km</p>

      <ol className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key} className={r.you ? "rounded-xl bg-accent-50 -mx-2 px-2 py-1.5" : "py-0.5"}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="min-w-0 flex items-center gap-1.5">
                <span className={`truncate ${r.you ? "font-semibold text-ink" : "text-ink"}`}>{r.name}</span>
                {r.you && (
                  <span className="shrink-0 rounded-full bg-accent text-white px-1.5 text-[10px] font-bold uppercase tracking-wider leading-4">
                    You
                  </span>
                )}
              </p>
              <p className="shrink-0 tabular-nums text-text-2">
                <span className="font-semibold text-ink">{r.reviews.toLocaleString("en-IN")}</span>
                <span className="sr-only"> {r.reviews === 1 ? "review" : "reviews"}</span>
                {r.rating !== null && (
                  <>
                    {" · "}
                    <span aria-hidden className="text-star">★</span>
                    <span className="sr-only">rated</span> {r.rating.toFixed(1)}
                  </>
                )}
              </p>
            </div>
            <div aria-hidden className="mt-1.5 h-2 rounded-full bg-paper-subtle overflow-hidden">
              <div
                className={`h-full rounded-full ${r.you ? "bg-accent" : "bg-line-strong"}`}
                style={{ width: `${Math.max(2, Math.round((r.reviews / max) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      {rivals.length === 0 && <p className="mt-3 text-sm text-text-2">We couldn&rsquo;t find similar shops within 3 km.</p>}

      <p className="mt-auto pt-4">
        <span className="block pt-3 border-t border-line text-xs text-text-2">Every Monday you see who gained reviews.</span>
      </p>
    </section>
  );
}
