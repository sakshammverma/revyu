import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { CountryPicker } from "@/components/marketing/CountryPicker";
import { IfPriced, Price } from "@/lib/pricing";

export const metadata: Metadata = pageMetadata({
  path: "/pricing",
  title: "Pricing — Revyu",
  description:
    "Simple, flat pricing for single-outlet businesses, in your local currency. Monthly or annual, with a 15-day free trial.",
});

export default function PricingPage() {
  return (
    <MarketingPage>
      {/* Hero Header */}
      <section className="pt-12 sm:pt-20 pb-10 text-center max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white border border-line shadow-v2-rest">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-xs font-semibold text-text-2 tracking-wide">
            Transparent Flat Pricing
          </span>
        </div>
        <h1 className="heading-h1 font-display text-ink tracking-tight">
          One simple price. Every vertical included.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-text-2 leading-relaxed max-w-xl mx-auto">
          No tiers and no add-ons. Every shop and local business gets the whole product from day one.
        </p>
        <CountryPicker className="mt-5" />
      </section>

      {/* Pricing Cards Sheet */}
      <section className="max-w-[1024px] mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Monthly Card */}
          <div className="v2-sheet p-8 sm:p-10 border border-line flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h2 className="text-sm font-semibold text-ink">
                  Monthly Flexibility
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-bg border border-line text-text-2 font-medium">
                  Cancel anytime
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl sm:text-6xl text-ink tracking-tight"><Price plan="monthly" /></span>
                <span className="text-sm text-text-muted font-medium">/ month</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-text-muted">
                Billed monthly. Cancel any time from your dashboard.
              </p>

              <div className="mt-8 pt-6 border-t border-line">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-2 mb-4">
                  Everything included
                </p>
                <ul className="flex flex-col gap-3 text-sm text-ink">
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> 15 days free, first charge after the trial
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> Unlimited scans and completed flows
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> Owner dashboard: scans, funnel, top tags, rating
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> Private feedback inbox
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> QR + 4 print-ready PDFs (receipt, card, standee, sticker)
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-line">
              <Link
                href="/signup?plan=monthly"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-bg hover:bg-line text-ink border border-line font-semibold text-sm transition-all"
              >
                <span>Start 15-day free trial</span>
                <span className="font-bold">→</span>
              </Link>
            </div>
          </div>

          {/* Annual Card */}
          <div className="v2-card-elevated p-8 sm:p-10 border-2 border-accent flex flex-col justify-between relative">
            <IfPriced plan="saving">
              <div className="absolute -top-3.5 right-6">
                <span className="bg-[#2f6df0] text-white text-xs px-3.5 py-1 rounded-full font-semibold shadow-sm">
                  Save <Price plan="saving" /> a year
                </span>
              </div>
            </IfPriced>
            <div>
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h2 className="text-sm font-semibold text-accent">
                  Annual Commitment
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent-50 text-accent font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl sm:text-6xl text-ink tracking-tight"><Price plan="annual" /></span>
                <span className="text-sm text-text-muted font-medium">/ year</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-text-muted">
                Works out to about <Price plan="annualPerMonth" suffix="/month" fallback="a lower monthly rate" />, versus <Price plan="monthly" fallback="the monthly price" /> paying monthly.
              </p>

              <div className="mt-8 pt-6 border-t border-line">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">
                  Everything in Monthly — same product
                </p>
                <ul className="flex flex-col gap-3 text-sm text-ink">
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> 15 days free, first charge after the trial
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> Unlimited scans and completed flows
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> Owner dashboard and private feedback inbox
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> QR + 4 print-ready PDFs
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> <Price plan="saving" suffix=" saved versus paying monthly" fallback="Costs less than paying monthly" />
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-line">
              <Link
                href="/signup?plan=annual"
                className="btn-primary w-full py-3.5 text-sm justify-center"
              >
                <span>Start 15-day free trial</span>
                <span className="font-bold">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Explanatory FAQ Cards */}
      <section className="max-w-[1024px] mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="v2-sheet p-6 sm:p-8 border border-line">
            <h2 className="font-display text-xl text-ink">15 days free, first charge after the trial</h2>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              You set up UPI AutoPay or a card when you sign up, but nothing is charged until your 15-day trial ends, and the trial only starts once we verify your business. Cancel before then and you pay nothing. If that first payment doesn’t go through, your QR keeps working for 10 more customer reviews while you sort it out.
            </p>
          </div>

          <div className="v2-sheet p-6 sm:p-8 border border-line">
            <h2 className="font-display text-xl text-ink">One new customer can cover a whole year</h2>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              <Price plan="annual" /> a year is less than what many shops earn from a single new regular customer. We don’t promise reviews, ratings or rankings — we make sure every customer is asked.
            </p>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
