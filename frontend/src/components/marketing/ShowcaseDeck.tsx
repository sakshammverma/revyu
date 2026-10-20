"use client";

import { useRef, useState } from "react";
import { assembleDraft } from "@/lib/flow/draft";
import { getDemoVertical } from "@/lib/marketing/demo";
import { GhostHand, InteractiveTag, TryHint, useInView, usePlayground } from "./interact";

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
  const { tried, markTried } = usePlayground("draft");
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { threshold: 0.5 });
  const go = (i: number) => {
    markTried();
    setActiveCenter(i);
  };
  // Side phones: a click brings them to the front. Keyboard and screen-reader users have the step
  // pills and Prev/Next buttons for that, so the phone itself is not a button (a button can't hold buttons).
  const sidePhone = () => ({});
  // The ghost shows the real flow: focus the tag phone, add two tags, open the draft.
  const demoStep = (n: number) => {
    if (tried) return;
    if (n === 0) setActiveCenter(1);
    if (n === 1) setSelectedTags((t) => (t.includes(DEMO_TAGS[3].id) ? t : [...t, DEMO_TAGS[3].id]));
    if (n === 2) setSelectedTags((t) => (t.includes(DEMO_TAGS[4].id) ? t : [...t, DEMO_TAGS[4].id]));
    if (n === 3) setActiveCenter(2);
  };
  const [ownerMode, setOwnerMode] = useState<"lowrating" | "inbox">("lowrating");

  // Real draft assembler, same as the live flow. No tags -> empty (CR-1).
  const draft = assembleDraft(
    DEMO_TAGS.filter((t) => selectedTags.includes(t.id)),
    { businessName: DEMO.exampleBusiness, vertical: DEMO.key },
    "showcase-demo"
  );

  function nextPhone() {
    markTried();
    setActiveCenter((prev) => (prev + 1) % 5);
  }

  function prevPhone() {
    markTried();
    setActiveCenter((prev) => (prev - 1 + 5) % 5);
  }

  function handleCopySimulation() {
    setCopiedToast(true);
    setTimeout(() => {
      setCopiedToast(false);
    }, 3200);
  }

  function toggleTag(tag: string) {
    markTried();
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  }

  const currentStep = WORKFLOW_STEPS[activeCenter];

  return (
    <div id="mechanism" className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-line p-6 sm:p-12 lg:p-16">
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-text-2 flex items-center gap-3">
            How it works, step by step <InteractiveTag />
          </p>
          <h2 className="heading-h2 font-display text-ink">
            From a printed QR to a review they wrote themselves.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-text-muted leading-relaxed">
            Click through the five screens your customer sees. The phones are interactive — tap stars and tags and watch the draft change.
          </p>
          <div className="mt-4">
            <TryHint label="Tap tags and watch the review write itself" done={tried} />
          </div>
        </div>

        {/* Step Selector Pills Nav */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {WORKFLOW_STEPS.map((step) => {
            const isActive = activeCenter === step.id;
            return (
              <button
                key={step.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => go(step.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-ink text-white shadow-v2-elevated"
                    : "bg-bg text-text-2 hover:bg-line hover:text-ink"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                    isActive ? "bg-accent text-white" : "bg-black/10 text-text-2"
                  }`}
                >
                  {step.number}
                </span>
                <span>{step.shortTitle}</span>
                {step.id === 2 && (
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ml-1 ${isActive ? "bg-white/20 text-white" : "bg-accent/20 text-accent-hover"}`}>
                    Core
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 5-Phone Fanned Deck Container */}
        <div className="relative w-full py-8 sm:py-12 flex items-center justify-center overflow-hidden min-h-[640px] sm:min-h-[740px] bg-[#fcfcfc] rounded-2xl border border-line">
          {/* Left 40px Round Arrow Button */}
          <button
            type="button"
            onClick={prevPhone}
            className="absolute left-3 sm:left-8 z-40 w-11 h-11 rounded-full bg-white text-ink shadow-v2-elevated border border-line flex items-center justify-center hover:bg-[#fcfcfc] hover:scale-105 transition-all cursor-pointer"
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
            className="absolute right-3 sm:right-8 z-40 w-11 h-11 rounded-full bg-white text-ink shadow-v2-elevated border border-line flex items-center justify-center hover:bg-[#fcfcfc] hover:scale-105 transition-all cursor-pointer"
            aria-label="Next workflow step"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Fanned 5 Phones Stage */}
          <div ref={stageRef} className="relative w-full max-w-[1100px] h-[590px] sm:h-[670px] flex items-center justify-center">
            <GhostHand
              play={inView && !tried}
              stepMs={1100}
              onStep={demoStep}
              path={[
                { x: "34%", y: "55%" },
                { x: "42%", y: "46%" },
                { x: "56%", y: "46%" },
                { x: "50%", y: "84%" },
              ]}
            />
            {/* Phone 0 (Step 1): Scan & rate */}
            <div
              onClick={() => go(0)}
              {...sidePhone()}
              className={`absolute transition-all duration-500 cursor-pointer ${activeCenter === 0 ? "block" : "hidden md:block"} ${
                activeCenter === 0
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-10 -translate-x-[360px] scale-[0.82] opacity-75 hover:opacity-95"
              }`}
            >
              <div inert={activeCenter !== 0}>
              <IPhoneFrame isCenter={activeCenter === 0}>
                <div className="bg-white h-full flex flex-col justify-between p-4">
                  {/* Top Bar info */}
                  <div className="text-center pt-1 border-b border-line pb-3">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-bg text-[9px] font-medium text-text-2 mb-1.5">
                      📍 Scanned from counter standee
                    </span>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <h4 className="text-xs font-bold text-ink">{DEMO.exampleBusiness}</h4>
                    </div>
                    <p className="text-[10px] text-text-muted">{DEMO.exampleLocality} · example</p>
                  </div>

                  {/* Main Question & Rating Box */}
                  <div className="my-auto py-2 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent-hover flex items-center justify-center text-xl font-display mx-auto mb-3 shadow-2xs">
                      ✽
                    </div>
                    <h3 className="text-base font-bold font-display text-ink">
                      How was your visit today?
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">
                      Tap your rating to start
                    </p>

                    {/* 5 Big Gold Interactive Stars */}
                    <div className="flex items-center justify-center gap-1.5 my-5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`${star} star${star > 1 ? "s" : ""}`}
                          aria-pressed={star === selectedRating}
                          onClick={(e) => {
                            e.stopPropagation();
                            markTried();
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

                    <p className="text-[9px] text-text-muted mt-4">
                      No app install · No login · Nothing stored about you
                    </p>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        go(1);
                      }}
                      className="w-full py-2.5 bg-accent text-white rounded-lg text-xs font-semibold shadow-2xs hover:bg-accent transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              </IPhoneFrame>
              </div>
            </div>

            {/* Phone 1 (Step 2): Tag Selection Matrix */}
            <div
              onClick={() => go(1)}
              {...sidePhone()}
              className={`absolute transition-all duration-500 cursor-pointer ${
                activeCenter === 1
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-15 -translate-x-[180px] sm:-translate-x-[220px] scale-[0.88] opacity-85 hover:opacity-100"
              }`}
            >
              <div inert={activeCenter !== 1}>
              <IPhoneFrame isCenter={activeCenter === 1}>
                <div className="bg-white h-full flex flex-col justify-between p-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="text-[10px] font-semibold text-ink">{DEMO.exampleBusiness}</span>
                    <span className="text-[9px] text-text-muted bg-bg px-2 py-0.5 rounded-full">
                      Step 2 of 3
                    </span>
                  </div>

                  {/* Heading */}
                  <div className="pt-2 text-center">
                    <h3 className="text-sm font-bold text-ink">
                      What stood out?
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">
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
                          aria-pressed={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTag(tag.id);
                          }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-accent text-white shadow-2xs scale-102"
                              : "bg-bg text-text-2 border border-line hover:bg-white"
                          }`}
                        >
                          {isSelected ? `✓ ${tag.label}` : `+ ${tag.label}`}
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Assembly Indicator */}
                  <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-accent-hover">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                      <span>{selectedTags.length} selected · draft updates as you tap</span>
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        go(2);
                      }}
                      className="w-full py-2.5 bg-accent text-white rounded-lg text-xs font-semibold shadow-2xs hover:bg-accent transition-colors"
                    >
                      See my draft →
                    </button>
                  </div>
                </div>
              </IPhoneFrame>
              </div>
            </div>

            {/* Phone 2 (Step 3 - CENTER FRONT ELEVATED): Editable draft & copy */}
            <div
              onClick={() => go(2)}
              {...sidePhone()}
              className={`absolute transition-all duration-500 cursor-pointer ${
                activeCenter === 2
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-15 translate-x-0 scale-[0.92] opacity-90"
              }`}
            >
              <div inert={activeCenter !== 2}>
              <IPhoneFrame isCenter={activeCenter === 2}>
                <div className="bg-white h-full flex flex-col justify-between p-4">
                  {/* Business header */}
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-xs font-semibold text-ink">{DEMO.exampleBusiness}</span>
                    </div>
                    <span className="text-[10px] text-success-strong font-semibold bg-[#ecfdf5] px-2 py-0.5 rounded-full">
                      {"★".repeat(selectedRating)}
                    </span>
                  </div>

                  {/* Required Disclosure Banner (documents/16-DRAFT-AND-ROUTING.md) */}
                  <div className="pt-2">
                    <div className="p-2 rounded-lg bg-bg border border-line flex items-start gap-1.5">
                      <span className="text-accent-hover text-xs mt-0.5">✽</span>
                      <p className="text-[10px] text-text-2 leading-snug">
                        <strong className="text-ink">We&apos;ve written this from what you selected.</strong>{" "}
                        Edit anything — it&apos;s your review.
                      </p>
                    </div>
                  </div>

                  {/* Assembled Review Box */}
                  <div className="my-auto py-2">
                    <div className="p-3 rounded-xl bg-white border-2 border-accent/20 shadow-2xs text-[11px] text-ink leading-relaxed relative">
                      <p className="font-serif italic text-ink">
                        {draft ? <>&ldquo;{draft}&rdquo;</> : <span className="not-italic text-text-muted">No tags picked — this box is empty for them to write in.</span>}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-[9px] text-text-muted">
                        <span>{draft.length} characters</span>
                        <span className="text-accent-hover font-medium">Editable</span>
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
                  <div className="pt-3 border-t border-line flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySimulation();
                      }}
                      className="w-full py-2.5 bg-accent hover:bg-accent text-white rounded-lg text-xs font-semibold shadow-v2-btn flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                    >
                      <span>📋</span>
                      <span>{copiedToast ? "Copied — opening Google…" : "Copy & open Google"}</span>
                    </button>
                    <p className="text-[9px] text-center text-text-muted">
                      Next you&apos;ll see Google — paste in the review box there.
                    </p>
                  </div>
                </div>
              </IPhoneFrame>
              </div>
            </div>

            {/* Phone 3 (Step 4): Google review page — customer pastes */}
            <div
              onClick={() => go(3)}
              {...sidePhone()}
              className={`absolute transition-all duration-500 cursor-pointer ${
                activeCenter === 3
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-15 translate-x-[180px] sm:translate-x-[220px] scale-[0.88] opacity-85 hover:opacity-100"
              }`}
            >
              <div inert={activeCenter !== 3}>
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
                          go(4);
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
                    <div aria-hidden className="flex text-[#fbbc04] text-xl gap-1">
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
            </div>

            {/* Phone 4 (Step 5): Low-rating routing & owner inbox */}
            <div
              onClick={() => go(4)}
              {...sidePhone()}
              className={`absolute transition-all duration-500 cursor-pointer ${activeCenter === 4 ? "block" : "hidden md:block"} ${
                activeCenter === 4
                  ? "z-30 scale-100 opacity-100 shadow-v2-phone"
                  : "z-10 translate-x-[360px] scale-[0.82] opacity-75 hover:opacity-95"
              }`}
            >
              <div inert={activeCenter !== 4}>
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
                    <div className="p-3 my-auto flex flex-col gap-2 text-[10px] bg-white m-2 rounded-xl shadow-2xs border border-line">
                      <div className="text-center pb-1">
                        <p className="text-[11px] font-bold text-ink">
                          Sorry that didn&apos;t go well.
                        </p>
                        <p className="text-[9px] text-text-muted mt-0.5">
                          Tell the owner directly — only they see this.
                        </p>
                      </div>

                      <div className="p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-[9px] text-text-muted h-14">
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
                        className="w-full py-2.5 bg-ink hover:bg-black text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        {sentFeedbackToast ? "Sent to owner ✓" : "Send privately to the owner"}
                      </button>

                      {/* CR-3: Google stays full width, above the fold, one tap — at every rating */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          go(3);
                        }}
                        className="w-full py-2.5 border border-ink bg-white hover:bg-[#f8fafc] text-ink rounded text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Post publicly on Google →
                      </button>
                    </div>
                  ) : (
                    /* Owner inbox: private feedback arrives in the dashboard */
                    <div className="p-3 my-auto flex flex-col gap-2 text-[10px]">
                      <div className="self-stretch bg-white p-3 rounded-lg shadow-2xs leading-snug border-l-3 border-accent">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-ink text-[11px]">2★ · private feedback</p>
                          <span className="text-[9px] text-text-muted">Today</span>
                        </div>
                        <p className="text-text-2 mb-1.5">
                          The message the customer typed appears here, with a contact only if they chose to leave one.
                        </p>
                        <div className="pt-1.5 border-t border-line flex items-center justify-between text-[9px] text-text-muted">
                          <span>Sample</span>
                          <span className="text-accent-hover font-bold">✓ Mark as resolved</span>
                        </div>
                      </div>

                      <div className="self-stretch bg-white p-2.5 rounded-lg shadow-2xs leading-snug">
                        <p className="text-[10px] text-ink">
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
        </div>

        {/* Dynamic Detail Card for Active Selected Step */}
        <div className="mt-8 p-6 rounded-2xl bg-[#fcfcfc] border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent-hover uppercase tracking-wider mb-1">
              <span>Step {currentStep.number}</span>
              <span>•</span>
              <span>{currentStep.shortTitle}</span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-ink">
              {currentStep.title}
            </h4>
            <p className="text-sm text-text-2 mt-1 leading-relaxed">
              {currentStep.desc}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={prevPhone}
              className="px-4 py-2 rounded-lg border border-line text-xs font-semibold text-ink bg-white hover:bg-bg transition-colors cursor-pointer"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={nextPhone}
              className="px-4 py-2 rounded-lg bg-accent text-xs font-semibold text-white hover:bg-accent shadow-2xs transition-colors cursor-pointer"
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
      className={`rounded-[38px] p-2.5 bg-ink border-[3px] border-[#38414a] shadow-v2-phone overflow-hidden transition-all duration-300 ${
        isCenter ? "w-[280px] sm:w-[310px] h-[520px] sm:h-[580px]" : "w-[260px] sm:w-[280px] h-[480px] sm:h-[530px]"
      }`}
    >
      <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-white flex flex-col">
        {/* Dynamic Island Pill Notch & Speaker */}
        <div className="w-full pt-2 pb-1 bg-transparent flex items-center justify-between px-5 text-[9px] font-semibold text-ink z-20 pointer-events-none">
          <span>9:41</span>
          <div className="w-20 h-4 bg-ink rounded-full mx-auto" />
          <div className="flex items-center gap-1 text-[8px]">
            <span>●●●</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* Bottom Home Indicator Bar */}
        <div className="w-full py-1.5 bg-transparent flex justify-center z-20 pointer-events-none">
          <div className="w-28 h-1 bg-ink/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
