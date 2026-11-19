"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/demo", label: "Demo" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compliance", label: "Our rules" },
];

/**
 * `overDark`: the page starts with a dark hero that runs up behind the header,
 * so until the visitor scrolls the header is transparent with light text.
 * Once scrolled it becomes the same white pill on every page.
 */
export function Header({ overDark = false }: { overDark?: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Any navigation closes the menu.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset UI state when the route changes
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dark = overDark && !isScrolled;
  const link = dark ? "text-white/80 hover:text-white" : "text-text-2 hover:text-ink";

  return (
    <header className="sticky top-0 z-50 w-full px-3 sm:px-6 pointer-events-none">
      <div
        className={`pointer-events-auto mx-auto h-16 flex items-center justify-between transition-all duration-300 ${
          isScrolled
            ? "max-w-[920px] px-4 sm:px-6 rounded-xl border border-line bg-white/90 backdrop-blur-xl shadow-v2-rest mt-2"
            : `max-w-[1272px] px-2 sm:px-6 bg-transparent border-b ${dark ? "border-white/10" : "border-line"}`
        }`}
      >
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <Logo className={`text-lg ${dark ? "text-white" : "text-ink"}`} markClassName="w-6 h-6 transition-transform group-hover:scale-105" />
        </Link>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-8 whitespace-nowrap">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`text-sm transition-colors ${link} aria-[current=page]:font-semibold ${dark ? "aria-[current=page]:text-white" : "aria-[current=page]:text-ink"}`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/gap-report"
            className={`text-sm font-semibold transition-colors ${dark ? "text-accent-soft hover:text-white" : "text-accent-hover hover:text-ink"}`}
          >
            Free gap report
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-5 whitespace-nowrap">
          <Link href="/app" className={`text-sm transition-colors ${link}`}>
            Owner login
          </Link>
          <Link href="/signup" className="btn-primary">
            <span>Get started</span>
          </Link>
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <Link href="/signup" className="btn-primary text-xs py-2 px-3.5">
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-colors ${
              dark ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-line bg-bg text-ink hover:bg-band-textured"
            }`}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <svg aria-hidden className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="pointer-events-auto lg:hidden mt-2 mx-auto max-w-[360px] bg-night text-white rounded-2xl p-6 shadow-v2-elevated border border-white/10 flex flex-col gap-4 text-right"
        >
          {[...NAV, { href: "/gap-report", label: "Free gap report" }, { href: "/app", label: "Owner login" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-accent-soft transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/10">
            <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full justify-center">
              Get started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
