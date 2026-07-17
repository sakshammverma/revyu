import type { RatingInfo } from "@/lib/dashboard/api";

export function RatingView({ data }: { data: RatingInfo }) {
  const currentReviews = data.current_review_count ?? 0;
  const baselineReviews = data.baseline_review_count ?? 0;
  const newReviews = Math.max(0, currentReviews - baselineReviews);

  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-display text-xl text-[#1a1e23]">Google Rating</h2>
          <span className="text-xs text-[#2f6b1a] bg-[#f0f7ed] border border-[#449127]/25 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
            {newReviews > 0 ? `+${newReviews} new reviews` : "Tracking live"}
          </span>
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-5xl leading-none tabular-nums text-[#1a1e23]">
            {data.current_rating ?? data.baseline_rating ?? "—"}
          </span>
          <span className="text-[#f5a524] text-2xl">★</span>
          {data.baseline_rating && data.current_rating && data.current_rating > data.baseline_rating && (
            <span className="text-sm font-mono tabular-nums text-[#2f6b1a] font-semibold">
              (was {data.baseline_rating})
            </span>
          )}
        </div>

        <div className="mt-4 px-4 py-3 rounded-xl bg-[#f7fafa] border border-[#e8ecec] flex items-center justify-between text-sm">
          <span className="text-[#515a63]">Total Google Reviews</span>
          <span className="font-mono tabular-nums font-semibold text-[#1a1e23]">{currentReviews}</span>
        </div>
      </div>

      {data.polled_at && (
        <p className="mt-5 pt-4 border-t border-[#e8ecec] text-xs text-[#515a63]">
          Last verified with Google: {new Date(data.polled_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
