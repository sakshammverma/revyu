"use client";

import { useState } from "react";

// Act 1 — "The gap" (documents/21-CONVERSION-DESIGN.md §3, FR-79). Loss is
// stated once, about the owner's *current* situation, with numbers they can
// type in themselves. Never a projection of rank, calls or revenue — we may
// not promise outcomes (documents/03-COMPLIANCE.md § Sales constraints).
export function Google3PackVisualizer() {
  const [yours, setYours] = useState(47);
  const [theirs, setTheirs] = useState(180);
  const gap = Math.max(theirs - yours, 0);

  return (
    <section className="mx-2 sm:mx-3 my-12 sm:my-16">
      <div className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            The gap
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            {yours} reviews. The one nearby has {theirs}.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6e797b] leading-relaxed">
            Same work. Same prices. They just ask every customer — you ask the ones you happen to remember.
          </p>
        </div>

        {/* 2-Column: inputs + search-result mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#f8fafc] rounded-2xl border border-[#e8ecec] p-6 sm:p-10">
          {/* Left Column: owner's own numbers (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-[#397dff]/10 text-[#397dff] mb-2">
                Try your own numbers
              </span>
              <h3 className="font-display text-xl sm:text-2xl text-[#1a1e23] leading-snug mb-2">
                Where do you stand today?
              </h3>
              <p className="text-xs sm:text-sm text-[#515a63] leading-relaxed mb-6">
                Look yourself up on Google Maps, then the busiest competitor near you. Put both review counts in.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-[#e8ecec] shadow-2xs mb-6 grid grid-cols-2 gap-4">
              <NumberField label="Your Google reviews" value={yours} onChange={setYours} />
              <NumberField label="Nearby competitor" value={theirs} onChange={setTheirs} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3.5 rounded-xl bg-white border border-[#e8ecec] shadow-2xs">
                <p className="text-[10px] text-[#6e797b] font-medium">The gap today</p>
                <p className="text-lg font-bold text-[#1a1e23] mt-0.5">{gap} reviews</p>
                <p className="text-[10px] text-[#6e797b] mt-0.5">What a searcher sees first</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#e8ecec] shadow-2xs">
                <p className="text-[10px] text-[#6e797b] font-medium">Why it happens</p>
                <p className="text-lg font-bold text-[#397dff] mt-0.5">Asking</p>
                <p className="text-[10px] text-[#6e797b] mt-0.5">Not quality — consistency</p>
              </div>
            </div>

            <p className="text-[11px] text-[#9aa1a3] mb-4">
              Nobody can promise you a number. What you can decide is whether every customer gets asked, or
              only the ones you happen to remember.
            </p>

            <a href="/signup" className="btn-primary text-xs py-2.5 px-5 self-start">
              <span>Stop being the quiet one →</span>
            </a>
          </div>

          {/* Right Column: search-result mockup (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#dadce0] p-4 sm:p-6 shadow-v2-rest">
            <div className="flex items-center gap-3 pb-3 border-b border-[#dadce0] text-xs">
              <span className="text-base text-[#4285f4]">🔍</span>
              <span className="font-medium text-[#202124]">shop near me</span>
              <span className="ml-auto text-[10px] text-[#5f6368]">Illustration</span>
            </div>

            <div className="mt-4 space-y-3">
              <Listing name="The shop nearby" rating="4.6" count={theirs} note="Asks every customer" muted={false} />
              <Listing name="Your shop" rating="4.3" count={yours} note="Same products, same prices" highlight />
              <Listing name="Another shop" rating="4.1" count={Math.round(yours * 0.6)} note="" muted />
            </div>

            <p className="mt-4 text-[11px] text-[#5f6368]">
              A stranger choosing between two shops reads the count before they read anything you do well.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#515a63]">{label}</span>
      <input
        type="number"
        min={0}
        max={99999}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(99999, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 rounded-lg border border-[#e8ecec] text-base font-bold text-[#1a1e23] focus:outline-none focus:border-[#397dff]"
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
          ? "border-2 border-[#397dff] bg-[#f8fbff]"
          : `border border-[#dadce0] bg-white ${muted ? "opacity-50" : ""}`
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`${highlight ? "text-sm font-bold" : "text-xs font-semibold"} text-[#202124]`}>{name}</p>
          <div className="flex items-center gap-1 text-[#fbbc04] text-xs mt-1">
            <span>{rating} ★</span>
            <span className="text-[#5f6368] text-[11px] font-normal">({count}) · Store</span>
          </div>
          {note && <p className="text-[11px] text-[#5f6368] mt-1">{note}</p>}
        </div>
        {highlight && (
          <span className="text-[10px] font-semibold text-[#397dff] bg-[#397dff]/10 px-2 py-0.5 rounded-full">
            You
          </span>
        )}
      </div>
    </div>
  );
}
