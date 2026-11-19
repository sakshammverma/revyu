import Link from "next/link";

import { demoQr } from "@/lib/marketing/qr";
import { EmailCapture } from "./EmailCapture";
import { HeroScene } from "./HeroScene";
import { ShopStrip } from "./ShopStrip";

// Each inner array is one line of the headline at desktop width; the lines are
// short enough that none of them wraps and leaves a word on its own.
const LINES_1 = [["Good", "work", "nobody"], ["writes", "down"]];
const LINES_2 = [["goes", "to", "the", "shop"], ["next", "door."]];

const CHIPS = ["No app for your customers", "Google link at every rating", "English and हिन्दी"];

/**
 * One screen that says what Revyu is and shows it working. A light sheet, so
 * the standee, the phone and the shop photographs carry the colour.
 */
export function Hero() {
  const qr = demoQr();

  return (
    <section className="day-grid -mt-16 overflow-hidden rounded-b-[28px] border-b border-line bg-sheet pt-16 sm:rounded-b-[40px]">
      <div className="mx-auto grid max-w-[1296px] items-center gap-6 px-5 pb-10 pt-8 sm:px-10 sm:pb-12 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-14 lg:pt-16">
        <div className="max-w-[640px]">
          <p className="animate-hero-pop inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3.5 py-1.5 text-xs font-semibold text-ink">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            Google reviews for local shops and businesses
          </p>

          <h1 className="heading-h1 mt-5">
            <span className="block">
              <HeadlineLines lines={LINES_1} from={0} />
            </span>
            <span className="block text-accent">
              <HeadlineLines lines={LINES_2} from={LINES_1.flat().length} />
            </span>
          </h1>

          <p className="animate-hero-pop mt-4 max-w-[560px] text-base leading-relaxed text-text-2 sm:text-lg" style={{ animationDelay: "520ms" }}>
            Revyu is one printed QR code on your counter. Customers scan it, tap what they liked, and post their own review
            on Google. Every customer gets asked, even on the days you forget.
          </p>

          <div className="animate-hero-pop mt-6 flex flex-col gap-2 sm:mt-7 sm:gap-3" style={{ animationDelay: "620ms" }}>
            <EmailCapture />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link
                href="/demo"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
              >
                Try it as a customer
                <span aria-hidden>→</span>
              </Link>
              <span className="text-text-muted">15 days free · cancel anytime</span>
            </div>
          </div>

          <ul className="animate-hero-pop mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-2" style={{ animationDelay: "720ms" }}>
            {CHIPS.map((chip) => (
              <li key={chip} className="flex items-center gap-1.5">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <HeroScene qr={qr.d} qrSize={qr.size} />
      </div>

      <ShopStrip />
    </section>
  );
}

/** The headline's words, animated in one by one. Lines break where the array says from `sm` up; on phones the text flows. */
function HeadlineLines({ lines, from }: { lines: string[][]; from: number }) {
  let n = from;
  return (
    <>
      {lines.map((line, l) => (
        <span key={l} className="sm:block">
          {line.map((word) => {
            const i = n++;
            return (
              <span key={i} className="animate-hero-word mr-[0.24em] inline-block" style={{ animationDelay: `${i * 70}ms` }}>
                {word}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}
