"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";

import { InteractiveTag, useInView } from "./interact";

/**
 * The whole product as one flowchart. The fork is the point: whatever star the
 * customer taps, posting on Google and writing to the owner privately are both
 * open (CR-3). The picker only changes what the flow *leads with*, exactly as
 * the live flow does; it never removes a path.
 */

const ICONS: Record<string, ReactNode> = {
  counter: (
    <>
      <path d="M4 10l1.200-5h13.600L20 10" />
      <path d="M4 10v9h16v-9" />
      <path d="M4 10c0 1.400 1.200 2.500 2.700 2.500S9.300 11.400 9.300 10c0 1.400 1.200 2.500 2.700 2.500s2.700-1.100 2.700-2.500c0 1.400 1.200 2.500 2.700 2.500S20 11.400 20 10" />
      <path d="M10 19v-4h4v4" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5.500A1.500 1.500 0 0 1 5.500 4H8M16 4h2.500A1.500 1.500 0 0 1 20 5.500V8M20 16v2.500a1.500 1.500 0 0 1-1.500 1.500H16M8 20H5.500A1.500 1.500 0 0 1 4 18.500V16" />
      <path d="M8.500 8.500h3v3h-3zM13.500 12.500h2v3h-3v-1.500" />
    </>
  ),
  star: <path d="M12 3.500l2.600 5.300 5.900.9-4.200 4.100 1 5.800L12 16.900l-5.300 2.700 1-5.800L3.500 9.700l5.900-.9z" />,
  draft: (
    <>
      <path d="M5 5.500A1.500 1.500 0 0 1 6.500 4h8L19 8.500v10a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 18.500z" />
      <path d="M8.500 12h7M8.500 15.500h4.500" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.500-5.600-6.500-10.500a6.500 6.500 0 0 1 13 0C18.500 15.400 12 21 12 21z" />
      <circle cx="12" cy="10.500" r="2.300" />
    </>
  ),
  note: (
    <>
      <path d="M4.500 6.500A1.500 1.500 0 0 1 6 5h12a1.500 1.500 0 0 1 1.500 1.500v8A1.500 1.500 0 0 1 18 16h-6.500L7 19.500V16H6a1.500 1.500 0 0 1-1.500-1.500z" />
      <path d="M8.500 9.500h7M8.500 12.500h4" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.500l2.200-7.300A1.700 1.700 0 0 1 7.800 5h8.400a1.700 1.700 0 0 1 1.600 1.200L20 13.500v4A1.500 1.500 0 0 1 18.500 19h-13A1.500 1.500 0 0 1 4 17.500z" />
      <path d="M4 13.500h4.500l1 2h5l1-2H20" />
    </>
  ),
};

function Icon({ name, className = "" }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

type Tone = "plain" | "google" | "private";

const TONES: Record<Tone, { ring: string; icon: string }> = {
  plain: { ring: "border-line", icon: "bg-paper-subtle text-ink" },
  google: { ring: "border-accent/40", icon: "bg-accent text-white" },
  private: { ring: "border-ink/25", icon: "bg-ink-dark text-white" },
};

function Node({
  icon,
  title,
  text,
  tone = "plain",
  badge,
  order,
  stacked,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  tone?: Tone;
  badge?: string;
  /** Position in the reveal sequence. */
  order: number;
  /** Icon above the text even on phones: for the two narrow lanes. */
  stacked?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      style={{ "--i": order } as CSSProperties}
      className={`jm-node relative flex h-full ${stacked ? "flex-col gap-2.5" : "gap-3"} lg:flex-col lg:gap-3 items-start rounded-2xl border bg-white p-3.5 lg:p-4 shadow-v2-rest ${TONES[tone].ring}`}
    >
      {badge && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-ink-dark px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          {badge}
        </span>
      )}
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone].icon}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-text-2">{text}</p>
        {children}
      </div>
    </div>
  );
}

/** A line with a pulse travelling along it. Vertical on phones, horizontal on desktop. */
function Conn({ delay = 0 }: { delay?: number }) {
  return <span aria-hidden className="jm-conn" style={{ "--d": `${delay}s` } as CSSProperties} />;
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="mt-1.5 flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${s <= value ? "text-[#f5a524]" : "text-line-strong"}`} fill="currentColor">
          <path d="M12 2l3.090 6.260L22 9.270l-5 4.870 1.180 6.880L12 17.770l-6.180 3.250L7 14.140 2 9.270l6.910-1.010z" />
        </svg>
      ))}
    </span>
  );
}

const FACTS = [
  "The same two options at 1 star and at 5",
  "Drafts built only from the customer’s own taps",
  "No reward for reviewing, ever",
];

export function JourneyMap() {
  const [stars, setStars] = useState(5);
  const low = stars <= 3;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { threshold: 0.2 });

  return (
    <div className="mx-2 sm:mx-3 mt-10 sm:mt-16">
      <section aria-labelledby="journey-title" className="v2-sheet mx-auto max-w-[1296px] border border-line p-6 sm:p-12 lg:p-16">
        <div className="max-w-3xl">
          <p className="vf-section-label mb-2 flex items-center gap-3 uppercase tracking-wider text-text-2">
            The whole thing on one page <InteractiveTag />
          </p>
          <h2 id="journey-title" className="heading-h2 font-display text-ink">
            One code on your counter. Two honest doors, at every star.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-text-muted sm:text-lg">
            Pick a rating and follow it. Whatever your customer taps, posting on Google and telling you privately are
            both one tap away. That is Google&rsquo;s rule, and it is ours.
          </p>
        </div>

        {/* Rating picker */}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div role="group" aria-label="Pick a star rating to follow" className="flex items-center gap-1 rounded-2xl border border-line bg-paper-subtle/50 p-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`${s} star${s > 1 ? "s" : ""}`}
                aria-pressed={stars === s}
                onClick={() => setStars(s)}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-transform duration-150 hover:bg-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg aria-hidden viewBox="0 0 24 24" className={`h-7 w-7 transition-colors duration-150 ${s <= stars ? "text-[#f5a524]" : "text-[#7f898b]"}`} fill={s <= stars ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
                  <path d="M12 2l3.090 6.260L22 9.270l-5 4.870 1.180 6.880L12 17.770l-6.180 3.250L7 14.140 2 9.270l6.910-1.010z" />
                </svg>
              </button>
            ))}
          </div>
          <p aria-live="polite" className="max-w-xl text-sm leading-snug text-text-2">
            <span className="font-semibold text-ink">
              At {stars} star{stars > 1 ? "s" : ""}:
            </span>{" "}
            {low
              ? "a private note to you is offered first. The Google button sits right under it, full width."
              : "tags, then a draft they can edit. Private feedback stays one tap away."}
          </p>
        </div>

        {/* The map */}
        <div
          ref={ref}
          data-on={inView}
          className="jm-map mt-8 flex flex-col rounded-2xl border border-line bg-[#fcfcfc] p-4 sm:p-6 lg:flex-row lg:items-center lg:p-8"
        >
          <div className="lg:w-[150px] lg:shrink-0">
            <Node order={0} icon="counter" title="A customer pays" text="Your code sits on the counter, receipt or card." />
          </div>
          <Conn delay={0} />
          <div className="lg:w-[150px] lg:shrink-0">
            <Node order={1} icon="scan" title="They scan it" text="Phone camera. No app, no login." />
          </div>
          <Conn delay={0.4} />
          <div className="lg:w-[150px] lg:shrink-0">
            <Node order={2} icon="star" title="They tap a star" text="Any rating, 1 to 5.">
              <Stars value={stars} />
            </Node>
          </div>

          {/* The fork: one line in, two lines out. */}
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="jm-fork hidden w-16 shrink-0 self-stretch lg:block">
            <path className="jm-fork-base" d="M0 50 C 55 50, 45 23, 100 23" />
            <path className="jm-fork-base" d="M0 50 C 55 50, 45 77, 100 77" />
            <path className="jm-fork-pulse" pathLength={100} d="M0 50 C 55 50, 45 23, 100 23" />
            <path className="jm-fork-pulse" pathLength={100} d="M0 50 C 55 50, 45 77, 100 77" />
          </svg>
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="jm-fork h-10 w-full lg:hidden">
            <path className="jm-fork-base" d="M50 0 C 50 60, 25 40, 25 100" />
            <path className="jm-fork-base" d="M50 0 C 50 60, 75 40, 75 100" />
            <path className="jm-fork-pulse" pathLength={100} d="M50 0 C 50 60, 25 40, 25 100" />
            <path className="jm-fork-pulse" pathLength={100} d="M50 0 C 50 60, 75 40, 75 100" />
          </svg>

          {/* Two lanes: side by side on phones, stacked rows on desktop. */}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center">
              <div className="flex-1">
                <Node
                  order={3}
                  stacked
                  tone="google"
                  icon="draft"
                  badge={low ? undefined : "Leads at 4–5"}
                  title={low ? "Their own words" : "Tags, then a draft"}
                  text={low ? "Nothing is written for them. Google is one tap away." : "Built only from what they tapped. They can edit all of it."}
                />
              </div>
              <Conn delay={1.2} />
              <div className="flex-1">
                <Node order={4} stacked tone="google" icon="pin" title="They post on Google" text="Their account, their own star rating. We never post for anyone." />
              </div>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center">
              <div className="flex-1">
                <Node
                  order={3}
                  stacked
                  tone="private"
                  icon="note"
                  badge={low ? "Leads at 1–3" : undefined}
                  title="A private note to you"
                  text={low ? "Offered first, so you hear it directly." : "Always there, for anything they’d rather tell you alone."}
                />
              </div>
              <Conn delay={1.2} />
              <div className="flex-1">
                <Node order={4} stacked tone="private" icon="inbox" title="It lands in your inbox" text="With an email alert, so you can put it right the same day." />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-col gap-2 text-sm text-text-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-center gap-2">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-success-strong" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {fact}
              </li>
            ))}
          </ul>
          <Link href="/compliance" className="shrink-0 text-sm font-semibold text-accent-hover underline underline-offset-4 hover:no-underline">
            Read the rules we follow →
          </Link>
        </div>
      </section>
    </div>
  );
}
