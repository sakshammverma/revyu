"use client";

import { useState, useEffect } from "react";
import { assembleDraft } from "@/lib/flow/draft";
import { getDemoVertical } from "@/lib/marketing/demo";

const DEMO = getDemoVertical("general");
const DEMO_TAGS = DEMO.tags.slice(0, 6);

const WORKFLOW_STEPS = [
  {
    id: 0,
    number: "01",
    shortTitle: "Scan & rate",
    title: "Scan the printed QR, tap a star",
    desc: "The customer scans the QR on a receipt, handout card or counter standee with their phone camera. It opens in the browser — no app, no login — and asks one question.",
  },
  {
    id: 1,
    number: "02",
    shortTitle: "Tap tags",
    title: "Tap what stood out — or nothing",
    desc: "Up to eight short tags set for your business. They can pick several, one, or none at all. Picking none is fine: the draft simply stays empty.",
  },
  {
    id: 2,
    number: "03",
    shortTitle: "Edit & copy",
    title: "An editable draft, built only from their taps",
    desc: "The draft is assembled on their phone from the tags they chose and your business name. It opens in an editable box with a permanent note saying so. One tap copies it.",
  },
  {
    id: 3,
    number: "04",
    shortTitle: "Paste on Google",
    title: "Your Google review page opens — they paste",
    desc: "Google doesn’t let anyone pre-fill a review, so the customer pastes the text and posts it from their own Google account. We never post on their behalf.",
  },
  {
    id: 4,
    number: "05",
    shortTitle: "Private feedback",
    title: "Unhappy? They can tell you directly — Google stays one tap away",
    desc: "At 1–3 stars, a private note to you is offered first and the Google button sits right below it, full width. Private feedback lands in your dashboard inbox.",
  },
];

export function ShowcaseDeck() {
  const [activeCenter, setActiveCenter] = useState(2); // Phone 2 (Step 3: Draft & Copy) center front by default
  const [copiedToast, setCopiedToast] = useState(false);
  const [postedToast, setPostedToast] = useState(false);
  const [sentFeedbackToast, setSentFeedbackToast] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    DEMO_TAGS.slice(0, 3).map((t) => t.id)
  );
  const [ownerMode, setOwnerMode] = useState<"lowrating" | "inbox">("lowrating");

  // Real draft assembler, same as the live flow. No tags -> empty (CR-1).
  const draft = assembleDraft(
    DEMO_TAGS.filter((t) => selectedTags.includes(t.id)),
    { businessName: DEMO.exampleBusiness, vertical: DEMO.key },
    "showcase-demo"
  );

  function nextPhone() {
    setActiveCenter((prev) => (prev + 1) % 5);
  }

  function prevPhone() {
    setActiveCenter((prev) => (prev - 1 + 5) % 5);
  }

  function handleCopySimulation() {
    setCopiedToast(true);
    setTimeout(() => {
      setCopiedToast(false);
    }, 3200);
  }

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }

  const currentStep = WORKFLOW_STEPS[activeCenter];

  return (
    <div id="mechanism" className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16">
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            How it works, step by step
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            From a printed QR to a review they wrote themselves.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#6e797b] leading-relaxed">
            Click through the five screens your customer sees. The phones are interactive — tap stars and tags and watch the draft change.
          </p>
        </div>

        {/* Step Selector Pills Nav */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {WORKFLOW_STEPS.map((step) => {
            const isActive = activeCenter === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveCenter(step.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#1a1e23] text-white shadow-v2-elevated"
                    : "bg-[#f2f7f7] text-[#515a63] hover:bg-[#e8ecec] hover:text-[#1a1e23]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                    isActive ? "bg-[#397dff] text-white" : "bg-black/10 text-[#515a63]"
                  }`}
                >
                  {step.number}
                </span>
                <span>{step.shortTitle}</span>
                {step.id === 2 && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-[#397dff]/20 text-[#397dff] rounded font-semibold ml-1">
                    Core
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 5-Phone Fanned Deck Container */}
        <div className="relative w-full py-8 sm:py-12 flex items-center justify-center overflow-hidden min-h-[640px] sm:min-h-[740px] bg-[#fcfcfc] rounded-2xl border border-[#e8ecec]">
          {/* Left 40px Round Arrow Button */}
          <button
            type="button"
            onClick={prevPhone}
            className="absolute left-3 sm:left-8 z-40 w-11 h-11 rounded-full bg-white text-[#1a1e23] shadow-v2-elevated border border-[#e8ecec] flex items-center justify-center hover:bg-[#fcfcfc] hover:scale-105 transition-all cursor-pointer"
            aria-label="Previous workflow step"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right 40px Round Arrow Button */}
          <button
            type="button"
            onClick={nextPhone}
            className="absolute right-3 sm:right-8 z-40 w-11 h-11 rounded-full bg-white text-[#1a1e23] shadow-v2-elevated border border-[#e8ecec] flex items-center justify-center hover:bg-[#fcfcfc] hover:scale-105 transition-all cursor-pointer"
            aria-label="Next workflow step"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Fanned 5 Phones Stage */}
          <div className="relative w-full max-w-[1100px] h-[590px] sm:h-[670px] flex items-center justify-center">
            {/* Phone 0 (Step 1): Scan & rate */}
            <div
              onClick={() => setActiveCenter(0)}
              className={`absolute transition-all duration-500 cursor-pointer hidden md:block ${
                activeCenter === 0
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-10 -translate-x-[360px] scale-[0.82] opacity-75 hover:opacity-95"
              }`}
            >
              <IPhoneFrame isCenter={activeCenter === 0}>
                <div className="bg-white h-full flex flex-col justify-between p-4">
                  {/* Top Bar info */}
                  <div className="text-center pt-1 border-b border-[#e8ecec] pb-3">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-[#f2f7f7] text-[9px] font-medium text-[#515a63] mb-1.5">
                      📍 Scanned from counter standee
                    </span>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#449127]" />
                      <h4 className="text-xs font-bold text-[#1a1e23]">{DEMO.exampleBusiness}</h4>
                    </div>
                    <p className="text-[10px] text-[#6e797b]">{DEMO.exampleLocality} · example</p>
                  </div>

                  {/* Main Question & Rating Box */}
                  <div className="my-auto py-2 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#397dff]/10 text-[#397dff] flex items-center justify-center text-xl font-display mx-auto mb-3 shadow-2xs">
                      ✽
                    </div>
                    <h3 className="text-base font-bold font-display text-[#1a1e23]">
                      How was your visit today?
                    </h3>
                    <p className="text-[11px] text-[#6e797b] mt-1">
                      Tap your rating to start
                    </p>

                    {/* 5 Big Gold Interactive Stars */}
                    <div className="flex items-center justify-center gap-1.5 my-5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRating(star);
                          }}
                          className={`text-2xl transition-transform hover:scale-125 cursor-pointer ${
                            star <= selectedRating ? "text-[#f59e0b] drop-shadow-xs" : "text-[#e2e8f0]"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[10px] font-medium text-[#065f46]">
                      <span>✓</span>
                      <span>{selectedRating} of 5 selected</span>
                    </div>

                    <p className="text-[9px] text-[#9aa1a3] mt-4">
                      No app install · No login · Nothing stored about you
                    </p>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-[#e8ecec]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCenter(1);
                      }}
                      className="w-full py-2.5 bg-[#397dff] text-white rounded-lg text-xs font-semibold shadow-2xs hover:bg-[#2f68db] transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              </IPhoneFrame>
            </div>

            {/* Phone 1 (Step 2): Tag Selection Matrix */}
            <div
              onClick={() => setActiveCenter(1)}
              className={`absolute transition-all duration-500 cursor-pointer ${
                activeCenter === 1
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-15 -translate-x-[180px] sm:-translate-x-[220px] scale-[0.88] opacity-85 hover:opacity-100"
              }`}
            >
              <IPhoneFrame isCenter={activeCenter === 1}>
                <div className="bg-white h-full flex flex-col justify-between p-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#e8ecec]">
                    <span className="text-[10px] font-semibold text-[#1a1e23]">{DEMO.exampleBusiness}</span>
                    <span className="text-[9px] text-[#6e797b] bg-[#f2f7f7] px-2 py-0.5 rounded-full">
                      Step 2 of 3
                    </span>
                  </div>

                  {/* Heading */}
                  <div className="pt-2 text-center">
                    <h3 className="text-sm font-bold text-[#1a1e23]">
                      What stood out?
                    </h3>
                    <p className="text-[10px] text-[#6e797b] mt-0.5">
                      Tap whatever applies — or skip
                    </p>
                  </div>

                  {/* Tag Chips Grid */}
                  <div className="my-auto py-2 flex flex-wrap gap-2 justify-center">
                    {DEMO_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTag(tag.id);
                          }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#397dff] text-white shadow-2xs scale-102"
                              : "bg-[#f2f7f7] text-[#515a63] border border-[#e8ecec] hover:bg-white"
                          }`}
                        >
                          {isSelected ? `✓ ${tag.label}` : `+ ${tag.label}`}
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Assembly Indicator */}
                  <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#397dff]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#397dff] animate-ping" />
                      <span>{selectedTags.length} selected · draft updates as you tap</span>
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-[#e8ecec]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCenter(2);
                      }}
                      className="w-full py-2.5 bg-[#397dff] text-white rounded-lg text-xs font-semibold shadow-2xs hover:bg-[#2f68db] transition-colors"
                    >
                      See my draft →
                    </button>
                  </div>
                </div>
              </IPhoneFrame>
            </div>

            {/* Phone 2 (Step 3 - CENTER FRONT ELEVATED): Editable draft & copy */}
            <div
              onClick={() => setActiveCenter(2)}
              className={`absolute transition-all duration-500 cursor-pointer ${
                activeCenter === 2
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-15 translate-x-0 scale-[0.92] opacity-90"
              }`}
            >
              <IPhoneFrame isCenter={activeCenter === 2}>
                <div className="bg-white h-full flex flex-col justify-between p-4">
                  {/* Business header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#e8ecec]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#449127]" />
                      <span className="text-xs font-semibold text-[#1a1e23]">{DEMO.exampleBusiness}</span>
                    </div>
                    <span className="text-[10px] text-[#449127] font-semibold bg-[#ecfdf5] px-2 py-0.5 rounded-full">
                      {"★".repeat(selectedRating)}
                    </span>
                  </div>

                  {/* Required Disclosure Banner (documents/16-DRAFT-AND-ROUTING.md) */}
                  <div className="pt-2">
                    <div className="p-2 rounded-lg bg-[#f2f7f7] border border-[#e8ecec] flex items-start gap-1.5">
                      <span className="text-[#397dff] text-xs mt-0.5">✽</span>
                      <p className="text-[10px] text-[#515a63] leading-snug">
                        <strong className="text-[#1a1e23]">We&apos;ve written this from what you selected.</strong>{" "}
                        Edit anything — it&apos;s your review.
                      </p>
                    </div>
                  </div>

                  {/* Assembled Review Box */}
                  <div className="my-auto py-2">
                    <div className="p-3 rounded-xl bg-white border-2 border-[#397dff]/20 shadow-2xs text-[11px] text-[#1a1e23] leading-relaxed relative">
                      <p className="font-serif italic text-[#1a1e23]">
                        {draft ? <>&ldquo;{draft}&rdquo;</> : <span className="not-italic text-[#9aa1a3]">No tags picked — this box is empty for them to write in.</span>}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-[#e8ecec] flex items-center justify-between text-[9px] text-[#6e797b]">
                        <span>{draft.length} characters</span>
                        <span className="text-[#397dff] font-medium">Editable</span>
                      </div>
                    </div>

                    {/* Copied Alert Toast */}
                    {copiedToast && (
                      <div className="mt-2 p-2 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-center text-[10px] text-[#065f46] font-semibold animate-[chatBubbleIn_0.3s_ease]">
                        ✓ Copied. Paste it into the box on the next screen.
                      </div>
                    )}
                  </div>

                  {/* Primary 1-Tap Copy & Handoff CTA */}
                  <div className="pt-3 border-t border-[#e8ecec] flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySimulation();
                      }}
                      className="w-full py-2.5 bg-[#397dff] hover:bg-[#2f68db] text-white rounded-lg text-xs font-semibold shadow-v2-button flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                    >
                      <span>📋</span>
                      <span>{copiedToast ? "Copied — opening Google…" : "Copy & open Google"}</span>
                    </button>
                    <p className="text-[9px] text-center text-[#9aa1a3]">
                      Next you&apos;ll see Google — paste in the review box there.
                    </p>
                  </div>
                </div>
              </IPhoneFrame>
            </div>

            {/* Phone 3 (Step 4): Google review page — customer pastes */}
            <div
              onClick={() => setActiveCenter(3)}
              className={`absolute transition-all duration-500 cursor-pointer ${
                activeCenter === 3
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-15 translate-x-[180px] sm:translate-x-[220px] scale-[0.88] opacity-85 hover:opacity-100"
              }`}
            >
              <IPhoneFrame isCenter={activeCenter === 3}>
                <div className="bg-[#f8f9fa] h-full flex flex-col justify-between">
                  {/* Google Maps Header */}
                  <div className="bg-white px-3 py-2 border-b border-[#dadce0] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#5f6368]">✕</span>
                      <div className="leading-tight">
                        <p className="text-[11px] font-bold text-[#202124]">{DEMO.exampleBusiness}</p>
                        <p className="text-[9px] text-[#70757a]">{DEMO.exampleLocality} · Google</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPostedToast(true);
                        setTimeout(() => {
                          setPostedToast(false);
                          setActiveCenter(4);
                        }, 1200);
                      }}
                      className="px-3 py-1 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[11px] font-semibold rounded-full shadow-2xs transition-colors cursor-pointer"
                    >
                      {postedToast ? "Posted ✓" : "Post"}
                    </button>
                  </div>

                  {/* Google Review Form Content */}
                  <div className="p-3 my-auto flex flex-col gap-2.5">
                    {/* User Profile */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white text-xs font-bold flex items-center justify-center">
                        A
                      </div>
                      <div className="leading-tight">
                        <p className="text-[11px] font-semibold text-[#202124]">Your customer</p>
                        <p className="text-[9px] text-[#70757a]">Posting from their own Google account</p>
                      </div>
                    </div>

                    {/* 5 Google Stars */}
                    <div className="flex text-[#fbbc04] text-xl gap-1">
                      {"★".repeat(selectedRating)}
                      <span className="text-[#dadce0]">{"★".repeat(5 - selectedRating)}</span>
                    </div>

                    {/* Pasted Review Textarea Box */}
                    <div className="bg-white p-2.5 rounded-lg border border-[#dadce0] text-[10px] text-[#202124] leading-relaxed shadow-2xs">
                      {draft || "They paste here — or write their own."}
                    </div>

                    {/* Add Photo Prompt */}
                    <div className="flex items-center gap-1.5 text-[10px] text-[#1a73e8] bg-white p-2 rounded-lg border border-[#dadce0]">
                      <span>📷</span>
                      <span>Add photos to your review</span>
                    </div>
                  </div>

                  {/* Footer status */}
                  <div className="p-2.5 bg-white border-t border-[#dadce0] text-center">
                    <span className="text-[9px] text-[#1e7e34] font-medium">
                      They set the stars and paste — Google has no pre-fill
                    </span>
                  </div>
                </div>
              </IPhoneFrame>
            </div>

            {/* Phone 4 (Step 5): Low-rating routing & owner inbox */}
            <div
              onClick={() => setActiveCenter(4)}
              className={`absolute transition-all duration-500 cursor-pointer hidden md:block ${
                activeCenter === 4
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-10 translate-x-[360px] scale-[0.82] opacity-75 hover:opacity-95"
              }`}
            >
              <IPhoneFrame isCenter={activeCenter === 4}>
                <div className="bg-[#f0f2f5] h-full flex flex-col justify-between">
                  {/* Mode Toggle Header */}
                  <div className="bg-[#075e54] text-white px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                        ✽
                      </div>
                      <div className="leading-tight">
                        <p className="text-xs font-semibold">{ownerMode === "lowrating" ? "Customer screen" : "Your dashboard"}</p>
                        <p className="text-[8px] text-[#a0d8d0]">{ownerMode === "lowrating" ? "at 1–3 stars" : "private feedback inbox"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[8px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOwnerMode("lowrating");
                        }}
                        className={`px-1.5 py-0.5 rounded ${
                          ownerMode === "lowrating" ? "bg-white text-[#075e54] font-bold" : "text-white/80"
                        }`}
                      >
                        1–3★
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOwnerMode("inbox");
                        }}
                        className={`px-1.5 py-0.5 rounded ${
                          ownerMode === "inbox" ? "bg-white text-[#075e54] font-bold" : "text-white/80"
                        }`}
                      >
                        Inbox
                      </button>
                    </div>
                  </div>

                  {ownerMode === "lowrating" ? (
                    /* Low-rating screen (CR-3): private is primary, Google is full width, same screen */
                    <div className="p-3 my-auto flex flex-col gap-2 text-[10px] bg-white m-2 rounded-xl shadow-2xs border border-[#e8ecec]">
                      <div className="text-center pb-1">
                        <p className="text-[11px] font-bold text-[#1a1e23]">
                          Sorry that didn&apos;t go well.
                        </p>
                        <p className="text-[9px] text-[#6e797b] mt-0.5">
                          Tell the owner directly — only they see this.
                        </p>
                      </div>

                      <div className="p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-[9px] text-[#9aa1a3] h-14">
                        What went wrong with your visit?
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSentFeedbackToast(true);
                          setTimeout(() => {
                            setSentFeedbackToast(false);
                            setOwnerMode("inbox");
                          }, 900);
                        }}
                        className="w-full py-2.5 bg-[#1a1e23] hover:bg-black text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        {sentFeedbackToast ? "Sent to owner ✓" : "Send privately to the owner"}
                      </button>

                      {/* CR-3: Google stays full width, above the fold, one tap — at every rating */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCenter(3);
                        }}
                        className="w-full py-2.5 border border-[#1a1e23] bg-white hover:bg-[#f8fafc] text-[#1a1e23] rounded text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Post publicly on Google →
                      </button>
                    </div>
                  ) : (
                    /* Owner inbox: private feedback arrives in the dashboard */
                    <div className="p-3 my-auto flex flex-col gap-2 text-[10px]">
                      <div className="self-stretch bg-white p-3 rounded-lg shadow-2xs leading-snug border-l-3 border-[#397dff]">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-[#1a1e23] text-[11px]">2★ · private feedback</p>
                          <span className="text-[9px] text-[#6e797b]">Today</span>
                        </div>
                        <p className="text-[#515a63] mb-1.5">
                          The message the customer typed appears here, with a contact only if they chose to leave one.
                        </p>
                        <div className="pt-1.5 border-t border-[#e8ecec] flex items-center justify-between text-[9px] text-[#6e797b]">
                          <span>Sample</span>
                          <span className="text-[#397dff] font-bold">✓ Mark as resolved</span>
                        </div>
                      </div>

                      <div className="self-stretch bg-white p-2.5 rounded-lg shadow-2xs leading-snug">
                        <p className="text-[10px] text-[#1a1e23]">
                          Private feedback is offered at every rating — and never replaces the Google button.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bottom bar */}
                  <div className="p-2 bg-[#f0f2f5] border-t border-[#e1e4e8] text-center text-[9px] text-[#54656f]">
                    <span>Google button shown at every rating</span>
                  </div>
                </div>
              </IPhoneFrame>
            </div>
          </div>
        </div>

        {/* Dynamic Detail Card for Active Selected Step */}
        <div className="mt-8 p-6 rounded-2xl bg-[#fcfcfc] border border-[#e8ecec] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#397dff] uppercase tracking-wider mb-1">
              <span>Step {currentStep.number}</span>
              <span>•</span>
              <span>{currentStep.shortTitle}</span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-[#1a1e23]">
              {currentStep.title}
            </h4>
            <p className="text-sm text-[#515a63] mt-1 leading-relaxed">
              {currentStep.desc}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={prevPhone}
              className="px-4 py-2 rounded-lg border border-[#e8ecec] text-xs font-semibold text-[#1a1e23] bg-white hover:bg-[#f2f7f7] transition-colors cursor-pointer"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={nextPhone}
              className="px-4 py-2 rounded-lg bg-[#397dff] text-xs font-semibold text-white hover:bg-[#2f68db] shadow-2xs transition-colors cursor-pointer"
            >
              Next Step →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function IPhoneFrame({
  children,
  isCenter = false,
}: {
  children: React.ReactNode;
  isCenter?: boolean;
}) {
  return (
    <div
      className={`rounded-[38px] p-2.5 bg-[#1a1e23] border-[3px] border-[#38414a] shadow-v2-phone overflow-hidden transition-all duration-300 ${
        isCenter ? "w-[280px] sm:w-[310px] h-[520px] sm:h-[580px]" : "w-[260px] sm:w-[280px] h-[480px] sm:h-[530px]"
      }`}
    >
      <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-white flex flex-col">
        {/* Dynamic Island Pill Notch & Speaker */}
        <div className="w-full pt-2 pb-1 bg-transparent flex items-center justify-between px-5 text-[9px] font-semibold text-[#1a1e23] z-20 pointer-events-none">
          <span>9:41</span>
          <div className="w-20 h-4 bg-[#1a1e23] rounded-full mx-auto" />
          <div className="flex items-center gap-1 text-[8px]">
            <span>●●●</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* Bottom Home Indicator Bar */}
        <div className="w-full py-1.5 bg-transparent flex justify-center z-20 pointer-events-none">
          <div className="w-28 h-1 bg-[#1a1e23]/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
