import type { ReactNode } from "react";

import { Reveal } from "./Reveal";

// Five-point star centred on 0,0 with an outer radius of 4.
const STAR = "M0 -4L1 -1.38L3.8 -1.24L1.62 .53L2.35 3.24L0 1.7L-2.35 3.24L-1.62 .53L-3.8 -1.24L-1 -1.38Z";

// Three ways a shop asks for reviews, framed by what each one costs the owner.
// No named competitors and no invented figures.
const WAYS: { title: string; tag: string; best?: boolean; icon: ReactNode; rows: [string, string][] }[] = [
  {
    title: "Asking by memory",
    tag: "What most shops do",
    // A shopper with a thought bubble holding a faded, dashed star: the review
    // that was meant to be asked for and never was.
    icon: (
      <>
        <circle cx="17" cy="24" r="5.5" className="fill-ink/70" />
        <path d="M6 42c.8-6.5 5-10 11-10s10.2 3.5 11 10z" className="fill-ink/70" />
        <circle cx="24.5" cy="20" r="1.4" className="fill-white stroke-line-strong" strokeWidth={1.2} />
        <circle cx="27" cy="16.5" r="2" className="fill-white stroke-line-strong" strokeWidth={1.2} />
        <rect x="25" y="1" width="22" height="17" rx="8.5" className="fill-white stroke-line-strong" strokeWidth={1.2} />
        <path d={STAR} transform="translate(36 9.8) scale(1.5)" className="fill-star/30 stroke-star" strokeWidth={0.9} strokeDasharray="1.4 1" strokeLinejoin="round" />
      </>
    ),
    rows: [
      ["When", "Only when you happen to remember"],
      ["Who", "The few who come to mind"],
      ["Your effort", "Your attention, every single day"],
      ["What you see", "Nothing"],
    ],
  },
  {
    title: "A message days later",
    tag: "SMS or WhatsApp follow-ups",
    // A phone with an unanswered message and a clock: the ask arrives late.
    icon: (
      <>
        <rect x="9" y="4" width="21" height="38" rx="4" className="fill-white stroke-ink" strokeWidth={2} />
        <path d="M17 8.5h5" className="stroke-ink/40" strokeWidth={1.6} strokeLinecap="round" />
        <rect x="13" y="13" width="12" height="6" rx="2" className="fill-line-strong" />
        <rect x="17" y="22" width="9" height="5" rx="2" className="fill-accent/60" />
        <circle cx="33" cy="34" r="9.5" className="fill-warning stroke-paper-subtle" strokeWidth={2.5} />
        <path d="M33 29.5V34l3 2" className="fill-none stroke-white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    rows: [
      ["When", "Days later, when the feeling has gone"],
      ["Who", "Only people whose number you hold"],
      ["Your effort", "A list, a message, a follow-up. Every time"],
      ["What you see", "Messages sent"],
    ],
  },
  {
    title: "A code on your counter",
    tag: "Revyu",
    best: true,
    // A counter standee: stars, a QR code and a caption line, on a base.
    icon: (
      <>
        <rect x="9" y="40" width="30" height="3.5" rx="1.75" className="fill-white/45" />
        <rect x="13" y="4" width="22" height="36" rx="3" className="fill-white" />
        {[18.5, 24, 29.5].map((x) => (
          <path key={x} d={STAR} transform={`translate(${x} 9.5) scale(0.5)`} className="fill-star" />
        ))}
        {[
          [17, 14],
          [26, 14],
          [17, 23],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="5" height="5" rx="0.8" className="fill-ink" />
            <rect x={x + 1} y={y + 1} width="3" height="3" rx="0.4" className="fill-white" />
            <rect x={x + 1.75} y={y + 1.75} width="1.5" height="1.5" className="fill-ink" />
          </g>
        ))}
        <path d="M26 23h2v2h-2zM29 26h2v2h-2zM26 26.5h2v1.5h-2zM28.5 23h1.5v1.5h-1.5z" className="fill-ink" />
        <rect x="18" y="33" width="12" height="1.6" rx="0.8" className="fill-line-strong" />
      </>
    ),
    rows: [
      ["When", "At the counter, while they are still smiling"],
      ["Who", "Everyone who sees the code, the quiet regulars too"],
      ["Your effort", "Print it once"],
      ["What you see", "Scans, completions, what people praise"],
    ],
  },
];

export function ComparisonMatrix() {
  return (
    <section aria-labelledby="ways-title" className="mx-auto max-w-[1296px] px-4 pt-4 sm:px-8">
      <div className="max-w-3xl">
        <p className="vf-section-label mb-2 uppercase tracking-wider">Three ways shops ask</p>
        <h2 id="ways-title" className="heading-h2">
          Only one of them works on the days you forget.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-text-muted sm:text-lg">
          Happy customers rarely skip a review because they are unhappy. They skip it because nobody asked at the right moment.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-3">
        {WAYS.map((way, i) => (
          <Reveal key={way.title} order={i}>
            <div
              className={`flex h-full flex-col rounded-2xl p-6 sm:p-7 ${
                way.best ? "night-surface shadow-v2-elevated" : "border border-line bg-white shadow-v2-rest"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${way.best ? "bg-accent" : "bg-paper-subtle"}`}>
                  <svg aria-hidden viewBox="0 0 48 48" className="h-11 w-11">
                    {way.icon}
                  </svg>
                </span>
                <div>
                  <h3 className={`font-display text-xl leading-tight ${way.best ? "text-white" : "text-ink"}`}>{way.title}</h3>
                  <p className={`text-xs font-semibold ${way.best ? "text-accent-soft" : "text-text-muted"}`}>{way.tag}</p>
                </div>
              </div>
              <dl className={`mt-5 flex flex-col divide-y text-sm ${way.best ? "divide-white/10" : "divide-line"}`}>
                {way.rows.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[92px_1fr] gap-3 py-3">
                    <dt className={`text-xs font-semibold uppercase tracking-wide ${way.best ? "text-white/70" : "text-text-muted"}`}>{k}</dt>
                    <dd className={way.best ? "font-semibold text-white" : "text-text-2"}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
