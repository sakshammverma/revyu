import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";

export const metadata: Metadata = {
  title: "Compliance — Revyu",
  description: "The five rules that keep your Google Business Profile safe from penalties and suspensions.",
};

const RULES = [
  {
    id: "CR-1",
    title: "No pre-written review library",
    body: "We store no pre-authored review text—not as seeds, not as examples, and not as fallback copy. Every draft is assembled at runtime from exactly what the customer selected. Google strictly prohibits merchants from supplying review content; this is why the customer stays the genuine author.",
  },
  {
    id: "CR-2",
    title: "The draft is always editable",
    body: "The assembled draft appears in a free-text field the customer can edit or clear entirely before copying. It is never read-only, never copy-on-behalf. We state plainly: “We’ve written this from what you selected. Edit anything—it’s your review.”",
  },
  {
    id: "CR-3",
    title: "Zero sentiment gating",
    body: "Every customer sees the Google review link, at every rating, one star through five. No branch, no threshold, no delay, and no visual de-emphasis. Most review tools route only happy customers to Google—that is prohibited, and it is actively enforced by Google against the business profile.",
  },
  {
    id: "CR-4",
    title: "Printed material, no staff observation",
    body: "The code lives on a counter tent, receipt, or card—never on a shared tablet handed to the customer, and never with staff watching them complete it. The customer uses their own phone, on their own time, with complete privacy.",
  },
  {
    id: "CR-5",
    title: "Zero incentives or kickbacks",
    body: "No reward, discount, or loyalty point is ever tied to leaving a review, at any rating. Incentivised reviews are prohibited outright by Google’s policies and run against Indian consumer-review standards—this isn’t a feature we’ve chosen not to build; it doesn’t exist in the product.",
  },
];

export function CompliancePage() {
  return (
    <MarketingPage>
      {/* Header */}
      <section className="pt-12 sm:pt-20 pb-10 text-center max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white border border-[#e8ecec] shadow-v2-rest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#397dff]" />
          <span className="text-xs font-semibold text-[#515a63] tracking-wide">
            Our five rules
          </span>
        </div>
        <h1 className="heading-h1 font-display text-[#1a1e23] tracking-tight">
          We never hide the Google link.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#515a63] leading-relaxed max-w-xl mx-auto">
          The ultimate risk in review collection sits directly on <em>your</em> Google Business Profile. These five rules are why Revyu keeps your business permanently safe.
        </p>
      </section>

      {/* 5 Rules Cards */}
      <section className="max-w-[1024px] mx-auto px-4 pb-16">
        <div className="flex flex-col gap-4">
          {RULES.map((rule) => (
            <div
              key={rule.id}
              className="v2-sheet p-6 sm:p-8 border border-[#e8ecec] flex flex-col sm:flex-row sm:items-start gap-5 hover:border-[#397dff]/40 transition-colors"
            >
              <div className="shrink-0">
                <span className="font-mono text-xs font-bold text-[#397dff] bg-[#e7f5fd] border border-[#397dff]/20 px-3.5 py-1.5 rounded-lg inline-block">
                  {rule.id}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl sm:text-2xl text-[#1a1e23]">
                  {rule.title}
                </h2>
                <p className="mt-2 text-sm text-[#6e797b] leading-relaxed">
                  {rule.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What We Never Claim Card */}
      <section className="max-w-[1024px] mx-auto px-4 pb-20">
        <div className="v2-card-elevated p-8 sm:p-10 border border-[#e8ecec] bg-white">
          <h3 className="font-display text-2xl text-[#1a1e23]">What we never claim</h3>
          <p className="text-sm text-[#6e797b] mt-2">
            Claims we will never make:
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm text-[#515a63]">
            <li className="flex items-center gap-3">
              <span className="text-[#c62445] font-bold">—</span>
              <span>We never promise a number of reviews.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[#c62445] font-bold">—</span>
              <span>We never promise a better rating or search ranking.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[#c62445] font-bold">—</span>
              <span>We never post on a customer’s behalf or pre-fill Google’s review form.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[#c62445] font-bold">—</span>
              <span>We never offer private feedback instead of the Google link — only in addition to it.</span>
            </li>
          </ul>

          <div className="mt-8 pt-6 border-t border-[#e8ecec] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-medium text-[#1a1e23]">
              Collect reviews the honest, compliant way.
            </span>
            <Link
              href="/signup"
              className="btn-primary"
            >
              <span>Start 15-day free trial</span>
              <span className="font-bold">→</span>
            </Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}

export default CompliancePage;
