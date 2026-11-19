import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { JourneyMap } from "@/components/marketing/JourneyMap";
import { PageHero } from "@/components/marketing/PageHero";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = pageMetadata({
  path: "/compliance",
  title: "Compliance — Revyu",
  description:
    "The five rules that keep your Google Business Profile safe from penalties and suspensions.",
});

const RULES: { id: string; title: string; short: string; body: string; icon: ReactNode }[] = [
  {
    id: "CR-1",
    title: "No pre-written review library",
    short: "Every draft is built live from the customer’s own taps.",
    body: "We store no pre-authored review text—not as seeds, not as examples, and not as fallback copy. Every draft is assembled at runtime from exactly what the customer selected. Google strictly prohibits merchants from supplying review content; this is why the customer stays the genuine author.",
    icon: (
      <>
        <path d="M5 5.500A1.500 1.500 0 0 1 6.500 4h8L19 8.500v10a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 18.500z" />
        <path d="M8.500 12h7M8.500 15.500h4.500" />
      </>
    ),
  },
  {
    id: "CR-2",
    title: "The draft is always editable",
    short: "A free-text box they can change or clear.",
    body: "The assembled draft appears in a free-text field the customer can edit or clear entirely before copying. It is never read-only, never copy-on-behalf. We state plainly: “We’ve written this from what you selected. Edit anything—it’s your review.”",
    icon: (
      <>
        <path d="M4 20h4l10.500-10.500a2.100 2.100 0 0 0-3-3L5 17z" />
        <path d="M13.500 8.500l3 3" />
      </>
    ),
  },
  {
    id: "CR-3",
    title: "Zero sentiment gating",
    short: "The Google link is there at one star and at five.",
    body: "Every customer sees the Google review link, at every rating, one star through five. No branch, no threshold, no delay, and no visual de-emphasis. Most review tools route only happy customers to Google—that is prohibited, and it is actively enforced by Google against the business profile.",
    icon: <path d="M12 3.500l2.600 5.300 5.900.900-4.200 4.100 1 5.800L12 16.900l-5.300 2.700 1-5.800L3.500 9.700l5.900-.900z" />,
  },
  {
    id: "CR-4",
    title: "Printed material, no staff observation",
    short: "Their own phone, their own time, nobody watching.",
    body: "The code lives on a counter tent, receipt, or card—never on a shared tablet handed to the customer, and never with staff watching them complete it. The customer uses their own phone, on their own time, with complete privacy.",
    icon: (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2.500" />
        <path d="M11 17.500h2" />
      </>
    ),
  },
  {
    id: "CR-5",
    title: "Zero incentives or kickbacks",
    short: "No discount, reward or point for a review. Ever.",
    body: "No reward, discount, or loyalty point is ever tied to leaving a review, at any rating. Incentivised reviews are prohibited outright by Google’s policies and run against Indian consumer-review standards—this isn’t a feature we’ve chosen not to build; it doesn’t exist in the product.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.500" />
        <path d="M6 6l12 12" />
      </>
    ),
  },
];

const NEVER = [
  "We never promise a number of reviews.",
  "We never promise a better rating or search ranking.",
  "We never post on a customer’s behalf or pre-fill Google’s review form.",
  "We never offer private feedback instead of the Google link — only in addition to it.",
];

export function CompliancePage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Our five rules"
        title="We never hide the Google link."
        lead={
          <>
            The risk in review collection sits on <em>your</em> Google Business Profile, not on the tool you used. These five
            rules are built into the product so that risk never reaches you.
          </>
        }
      />

      {/* The five rules */}
      <section aria-label="The five rules" className="mx-auto max-w-[1296px] px-4 pt-10 sm:px-8 sm:pt-14">
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-6">
          {RULES.map((rule, i) => (
            <Reveal key={rule.id} order={i % 3} className={i < 3 ? "lg:col-span-2" : "lg:col-span-3"}>
              <div className="lift flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-v2-rest sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      {rule.icon}
                    </svg>
                  </span>
                  <span className="rounded-lg border border-accent/20 bg-accent-50 px-2.5 py-1 font-mono text-xs font-bold text-accent-hover">
                    {rule.id}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-xl leading-snug text-ink sm:text-2xl">{rule.title}</h2>
                <p className="mt-1.5 text-sm font-semibold text-ink">{rule.short}</p>
                <p className="mt-3 text-sm leading-relaxed text-text-2">{rule.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Rule 3 in action: the same two options at every star */}
      <JourneyMap />

      {/* What we never claim */}
      <section className="mx-2 mt-10 sm:mx-3 sm:mt-16">
        <Reveal>
          <div className="night-surface mx-auto grid max-w-[1296px] gap-8 overflow-hidden rounded-2xl p-6 sm:p-12 lg:grid-cols-[1fr_1.3fr] lg:gap-14 lg:p-16">
            <div>
              <p className="vf-section-label-dark mb-2 uppercase tracking-wider">Sales honesty</p>
              <h2 className="heading-h2 text-white!">What we never claim</h2>
              <p className="mt-3 text-base leading-relaxed text-white/75">
                Not in a sales call, not on this site and not in the product. Nobody can honestly promise them.
              </p>
              <Link href="/signup" className="btn-primary mt-7 min-h-[48px] px-6 text-[15px]">
                <span>Start 15-day free trial</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
            <ul className="flex flex-col divide-y divide-white/10">
              {NEVER.map((item) => (
                <li key={item} className="flex items-start gap-3.5 py-4 text-base text-white">
                  <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-[#ff9db0]">
                    ✕
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </MarketingPage>
  );
}

export default CompliancePage;
