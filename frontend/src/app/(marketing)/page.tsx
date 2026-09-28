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

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f2f7f7] text-[#1a1e23] selection:bg-[#397dff]/15 selection:text-[#1a1e23]">
      {/* 1. Top Announcement Bar */}
      <PromoBar />

      {/* 2. Floating Compacting Scrolled Nav with Mega Menu */}
      <Header />

      {/* Main Page Flow following design-system.md sequence */}
      <main className="flex-1">
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
        <FinalCTA />
      </main>

      {/* 16. Dark Footer Sheet */}
      <Footer />
    </div>
  );
}
