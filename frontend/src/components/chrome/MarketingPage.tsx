import { PromoBar } from "@/components/chrome/PromoBar";
import { SkipLink } from "@/components/chrome/SkipLink";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";

/**
 * The chrome every public page shares. `overDark` is for pages whose first
 * section is dark and runs up behind the header (the home page).
 */
export function MarketingPage({ children, overDark = false }: { children: React.ReactNode; overDark?: boolean }) {
  return (
    <div className="marketing-root min-h-screen flex flex-col bg-bg text-ink selection:bg-accent/15 selection:text-ink">
      {/* Scroll reveals start hidden and are shown by script; without script, show everything. */}
      <noscript>
        <style>{`.rv{opacity:1!important;transform:none!important}.jm-node{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <SkipLink />
      <PromoBar />
      <Header overDark={overDark} />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <Footer />
    </div>
  );
}
