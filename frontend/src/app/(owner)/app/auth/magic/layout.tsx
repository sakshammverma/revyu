import type { Metadata } from "next";

// The magic-link page is a client component; its title lives here.
export const metadata: Metadata = { title: "Logging in — Revyu" };

export default function MagicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
