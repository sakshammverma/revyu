"use client";

import Link from "next/link";

import { useRef, useState } from "react";

import { AskLanes } from "./AskLanes";
import { GhostHand, InteractiveTag, TryHint, useCountUp, useInView, usePlayground } from "./interact";
import { Reveal } from "./Reveal";

// Act 1 — "The gap" (documents/21-CONVERSION-DESIGN.md §3, FR-79). Loss is
// stated once, about the owner's *current* situation, with numbers they can
// type in themselves. Never a projection of rank, calls or revenue — we may
// not promise outcomes (documents/03-COMPLIANCE.md § Sales constraints).
export function Google3PackVisualizer() {
  const [yours, setYours] = useState(47);
  const [theirs, setTheirs] = useState(180);
  const gap = useCountUp(Math.max(theirs - yours, 0));
  const { tried, markTried } = usePlayground("rank");
  const fieldsRef = useRef<HTMLDivElement>(null);
  const inView = useInView(fieldsRef);
  const edit = (set: (v: number) => void) => (v: number) => {
    markTried();
    set(v);
  };

  const max = Math.max(yours, theirs, 1);

  return (
    <section id="gap" aria-labelledby="gap-title" className="mx-2 mt-10 sm:mx-3 sm:mt-16">
      <div className="v2-sheet mx-auto max-w-[1296px] border border-line p-6 sm:p-12 lg:p-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left: the claim, and the owner's own numbers */}
          <div className="lg:col-span-6">
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

            <div ref={fieldsRef} className="relative mt-7 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-bg p-5">
              <NumberField label="Your Google reviews" value={yours} onChange={edit(setYours)} ring={!tried} />
              <NumberField label="Nearby competitor" value={theirs} onChange={edit(setTheirs)} />
              <GhostHand play={inView && !tried} path={[{ x: "25%", y: "68%" }]} onStep={() => !tried && setYours(62)} />
            </div>
            <div className="mt-3 flex">
              <TryHint label="Type your own review count" done={tried} />
            </div>

            {/* The two counts as bars: the picture a searcher carries away */}
            <Reveal className="mt-6 flex flex-col gap-3">
              <Bar label="Your shop" value={yours} pct={(yours / max) * 100} you />
              <Bar label="The one nearby" value={theirs} pct={(theirs / max) * 100} />
              <p className="text-sm text-text-2">
                <span className="font-semibold text-ink">{gap} reviews apart.</span> Not quality. Consistency of asking.
              </p>
            </Reveal>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/gap-report" className="btn-primary min-h-[48px] px-6 text-[15px]">
                <span>Check your real numbers, free</span>
                <span aria-hidden>→</span>
              </Link>
              <span className="text-sm text-text-muted">Live Google data · no signup</span>
            </div>
          </div>

          {/* Right: search-result mockup. An illustration, not content: hidden from assistive tech. */}
          <div className="lg:col-span-6">
            <div aria-hidden data-illustration className="rounded-2xl border border-[#dadce0] bg-white p-4 shadow-v2-elevated sm:p-6">
              <div className="flex items-center gap-3 rounded-full border border-[#dadce0] px-4 py-2.5 text-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#4285f4]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.500-3.500" />
                </svg>
                <span className="font-medium text-[#202124]">shop near me</span>
                <span className="ml-auto text-[11px] text-[#5f6368]">Illustration</span>
              </div>

              <div className="mt-4 space-y-3">
                <Listing name="The shop nearby" rating="4.6" count={theirs} note="Asks every customer" muted={false} />
                <Listing name="Your shop" rating="4.3" count={yours} note="Same products, same prices" highlight />
                <Listing name="Another shop" rating="4.1" count={Math.round(yours * 0.6)} note="" muted />
              </div>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Nobody can promise you a number. What you can decide is whether every customer gets asked.
            </p>
          </div>
        </div>

        <AskLanes />
      </div>
    </section>
  );
}

function Bar({ label, value, pct, you = false }: { label: string; value: number; pct: number; you?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-paper-subtle">
        <div
          className={`grow-bar h-full rounded-full transition-[width] duration-500 ${you ? "bg-accent" : "bg-ink-dark"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  ring = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  ring?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-text-2">{label}</span>
      <input
        type="number"
        min={0}
        max={99999}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(99999, Number(e.target.value) || 0)))}
        className={`w-full px-3 py-2 rounded-lg border border-line text-base font-bold text-ink focus:outline-none focus:border-accent ${ring ? "afford-ring" : ""}`}
      />
    </label>
  );
}

function Listing({
  name,
  rating,
  count,
  note,
  highlight = false,
  muted = false,
}: {
  name: string;
  rating: string;
  count: number;
  note: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`p-3.5 rounded-lg transition-all ${
        highlight
          ? "border-2 border-accent bg-[#f8fbff]"
          : `border border-[#dadce0] bg-white ${muted ? "opacity-50" : ""}`
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`${highlight ? "text-sm font-bold" : "text-xs font-semibold"} text-[#202124]`}>{name}</p>
          <div aria-hidden className="flex items-center gap-1 text-[#fbbc04] text-xs mt-1">
            <span>{rating} ★</span>
            <span className="text-[#5f6368] text-[11px] font-normal">({count}) · Store</span>
          </div>
          {note && <p className="text-[11px] text-[#5f6368] mt-1">{note}</p>}
        </div>
        {highlight && (
          <span className="text-[10px] font-semibold text-accent-hover bg-accent/10 px-2 py-0.5 rounded-full">
            You
          </span>
        )}
      </div>
    </div>
  );
}
