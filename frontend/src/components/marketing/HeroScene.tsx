"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { assembleDraft } from "@/lib/flow/draft";
import { DEMO, DEMO_TAGS, DraftScreen, GoogleScreen, RateScreen, ScanScreen, TagsScreen } from "./FlowScreens";
import type { QrShape } from "@/lib/marketing/qr";
import { HeroCanvas } from "./HeroCanvas";
import { useInView, usePrefersReducedMotion } from "./interact";
import { PhoneMockup } from "./PhoneMockup";
import { Standee3D } from "./Standee3D";

const PICKED = new Set(DEMO_TAGS.slice(0, 3).map((t) => t.id));
const DRAFT = assembleDraft(
  DEMO_TAGS.filter((t) => PICKED.has(t.id)),
  { businessName: DEMO.exampleBusiness, vertical: DEMO.key },
  "hero-scene",
);
const STEPS = ["Scan the code", "Tap a star", "Tap what stood out", "Edit the draft", "Paste on Google"];
const STEP_MS = 2600;
const noop = () => {};

/**
 * The product in one picture: the standee on the counter (its code really opens
 * the demo) and the customer's phone playing the flow. CSS 3D throughout; the
 * WebGL layer behind it is an optional upgrade (see HeroCanvas).
 * The phone is a moving illustration, so it is inert and hidden from assistive
 * tech; the sentence beside it says the same thing in words.
 */
export function HeroScene({ qr, qrSize }: { qr: string; qrSize: number }) {
  const code = { d: qr, size: qrSize };
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(stage, { threshold: 0.2, once: false });
  // Under reduced motion the phone rests on the tags screen, the clearest single frame.
  const [step, setStep] = useState(0);
  const shown = reduced ? 2 : step;

  useEffect(() => {
    if (reduced || !inView) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [reduced, inView]);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    });
  }
  function onLeave() {
    cancelAnimationFrame(frame.current);
    stage.current?.style.removeProperty("--px");
    stage.current?.style.removeProperty("--py");
  }

  return (
    <div
      ref={stage}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="hs-stage mx-auto flex h-[430px] w-full max-w-[560px] items-center justify-center sm:h-[540px] lg:h-[600px]"
    >
      <HeroCanvas />
      <span aria-hidden className="hs-glow" />

      {/* The standee: a real code that opens the demo, shown at every screen size. */}
      <div className="hs-float-slow absolute bottom-0 left-0 z-10 origin-bottom-left scale-[0.56] sm:scale-[0.78] lg:-left-6 lg:scale-90">
        <Standee3D qrPath={qr} qrSize={qrSize} label="QR code that opens the customer demo on your phone" />
      </div>

      {/* The customer's phone */}
      <div aria-hidden inert className="hs-float relative translate-x-12 sm:translate-x-16 lg:translate-x-20">
        <div className="hs-phone">
          <div className="sm:hidden">
            <PhoneMockup scale={0.52} chrome={shown === 0 || shown === 4 ? "none" : "browser"} dark={shown === 0}>
              <Screen step={shown} qr={code} />
            </PhoneMockup>
          </div>
          <div className="hidden sm:block">
            <PhoneMockup scale={0.68} chrome={shown === 0 || shown === 4 ? "none" : "browser"} dark={shown === 0}>
              <Screen step={shown} qr={code} />
            </PhoneMockup>
          </div>
        </div>
      </div>

      {/* What the phone is showing, as a caption with progress */}
      <div aria-hidden className="absolute left-0 top-6 hidden rounded-2xl border border-line bg-white px-4 py-3 text-ink shadow-v2-elevated sm:block lg:top-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-hover">
          Step {shown + 1} of {STEPS.length}
        </p>
        <p className="mt-0.5 text-sm font-semibold">{STEPS[shown]}</p>
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 rounded-full transition-all duration-300 ${i === shown ? "w-6 bg-accent" : i < shown ? "w-2 bg-ink/45" : "w-2 bg-ink/15"}`} />
          ))}
        </div>
      </div>

      <p className="sr-only">
        Illustration: a printed QR standee on a shop counter, and a customer’s phone going through the five steps: scan the
        code, tap a star, tap what stood out, edit the draft, paste it on Google.
      </p>
    </div>
  );
}

function Screen({ step, qr }: { step: number; qr: QrShape }) {
  return (
    <div key={step} className="flow-step h-full">
      {step === 0 && <ScanScreen qr={qr} />}
      {step === 1 && <RateScreen rating={5} onRate={noop} />}
      {step === 2 && <TagsScreen selected={PICKED} onToggle={noop} />}
      {step === 3 && <DraftScreen draft={DRAFT} />}
      {step === 4 && <GoogleScreen draft={DRAFT} rating={5} />}
    </div>
  );
}
