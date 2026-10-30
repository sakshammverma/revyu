import type { Metadata } from "next";

// The login page is a client component; its title lives here.
export const metadata: Metadata = { title: "Owner login — Revyu" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
