import type { Metadata } from "next";

// Owner pages are client components, so the title and noindex live here.
export const metadata: Metadata = {
  title: "Dashboard \u2014 Revyu",
  robots: { index: false, follow: false },
};

export default function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
