"use client";

import Link from "next/link";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

import { AskLanes } from "./AskLanes";
import { GhostHand, InteractiveTag, TryHint, useCountUp, useInView, usePlayground } from "./interact";
import { Reveal } from "./Reveal";

// Act 1 — "The gap" (documents/21-CONVERSION-DESIGN.md §3, FR-79). Loss is
// stated once, about the owner's *current* situation, with numbers they can
// type in themselves. Never a projection of rank, calls or revenue — we may
// not promise outcomes (documents/03-COMPLIANCE.md § Sales constraints).
//
// The picture is a review wall: one dot per Google review, the shop nearby on
// top, yours below, and the reviews you are behind drawn as empty rings in the
// same grid, so the gap is a shape you can see rather than a number to read.

const MAX = 99999;
// Above this many dots one dot stands for several reviews (and the wall says so).
const MAX_DOTS = 240;

export function Google3PackVisualizer() {
  const [yours, setYours] = useState(47);
  const [theirs, setTheirs] = useState(180);
  const gap = Math.max(theirs - yours, 0);
  const shownGap = useCountUp(gap);
  const { tried, markTried } = usePlayground("rank");
  const fieldsRef = useRef<HTMLDivElement>(null);
  const inView = useInView(fieldsRef);
  const edit = (set: (v: number) => void) => (v: number) => {
    markTried();
    set(v);
  };

  return (
    <section id="gap" aria-labelledby="gap-title" className="mx-2 mt-10 sm:mx-3 sm:mt-16">
      <div className="v2-sheet mx-auto max-w-[1296px] border border-line p-6 sm:p-12 lg:p-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left: the claim, and the owner's own numbers */}
          <div className="lg:col-span-5">
            <p className="vf-section-label mb-2 flex items-center gap-3 uppercase tracking-wider">
              The gap <InteractiveTag />
            </p>
            <h2 id="gap-title" className="heading-h2">
              {yours} reviews. The one nearby has {theirs}.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-text-muted sm:text-lg">
              Same work, same prices. They ask every customer. You ask the ones you happen to remember. A stranger choosing
              between you reads the count first.
            </p>

            <div ref={fieldsRef} className="relative mt-7 grid grid-cols-2 gap-3">
              <Stepper label="Your Google reviews" value={yours} onChange={edit(setYours)} ring={!tried} you />
              <Stepper label="Nearby competitor" value={theirs} onChange={edit(setTheirs)} />
              <GhostHand play={inView && !tried} path={[{ x: "25%", y: "66%" }]} onStep={() => !tried && setYours(62)} />
            </div>
            <div className="mt-3 flex">
              <TryHint label="Type your own review count" done={tried} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/gap-report" className="btn-primary min-h-[48px] px-6 text-[15px]">
                <span>Check your real numbers, free</span>
                <span aria-hidden>→</span>
              </Link>
              <span className="text-sm text-text-muted">Live Google data · no signup</span>
            </div>
          </div>

          {/* Right: the review wall */}
          <div className="lg:col-span-7">
            <ReviewWall yours={yours} theirs={theirs} gap={gap} shownGap={shownGap} />
          </div>
        </div>

        <AskLanes />
      </div>
    </section>
  );
}

function ReviewWall({ yours, theirs, gap, shownGap }: { yours: number; theirs: number; gap: number; shownGap: number }) {
  const per = Math.max(1, Math.ceil(Math.max(yours, theirs) / MAX_DOTS));
  const dots = (n: number) => Math.round(n / per);
  const theirDots = dots(theirs);
  const yourDots = dots(yours);
  const ringDots = Math.max(theirDots - yourDots, 0);

  return (
    <figure className="night-surface night-grid overflow-hidden rounded-[24px] p-5 shadow-v2-elevated sm:p-8">
      <figcaption className="flex items-center justify-between gap-3 text-xs">
        <span className="whitespace-nowrap font-semibold uppercase tracking-[0.14em] text-accent-soft">The review wall</span>
        <span className="text-white/70">
          {per === 1 ? "One dot, one Google review" : `One dot, ${per} Google reviews`}
        </span>
      </figcaption>

      <Reveal className="mt-6 flex flex-col gap-7">
        <Row name="The shop nearby" rating="4.6" count={theirs} note="Asks every customer">
          <Dots filled={theirDots} rings={0} tone="ink" />
        </Row>
        <Row name="Your shop" rating="4.3" count={yours} note="Same products, same prices" you>
          <Dots filled={yourDots} rings={ringDots} tone="accent" />
        </Row>
      </Reveal>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-6">
        {gap > 0 ? (
          <div className="flex items-end gap-3">
            <span className="font-display text-5xl leading-none [font-variant-numeric:lining-nums] text-white sm:text-6xl">{shownGap}</span>
            <span className="pb-1 text-sm leading-snug text-white/75">
              reviews apart.
              <br />
              <span className="text-white">Not quality. Consistency of asking.</span>
            </span>
          </div>
        ) : (
          <p className="text-sm text-white/80">
            <span className="font-semibold text-white">You are ahead.</span> Asking every customer is how it stays that way.
          </p>
        )}
        <Legend />
      </div>

      <p className="sr-only">
        Your shop has {yours} Google reviews, the shop nearby has {theirs}
        {gap > 0 ? `: ${gap} reviews apart.` : "."}
      </p>
    </figure>
  );
}

function Row({
  name,
  rating,
  count,
  note,
  you = false,
  children,
}: {
  name: string;
  rating: string;
  count: number;
  note: string;
  you?: boolean;
  children: ReactNode;
}) {
  return (
    <div aria-hidden>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            {name}
            {you && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">You</span>}
          </p>
          <p className="mt-0.5 text-xs text-white/65">
            <span className="text-star">{rating} ★</span> · {note}
          </p>
        </div>
        <span className="shrink-0 text-2xl font-semibold tabular-nums text-white">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Dots({ filled, rings, tone }: { filled: number; rings: number; tone: "ink" | "accent" }) {
  const total = filled + rings;
  return (
    <div className="flex flex-wrap gap-[5px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{ "--i": Math.min(i, 160) } as CSSProperties}
          className={`gw-dot ${i < filled ? (tone === "accent" ? "gw-you" : "gw-them") : "gw-ring"}`}
        />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/70">
      <li className="flex items-center gap-1.5">
        <span className="gw-dot gw-them" /> Their reviews
      </li>
      <li className="flex items-center gap-1.5">
        <span className="gw-dot gw-you" /> Yours
      </li>
      <li className="flex items-center gap-1.5">
        <span className="gw-dot gw-ring" /> The gap
      </li>
    </ul>
  );
}

function Stepper({
  label,
  value,
  onChange,
  ring = false,
  you = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  ring?: boolean;
  you?: boolean;
}) {
  const set = (v: number) => onChange(Math.max(0, Math.min(MAX, v)));
  const btn =
    "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-semibold text-text-2 transition-colors hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div className={`rounded-2xl border bg-white p-3 shadow-v2-rest sm:p-4 ${you ? "border-accent/40" : "border-line"}`}>
      <p className="flex items-center gap-2 text-xs font-semibold text-text-2">
        <span aria-hidden className={`h-2 w-2 rounded-full ${you ? "bg-accent" : "bg-ink-dark"}`} />
        {label}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <button type="button" className={btn} aria-label={`${label}: 10 fewer`} onClick={() => set(value - 10)}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX}
          aria-label={label}
          value={value}
          onChange={(e) => set(Number(e.target.value) || 0)}
          className={`w-full min-w-0 rounded-lg bg-transparent px-1 py-1 text-center text-2xl font-bold tabular-nums text-ink [appearance:textfield] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${ring ? "afford-ring" : ""}`}
        />
        <button type="button" className={btn} aria-label={`${label}: 10 more`} onClick={() => set(value + 10)}>
          +
        </button>
      </div>
    </div>
  );
}
