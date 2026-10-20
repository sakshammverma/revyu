"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { FlowButton } from "@/components/flow/Button";
import { GOOGLE_LABEL, PRIVATE_LABEL } from "@/components/flow/CustomerFlow";
import { StarRating } from "@/components/flow/StarRating";
import { TagChips } from "@/components/flow/TagChips";
import { assembleDraft } from "@/lib/flow/draft";
import { getDemoVertical } from "@/lib/marketing/demo";
import { StatTile } from "@/components/ui/Card";
import { InteractiveTag, TryHint, usePlayground, usePrefersReducedMotion } from "./interact";
import { PhoneMockup } from "./PhoneMockup";

const DEMO = getDemoVertical("general");
const TAGS = DEMO.tags.slice(0, 6).map((t, i) => ({ ...t, sort_order: i }));
const STAGE_MS = 3800;

// Autoplay that pauses on hover/focus/interaction and never runs under reduced motion.
function useStages(count: number) {
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setStage((s) => (s + 1) % count), STAGE_MS);
    return () => clearInterval(t);
  }, [paused, reduced, count]);
  return { stage, setStage, paused, setPaused };
}

function Tap({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute w-12 h-12 rounded-full bg-accent/30 border-2 border-accent/60 animate-[tapPulse_1.2s_ease-in-out_infinite] ${className}`}
    />
  );
}

function BrandHeader({ step }: { step?: number }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-line">
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden className="w-2 h-2 rounded-full bg-accent shrink-0" />
          <span className="text-sm font-semibold text-ink truncate">{DEMO.exampleBusiness}</span>
        </div>
        {step && <span className="text-xs text-text-2">Step {step} of 3</span>}
      </div>
      {step && (
        <div aria-hidden className="flex gap-1.5 -mt-1 mb-4">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      )}
    </>
  );
}

// Same two always-available options as the live flow (CR-3).
function StickyBar() {
  return (
    <div className="absolute bottom-0 inset-x-0 bg-sheet/95 border-t border-line px-3 pt-3 pb-2 flex flex-col gap-1">
      <FlowButton variant="outline" tabIndex={-1}>{GOOGLE_LABEL}</FlowButton>
      <span className="min-h-[40px] flex items-center justify-center text-sm font-semibold text-accent-hover underline underline-offset-2">
        {PRIVATE_LABEL}
      </span>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h3 className="font-display text-[26px] leading-tight tracking-tight text-ink">{title}</h3>
      {sub && <p className="text-sm text-text-2 mt-1.5">{sub}</p>}
    </div>
  );
}

function Card({
  photo,
  pauseSet,
  caption,
  stages,
  stage,
  onStage,
  phone,
  num,
  title,
  body,
  chips,
}: {
  photo: string;
  pauseSet: (v: boolean) => void;
  caption: string;
  stages: number;
  stage: number;
  onStage: (s: number) => void;
  phone: React.ReactNode;
  num: string;
  title: string;
  body: string;
  chips: string[];
}) {
  return (
    <div className="flex flex-col group">
      <div
        className="relative rounded-2xl overflow-hidden shadow-v2-rest border border-line py-6 flex flex-col items-center gap-4"
        onMouseEnter={() => pauseSet(true)}
        onMouseLeave={() => pauseSet(false)}
        onFocus={() => pauseSet(true)}
        onBlur={() => pauseSet(false)}
      >
        <Image src={photo} alt="" fill className="object-cover" />
        <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
        <div className="relative z-10">{phone}</div>
        <div className="relative z-10 flex flex-col items-center gap-2 px-4">
          <p className="text-center text-sm font-medium text-white min-h-[40px] max-w-[270px]" aria-live="polite">
            {caption}
          </p>
          <div className="flex gap-2">
            {Array.from({ length: stages }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show screen ${i + 1} of ${stages}`}
                aria-current={stage === i}
                onClick={() => onStage(i)}
                className="group/dot flex h-6 cursor-pointer items-center px-0.5"
              >
                <span
                  aria-hidden
                  className={`block h-2 rounded-full transition-all group-hover/dot:bg-white ${stage === i ? "w-6 bg-white" : "w-2 bg-white/50"}`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="pt-4 flex items-start gap-2.5">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-line text-ink shrink-0 mt-0.5">{num}</span>
        <div>
          <p className="text-xs sm:text-sm text-text-2 leading-relaxed">
            <strong className="text-ink font-semibold">{title} </strong>
            {body}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-accent font-medium">
            {chips.map((c, i) => (
              <span key={c}>{i > 0 && <span className="mr-2">•</span>}✓ {c}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuildCards() {
  const c1 = useStages(3);
  const c2 = useStages(3);
  const c3 = useStages(3);
  const { tried, markTried } = usePlayground("rate");
  const stageTo = (c: { setStage: (s: number) => void }) => (s: number) => {
    markTried();
    c.setStage(s);
  };

  const [rating, setRating] = useState<number | null>(5);
  const [selected, setSelected] = useState<Set<string>>(new Set(TAGS.slice(0, 3).map((t) => t.id)));

  // Same assembler as the live flow. Zero tags gives an empty draft (CR-1).
  const draft = assembleDraft(
    TAGS.filter((t) => selected.has(t.id)),
    { businessName: DEMO.exampleBusiness, vertical: DEMO.key },
    "buildcards-demo"
  );
  const low = rating !== null && rating <= 3;

  function rate(v: number) {
    markTried();
    setRating(v);
    c1.setPaused(true);
    c1.setStage(1);
  }

  function toggle(id: string) {
    markTried();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function copy() {
    markTried();
    navigator.clipboard?.writeText(draft);
    c2.setStage(1);
  }

  const cap1 = [
    "Customer points their camera at your QR. No app to install.",
    low ? "At 1–3 stars they can write to you privately. Google is on the same screen." : "They tap a star. That's the only required step.",
    "They tap what stood out, or skip. Google stays one tap away.",
  ];
  const cap2 = [
    "Their draft is built only from what they tapped. They can edit it.",
    "One tap copies it and sends them to your Google page.",
    "They paste and post from their own Google account. Google doesn't allow pre-filled reviews.",
  ];
  const cap3 = [
    "You get an email the moment someone leaves private feedback.",
    "Your dashboard: how many scanned and how many finished.",
    "Read the message, call or WhatsApp them, mark it resolved.",
  ];

  return (
    <section id="build" className="max-w-[1296px] mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-6 sm:pb-10">
      <div className="max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-50 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
          <span>● The product, screen by screen</span>
        </div>
        <InteractiveTag className="ml-3 align-top" />
        <h2 className="heading-h2 font-display text-ink">Three screens. Scan, tap, paste.</h2>
        <p className="mt-3 text-base sm:text-lg text-text-muted leading-relaxed">
          These are the real screens: what your customer sees on their own phone, what they paste into Google, and what you see
          afterwards. Tap the stars and chips. The draft is built from exactly what you select.
        </p>
        <div className="mt-4">
          <TryHint label="Tap a star or chip, it's the real flow" done={tried} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
        {/* 1. Customer: scan, rate, tag */}
        <Card
          photo="/images/shop-supermart-front.jpg"
          pauseSet={c1.setPaused}
          caption={cap1[c1.stage]}
          stages={3}
          stage={c1.stage}
          onStage={stageTo(c1)}
          num="01"
          title="Scan, rate, tap."
          body="The customer scans the QR on a receipt, card or counter standee with their own camera, picks a star rating, and taps what stood out."
          chips={["No app, no login", "Zero tags is allowed"]}
          phone={
            <PhoneMockup chrome="browser">
              <div className="h-full relative">
                {c1.stage === 0 && (
                  <div className="h-full bg-[#14181c] relative flex flex-col items-center justify-center">
                    <div className="w-[210px] bg-white rounded-2xl p-4 text-center shadow-xl">
                      <p className="text-[13px] font-semibold text-ink">Loved it? Tell us.</p>
                      <div aria-hidden className="mt-2 mx-auto w-[120px] h-[120px] grid grid-cols-5 grid-rows-5 gap-[3px]">
                        {Array.from({ length: 25 }, (_, i) => (
                          <span key={i} className={[0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 20, 22, 23, 24, 8, 16].includes(i) ? "bg-ink rounded-[1px]" : "bg-transparent"} />
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-text-2">Scan with your camera</p>
                    </div>
                    <div className="absolute bottom-16 inset-x-0 flex justify-center">
                      <span className="px-4 py-2 rounded-full bg-[#ffd60a] text-ink text-[14px] font-semibold shadow-lg">
                        revyu.in · Open {DEMO.exampleBusiness}
                      </span>
                    </div>
                  </div>
                )}
                {c1.stage === 1 && (
                  <div className="h-full p-5 pb-36 overflow-hidden bg-sheet">
                    <BrandHeader step={1} />
                    {low ? (
                      <div className="flex flex-col gap-3">
                        <Heading title="Sorry that didn’t go well." sub="Tell them directly. The owner sees private feedback today." />
                        <div className="rounded-xl border border-line-strong bg-white p-3 text-[15px] text-text-muted min-h-[84px]">What went wrong with your visit?</div>
                        <FlowButton tabIndex={-1}>Send privately to the owner</FlowButton>
                        <p className="text-center text-xs font-medium tracking-wider text-text-2 uppercase">or</p>
                        <FlowButton variant="outline" tabIndex={-1}>{GOOGLE_LABEL}</FlowButton>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5 text-center">
                        <Heading title="How was your visit?" sub="Tap a star to rate your experience" />
                        <div className="relative py-3 px-2 bg-paper-subtle/50 rounded-2xl border border-line">
                          <StarRating value={rating} onChange={rate} />
                          {!c1.paused && <Tap className="right-2 top-4" />}
                        </div>
                      </div>
                    )}
                    {!low && <StickyBar />}
                  </div>
                )}
                {c1.stage === 2 && (
                  <div className="h-full p-5 pb-36 overflow-hidden bg-sheet">
                    <BrandHeader step={2} />
                    <div className="flex flex-col gap-4">
                      <Heading title="What stood out?" sub="Tap whatever applies, or skip to continue." />
                      <TagChips tags={TAGS} selected={selected} onToggle={toggle} />
                      <FlowButton tabIndex={-1} onClick={() => c2.setStage(0)}>Assemble my review →</FlowButton>
                    </div>
                    <StickyBar />
                  </div>
                )}
              </div>
            </PhoneMockup>
          }
        />

        {/* 2. Customer: draft, copy, paste on Google */}
        <Card
          photo="/images/shop-supermarket-evening.jpg"
          pauseSet={c2.setPaused}
          caption={cap2[c2.stage]}
          stages={3}
          stage={c2.stage}
          onStage={stageTo(c2)}
          num="02"
          title="Edit, copy, paste."
          body="The draft is built only from what they tapped, sits in an editable box, and says so. They copy it and paste it on Google. Google doesn't let anyone pre-fill a review, so that step is real."
          chips={["Google link at every rating", "Never auto-posted"]}
          phone={
            <PhoneMockup chrome={c2.stage === 2 ? "none" : "browser"}>
              <div className="h-full relative">
                {c2.stage === 0 && (
                  <div className="h-full p-5 pb-36 overflow-hidden bg-sheet">
                    <BrandHeader step={3} />
                    <div className="flex flex-col gap-3">
                      <Heading title="Your review draft" />
                      <div className="px-3.5 py-2.5 rounded-xl bg-accent-50 border border-accent/25 text-sm font-medium leading-snug text-[#1e4fae]">
                        We’ve written this from what you selected. Edit anything. It’s your review.
                      </div>
                      <div className="rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink min-h-[130px]">
                        {draft || <span className="text-text-muted">Empty. The customer can write their own.</span>}
                      </div>
                      <div className="relative">
                        <FlowButton onClick={copy}>Copy &amp; Continue to Google →</FlowButton>
                        {!c2.paused && <Tap className="right-6 -top-1" />}
                      </div>
                    </div>
                    <StickyBar />
                  </div>
                )}
                {c2.stage === 1 && (
                  <div className="h-full p-5 overflow-hidden bg-sheet flex flex-col gap-4">
                    <BrandHeader />
                    <div className="p-3.5 rounded-xl bg-success-50 border border-success/25 flex items-center gap-3">
                      <span aria-hidden className="w-9 h-9 shrink-0 rounded-full bg-success text-white flex items-center justify-center font-bold">✓</span>
                      <div>
                        <p className="text-base font-semibold text-ink">Copied to your clipboard!</p>
                        <p className="text-sm text-text-2">Ready to paste into Google Maps.</p>
                      </div>
                    </div>
                    <p className="text-sm text-text-2 leading-relaxed">
                      Next step: paste your draft into Google Maps. You may need to sign in with your Google account first.
                    </p>
                    <FlowButton onClick={() => c2.setStage(2)}>Open Google Review Page →</FlowButton>
                  </div>
                )}
                {c2.stage === 2 && (
                  <div className="h-full bg-[#f8f9fa] flex flex-col font-sans">
                    <div className="bg-white px-4 py-3 border-b border-[#dadce0] flex items-center justify-between">
                      <div className="leading-tight">
                        <p className="text-[15px] font-semibold text-[#202124]">{DEMO.exampleBusiness}</p>
                        <p className="text-xs text-[#70757a]">Posting publicly</p>
                      </div>
                      <span className="px-4 py-1.5 bg-[#1a73e8] text-white text-[14px] font-semibold rounded-full">Post</span>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-full bg-[#1a73e8] text-white font-bold flex items-center justify-center">Y</span>
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-[#202124]">Your customer</p>
                          <p className="text-xs text-[#70757a]">Their own Google account</p>
                        </div>
                      </div>
                      <div className="text-[#fbbc04] text-3xl tracking-wide">★★★★★</div>
                      <div className="bg-white p-3 rounded-lg border border-[#dadce0] text-[15px] text-[#202124] leading-relaxed min-h-[120px]">
                        {draft || "They paste here, or write their own."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </PhoneMockup>
          }
        />

        {/* 3. Owner: what you see */}
        <Card
          photo="/images/shop-medical-counter.jpg"
          pauseSet={c3.setPaused}
          caption={cap3[c3.stage]}
          stages={3}
          stage={c3.stage}
          onStage={stageTo(c3)}
          num="03"
          title="See what happened."
          body="Log in with a one-time email code. See scans, completed flows, private feedback, and your Google rating against the day you started."
          chips={["No password", "Weekly email summary"]}
          phone={
            <PhoneMockup dark={c3.stage === 0}>
              <div className="h-full relative">
                {c3.stage === 0 && (
                  <div className="h-full bg-gradient-to-b from-[#2b3a55] to-[#0e1113] px-4 pt-10">
                    <p className="text-center text-white/80 text-6xl font-light">9:41</p>
                    <div className="mt-16 bg-white/90 rounded-2xl p-3.5 text-ink shadow-lg animate-[chatBubbleIn_0.4s_ease]">
                      <div className="flex justify-between text-xs text-text-2">
                        <span className="font-semibold">Mail · Revyu</span><span>now</span>
                      </div>
                      <p className="text-[15px] font-semibold mt-1">New private feedback on Revyu</p>
                      <p className="text-sm text-text-2 leading-snug">
                        A customer left private feedback for {DEMO.exampleBusiness}. Rating: 2. View it in your dashboard.
                      </p>
                    </div>
                  </div>
                )}
                {c3.stage === 1 && (
                  <div className="h-full bg-paper flex flex-col">
                    <div className="px-4 py-3 border-b border-line bg-white flex items-center justify-between">
                      <div className="leading-tight">
                        <p className="font-display text-lg text-ink">Revyu</p>
                        <p className="text-xs text-text-2">{DEMO.exampleBusiness}</p>
                      </div>
                      <span className="text-xs font-semibold text-success bg-success-50 px-2 py-1 rounded-full">Collecting</span>
                    </div>
                    <div className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
                      <Heading title="Overview" sub="How your QR code is performing, last 30 days." />
                      <div className="grid grid-cols-3 gap-2">
                        <StatTile label="Total scans" value={143} note="QR opened" />
                        <StatTile label="Completed flows" value={28} note="Copied their draft" />
                        <StatTile label="Conversion" value="20%" note="Scan to complete" highlight />
                      </div>
                      <div className="bg-white rounded-xl border border-line p-3.5">
                        <p className="text-[15px] font-semibold text-ink">1 customer left private feedback</p>
                        <span className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold">Open inbox</span>
                      </div>
                      <p className="text-[11px] text-text-2">Sample numbers</p>
                    </div>
                    <div className="grid grid-cols-5 border-t border-line bg-white pb-6 pt-2 text-center text-[11px] text-text-2">
                      {["Overview", "Feedback", "QR & Print", "Billing", "More"].map((t, i) => (
                        <span key={t} className={i === 0 ? "font-semibold text-accent" : ""}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {c3.stage === 2 && (
                  <div className="h-full bg-paper">
                    <div className="px-4 py-3 border-b border-line bg-white">
                      <p className="font-display text-lg text-ink">Feedback</p>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <Heading title="Feedback" sub="Answer quickly. It's the cheapest way to keep a customer." />
                      <div className="bg-white rounded-xl border border-line p-3.5 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-warning bg-[#fef3c7] px-2 py-0.5 rounded-full">2★</span>
                          <span className="text-xs text-text-2">2h ago</span>
                        </div>
                        <p className="text-[15px] text-ink leading-snug">Billing took too long and nobody told me why. Sample message.</p>
                        <p className="text-xs text-text-2">Contact: +91 98xxx xxxxx</p>
                        <div className="flex gap-2 text-xs font-semibold">
                          <span className="px-3 py-1.5 rounded-lg border border-line-strong">Call</span>
                          <span className="px-3 py-1.5 rounded-lg border border-line-strong">WhatsApp</span>
                          <span className="ml-auto px-3 py-1.5 rounded-lg bg-ink text-white">Mark resolved</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </PhoneMockup>
          }
        />
      </div>
    </section>
  );
}
