import Link from "next/link";

import { DEMO_VERTICALS } from "@/lib/marketing/demo";

// Pre-launch: no customer testimonials exist yet, so this band shows the two
// things a prospect can verify today — the real default tag sets per vertical
// and the rules we hold ourselves to (documents/03-COMPLIANCE.md).
// Swap row 2 for real, attributed owner quotes once installs produce them.

interface Card {
  eyebrow: string;
  title: string;
  body?: string;
  chips?: string[];
  footer: string;
}

const ROW_1: Card[] = DEMO_VERTICALS.map((v) => ({
  eyebrow: v.label,
  title: `What a ${v.label.toLowerCase().replace(/s$/, "")} customer can tap`,
  chips: v.tags.map((t) => t.label),
  footer: "Default tags · you can edit them for your business",
}));

const ROW_2: Card[] = [
  {
    eyebrow: "Today",
    title: "Three customers left happy. None of them said so.",
    body: "Satisfaction is silent. It walks out the door and forgets. A review is how a good day becomes permanent.",
    footer: "Silence is the default",
  },
  {
    eyebrow: "The shop next door",
    title: "Your neighbour isn\u2019t better. They\u2019re visible.",
    body: "A stranger choosing between two shops reads the numbers first, the prices second. Yours was decided before they walked in.",
    footer: "Decided before they arrive",
  },
  {
    eyebrow: "This week",
    title: "Every week is added to someone\u2019s count.",
    body: "Reviews compound. The shop that starts earlier isn\u2019t cleverer, only further along a road you haven\u2019t stepped onto yet.",
    footer: "The gap rarely closes by itself",
  },
  {
    eyebrow: "The memory problem",
    title: "You only ask the ones you remember.",
    body: "Asking by hand reaches the loud and the lucky. A printed code asks everyone, including the quiet regulars who would gladly say yes.",
    footer: "Everyone, not whoever comes to mind",
  },
  {
    eyebrow: "Later",
    title: "Next month has a way of becoming next year.",
    body: "Nobody decides to fall behind. They decide to do it later.",
    footer: "Later is also a decision",
  },
  {
    eyebrow: "Your move",
    title: "Set it up once. Then it asks for you.",
    body: "Print the code. From then on it asks every customer, every day, whether you are busy, tired or on holiday.",
    footer: "It works while you don\u2019t",
  },
];

export function TestimonialMarquee() {
  return (
    <div className="mx-2 sm:mx-3 my-12 sm:my-16">
      <section
        className="relative rounded-2xl bg-[#e2e6e6] py-16 sm:py-24 overflow-hidden border border-[#d5dcdc]"
        style={{
          backgroundImage: "url('/assets/contour-lines.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto px-4 mb-12 sm:mb-16">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            Five kinds of business. One quiet problem.
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            Every day you don&rsquo;t ask, the shop next door pulls a little further ahead.
          </h2>
        </div>

        {/* Marquee Row 1 — real default tag sets */}
        <div className="relative w-full overflow-hidden mb-6 flex">
          <div className="flex gap-6 animate-marquee shrink-0">
            {[...ROW_1, ...ROW_1].map((item, idx) => (
              <MarqueeCard key={`row1-${idx}`} item={item} />
            ))}
          </div>
        </div>

        {/* Marquee Row 2 (Reverse) — the five rules */}
        <div className="relative w-full overflow-hidden mb-12 flex">
          <div className="flex gap-6 animate-marquee-reverse shrink-0">
            {[...ROW_2, ...ROW_2].map((item, idx) => (
              <MarqueeCard key={`row2-${idx}`} item={item} />
            ))}
          </div>
        </div>

        {/* Bottom line & Dark Pill CTA */}
        <div className="text-center px-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-sm font-medium text-[#515a63]">
            Kirana, café, boutique, repair shop or studio —{" "}
            <span className="font-semibold text-[#1a1e23]">one product, one price</span>.
          </p>
          <Link href="/signup" className="btn-pill-dark text-xs sm:text-sm py-2 px-5">
            <span>Start your 15-day trial</span>
            <span className="font-bold">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function MarqueeCard({ item }: { item: Card }) {
  return (
    <div className="w-[360px] sm:w-[420px] bg-white rounded-xl p-6 shadow-v2-rest border border-[#e8ecec] flex flex-col justify-between shrink-0">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#397dff]">
            {item.eyebrow}
          </span>
        </div>
        <p className="font-display text-[#1a1e23] text-lg leading-snug">{item.title}</p>
        {item.body && (
          <p className="mt-2 text-sm text-[#515a63] leading-relaxed">{item.body}</p>
        )}
        {item.chips && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.chips.map((chip) => (
              <span
                key={chip}
                className="px-2.5 py-1 rounded-full bg-[#f2f7f7] border border-[#e8ecec] text-[11px] font-medium text-[#515a63]"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-[#e8ecec]">
        <p className="text-[11px] text-[#6e797b]">{item.footer}</p>
      </div>
    </div>
  );
}
