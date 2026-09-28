"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

import { assembleDraft } from "@/lib/flow/draft";
import { getDemoVertical } from "@/lib/marketing/demo";

const DEMO = getDemoVertical("general");
const ALL_TAGS = DEMO.tags.slice(0, 6).map((t) => t.label);

export function BuildCards() {
  // Timeline loops for Card 1, Card 2, and Card 3
  const [stepCard1, setStepCard1] = useState(0); // 0: Star rating, 1: Tag matrix, 2: Ready for draft
  const [stepCard2, setStepCard2] = useState(0); // 0: Editable draft, 1: Copy tapped, 2: Google handoff
  const [stepCard3, setStepCard3] = useState(0); // 0: Weekly digest, 1: Dashboard readout

  // Hover states to pause auto-cycling for user inspection
  const [paused1, setPaused1] = useState(false);
  const [paused2, setPaused2] = useState(false);
  const [paused3, setPaused3] = useState(false);

  // Interactive state for Card 1 (Visitors can toggle tags!)
  const [selectedRating, setSelectedRating] = useState(5);
  const [activeTags, setActiveTags] = useState<string[]>([
    "friendly staff",
    "great service",
    "quick and easy",
  ]);

  // Interactive state for Card 2 (Visitors can click copy!)
  const [copiedToast, setCopiedToast] = useState(false);

  // Same assembler as the live customer flow — zero tags gives an empty draft (CR-1).
  const draft = assembleDraft(
    DEMO.tags.filter((t) => activeTags.includes(t.label)),
    { businessName: DEMO.exampleBusiness, vertical: DEMO.key },
    "buildcards-demo"
  );

  function toggleTag(tag: string) {
    if (activeTags.includes(tag)) {
      setActiveTags(activeTags.filter((t) => t !== tag));
    } else {
      setActiveTags([...activeTags, tag]);
    }
  }

  // Card 1 Video Loop: cycles every 3.3s through 3 states if not hovered
  useEffect(() => {
    if (paused1) return;
    const timer = setInterval(() => {
      setStepCard1((prev) => (prev + 1) % 3);
    }, 3300);
    return () => clearInterval(timer);
  }, [paused1]);

  // Card 2 Video Loop: cycles every 3.3s through 3 states if not hovered
  useEffect(() => {
    if (paused2) return;
    const timer = setInterval(() => {
      setStepCard2((prev) => (prev + 1) % 3);
    }, 3300);
    return () => clearInterval(timer);
  }, [paused2]);

  // Card 3 Video Loop: cycles every 3.3s through 2 states if not hovered
  useEffect(() => {
    if (paused3) return;
    const timer = setInterval(() => {
      setStepCard3((prev) => (prev + 1) % 2);
    }, 3300);
    return () => clearInterval(timer);
  }, [paused3]);

  function handleCopyCard2() {
    navigator.clipboard?.writeText(draft);
    setCopiedToast(true);
    setStepCard2(1);
    setTimeout(() => {
      setStepCard2(2);
      setCopiedToast(false);
    }, 1200);
  }

  return (
    <section className="max-w-[1296px] mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-6 sm:pb-10">
      {/* Section Header */}
      <div className="max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e7f5fd] border border-[#397dff]/20 text-[#397dff] text-xs font-semibold uppercase tracking-wider mb-3">
          <span>● The product, screen by screen</span>
        </div>
        <h2 className="heading-h2 font-display text-[#1a1e23]">
          Three screens. Scan, tap, paste.
        </h2>
        <p className="mt-3 text-base sm:text-lg text-[#6e797b] leading-relaxed">
          What your customer sees on their own phone, what they paste into Google, and what you see afterwards. Tap the chips — the draft is built from exactly what you select.
        </p>
      </div>

      {/* 3-Up Interactive Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {/* CARD 1: SCREEN 1 — THE IN-STORE TOUCHPOINT (SCAN & TAG MATRIX) */}
        <div className="flex flex-col justify-between group">
          <div
            className="relative aspect-square rounded-2xl overflow-hidden shadow-v2-rest border border-[#e8ecec] p-3 sm:p-4 flex items-center justify-center"
            onMouseEnter={() => setPaused1(true)}
            onMouseLeave={() => setPaused1(false)}
          >
            {/* Cinematic Scenic Background with Frost Overlay */}
            <Image
              src="/images/landscape-architectural-haven.jpg"
              alt=""
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[#1a1e23]/35 backdrop-blur-[2px]" />

            {/* Smartphone Enclosure */}
            <div className="relative z-10 w-full max-w-[270px] bg-[#1a1e23]/80 p-2 rounded-[30px] shadow-2xl border border-white/30 backdrop-blur-md">
              {/* Dynamic Island / Top Speaker Notch */}
              <div className="w-16 h-3 bg-[#111315] rounded-full mx-auto mb-1.5 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a1e23] border border-white/20" />
              </div>

              {/* Screen Interior */}
              <div className="bg-white rounded-[22px] p-3 flex flex-col justify-between min-h-[300px] overflow-hidden shadow-inner">
                {/* Status Bar */}
                <div className="flex items-center justify-between text-[9px] text-[#6e797b] font-mono pb-1 border-b border-[#f0f2f2]">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Video Timeline Progress Bar */}
                <div className="w-full h-1 bg-[#f2f7f7] rounded-full overflow-hidden mt-1.5 mb-1.5">
                  <div
                    key={`c1-${stepCard1}-${paused1}`}
                    className={`h-full bg-[#397dff] rounded-full ${paused1 ? "w-full" : "animate-[tabFill_3.3s_linear]"}`}
                  />
                </div>

                {/* Outlet Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e8ecec]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#449127] animate-pulse" />
                    <span className="text-[11px] font-semibold text-[#1a1e23]">{DEMO.exampleBusiness}</span>
                  </div>
                  <span className="text-[8px] font-medium text-[#397dff] bg-[#397dff]/10 px-1.5 py-0.5 rounded-full">
                    {stepCard1 === 0 ? "01: Rating" : stepCard1 === 1 ? "02: Tags" : "03: Draft"}
                  </span>
                </div>

                {/* Dynamic Screen Content */}
                <div className="my-auto py-1">
                  {stepCard1 === 0 && (
                    /* Stage 0: 5-Star Selection Animation */
                    <div className="text-center py-1">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[#f2f7f7] text-[8px] font-medium text-[#515a63] mb-1">
                        📍 Scanned from receipt QR
                      </span>
                      <p className="text-[11px] font-bold text-[#1a1e23]">
                        How was your visit today?
                      </p>

                      {/* Interactive glowing gold stars */}
                      <div className="flex items-center justify-center gap-1.5 my-2 text-xl cursor-pointer">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRating(star)}
                            className={`transition-transform hover:scale-125 ${
                              star <= selectedRating ? "text-[#f59e0b]" : "text-[#d1d5db]"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>

                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[8px] font-semibold text-[#065f46]">
                        ✓ {selectedRating}.0 Stars Selected
                      </div>
                    </div>
                  )}

                  {stepCard1 === 1 && (
                    /* Stage 1: Interactive Tag Matrix Tapping */
                    <div className="py-0.5 text-center">
                      <p className="text-[11px] font-bold text-[#1a1e23] mb-0.5">
                        What made your visit great?
                      </p>
                      <p className="text-[8px] text-[#6e797b] mb-1.5">
                        Tap whatever applies — or none
                      </p>

                      <div className="flex flex-wrap gap-1 justify-center max-h-[88px] overflow-y-auto">
                        {ALL_TAGS.map((tag) => {
                          const isSel = activeTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={`px-2 py-0.5 rounded-full text-[8px] font-medium transition-all cursor-pointer ${
                                isSel
                                  ? "bg-[#397dff] text-white shadow-2xs scale-102"
                                  : "bg-[#f2f7f7] text-[#515a63] hover:bg-[#e8ecec]"
                              }`}
                            >
                              {isSel ? `✓ ${tag}` : `+ ${tag}`}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-[8px] text-[#397dff] font-medium mt-1.5">
                        ● {activeTags.length} selected · draft updates as you tap
                      </p>
                    </div>
                  )}

                  {stepCard1 === 2 && (
                    /* Stage 2: Synthesis Handoff Preview */
                    <div className="py-1 text-center">
                      <div className="w-7 h-7 rounded-full bg-[#449127]/10 text-[#449127] flex items-center justify-center font-bold text-xs mx-auto mb-1">
                        ✓
                      </div>
                      <p className="text-[11px] font-bold text-[#1a1e23]">
                        Your draft
                      </p>
                      <div className="text-[8px] text-[#515a63] mt-1 italic px-2 bg-[#fcfcfc] p-1.5 rounded border border-[#e8ecec] leading-relaxed">
                        {draft ? <>&ldquo;{draft}&rdquo;</> : "No tags selected — the draft stays empty."}
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Step Navigator Pills */}
                <div className="pt-1.5 border-t border-[#e8ecec] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStepCard1(s)}
                        className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center transition-colors cursor-pointer ${
                          stepCard1 === s
                            ? "bg-[#397dff] text-white"
                            : "bg-[#f2f7f7] text-[#6e797b] hover:bg-[#e8ecec]"
                        }`}
                      >
                        {s + 1}
                      </button>
                    ))}
                  </div>
                  <span className="text-[8px] text-[#9aa1a3]">
                    {paused1 ? "Paused (Inspect)" : "Auto-playing 3.3s"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Copy below card */}
          <div className="pt-4 flex items-start gap-2.5">
            <span className="text-base text-[#1a1e23] shrink-0 mt-0.5 font-mono text-xs px-1.5 py-0.5 rounded bg-[#e8ecec]">
              01
            </span>
            <div>
              <p className="text-xs sm:text-sm text-[#515a63] leading-relaxed">
                <strong className="text-[#1a1e23] font-semibold">Scan, rate, tap. </strong>
                The customer scans the QR on a receipt, card or counter standee with their own camera, picks a star rating, and taps what stood out.
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#397dff] font-medium">
                <span>✓ No app, no login</span>
                <span>•</span>
                <span>✓ Zero tags is allowed</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: SCREEN 2 — DISCLOSED DRAFT & 1-TAP GOOGLE MAPS HANDOFF */}
        <div className="flex flex-col justify-between group">
          <div
            className="relative aspect-square rounded-2xl overflow-hidden shadow-v2-rest border border-[#e8ecec] p-3 sm:p-4 flex items-center justify-center"
            onMouseEnter={() => setPaused2(true)}
            onMouseLeave={() => setPaused2(false)}
          >
            {/* Cinematic Scenic Background */}
            <Image
              src="/images/landscape-emerald-forest.jpg"
              alt=""
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[#1a1e23]/35 backdrop-blur-[2px]" />

            {/* Smartphone Enclosure */}
            <div className="relative z-10 w-full max-w-[270px] bg-[#1a1e23]/80 p-2 rounded-[30px] shadow-2xl border border-white/30 backdrop-blur-md">
              {/* Dynamic Island */}
              <div className="w-16 h-3 bg-[#111315] rounded-full mx-auto mb-1.5 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a1e23] border border-white/20" />
              </div>

              {/* Screen Interior */}
              <div className="bg-white rounded-[22px] p-3 flex flex-col justify-between min-h-[300px] overflow-hidden shadow-inner">
                {/* Status Bar */}
                <div className="flex items-center justify-between text-[9px] text-[#6e797b] font-mono pb-1 border-b border-[#f0f2f2]">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Video Timeline Progress Bar */}
                <div className="w-full h-1 bg-[#f2f7f7] rounded-full overflow-hidden mt-1.5 mb-1.5">
                  <div
                    key={`c2-${stepCard2}-${paused2}`}
                    className={`h-full bg-[#397dff] rounded-full ${paused2 ? "w-full" : "animate-[tabFill_3.3s_linear]"}`}
                  />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e8ecec]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#397dff]">✽</span>
                    <span className="text-[11px] font-semibold text-[#1a1e23]">
                      {stepCard2 === 2 ? "Pasting on Google" : "Editable draft"}
                    </span>
                  </div>
                  <span className="text-[8px] text-[#449127] font-semibold bg-[#ecfdf5] px-1.5 py-0.5 rounded-full">
                    Always editable
                  </span>
                </div>

                {/* Dynamic Screen Content */}
                <div className="my-auto py-1">
                  {stepCard2 === 0 && (
                    /* Stage 0: Disclosed Draft Synthesized */
                    <div>
                      <p className="text-[8px] text-[#515a63] mb-1 leading-tight">
                        <strong>We&apos;ve written this from what you selected.</strong> Edit anything — it&apos;s your review.
                      </p>
                      <div className="p-2 rounded-lg bg-[#f2f7f7] border border-[#e8ecec] text-[9px] text-[#1a1e23] italic leading-snug">
                        {draft ? <>&ldquo;{draft}&rdquo;</> : <span className="not-italic text-[#9aa1a3]">Empty — the customer can write their own.</span>}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[8px] text-[#6e797b]">
                        <span>{draft.length} characters</span>
                        <span className="text-[#397dff] font-medium">Customer can clear it</span>
                      </div>
                    </div>
                  )}

                  {stepCard2 === 1 && (
                    /* Stage 1: 1-Tap Copy Triggered */
                    <div className="text-center py-1">
                      <div className="p-2 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[9px] font-semibold text-[#065f46] shadow-2xs mb-1.5">
                        ✓ Copied. Paste it into the box on the next screen.
                      </div>
                      <p className="text-[8px] text-[#6e797b]">
                        Opening your business&apos;s Google review page…
                      </p>
                    </div>
                  )}

                  {stepCard2 === 2 && (
                    /* Stage 2: Google Maps Official Dialog */
                    <div className="bg-[#f8f9fa] p-2 rounded-lg border border-[#dadce0]">
                      <div className="flex items-center justify-between pb-1 border-b border-[#dadce0] text-[8px]">
                        <span className="font-bold text-[#202124]">Google review (customer pastes)</span>
                        <span className="px-1.5 py-0.5 bg-[#1a73e8] text-white rounded font-bold">Post</span>
                      </div>
                      <div className="text-[#fbbc04] text-[11px] my-1">★★★★★</div>
                      <p className="text-[8px] text-[#202124] bg-white p-1 rounded border border-[#dadce0] leading-tight">
                        {draft || "…"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Clickable Action Button */}
                <button
                  type="button"
                  onClick={handleCopyCard2}
                  className={`w-full py-1.5 rounded-lg text-[9px] font-semibold text-center shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    stepCard2 === 1
                      ? "bg-[#16a34a] text-white"
                      : "bg-[#397dff] text-white hover:bg-[#2f68db]"
                  }`}
                >
                  <span>📋</span>
                  <span>{stepCard2 === 1 ? "Copied — opening Google…" : "Copy & open Google"}</span>
                </button>

                {/* Interactive Step Navigator Pills */}
                <div className="pt-1.5 mt-1 border-t border-[#e8ecec] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStepCard2(s)}
                        className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center transition-colors cursor-pointer ${
                          stepCard2 === s
                            ? "bg-[#397dff] text-white"
                            : "bg-[#f2f7f7] text-[#6e797b] hover:bg-[#e8ecec]"
                        }`}
                      >
                        {s + 1}
                      </button>
                    ))}
                  </div>
                  <span className="text-[8px] text-[#9aa1a3]">
                    {paused2 ? "Paused (Inspect)" : "Auto-playing 3.3s"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Copy below card */}
          <div className="pt-4 flex items-start gap-2.5">
            <span className="text-base text-[#1a1e23] shrink-0 mt-0.5 font-mono text-xs px-1.5 py-0.5 rounded bg-[#e8ecec]">
              02
            </span>
            <div>
              <p className="text-xs sm:text-sm text-[#515a63] leading-relaxed">
                <strong className="text-[#1a1e23] font-semibold">Edit, copy, paste. </strong>
                The draft is built only from what they tapped, sits in an editable box, and says so. They copy it and paste it on Google — Google doesn&apos;t let anyone pre-fill a review, so that step is real.
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#397dff] font-medium">
                <span>✓ Google link at every rating</span>
                <span>•</span>
                <span>✓ Never auto-posted</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: SCREEN 3 — THE OWNER EXPERIENCE (WEEKLY DIGEST & DASHBOARD) */}
        <div className="flex flex-col justify-between group">
          <div
            className="relative aspect-square rounded-2xl overflow-hidden shadow-v2-rest border border-[#e8ecec] p-3 sm:p-4 flex items-center justify-center"
            onMouseEnter={() => setPaused3(true)}
            onMouseLeave={() => setPaused3(false)}
          >
            {/* Cinematic Scenic Background */}
            <Image
              src="/images/landscape-dolomites-alpine.jpg"
              alt=""
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[#1a1e23]/35 backdrop-blur-[2px]" />

            {/* Smartphone Enclosure */}
            <div className="relative z-10 w-full max-w-[270px] bg-[#1a1e23]/80 p-2 rounded-[30px] shadow-2xl border border-white/30 backdrop-blur-md">
              {/* Dynamic Island */}
              <div className="w-16 h-3 bg-[#111315] rounded-full mx-auto mb-1.5 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a1e23] border border-white/20" />
              </div>

              {/* Screen Interior */}
              <div className="bg-white rounded-[22px] p-3 flex flex-col justify-between min-h-[300px] overflow-hidden shadow-inner">
                {/* Status Bar */}
                <div className="flex items-center justify-between text-[9px] text-[#6e797b] font-mono pb-1 border-b border-[#f0f2f2]">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Video Timeline Progress Bar */}
                <div className="w-full h-1 bg-[#f2f7f7] rounded-full overflow-hidden mt-1.5 mb-1.5">
                  <div
                    key={`c3-${stepCard3}-${paused3}`}
                    className={`h-full bg-[#16a34a] rounded-full ${paused3 ? "w-full" : "animate-[tabFill_3.3s_linear]"}`}
                  />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e8ecec]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{stepCard3 === 0 ? "💬" : "📊"}</span>
                    <span className="text-[11px] font-semibold text-[#1a1e23]">
                      {stepCard3 === 0 ? "Weekly email digest" : "Owner dashboard"}
                    </span>
                  </div>
                  <span className="text-[8px] font-semibold text-[#16a34a] bg-[#ecfdf5] px-1.5 py-0.5 rounded-full">
                    {stepCard3 === 0 ? "Mondays" : "Sample data"}
                  </span>
                </div>

                {/* Dynamic Screen Content */}
                <div className="my-auto py-1">
                  {stepCard3 === 0 ? (
                    /* Stage 0: Weekly digest email to the owner */
                    <div className="bg-[#f0f2f5] p-2 rounded-xl border border-[#e1e4e8]">
                      <div className="bg-white p-2 rounded-lg shadow-2xs border-l-3 border-[#25d366]">
                        <p className="font-bold text-[#1a1e23] text-[9.5px]">
                          📬 Your week at {DEMO.exampleBusiness}
                        </p>
                        <p className="text-[8px] text-[#515a63] mt-0.5">
                          <strong>38</strong> scans · <strong>9</strong> completed · <strong>2</strong> private notes to read.
                        </p>
                        <div className="mt-1 pt-1 border-t border-[#e8ecec] flex items-center justify-between text-[7.5px] text-[#6e797b]">
                          <span>Google rating: <strong>4.4 ★</strong></span>
                          <span className="text-[#25d366] font-bold">+3 reviews this week</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Stage 1: Dashboard readout (sample numbers) */
                    <div>
                      {/* SVG Conversion Curve */}
                      <div className="h-14 w-full relative flex items-end">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                          <path
                            d="M 0,35 L 25,28 L 50,18 L 75,10 L 100,2"
                            fill="none"
                            stroke="#16a34a"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 0,35 L 25,28 L 50,18 L 75,10 L 100,2 L 100,40 L 0,40 Z"
                            fill="url(#greenGrad2)"
                            opacity="0.15"
                          />
                          <defs>
                            <linearGradient id="greenGrad2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#16a34a" />
                              <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>

                      {/* Stats Grid */}
                      <div className="mt-1.5 pt-1.5 border-t border-[#e8ecec] grid grid-cols-3 gap-1 text-center">
                        <div>
                          <p className="text-[7.5px] text-[#6e797b]">Scans</p>
                          <p className="text-[11px] font-bold text-[#1a1e23]">143</p>
                        </div>
                        <div>
                          <p className="text-[7.5px] text-[#6e797b]">Completed</p>
                          <p className="text-[11px] font-bold text-[#16a34a]">28</p>
                        </div>
                        <div>
                          <p className="text-[7.5px] text-[#6e797b]">Rating</p>
                          <p className="text-[11px] font-bold text-[#397dff]">4.3 → 4.5</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Status */}
                <div className="py-1 px-1.5 rounded bg-[#f8fafc] border border-[#e8ecec] flex items-center justify-between text-[8px] text-[#6e797b]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                    <span>QR collecting</span>
                  </span>
                  <span className="text-[#16a34a] font-semibold">Rating checked weekly</span>
                </div>

                {/* Interactive Step Navigator Pills */}
                <div className="pt-1.5 mt-1 border-t border-[#e8ecec] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[0, 1].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStepCard3(s)}
                        className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center transition-colors cursor-pointer ${
                          stepCard3 === s
                            ? "bg-[#16a34a] text-white"
                            : "bg-[#f2f7f7] text-[#6e797b] hover:bg-[#e8ecec]"
                        }`}
                      >
                        {s + 1}
                      </button>
                    ))}
                  </div>
                  <span className="text-[8px] text-[#9aa1a3]">
                    {paused3 ? "Paused (Inspect)" : "Auto-playing 3.3s"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Copy below card */}
          <div className="pt-4 flex items-start gap-2.5">
            <span className="text-base text-[#1a1e23] shrink-0 mt-0.5 font-mono text-xs px-1.5 py-0.5 rounded bg-[#e8ecec]">
              03
            </span>
            <div>
              <p className="text-xs sm:text-sm text-[#515a63] leading-relaxed">
                <strong className="text-[#1a1e23] font-semibold">See what happened. </strong>
                Log in with a one-time email code. See scans, completed flows, which tags customers pick, private feedback, and your Google rating against the day you started.
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#16a34a] font-medium">
                <span>✓ No password</span>
                <span>•</span>
                <span>✓ Weekly email summary</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
