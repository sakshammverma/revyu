import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";

export const metadata: Metadata = {
  title: "How it works — Revyu",
  description: "Three steps: scan, tap, paste. No app, no review gating, no pre-written reviews."
};

const STEPS = [
  {
    index: "01",
    title: "Scan the printed QR",
    body: "The customer points their phone camera at the QR on a receipt, handout card or counter standee. No app download, no account — it opens straight in their phone’s browser.",
    highlight: "No app, no login",
  },
  {
    index: "02",
    title: "Tap a rating and what stood out",
    body: "They tap 1–5 stars, then tap whatever stood out—clean place, quick service, friendly team. Customers can pick as many tags as apply, or none at all — then the draft stays empty.",
    highlight: "Zero tags is fine",
  },
  {
    index: "03",
    title: "Edit, copy and paste on Google",
    body: "A draft assembles live from exactly what they selected. The customer can edit or clear it with total freedom. Then they tap copy and paste it on your Google review page, posting from their own Google account.",
    highlight: "Google link at every rating",
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      {/* Header */}
      <section className="pt-12 sm:pt-20 pb-10 text-center max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white border border-[#e8ecec] shadow-v2-rest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#397dff]" />
          <span className="text-xs font-semibold text-[#515a63] tracking-wide">
            How it works
          </span>
        </div>
        <h1 className="heading-h1 font-display text-[#1a1e23] tracking-tight">
          Three steps. Nothing hidden.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#515a63] leading-relaxed max-w-xl mx-auto">
          What your customer does, start to finish — including the one step we can’t remove.
        </p>
      </section>

      {/* 3 Step Cards Grid */}
      <section className="max-w-[1024px] mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {STEPS.map((step) => (
            <div
              key={step.index}
              className="v2-sheet p-6 sm:p-8 border border-[#e8ecec] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="w-10 h-10 rounded-xl bg-[#e7f5fd] text-[#397dff] font-mono font-bold text-sm flex items-center justify-center">
                    {step.index}
                  </span>
                  <span className="text-xs text-[#449127] font-semibold px-2.5 py-1 rounded-full bg-[#449127]/10">
                    {step.highlight}
                  </span>
                </div>
                <h2 className="font-display text-xl text-[#1a1e23]">{step.title}</h2>
                <p className="mt-3 text-sm text-[#6e797b] leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About the Paste Step */}
      <section className="max-w-[1024px] mx-auto px-4 pb-20">
        <div className="v2-card-elevated p-8 sm:p-10 border border-[#e8ecec] bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-[#397dff]" />
            <span className="text-xs uppercase tracking-wider text-[#397dff] font-semibold">
              Policy Transparency
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl text-[#1a1e23]">About that paste step</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-[#6e797b] leading-relaxed">
            <p>
              Google&rsquo;s official review form accepts no prefilled rating or pre-populated text—there is no legitimate workaround, and we don&rsquo;t pretend otherwise. After copying, the customer is handed directly to Google and submits using their own Google account.
            </p>
            <p>
              That step is intentional. Any software claiming to auto-submit reviews on behalf of customers is either scraping Google or violating terms. We keep the paste step because it&rsquo;s the honest version of this product: your customer is the author, posting from their own account.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-[#e8ecec] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-medium text-[#1a1e23]">
              Ready to test it for your business?
            </span>
            <Link
              href="/#mechanism"
              className="btn-primary"
            >
              <span>Try the demo</span>
              <span className="font-bold">→</span>
            </Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
