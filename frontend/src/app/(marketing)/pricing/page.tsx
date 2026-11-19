import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { CountryPicker } from "@/components/marketing/CountryPicker";
import { PageHero } from "@/components/marketing/PageHero";
import { Reveal } from "@/components/marketing/Reveal";
import { ROICalculatorSection } from "@/components/marketing/ROICalculatorSection";
import { PlaygroundProvider } from "@/components/marketing/interact";
import { IfPriced, PlanPrice, Price } from "@/lib/pricing";

export const metadata: Metadata = pageMetadata({
  path: "/pricing",
  title: "Pricing — Revyu",
  description:
    "Simple, flat pricing for single-outlet businesses, in your local currency. Monthly or annual, with a 15-day free trial.",
});

const INCLUDED = [
  "15 days free, first charge after the trial",
  "Unlimited scans and completed flows",
  "Owner dashboard: scans, funnel, top tags, rating",
  "Private feedback inbox with email alerts",
  "QR + 4 print-ready PDFs (receipt, card, standee, sticker)",
];

const NOTES = [
  {
    title: "15 days free, first charge after the trial",
    body: "You set up UPI AutoPay or a card when you sign up, but nothing is charged until your 15-day trial ends, and the trial only starts once we verify your business. Cancel before then and you pay nothing.",
  },
  {
    title: "If a payment fails",
    body: "If that first payment doesn’t go through, your QR keeps working for 10 more customer reviews while you sort it out.",
  },
  {
    title: "What we don’t sell",
    body: "No tiers, no per-review fees, no setup fee. And no promises about reviews, ratings or rankings: we make sure every customer is asked.",
  },
];

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-success-strong" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <PlaygroundProvider>
      <MarketingPage>
        <PageHero
          eyebrow="Flat pricing"
          title="One simple price. Everything included."
          lead="No tiers and no add-ons. Every shop and local business gets the whole product from day one, in its own currency."
        />

        {/* Plans */}
        <section aria-label="Plans" className="mx-auto max-w-[1080px] px-4 pt-8 sm:pt-10">
          <div className="flex justify-center">
            <CountryPicker />
          </div>

          <div className="mt-6 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-8">
            {/* Monthly */}
            <div className="v2-sheet flex flex-col justify-between border border-line p-8 sm:p-10">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-2xl text-ink">Monthly</h2>
                  <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-xs font-medium text-text-2">Cancel anytime</span>
                </div>
                <div className="mt-6 flex items-baseline gap-2">
                  <PlanPrice plan="monthly" unit="/ month" />
                </div>
                <p className="mt-2 text-sm text-text-muted">Billed monthly. Cancel any time from your dashboard.</p>

                <ul className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/signup?plan=monthly"
                className="mt-10 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-line bg-bg px-6 text-sm font-semibold text-ink transition-colors hover:bg-line"
              >
                <span>Start 15-day free trial</span>
                <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Annual */}
            <div className="relative">
              <span aria-hidden className="absolute -inset-3 rounded-[28px] bg-accent/20 blur-2xl" />
              <div className="v2-card-elevated relative flex h-full flex-col justify-between border-2 border-accent p-8 sm:p-10">
                <IfPriced plan="saving">
                  <div className="absolute -top-3.5 right-6">
                    <span className="rounded-full bg-accent px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
                      Save <Price plan="saving" /> a year
                    </span>
                  </div>
                </IfPriced>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-2xl text-ink">Annual</h2>
                    <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-hover">Best value</span>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <PlanPrice plan="annual" unit="/ year" />
                  </div>
                  <p className="mt-2 text-sm text-text-muted">
                    Works out to about <Price plan="annualPerMonth" suffix="/month" fallback="a lower monthly rate" />, versus{" "}
                    <Price plan="monthly" fallback="the monthly price" /> paying monthly.
                  </p>

                  <ul className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink">
                    <li className="flex items-start gap-2.5 font-semibold">
                      <Check />
                      <span>
                        <Price plan="saving" suffix=" saved versus paying monthly" fallback="Costs less than paying monthly" />
                      </span>
                    </li>
                    {INCLUDED.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href="/signup?plan=annual" className="btn-primary mt-10 min-h-[48px] w-full justify-center text-sm">
                  <span>Start 15-day free trial</span>
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-text-muted">
            The same product on both plans. What you are charged follows the country of your business, confirmed at signup.
          </p>
        </section>

        {/* The price, in customers */}
        <ROICalculatorSection />

        {/* The fine print, in plain words */}
        <section aria-label="Billing details" className="mx-auto max-w-[1296px] px-4 sm:px-8">
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {NOTES.map((note, i) => (
              <Reveal key={note.title} order={i}>
                <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-v2-rest sm:p-7">
                  <h2 className="font-display text-xl leading-snug text-ink">{note.title}</h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-text-2">{note.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-text-2">
            Something else?{" "}
            <Link href="/contact" className="font-semibold text-accent-hover underline underline-offset-4 hover:no-underline">
              Contact us
            </Link>{" "}
            or{" "}
            <Link href="/refund-policy" className="font-semibold text-accent-hover underline underline-offset-4 hover:no-underline">
              read the refund policy
            </Link>
            .
          </p>
        </section>
      </MarketingPage>
    </PlaygroundProvider>
  );
}
