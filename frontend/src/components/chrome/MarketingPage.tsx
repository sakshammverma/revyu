import { PromoBar } from "@/components/chrome/PromoBar";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-accent/15 selection:text-ink">
      <PromoBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
