import type { RatingInfo } from "@/lib/dashboard/api";
import { formatDate } from "@/lib/format";

const STAR = "M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6z";

function Stars({ className }: { className: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="w-5 h-5 shrink-0" fill="currentColor">
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
}

/**
 * The result the owner pays for: their Google rating and how many reviews the
 * listing has gained since they joined. Numbers come from the weekly check of
 * the public listing; null means "not checked yet" and is never shown as zero.
 */
export function RatingCard({ data }: { data: RatingInfo }) {
  const rating = data.current_rating ?? data.baseline_rating;
  const reviews = data.current_review_count;
  const gained =
    reviews !== null && data.baseline_review_count !== null ? Math.max(0, reviews - data.baseline_review_count) : null;
  const moved =
    data.baseline_rating !== null && data.current_rating !== null
      ? Math.round((data.current_rating - data.baseline_rating) * 10) / 10
      : 0;

  return (
    <section className="relative overflow-hidden rounded-[var(--r-card)] bg-ink-dark text-white p-5 sm:p-6 flex flex-col shadow-v2-elevated">
      {/* Depth: two soft lights behind the number. Decorative only. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 w-64 h-64 rounded-full bg-accent/35 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 w-56 h-56 rounded-full bg-star/15 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-on-dark">Your Google rating</h2>
        {moved > 0 && (
          <span className="text-xs font-semibold rounded-full bg-white/10 px-2.5 py-1 tabular-nums">
            Up from {data.baseline_rating!.toFixed(1)}
          </span>
        )}
      </div>

      <div className="relative mt-5 flex items-end gap-3">
        <span className="font-display text-6xl sm:text-7xl leading-[0.85]">{rating !== null ? rating.toFixed(1) : "—"}</span>
        {rating !== null && (
          <span className="relative mb-1" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
            <Stars className="text-white/20" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${(rating / 5) * 100}%` }}>
              <Stars className="text-star" />
            </span>
          </span>
        )}
      </div>

      <p className="relative mt-3 text-sm text-text-on-dark">
        {reviews !== null ? (
          <>
            <span className="font-semibold text-white tabular-nums">{reviews.toLocaleString("en-IN")}</span> reviews on Google
          </>
        ) : (
          "Your listing has not been checked yet."
        )}
      </p>

      <div className="relative mt-auto pt-5">
        <div className="rounded-xl bg-white/[0.07] border border-white/10 px-4 py-3">
          {gained !== null && gained > 0 ? (
            <>
              <p className="font-display text-3xl leading-none tabular-nums">+{gained.toLocaleString("en-IN")}</p>
              <p className="text-sm text-text-on-dark mt-1.5">new Google {gained === 1 ? "review" : "reviews"} since you joined</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{data.polled_at ? "No new reviews counted yet" : "First check this week"}</p>
              <p className="text-sm text-text-on-dark mt-1">New reviews show here after each weekly check.</p>
            </>
          )}
        </div>
        <p className="text-xs text-text-on-dark mt-3">
          {data.polled_at ? `Checked weekly · last on ${formatDate(data.polled_at)}` : "Checked with Google once a week"}
        </p>
      </div>
    </section>
  );
}
