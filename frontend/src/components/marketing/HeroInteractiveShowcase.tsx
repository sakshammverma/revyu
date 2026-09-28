"use client";

import { useState } from "react";

const TAGS = [
  { id: "clean", label: "Spotless & clean", phrase: "the place was spotless and very well maintained" },
  { id: "gentle", label: "Great service", phrase: "the service was excellent and really attentive" },
  { id: "ontime", label: "Zero wait time", phrase: "quick and hassle-free with zero waiting" },
  { id: "friendly", label: "Friendly team", phrase: "the staff were warm, courteous, and attentive" },
];

export function HeroInteractiveShowcase() {
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(["clean", "friendly"]);
  const [copied, setCopied] = useState(false);

  const draftText = selectedTags.length > 0
    ? `Great experience at Sharma General Store! ` +
      selectedTags.map((id) => TAGS.find((t) => t.id === id)?.phrase).filter(Boolean).join(". ") +
      ". Highly recommend!"
    : "Great experience at Sharma General Store. Highly recommend!";

  function toggleTag(id: string) {
    if (selectedTags.includes(id)) {
      setSelectedTags(selectedTags.filter((t) => t !== id));
    } else {
      setSelectedTags([...selectedTags, id]);
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="w-full border-t border-line bg-paper">
      {/* Top Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3 border-b border-line text-xs font-mono text-ink-muted gap-2 bg-paper-subtle/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="font-bold text-ink uppercase tracking-wider">
            [LIVE DEMO // HOW CUSTOMERS REVIEW AT CHECKOUT]
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-ink-subtle uppercase">Average time: 24 seconds</span>
          <span className="text-brand font-bold uppercase bg-brand/10 px-2 py-0.5 border border-brand/20">
            Zero App Install
          </span>
        </div>
      </div>

      {/* 2-Column Split: The Counter Stand on Left, The Customer Phone on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
        {/* Left Column: The Smart Counter Stand Mockup */}
        <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between bg-paper-card">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line text-xs font-mono uppercase text-ink-muted">
              <span className="font-bold text-ink">01 · Counter Stand</span>
              <span className="px-2 py-0.5 border border-line bg-paper-subtle">At Checkout Till</span>
            </div>

            {/* Stylized Minimalist Acrylic Stand Card */}
            <div className="mt-6 p-6 border-2 border-line bg-white shadow-sm flex flex-col items-center text-center relative group hover:border-brand/40 transition-colors">
              <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-lg mb-3 shadow-2xs">
                R
              </div>

              <div className="flex items-center gap-1 text-amber-500 text-sm mb-1">
                ★★★★★
              </div>
              <p className="text-xs font-bold text-ink uppercase tracking-wider">
                Sharma General Store
              </p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Review us on Google
              </p>

              {/* Crisp SVG QR Code */}
              <div className="my-5 p-3 bg-white border border-line shadow-2xs rounded-xs flex items-center justify-center">
                <svg className="w-32 h-32 text-ink" viewBox="0 0 100 100" fill="currentColor">
                  {/* Outer corner markers */}
                  <rect x="10" y="10" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
                  <rect x="16" y="16" width="13" height="13" />
                  <rect x="65" y="10" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
                  <rect x="71" y="16" width="13" height="13" />
                  <rect x="10" y="65" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
                  <rect x="16" y="71" width="13" height="13" />
                  {/* Pattern data dots */}
                  <rect x="42" y="12" width="6" height="6" />
                  <rect x="52" y="18" width="6" height="6" />
                  <rect x="42" y="28" width="6" height="6" />
                  <rect x="12" y="44" width="6" height="6" />
                  <rect x="24" y="48" width="6" height="6" />
                  <rect x="44" y="44" width="12" height="12" fill="var(--brand)" />
                  <rect x="64" y="44" width="6" height="6" />
                  <rect x="76" y="52" width="6" height="6" />
                  <rect x="84" y="44" width="6" height="6" />
                  <rect x="44" y="68" width="6" height="6" />
                  <rect x="56" y="76" width="6" height="6" />
                  <rect x="68" y="68" width="6" height="6" />
                  <rect x="80" y="80" width="6" height="6" />
                </svg>
              </div>

              {/* NFC Sensor Bar */}
              <div className="w-full py-2 px-3 border border-line bg-paper-subtle text-[11px] font-mono uppercase tracking-wider text-ink-muted flex items-center justify-center gap-1.5">
                <span className="text-brand">⚡</span>
                <span>NFC Tap or QR Scan</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line text-xs font-mono text-ink-muted">
            Printed acrylic tent card placed next to the card machine. Customer taps with their phone or points their camera.
          </div>
        </div>

        {/* Right Column: Interactive Customer Smartphone Screen */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line text-xs font-mono uppercase text-ink-muted">
              <span className="font-bold text-brand">02 · Customer Mobile Screen</span>
              <span className="px-2 py-0.5 bg-positive/10 text-positive font-bold border border-positive/20">
                Interactive: Tap to Test
              </span>
            </div>

            {/* Step A: Rating */}
            <div className="mt-5">
              <p className="text-xs font-mono uppercase font-bold text-ink-muted tracking-wider">
                Step 1: Star Rating
              </p>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-2 text-2xl transition-transform hover:scale-125 cursor-pointer"
                    aria-label={`Rate ${star} stars`}
                  >
                    <span className={star <= rating ? "text-amber-500" : "text-zinc-300"}>
                      ★
                    </span>
                  </button>
                ))}
                <span className="ml-3 text-xs font-mono font-bold text-ink">
                  {rating}.0 / 5.0 Rating
                </span>
              </div>
            </div>

            {/* Step B: Guided Compliment Tags */}
            <div className="mt-5 pt-4 border-t border-line">
              <p className="text-xs font-mono uppercase font-bold text-ink-muted tracking-wider mb-2.5">
                Step 2: What stood out? (Eliminates blank-box panic)
              </p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => {
                  const active = selectedTags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? "bg-brand text-white border-brand shadow-2xs"
                          : "bg-paper-subtle text-ink border-line hover:border-brand/50"
                      }`}
                    >
                      <span>{active ? "✓" : "+"}</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step C: Live Assembled Review Draft */}
            <div className="mt-5 pt-4 border-t border-line">
              <div className="flex items-center justify-between mb-2 text-xs font-mono uppercase">
                <span className="font-bold text-brand">Step 3: Live Assembled Draft</span>
                <span className="text-positive font-bold">100% Editable by Customer</span>
              </div>
              <div className="p-3.5 border border-line bg-paper-subtle text-xs sm:text-sm text-ink italic leading-relaxed">
                &ldquo;{draftText}&rdquo;
              </div>

              {/* Action Button: Copy & Handoff */}
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 w-full py-3 px-4 bg-cta hover:bg-cta-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? (
                  <>
                    <span className="text-base">✓</span>
                    <span>Copied! Ready to paste into Google Maps</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy &amp; Open Google Maps Review Page →</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line text-xs font-mono text-ink-muted">
            Customer remains the authentic author. Review is pasted and submitted with their own Google account.
          </div>
        </div>
      </div>
    </div>
  );
}
