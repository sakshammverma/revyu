import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found — Revyu", robots: { index: false } };

// Unknown URLs outside /r (which has its own branded page for unknown QR codes).
export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <div className="v2-sheet border border-line w-full max-w-md p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-2">404</p>
        <h1 className="font-display text-2xl text-ink mt-2">We can&rsquo;t find that page</h1>
        <p className="text-sm text-text-2 mt-2">The link may be old or mistyped.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/" className="btn-primary min-h-[48px] inline-flex items-center justify-center">
            Go to the home page
          </Link>
          <Link href="/app/login" className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-accent-hover underline">
            Owner login
          </Link>
        </div>
      </div>
    </main>
  );
}
