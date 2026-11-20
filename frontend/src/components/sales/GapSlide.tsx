"use client";

import type { GapBusiness } from "@/lib/gap/api";
import type { Prospect } from "@/lib/marketing/salesTypes";

/** "Live from Google": these numbers are the listing's real public numbers, read just now. */
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-strong">
      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-success" />
      Live from Google
    </span>
  );
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-sm text-text-muted">No rating yet</span>;
  return (
    <span className="text-sm font-semibold text-ink">
      <span aria-hidden className="text-star">★</span> {rating.toFixed(1)}
    </span>
  );
}

function count(b: GapBusiness): number {
  return b.review_count ?? 0;
}

/**
 * Step 1: the shop on Google today, against its nearby rivals. Real public numbers only:
 * no forecast, no "you'll pass X", nothing said about a rival beyond its public count.
 */
export function GapSlide({ prospect, name }: { prospect: Prospect; name: string }) {
  const { report } = prospect;
  const me = report.business;
  const mine = count(me);
  const rivals = report.competitors;
  const top = rivals[0] ?? null;
  const noRivals = rivals.length === 0;
  const noReviews = mine === 0;
  const leads = !noRivals && !noReviews && report.review_gap === 0;

  const rows = [{ ...me, you: true }, ...rivals.map((r) => ({ ...r, you: false }))].sort((a, b) => count(b) - count(a));
  const max = Math.max(1, ...rows.map(count));

  return (
    <div className="marketing-root mx-auto flex h-full max-w-3xl flex-col justify-center-safe gap-4 px-5 py-4 sm:gap-7 sm:px-8 sm:py-10">
      <div>
        <LiveBadge />
        <h1 className="font-display text-2xl leading-[1.2] tracking-tight text-ink mt-2.5 sm:mt-3 sm:text-5xl">
          {name} on Google today.
        </h1>
      </div>

      {noRivals ? (
        <div className="flex items-end gap-6">
          <div>
            <p className="font-display text-5xl tracking-tight text-ink sm:text-6xl">{mine.toLocaleString()}</p>
            <p className="text-sm text-text-2 mt-1">Google reviews</p>
          </div>
          <div className="pb-1">
            <Stars rating={me.rating} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--r-card)] border border-accent/30 bg-accent-50 p-3.5 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-hover">You</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-4xl tracking-tight text-ink sm:text-5xl">{mine.toLocaleString()}</span>
              <span className="text-xs text-text-2">reviews</span>
            </p>
            <div className="mt-1.5">
              <Stars rating={me.rating} />
            </div>
          </div>
          {top && (
            <div className="rounded-[var(--r-card)] border border-line bg-sheet p-3.5 sm:p-5">
              <p className="line-clamp-2 break-words text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:tracking-[0.12em]">{top.name}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-4xl tracking-tight text-ink sm:text-5xl">{count(top).toLocaleString()}</span>
                <span className="text-xs text-text-2">reviews</span>
              </p>
              <div className="mt-1.5">
                <Stars rating={top.rating} />
              </div>
            </div>
          )}
        </div>
      )}

      {!noRivals && (
        <div>
          <ol className="flex flex-col gap-2" aria-label="Nearby shops by Google reviews">
            {rows.map((r) => (
              <li key={r.place_id} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2.5 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                <span className={`truncate text-xs sm:text-sm ${r.you ? "font-semibold text-ink" : "text-text-2"}`}>
                  {r.you ? name : r.name}
                </span>
                <span className="h-2.5 rounded-full bg-line overflow-hidden" aria-hidden>
                  <span
                    className={`block h-full rounded-full transition-[width] duration-700 ${r.you ? "bg-accent" : "bg-line-strong"}`}
                    style={{ width: `${Math.max(2, (count(r) / max) * 100)}%` }}
                  />
                </span>
                <span className={`text-xs tabular-nums sm:text-sm ${r.you ? "font-semibold text-ink" : "text-text-2"}`}>
                  {count(r).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-text-muted sm:text-sm">
            You&rsquo;re #{report.rank_by_reviews} of {report.group_size} nearby by Google reviews
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {leads ? (
          <p className="text-base font-semibold leading-snug text-ink sm:text-lg">
            You lead {Math.max(1, report.group_size - 1)} nearby shops with {mine.toLocaleString()} reviews. Staying ahead
            means new reviews every week.
          </p>
        ) : (
          <>
            {noReviews ? (
              <p className="text-base font-semibold leading-snug text-ink sm:text-lg">No Google reviews yet.</p>
            ) : (
              top && (
                <p className="text-base font-semibold leading-snug text-ink sm:text-lg">
                  {top.name} has {report.review_gap.toLocaleString()} more Google reviews.
                </p>
              )
            )}
            {noRivals && (
              <p className="text-sm text-text-2">We couldn&rsquo;t find similar shops within 3 km.</p>
            )}
            <p className="text-sm leading-relaxed text-text-2 sm:text-base">
              Customers rarely write a review unless someone asks. Revyu asks every customer, every time.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
