import { formatDate } from "@/lib/format";
import type { RatingInfo } from "@/lib/dashboard/api";

export function RatingView({ data }: { data: RatingInfo }) {
  // null = Google hasn't been checked yet (weekly poll); never show that as 0.
  const currentReviews = data.current_review_count;
  const newReviews =
    currentReviews !== null && data.baseline_review_count !== null
      ? Math.max(0, currentReviews - data.baseline_review_count)
      : 0;
  const checked = data.polled_at !== null;

  return (
    <div className="v2-sheet border border-line p-4 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-display text-xl text-ink">Google rating</h2>
          {newReviews > 0 ? (
            <span className="text-xs text-success-strong bg-success-50 border border-success/25 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
              +{newReviews} new {newReviews === 1 ? "review" : "reviews"}
            </span>
          ) : !checked ? (
            <span className="text-xs text-text-2 bg-paper-subtle border border-line px-2.5 py-0.5 rounded-full font-semibold shrink-0">
              First check this week
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-5xl leading-none tabular-nums text-ink">
            {data.current_rating ?? data.baseline_rating ?? "—"}
          </span>
          <span aria-hidden className="text-[#f5a524] text-2xl">
            ★
          </span>
          {data.baseline_rating && data.current_rating && data.current_rating > data.baseline_rating && (
            <span className="text-sm font-mono tabular-nums text-success-strong font-semibold">(was {data.baseline_rating})</span>
          )}
        </div>

        <div className="mt-4 px-4 py-3 rounded-xl bg-paper-subtle border border-line flex items-center justify-between text-sm">
          <span className="text-text-2">Total Google Reviews</span>
          <span className="font-mono tabular-nums font-semibold text-ink">{currentReviews ?? "—"}</span>
        </div>
      </div>

      <p className="mt-5 pt-4 border-t border-line text-xs text-text-2">
        {checked
          ? `Last checked with Google: ${formatDate(data.polled_at!)}`
          : "We check your Google listing once a week. Numbers appear after the first check."}
      </p>
    </div>
  );
}
