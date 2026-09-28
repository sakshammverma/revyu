"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

import { assembleDraft } from "@/lib/flow/draft";
import { getDemoVertical } from "@/lib/marketing/demo";

const WORDS_LINE_1 = ["Good", "work", "nobody", "writes", "down"];
const WORDS_LINE_2 = ["goes", "to", "the", "shop", "next", "door."];

// One slide per supported vertical. Tags come from the real vertical seed
// config; the draft is assembled by the same function the live flow uses.
// Background photos are decorative only.
const STORIES = [
  { name: "Kirana & grocery", business: "Sharma General Store", locality: "Indiranagar, Bengaluru", picks: [0, 2, 4], image: "/images/hero-coastal-scenic.jpg" },
  { name: "Fashion & boutiques", business: "Threads & Co", locality: "Koregaon Park, Pune", picks: [3, 2, 7], image: "/images/landscape-dolomites-alpine.jpg" },
  { name: "Cafés & restaurants", business: "The Corner Table", locality: "Sector 18, Noida", picks: [0, 5, 7], image: "/images/landscape-yosemite-valley.jpg" },
  { name: "Electronics & repairs", business: "FixIt Mobiles", locality: "Anna Nagar, Chennai", picks: [6, 5, 4], image: "/images/landscape-emerald-forest.jpg" },
  { name: "Services & studios", business: "Pathway Studio", locality: "Vijay Nagar, Indore", picks: [3, 1, 0], image: "/images/landscape-ocean-horizon.jpg" },
].map((s) => {
  const v = getDemoVertical("general");
  const tags = s.picks.map((i) => v.tags[i]);
  return {
    name: s.name,
    business: s.business,
    locality: s.locality,
    image: s.image,
    tags,
    draft: assembleDraft(tags, { businessName: s.business, vertical: v.key }, `hero-${s.business}`),
  };
});

export function Hero() {
  const [email, setEmail] = useState("");
  const [activeStory, setActiveStory] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  // Cycle images and customer stories every 3.3 seconds (3300ms)
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setActiveStory((prev) => (prev + 1) % STORIES.length);
      setTimerKey((k) => k + 1);
    }, 3300);

    return () => clearInterval(timer);
  }, [isPaused, activeStory]);

  function handleSelectStory(idx: number) {
    setActiveStory(idx);
    setTimerKey((k) => k + 1);
  }

  const current = STORIES[activeStory];

  return (
    <div className="mx-2 sm:mx-3 my-0">
      {/* White Sheet on a Desk */}
      <section className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] overflow-hidden relative">
        {/* Top Fold: Centered Headline & Subtitle */}
        <div className="pt-14 sm:pt-20 lg:pt-24 pb-6 sm:pb-8 px-4 sm:px-8 text-center max-w-[1140px] mx-auto flex flex-col items-center">
          {/* Staggered Serif H1 (Strictly 2 lines, extended horizontally) */}
          <h1 className="heading-h1 font-display w-full max-w-[1100px] text-center leading-[1.08] text-[#1a1e23]">
            <span className="block whitespace-normal sm:whitespace-nowrap mb-1">
              {WORDS_LINE_1.map((word, idx) => (
                <span
                  key={idx}
                  className="inline-block mr-[0.25em] animate-hero-word"
                  style={{ animationDelay: `${idx * 85}ms` }}
                >
                  {word}
                </span>
              ))}
            </span>
            <span className="block whitespace-normal sm:whitespace-nowrap">
              {WORDS_LINE_2.map((word, idx) => (
                <span
                  key={idx}
                  className="inline-block mr-[0.25em] animate-hero-word"
                  style={{ animationDelay: `${(idx + WORDS_LINE_1.length) * 85}ms` }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h1>

          {/* Sub-copy */}
          <p
            className="mt-6 text-base sm:text-lg text-[#515a63] leading-relaxed max-w-2xl animate-hero-pop text-center"
            style={{ animationDelay: "580ms" }}
          >
            Every happy customer who walks out unasked is a review the shop next door gets instead. One printed code on your counter asks all of them, in a few taps, on their own phone. No app. Nothing to remember.
          </p>
        </div>

        {/* Cinematic Stage with Overlapping Email Pill and 3.3s Dynamic Landscape */}
        <div
          className="relative w-full aspect-[21/9] sm:aspect-[2.8/1] min-h-[420px] sm:min-h-[520px] overflow-hidden group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Stack of Cinematic Landscape Photos with Cross-fade (Non-cartoonish, expansive natural landscapes) */}
          {STORIES.map((story, idx) => (
            <div
              key={story.name}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                activeStory === idx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <Image
                src={story.image}
                alt=""
                aria-hidden="true"
                fill
                priority={idx === 0}
                className="object-cover object-center transform transition-transform duration-10000 ease-out scale-105"
              />
            </div>
          ))}

          {/* Gentle top white fade */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white to-transparent pointer-events-none z-20" />

          {/* Subtle bottom gradient to protect floating cards */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-20" />

          {/* Floating Email Pill — prefills the signup form */}
          <div className="absolute top-2 sm:top-4 left-0 right-0 z-30 flex flex-col items-center px-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) {
                  window.location.href = `/signup?email=${encodeURIComponent(email.trim())}`;
                } else {
                  window.location.href = "/signup";
                }
              }}
              className="w-full max-w-[460px] flex items-center p-1.5 rounded-xl bg-white border border-[#e8ecec] shadow-v2-elevated focus-within:border-[#397dff] transition-all"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your business email"
                className="flex-1 px-4 py-2.5 text-sm text-[#1a1e23] placeholder-[#9aa1a3] bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="btn-primary text-sm py-2.5 px-5 shrink-0 cursor-pointer"
              >
                <span>Start free trial</span>
              </button>
            </form>
          </div>

          {/* 3.3s Auto-Play Indicator Badge (Top right) */}
          <div className="absolute top-4 right-4 sm:right-8 z-30 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-[11px] font-medium border border-white/20">
            <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-amber-400" : "bg-[#397dff] animate-ping"}`} />
            <span>{isPaused ? "Paused" : "Example flow"}</span>
          </div>

          {/* Floating example card: what the customer tapped -> the draft it builds */}
          <div className="absolute bottom-6 right-4 sm:bottom-10 sm:right-10 max-w-[340px] sm:max-w-[420px] bg-white/95 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-v2-elevated border border-white/80 z-30 transition-all duration-500">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e797b]">
                Example · {current.name}
              </span>
              <span className="text-[11px] text-[#9aa1a3]">Customer tapped</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {current.tags.map((t) => (
                <span
                  key={t.id}
                  className="px-2.5 py-1 rounded-full bg-[#e7f5fd] text-[#397dff] text-[11px] font-semibold"
                >
                  ✓ {t.label}
                </span>
              ))}
            </div>
            <p className="font-display text-[#1a1e23] text-sm sm:text-base leading-snug transition-all duration-300">
              &ldquo;{current.draft}&rdquo;
            </p>
            <div className="mt-3.5 pt-3 border-t border-[#e8ecec] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#1a1e23]">{current.business}</p>
                <p className="text-[11px] text-[#6e797b]">{current.locality} · fictional example</p>
              </div>
              <a
                href="/how-it-works"
                className="text-xs font-semibold text-[#397dff] hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
              >
                <span>How it works →</span>
              </a>
            </div>
            <p className="mt-2 text-[11px] text-[#9aa1a3]">
              The customer can edit or clear this before copying it to Google.
            </p>
          </div>
        </div>

        {/* Vertical strip with 3.3s progress underline */}
        <div
          className="w-full border-t border-[#e8ecec] bg-[#ffffff] grid grid-cols-2 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-[#e8ecec] text-xs"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="p-3.5 sm:p-4 flex items-center justify-center font-semibold text-[#6e797b] bg-[#fcfcfc] col-span-2 sm:col-span-1">
            Built for
          </div>
          {STORIES.map((s, idx) => {
            const isActive = activeStory === idx;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => handleSelectStory(idx)}
                className={`relative p-3.5 sm:p-4 flex flex-col justify-center items-start transition-colors cursor-pointer text-left ${
                  isActive ? "bg-white" : "bg-[#fcfcfc] hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className={`font-semibold ${isActive ? "text-[#1a1e23]" : "text-[#6e797b]"}`}>
                    {s.name}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#397dff] shrink-0 ml-auto" />
                  )}
                </div>
                <span className="text-[11px] text-[#9aa1a3] mt-0.5">8 tags, set per business</span>

                {/* 3.3-second Progress underline for active story */}
                {isActive && !isPaused && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#e8ecec] overflow-hidden">
                    <div
                      key={`progress-${idx}-${timerKey}`}
                      className="h-full bg-[#397dff] animate-[tabFill_3.3s_linear]"
                    />
                  </div>
                )}
                {isActive && isPaused && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#397dff]" />
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
