import type { Metadata } from "next";

// Per-outlet pages: no extra DB round-trip just for a title (NFR-2 budget), and
// kept out of search results (robots.ts disallows /r/ too).
export const metadata: Metadata = {
  // Neutral: the same layout serves menu and rewards pages (rewards are never tied to reviews, CR-6).
  title: "Welcome",
  robots: { index: false, follow: false },
};

// Customer flow layout (/r/{slug}). Deliberately adds nothing: the flow uses
// the root layout's design-system faces (Plus Jakarta Sans for text, Lora for
// the display headings), which are already loaded. The previous Archivo and
// Geist Mono faces were declared here but referenced by no class, so they only
// cost preload bytes on the surface with the tightest budget (< 150KB, NFR-2).
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
