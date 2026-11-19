"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { assembleDraft } from "@/lib/flow/draft";
import type { QrShape } from "@/lib/marketing/qr";
import { DEMO, DEMO_TAGS, DraftScreen, GoogleScreen, OwnerScreen, RateScreen, ScanScreen, TagsScreen } from "./FlowScreens";
import { InteractiveTag, TryHint, usePlayground, usePrefersReducedMotion } from "./interact";
import { PhoneMockup } from "./PhoneMockup";

const STEPS = [
  {
    title: "They scan the code on your counter",
    body: "With their own phone camera, from a standee, a sticker, a card or the bill. It opens as a web page.",
    chips: ["No app", "No login"],
  },
  {
    title: "They tap a star",
    body: "Any rating, one to five. Posting on Google and writing to you privately are both on screen from here on, whatever they tap.",
    chips: ["Try it: tap a star", "Same options at every rating"],
  },
  {
    title: "They tap what stood out",
    body: "Up to eight tags that you choose for your business. They can pick several, or none.",
    chips: ["Try it: tap the tags", "Zero tags is fine"],
  },
  {
    title: "A draft appears, in their words",
    body: "Built only from what they tapped, in a box they can edit or clear. Nothing is written for them in advance.",
    chips: ["Always editable", "No stored reviews"],
  },
  {
    title: "They paste it on Google",
    body: "One tap copies the draft and opens your Google review page. They post from their own account. Google allows no shortcut here, so we don’t pretend there is one.",
    chips: ["Their account", "Never auto-posted"],
  },
  {
    title: "You see what happened",
    body: "Scans, completed flows and what customers praise, plus a private inbox for anything they would rather tell you alone.",
    chips: ["Email alerts", "No password to remember"],
  },
];

/**
 * How it works, told once. On desktop the phone stays pinned while the steps
 * scroll past it; on phones the same steps are a tap-through. The star and tag
 * screens are the real flow components, so the draft is built from what the
 * visitor actually taps.
 */
export function FlowStory({ qr, heading = "h2" }: { qr: QrShape; heading?: "h2" | "none" }) {
  const [active, setActive] = useState(0);
  const [rating, setRating] = useState<number | null>(5);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEMO_TAGS.slice(0, 3).map((t) => t.id)));
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();
  const { tried, markTried } = usePlayground("rate");

  const draft = assembleDraft(
    DEMO_TAGS.filter((t) => selected.has(t.id)),
    { businessName: DEMO.exampleBusiness, vertical: DEMO.key },
    "flow-story",
  );

  // Desktop: the step crossing the middle of the screen is the one on the phone.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    let io: IntersectionObserver | undefined;
    const wire = () => {
      io?.disconnect();
      if (!mq.matches) return;
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
          }
        },
        { rootMargin: "-48% 0px -48% 0px" },
      );
      items.current.forEach((el) => el && io!.observe(el));
    };
    wire();
    mq.addEventListener("change", wire);
    return () => {
      mq.removeEventListener("change", wire);
      io?.disconnect();
    };
  }, []);

  function go(i: number) {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    if (window.matchMedia("(min-width: 1024px)").matches) {
      items.current[next]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    } else {
      setActive(next);
    }
  }

  function rate(v: number) {
    markTried();
    setRating(v);
  }
  function toggle(id: string) {
    markTried();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const phone = (scale: number) => (
    <PhoneMockup scale={scale} chrome={active >= 1 && active <= 3 ? "browser" : "none"} dark={active === 0}>
      <div key={active} className="flow-step h-full">
        {active === 0 && <ScanScreen qr={qr} />}
        {active === 1 && <RateScreen rating={rating} onRate={rate} />}
        {active === 2 && <TagsScreen selected={selected} onToggle={toggle} onNext={() => go(3)} />}
        {active === 3 && <DraftScreen draft={draft} onCopy={() => go(4)} />}
        {active === 4 && <GoogleScreen draft={draft} rating={rating ?? 5} />}
        {active === 5 && <OwnerScreen />}
      </div>
    </PhoneMockup>
  );

  const step = STEPS[active];

  return (
    <section id="how" aria-labelledby={heading === "h2" ? "how-title" : undefined} className="mx-auto max-w-[1296px] px-4 pb-6 pt-16 sm:px-8 sm:pt-24">
      {heading === "h2" && (
        <div className="max-w-3xl">
          <p className="vf-section-label mb-2 flex items-center gap-3 uppercase tracking-wider">
            How it works <InteractiveTag />
          </p>
          <h2 id="how-title" className="heading-h2">
            Scan. Tap. Paste. That is the whole thing.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-text-muted sm:text-lg">
            These are the real screens, on a fictional shop. Tap the stars and the tags: the draft is built from exactly what
            you pick.
          </p>
          <div className="mt-4">
            <TryHint label="Tap a star or a tag on the phone" done={tried} />
          </div>
        </div>
      )}

      {/* Desktop: steps scroll, phone stays */}
      <div className="mt-12 hidden gap-16 lg:grid lg:grid-cols-[1fr_auto]">
        <ol className="relative" style={{ "--fs-progress": (active + 1) / STEPS.length } as CSSProperties}>
          <span aria-hidden className="fs-rail" />
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <li
                key={s.title}
                ref={(el) => {
                  items.current[i] = el;
                }}
                data-step={i}
                className="relative flex min-h-[38vh] items-center pl-14"
              >
                <span
                  aria-hidden
                  className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-300 ${
                    i <= active ? "border-accent bg-accent text-white" : "border-line-strong bg-bg text-text-2"
                  }`}
                >
                  {i + 1}
                </span>
                <div
                  className={`max-w-xl rounded-2xl border p-6 transition-all duration-300 ${
                    on ? "border-line bg-white shadow-v2-elevated" : "border-transparent"
                  }`}
                >
                  <h3 className="heading-h3">{s.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-text-2">{s.body}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {s.chips.map((c) => (
                      <li key={c} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-text-2">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="sticky top-24 h-fit self-start pb-10">
          <div className="relative">
            <span aria-hidden className="absolute -inset-8 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative">{phone(0.8)}</div>
          </div>
        </div>
      </div>

      {/* Phones and tablets: the same steps, one tap at a time */}
      <div className="mt-8 flex flex-col items-center lg:hidden">
        <div className="relative">
          <span aria-hidden className="absolute -inset-6 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative">{phone(0.62)}</div>
        </div>
        <div className="mt-6 w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-v2-rest" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">
            Step {active + 1} of {STEPS.length}
          </p>
          <h3 className="mt-1 font-display text-xl leading-snug text-ink">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-2">{step.body}</p>
        </div>
        <div className="mt-4 flex w-full max-w-md items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(active - 1)}
            disabled={active === 0}
            className="min-h-[44px] rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink disabled:opacity-40"
          >
            ← Back
          </button>
          <div aria-hidden className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-accent" : "w-1.5 bg-line-strong"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(active === STEPS.length - 1 ? 0 : active + 1)}
            className="btn-primary min-h-[44px] px-4"
          >
            {active === STEPS.length - 1 ? "Start again" : "Next →"}
          </button>
        </div>
      </div>
    </section>
  );
}
