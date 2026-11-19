import Link from "next/link";

import { EmailCapture } from "./EmailCapture";
import { Reveal } from "./Reveal";

const POINTS = ["15-day free trial", "QR and print files by email", "Cancel anytime"];

export function FinalCTA() {
  return (
    <div className="mx-2 mt-12 sm:mx-3 sm:mt-16">
      <section
        aria-labelledby="final-cta-title"
        className="night-surface night-grid mx-auto max-w-[1296px] overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-14 sm:py-20"
      >
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center">
          <h2 id="final-cta-title" className="heading-h1 text-white!">
            The shop next door asks everyone. <span className="text-accent-soft">Will you?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Start free, print your code, and let it ask for you. Your numbers are in your dashboard before you pay anything.
          </p>

          <EmailCapture tone="dark" className="mt-8" />

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-accent-soft" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {p}
              </li>
            ))}
          </ul>

          <Link href="/demo" className="mt-6 inline-flex min-h-[44px] items-center text-sm font-semibold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">
            Not sure yet? Try it as a customer first →
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
