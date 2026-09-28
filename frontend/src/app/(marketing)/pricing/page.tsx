import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";

export const metadata: Metadata = {
  title: "Pricing — Revyu",
  description: "Simple, flat pricing for single-outlet businesses. ₹499/month or ₹4,499/year. 15-day free trial.",
};

export default function PricingPage() {
  return (
    <MarketingPage>
      {/* Hero Header */}
      <section className="pt-12 sm:pt-20 pb-10 text-center max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white border border-[#e8ecec] shadow-v2-rest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#397dff]" />
          <span className="text-xs font-semibold text-[#515a63] tracking-wide">
            Transparent Flat Pricing
          </span>
        </div>
        <h1 className="heading-h1 font-display text-[#1a1e23] tracking-tight">
          One simple price. Every vertical included.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#515a63] leading-relaxed max-w-xl mx-auto">
          No tiers and no add-ons. Every shop and local business gets the whole product from day one.
        </p>
      </section>

      {/* Pricing Cards Sheet */}
      <section className="max-w-[1024px] mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Monthly Card */}
          <div className="v2-sheet p-8 sm:p-10 border border-[#e8ecec] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#e8ecec] pb-4">
                <span className="text-sm font-semibold text-[#1a1e23]">
                  Monthly Flexibility
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#f2f7f7] border border-[#e8ecec] text-[#515a63] font-medium">
                  Cancel anytime
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl sm:text-6xl text-[#1a1e23] tracking-tight">₹499</span>
                <span className="text-sm text-[#6e797b] font-medium">/ month</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-[#6e797b]">
                Billed monthly. Cancel any time from your dashboard.
              </p>

              <div className="mt-8 pt-6 border-t border-[#e8ecec]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#515a63] mb-4">
                  Everything included
                </p>
                <ul className="flex flex-col gap-3 text-sm text-[#1a1e23]">
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> 15 days free, then 10 review credits
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

            <div className="mt-10 pt-6 border-t border-[#e8ecec]">
              <Link
                href="/signup"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-[#f2f7f7] hover:bg-[#e8ecec] text-[#1a1e23] border border-[#e8ecec] font-semibold text-sm transition-all"
              >
                <span>Start 15-day free trial</span>
                <span className="font-bold">→</span>
              </Link>
            </div>
          </div>

          {/* Annual Card */}
          <div className="v2-card-elevated p-8 sm:p-10 border-2 border-[#397dff] flex flex-col justify-between relative">
            <div className="absolute -top-3.5 right-6">
              <span className="bg-[#397dff] text-white text-xs px-3.5 py-1 rounded-full font-semibold shadow-sm">
                Save 25% (2 months free)
              </span>
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-[#e8ecec] pb-4">
                <span className="text-sm font-semibold text-[#397dff]">
                  Annual Commitment
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#e7f5fd] text-[#397dff] font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl sm:text-6xl text-[#1a1e23] tracking-tight">₹4,499</span>
                <span className="text-sm text-[#6e797b] font-medium">/ year</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-[#6e797b]">
                Works out to about ₹375/month — two months free versus monthly.
              </p>

              <div className="mt-8 pt-6 border-t border-[#e8ecec]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#397dff] mb-4">
                  Everything in Monthly — same product
                </p>
                <ul className="flex flex-col gap-3 text-sm text-[#1a1e23]">
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#449127] font-bold">✓</span> 15 days free, then 10 review credits
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
                    <span className="text-[#449127] font-bold">✓</span> Two months free versus paying monthly
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-[#e8ecec]">
              <Link
                href="/signup"
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
          <div className="v2-sheet p-6 sm:p-8 border border-[#e8ecec]">
            <h3 className="font-display text-xl text-[#1a1e23]">15 days free, then 10 review credits</h3>
            <p className="mt-3 text-sm text-[#6e797b] leading-relaxed">
              Your QR collects from the day your business is approved. After 15 days you get 10 more review credits — one is used each time a customer completes the flow and copies their draft. Then collection pauses until you subscribe, so you see your real numbers before paying anything more.
            </p>
          </div>

          <div className="v2-sheet p-6 sm:p-8 border border-[#e8ecec]">
            <h3 className="font-display text-xl text-[#1a1e23]">One new customer can cover a whole year</h3>
            <p className="mt-3 text-sm text-[#6e797b] leading-relaxed">
              ₹4,499 a year is less than what many shops earn from a single new regular customer. We don’t promise reviews, ratings or rankings — we make sure every customer is asked.
            </p>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
