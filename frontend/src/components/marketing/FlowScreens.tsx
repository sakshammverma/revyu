"use client";

import { FlowButton } from "@/components/flow/Button";
import { GOOGLE_LABEL, PRIVATE_LABEL } from "@/lib/flow/strings";
import { StarRating } from "@/components/flow/StarRating";
import { TagChips } from "@/components/flow/TagChips";
import { StatTile } from "@/components/ui/Card";
import { getDemoVertical } from "@/lib/marketing/demo";
import type { QrShape } from "@/lib/marketing/qr";

/**
 * The product's screens, drawn with the real flow components at phone size, for
 * use inside a PhoneMockup. Shared by the hero scene and the "how it works"
 * story so both show exactly the same product.
 *
 * Every customer screen after the rating keeps the two always-available options
 * (post on Google, tell the owner privately) on screen, as the live flow does (CR-3).
 */

export const DEMO = getDemoVertical("general");
export const DEMO_TAGS = DEMO.tags.slice(0, 6).map((t, i) => ({ ...t, sort_order: i }));

function BrandHeader({ step }: { step?: number }) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="truncate text-sm font-semibold text-ink">{DEMO.exampleBusiness}</span>
        </div>
        {step && <span className="text-xs text-text-2">Step {step} of 3</span>}
      </div>
      {step && (
        <div aria-hidden className="-mt-1 mb-4 flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      )}
    </>
  );
}

function StickyBar() {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 border-t border-line bg-sheet/95 px-3 pb-2 pt-3">
      <FlowButton variant="outline" tabIndex={-1}>
        {GOOGLE_LABEL}
      </FlowButton>
      <span className="flex min-h-[40px] items-center justify-center text-sm font-semibold text-accent-hover underline underline-offset-2">
        {PRIVATE_LABEL}
      </span>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <p className="font-display text-[26px] leading-tight tracking-tight text-ink">{title}</p>
      {sub && <p className="mt-1.5 text-sm text-text-2">{sub}</p>}
    </div>
  );
}

/** The customer's camera, pointed at the printed code. */
export function ScanScreen({ qr }: { qr: QrShape }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-[#14181c]">
      <div className="relative w-[210px] rounded-2xl bg-white p-4 text-center shadow-xl">
        <p className="text-[13px] font-semibold text-ink">Loved it? Tell us.</p>
        {/* The same real code as the standee, seen through the camera. */}
        <div aria-hidden className="relative mx-auto mt-2 h-[120px] w-[120px] overflow-hidden">
          <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="h-full w-full text-ink" shapeRendering="crispEdges">
            <path d={qr.d} fill="currentColor" />
          </svg>
          <span className="hs-scanline absolute inset-x-0 top-0 h-[2px] bg-accent shadow-[0_0_12px_2px_rgba(47,109,240,0.8)]" />
        </div>
        <p className="mt-2 text-[11px] text-text-2">Scan with your camera</p>
      </div>
      <div className="absolute inset-x-0 bottom-16 flex justify-center">
        <span className="rounded-full bg-[#ffd60a] px-4 py-2 text-[14px] font-semibold text-ink shadow-lg">
          revyu.in · Open {DEMO.exampleBusiness}
        </span>
      </div>
    </div>
  );
}

/** Step 1 of the flow. At 1 to 3 stars the private note leads and the Google button sits right under it. */
export function RateScreen({ rating, onRate }: { rating: number | null; onRate: (v: number) => void }) {
  const low = rating !== null && rating <= 3;
  return (
    <div className="h-full overflow-hidden bg-sheet p-5 pb-36">
      <BrandHeader step={1} />
      <div className="flex flex-col gap-5 text-center">
        <Heading title="How was your visit?" sub="Tap a star to rate your experience" />
        <div className="rounded-2xl border border-line bg-paper-subtle/50 px-2 py-3">
          <StarRating value={rating} onChange={onRate} />
        </div>
        {low && (
          <p className="rounded-xl border border-line bg-white p-3 text-left text-sm leading-snug text-text-2">
            At 1 to 3 stars, a private note to the owner is offered first. The Google button stays right below it.
          </p>
        )}
      </div>
      <StickyBar />
    </div>
  );
}

export function TagsScreen({
  selected,
  onToggle,
  onNext,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext?: () => void;
}) {
  return (
    <div className="h-full overflow-hidden bg-sheet p-5 pb-36">
      <BrandHeader step={2} />
      <div className="flex flex-col gap-4">
        <Heading title="What stood out?" sub="Tap whatever applies, or skip to continue." />
        <TagChips tags={DEMO_TAGS} selected={selected} onToggle={onToggle} />
        <FlowButton onClick={onNext}>Write my draft →</FlowButton>
      </div>
      <StickyBar />
    </div>
  );
}

export function DraftScreen({ draft, onCopy }: { draft: string; onCopy?: () => void }) {
  return (
    <div className="h-full overflow-hidden bg-sheet p-5 pb-36">
      <BrandHeader step={3} />
      <div className="flex flex-col gap-3">
        <Heading title="Your review draft" />
        <div className="rounded-xl border border-accent/25 bg-accent-50 px-3.5 py-2.5 text-sm font-medium leading-snug text-[#1e4fae]">
          We’ve written this from what you selected. Edit anything. It’s your review.
        </div>
        <div className="min-h-[130px] rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink">
          {draft || <span className="text-text-muted">Empty. The customer can write their own.</span>}
        </div>
        <FlowButton onClick={onCopy}>Copy &amp; Continue to Google →</FlowButton>
      </div>
      <StickyBar />
    </div>
  );
}

/** An illustration of Google's own review form, where the customer pastes and posts from their account. */
export function GoogleScreen({ draft, rating }: { draft: string; rating: number }) {
  return (
    <div data-illustration className="flex h-full flex-col bg-[#f8f9fa] font-sans">
      <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-4 py-3">
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-[#202124]">{DEMO.exampleBusiness}</p>
          <p className="text-xs text-[#70757a]">Posting publicly</p>
        </div>
        <span className="rounded-full bg-[#1a73e8] px-4 py-1.5 text-[14px] font-semibold text-white">Post</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a73e8] font-bold text-white">Y</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#202124]">Your customer</p>
            <p className="text-xs text-[#70757a]">Their own Google account</p>
          </div>
        </div>
        <div aria-hidden className="text-3xl tracking-wide">
          <span className="text-[#fbbc04]">{"★".repeat(rating)}</span>
          <span className="text-[#dadce0]">{"★".repeat(5 - rating)}</span>
        </div>
        <div className="min-h-[120px] rounded-lg border border-[#dadce0] bg-white p-3 text-[15px] leading-relaxed text-[#202124]">
          {draft || "They paste here, or write their own."}
        </div>
        <p className="text-xs leading-snug text-[#70757a]">
          Illustration. Google does not allow anyone to pre-fill this form, so your customer pastes and posts it themselves.
        </p>
      </div>
    </div>
  );
}

/** What the owner sees. Numbers are samples and say so. */
export function OwnerScreen() {
  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <div className="leading-tight">
          <p className="font-display text-lg text-ink">Revyu</p>
          <p className="text-xs text-text-2">{DEMO.exampleBusiness}</p>
        </div>
        <span className="rounded-full bg-success-50 px-2 py-1 text-xs font-semibold text-success-strong">Collecting</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
        <Heading title="Overview" sub="How your QR code is performing, last 30 days." />
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Total scans" value={143} note="QR opened" />
          <StatTile label="Completed flows" value={28} note="Copied their draft" />
          <StatTile label="Conversion" value="20%" note="Scan to complete" highlight />
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-bold text-warning">2★ private</span>
            <span className="text-xs text-text-2">2h ago</span>
          </div>
          <p className="mt-2 text-[15px] leading-snug text-ink">Billing took too long and nobody told me why.</p>
          <div className="mt-2.5 flex gap-2 text-xs font-semibold text-ink">
            <span className="rounded-lg border border-line-strong px-3 py-1.5">Call</span>
            <span className="rounded-lg border border-line-strong px-3 py-1.5">WhatsApp</span>
            <span className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-white">Mark resolved</span>
          </div>
        </div>
        <p className="text-[11px] text-text-2">Sample numbers and a sample message.</p>
      </div>
      <div className="grid grid-cols-5 border-t border-line bg-white pb-6 pt-2 text-center text-[11px] text-text-2">
        {["Overview", "Feedback", "QR & Print", "Billing", "More"].map((t, i) => (
          <span key={t} className={i === 0 ? "font-semibold text-accent-hover" : ""}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
