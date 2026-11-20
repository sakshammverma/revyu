import type { Metadata, Viewport } from "next";

// The in-shop sales demo: PIN-gated tools and short-lived try links. Never indexed.
export const metadata: Metadata = {
  title: "Sales demo · Revyu",
  robots: { index: false, follow: false },
};

// Lets env(safe-area-inset-bottom) work, so pinned bars clear the home indicator on notched phones.
export const viewport: Viewport = { viewportFit: "cover" };

export default function SalesDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
