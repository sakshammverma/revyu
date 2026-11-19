import type { Metadata } from "next";
import { demoQr } from "@/lib/marketing/qr";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { Hero } from "@/components/marketing/Hero";
import { Google3PackVisualizer } from "@/components/marketing/Google3PackVisualizer";
import { FlowStory } from "@/components/marketing/FlowStory";
import { JourneyMap } from "@/components/marketing/JourneyMap";
import { FeatureBento } from "@/components/marketing/FeatureBento";
import { ComparisonMatrix } from "@/components/marketing/ComparisonMatrix";
import { ROICalculatorSection } from "@/components/marketing/ROICalculatorSection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { PlaygroundProvider, PlaygroundTracker } from "@/components/marketing/interact";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Revyu — A printed QR that helps customers write their own Google reviews",
  description:
    "For any local shop or business. Customers scan, tap what stood out, edit a draft and paste it on Google. Google link at every rating. Flat monthly price, 15-day free trial.",
});

// Structured data for the brand itself. No prices or ratings here: prices vary by country and
// are loaded in the browser, and the site makes no claims about outcomes.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "Revyu", url: siteUrl, logo: `${siteUrl}/icon.svg` },
    { "@type": "WebSite", name: "Revyu", url: siteUrl },
  ],
};

// The page is one argument, told once:
// what it is (hero) -> why it matters (the gap) -> how it works -> why it is safe
// (two doors at every rating) -> what you get -> why this way, and what it costs -> questions -> start.
export default function Home() {
  return (
    <PlaygroundProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd).replace(/</g, "\u003c") }} />
      <MarketingPage>
        <Hero />
        <Google3PackVisualizer />
        <FlowStory qr={demoQr()} />
        <JourneyMap />
        <FeatureBento />
        <ComparisonMatrix />
        <ROICalculatorSection />
        <FAQSection />
        <div id="final-cta">
          <FinalCTA />
        </div>
      </MarketingPage>
      {/* Checklist of the live demos on this page */}
      <PlaygroundTracker />
    </PlaygroundProvider>
  );
}
