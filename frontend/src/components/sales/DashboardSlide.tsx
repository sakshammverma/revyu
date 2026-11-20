"use client";

import { useMemo, useState } from "react";

import { JourneyCard } from "@/components/dashboard/JourneyCard";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { RatingCard } from "@/components/dashboard/RatingCard";
import { TagFrequencyView } from "@/components/dashboard/TagFrequencyView";
import type { RatingInfo } from "@/lib/dashboard/api";
import { exampleDashboard } from "@/lib/marketing/exampleDashboard";
import type { Prospect, SalesKit } from "@/lib/marketing/salesTypes";

import { FeedbackPreview } from "./FeedbackPreview";
import { PortalPreview } from "./PortalPreview";
import { PreviewBadge } from "./PreviewBadge";
import { RivalsCard } from "./RivalsCard";

const TRIAL_DAYS = 15;

// The same grid as the real Overview; dense flow fills the gaps the wide cards leave.
const GRID = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 md:grid-flow-row-dense gap-5";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Step 3 of the sales demo: the owner's own dashboard. Their rating, review count and
 * nearby shops are real (badged "Live from Google"); activity is example data (badged
 * "Example") and is never presented as this shop's month. No forecast of reviews,
 * rating or rank. On phones the live rating card comes first.
 */
export function DashboardSlide({ prospect, kit, name }: { prospect: Prospect; kit: SalesKit; name: string }) {
  const [hello] = useState(greeting);
  const example = useMemo(() => exampleDashboard(prospect.place_id, kit.tags), [prospect.place_id, kit.tags]);

  const { business } = prospect.report;
  // Baseline = current, so nothing reads as a review gain; the delta panel shows a neutral note.
  const rating: RatingInfo = {
    baseline_rating: business.rating,
    baseline_review_count: business.review_count,
    current_rating: business.rating,
    current_review_count: business.review_count,
    polled_at: prospect.fetched_at,
  };
  const qr = kit.try.qr;

  return (
    <PortalPreview name={name}>
      <div className="min-w-0">
        <h2 className="font-display text-2xl sm:text-3xl text-ink">{hello}</h2>
        <p className="text-sm text-text-2 mt-1">
          This is {name}&rsquo;s dashboard. Activity numbers are an example; the Google numbers are real.
        </p>
      </div>

      {/* The trial strip, as a picture: nothing to click. Hidden on phones, where step 4 covers the trial. */}
      <section
        aria-label="Free trial"
        className="v2-sheet border border-accent/20 bg-gradient-to-r from-accent-50 to-sheet px-4 py-3 sm:px-5 hidden sm:flex items-center gap-3"
      >
        <span aria-hidden className="w-10 h-10 shrink-0 rounded-full border-[5px] border-accent flex items-center justify-center font-display text-base text-ink">
          {TRIAL_DAYS}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">Free trial · {TRIAL_DAYS} days</p>
          <p className="text-sm text-text-2 mt-0.5 leading-snug">Nothing is charged during the trial.</p>
        </div>
      </section>

      <div className={GRID}>
        <PreviewBadge kind="example" className="md:col-span-2">
          <PerformanceCard trend={example.trend} overview={example.overview} />
        </PreviewBadge>

        <PreviewBadge kind="live" className="order-first md:order-none">
          <RatingCard data={rating} deltaNote="Your new Google reviews show here after each weekly check." />
        </PreviewBadge>

        <PreviewBadge kind="example" className="md:col-span-2">
          <JourneyCard funnel={example.funnel} days={30} linkHref={null} />
        </PreviewBadge>

        <PreviewBadge kind="live">
          <RivalsCard report={prospect.report} />
        </PreviewBadge>

        <PreviewBadge kind="example">
          <FeedbackPreview items={example.feedback} />
        </PreviewBadge>

        <PreviewBadge kind="example">
          <TagFrequencyView data={example.tagFrequency} />
        </PreviewBadge>

        <PreviewBadge kind="example">
          <section className="v2-sheet border border-line p-4 sm:p-6 flex flex-col items-center text-center">
            <h2 className="font-display text-xl text-ink self-start">Your QR</h2>
            <svg
              role="img"
              aria-label={`QR code for ${name}`}
              viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
              shapeRendering="crispEdges"
              className="mt-4 w-40 h-40 rounded-lg bg-white border border-line"
            >
              <path d={qr.d} className="fill-ink" />
            </svg>
            <p className="mt-3 font-semibold text-ink">Your QR, print-ready</p>
            <p className="text-sm text-text-2 mt-0.5">Download it any time from QR &amp; Print.</p>
          </section>
        </PreviewBadge>
      </div>
    </PortalPreview>
  );
}
