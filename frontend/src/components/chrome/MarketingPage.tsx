import { PromoBar } from "@/components/chrome/PromoBar";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f2f7f7] text-[#1a1e23] selection:bg-[#397dff]/15 selection:text-[#1a1e23]">
      <PromoBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
