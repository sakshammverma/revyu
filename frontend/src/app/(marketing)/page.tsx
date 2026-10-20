import type { Metadata } from "next";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { PromoBar } from "@/components/chrome/PromoBar";
import { Header } from "@/components/chrome/Header";
import { Hero } from "@/components/marketing/Hero";
import { BuildCards } from "@/components/marketing/BuildCards";
import { EngineStats } from "@/components/marketing/EngineStats";
import { TestimonialMarquee } from "@/components/marketing/TestimonialMarquee";
import { ShowcaseDeck } from "@/components/marketing/ShowcaseDeck";
import { HardwareShowcase } from "@/components/marketing/HardwareShowcase";
import { PlatformTabs } from "@/components/marketing/PlatformTabs";
import { Google3PackVisualizer } from "@/components/marketing/Google3PackVisualizer";
import { ROICalculatorSection } from "@/components/marketing/ROICalculatorSection";
import { ComparisonMatrix } from "@/components/marketing/ComparisonMatrix";
import { EditorialRail } from "@/components/marketing/EditorialRail";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/chrome/Footer";
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

export default function Home() {
  return (
    <PlaygroundProvider>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd).replace(/</g, "\u003c") }} />
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-accent/15 selection:text-ink">
      {/* 1. Top Announcement Bar */}
      <PromoBar />

      {/* 2. Floating Compacting Scrolled Nav with Mega Menu */}
      <Header />

      {/* Main Page Flow following design-system.md sequence */}
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {/* 3. Hero — one example flow per vertical */}
        <Hero />

        {/* 4. Three screens: customer, Google, owner */}
        <BuildCards />

        {/* 5. Why it happens + product facts */}
        <EngineStats />

        {/* 6. Default tags per vertical + the five rules */}
        <TestimonialMarquee />

        {/* 7. Interactive five-step walkthrough (#mechanism) */}
        <ShowcaseDeck />

        {/* 8. Print kit — the files we generate */}
        <HardwareShowcase />

        {/* 9. Verticals (#specialties) */}
        <PlatformTabs />

        {/* 10. Act 1 — the gap, stated once (FR-79) */}
        <Google3PackVisualizer />

        {/* 11. Price arithmetic — one customer covers a year */}
        <ROICalculatorSection />

        {/* 12. Comparison of approaches (no named competitors) */}
        <ComparisonMatrix />

        {/* 13. Links to compliance, how it works, pricing */}
        <EditorialRail />

        {/* 14. Frequently Asked Questions Accordion */}
        <FAQSection />

        {/* 15. Pre-Footer Conversion Call-to-Action Sheet */}
        <div id="final-cta">
          <FinalCTA />
        </div>
      </main>

      {/* 16. Dark Footer Sheet */}
      <Footer />

      {/* Checklist of the live demos on this page */}
      <PlaygroundTracker />
    </div>
    </PlaygroundProvider>
  );
}
