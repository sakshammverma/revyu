import type { Metadata } from "next";

import { MarketingPage } from "@/components/chrome/MarketingPage";
import { Section } from "@/components/chrome/Grid";
import { GapReportTool } from "@/components/marketing/GapReportTool";

export const metadata: Metadata = {
  title: "Free Google review gap report — Revyu",
  description:
    "See how many Google reviews your business has next to the strongest nearby competitors. Free, instant, no signup.",
};

export default function GapReportPage() {
  return (
    <MarketingPage>
      <Section className="pt-12 sm:pt-20 pb-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-semibold text-accent-hover">Free · 30 seconds · no signup</p>
          <h1 className="heading-h1 mt-3">How far behind are you on Google?</h1>
          <p className="mt-4 text-base sm:text-lg text-text-2 leading-relaxed">
            Search your business. We&rsquo;ll show your reviews next to the top three nearby competitors in your category.
          </p>
        </div>
      </Section>
      <Section className="pb-20">
        <GapReportTool />
      </Section>
    </MarketingPage>
  );
}
