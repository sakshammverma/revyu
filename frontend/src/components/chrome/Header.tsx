"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Secondary links collapse once the header shrinks to a pill; they stay
  // reachable through the Resources menu.
  const secondary = isScrolled ? "hidden" : "";

  return (
    <>
      {/* Dim overlay when mega menu is open */}
      {megaMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1a1e23]/30 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setMegaMenuOpen(false)}
        />
      )}

      <header className="sticky top-0 z-50 w-full px-3 sm:px-6 pointer-events-none transition-all duration-300">
        <div
          className={`pointer-events-auto mx-auto h-16 flex items-center justify-between transition-all duration-300 ${
            isScrolled
              ? "max-w-[880px] px-4 sm:px-6 rounded-xl border border-[#e8ecec] bg-white/90 backdrop-blur-xl shadow-v2-rest mt-2"
              : "max-w-[1272px] px-6 sm:px-10 bg-transparent border-b border-[#f0f2f2]"
          }`}
        >
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => setMegaMenuOpen(false)}
          >
            {/* 8-Petal Spirograph Flower Mark */}
            <svg className="w-5 h-5 text-[#1a1e23] group-hover:text-[#397dff] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2a4 4 0 0 0-4 4v12a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
              <path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 0 0 0 8h12a4 4 0 0 0 4-4z" />
            </svg>
            <span className="font-sans font-bold text-lg text-[#1a1e23] tracking-tight">
              Revyu
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className={`hidden md:flex items-center ${isScrolled ? "gap-5 lg:gap-6" : "gap-7 lg:gap-9"}`}>
            <Link
              href="/how-it-works"
              className="text-sm text-[#515a63] hover:text-[#1a1e23] transition-colors"
            >
              How it works
            </Link>

            <Link
              href="/#mechanism"
              className={`text-sm text-[#515a63] hover:text-[#1a1e23] transition-colors ${secondary}`}
            >
              Demo
            </Link>

            <Link
              href="/compliance"
              className={`text-sm text-[#515a63] hover:text-[#1a1e23] transition-colors ${secondary}`}
            >
              Compliance
            </Link>

            {/* Mega menu trigger button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMegaMenuOpen(!megaMenuOpen)}
                className={`text-sm transition-colors flex items-center gap-1 cursor-pointer ${
                  megaMenuOpen ? "text-[#1a1e23] font-medium" : "text-[#515a63] hover:text-[#1a1e23]"
                }`}
              >
                <span>Resources</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    megaMenuOpen ? "rotate-180 text-[#397dff]" : "text-[#6e797b]"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <Link
              href="/#specialties"
              className={`text-sm text-[#515a63] hover:text-[#1a1e23] transition-colors ${secondary}`}
            >
              Where it fits
            </Link>

            <Link
              href="/pricing"
              className="text-sm text-[#515a63] hover:text-[#1a1e23] transition-colors"
            >
              Pricing
            </Link>

            <Link
              href="/gap-report"
              className="text-sm font-semibold text-[#2558cc] hover:text-[#1a1e23] transition-colors"
            >
              Free gap report
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className={`hidden md:flex items-center ${isScrolled ? "gap-4" : "gap-5"}`}>
            <Link
              href="/app"
              className="text-sm text-[#515a63] hover:text-[#1a1e23] transition-colors"
            >
              Owner login
            </Link>
            <Link
              href="/signup"
              className="btn-primary"
            >
              <span>Get started</span>
            </Link>
          </div>

          {/* Mobile Menu Burger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/signup"
              className="btn-primary text-xs py-2 px-3.5"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-9 h-9 rounded-lg bg-[#f2f7f7] border border-[#e8ecec] flex items-center justify-center text-[#1a1e23] hover:bg-[#e2e6e6] transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mega Menu Dropdown Panel */}
        {megaMenuOpen && (
          <div className="pointer-events-auto absolute top-full left-0 right-0 max-w-[1272px] mx-auto px-4 mt-2 transition-all duration-300">
            <div className="bg-white rounded-2xl border border-[#e2e4e5] shadow-v2-elevated p-8 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#e8ecec]">
              {/* Column 1: Featured Case Study */}
              <div className="md:col-span-5 pr-0 md:pr-8 pb-6 md:pb-0">
                <p className="vf-section-label mb-3 text-xs uppercase tracking-wider text-[#515a63]">
                  How it works
                </p>
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3 border border-[#e8ecec]">
                  <Image
                    src="/images/hero-stand-idle.jpg"
                    alt="A printed QR standee on a reception counter"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-[#1a1e23] shadow-xs">
                    Printed QR
                  </div>
                </div>
                <h4 className="font-display text-lg text-[#1a1e23] leading-snug">
                  Scan, tap what stood out, edit the draft, paste it on Google. See all five screens.
                </h4>
                <Link
                  href="/#mechanism"
                  onClick={() => setMegaMenuOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#397dff] hover:text-[#2f68db] mt-2 group"
                >
                  <span>Try the demo</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              </div>

              {/* Column 2: Placements */}
              <div className="md:col-span-4 px-0 md:px-8 py-6 md:py-0">
                <p className="vf-section-label mb-3 text-xs uppercase tracking-wider text-[#515a63]">
                  Where to put the QR
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/#specialties"
                    onClick={() => setMegaMenuOpen(false)}
                    className="group block p-2.5 rounded-lg hover:bg-[#f2f7f7] transition-colors"
                  >
                    <div className="text-sm font-semibold text-[#1a1e23] group-hover:text-[#397dff] transition-colors">
                      Billing counter
                    </div>
                    <div className="text-xs text-[#6e797b] mt-0.5">
                      Standee or sticker next to the till
                    </div>
                  </Link>
                  <Link
                    href="/#specialties"
                    onClick={() => setMegaMenuOpen(false)}
                    className="group block p-2.5 rounded-lg hover:bg-[#f2f7f7] transition-colors"
                  >
                    <div className="text-sm font-semibold text-[#1a1e23] group-hover:text-[#397dff] transition-colors">
                      Bill or receipt
                    </div>
                    <div className="text-xs text-[#6e797b] mt-0.5">
                      Printed on every bill, scanned at home
                    </div>
                  </Link>
                  <Link
                    href="/#specialties"
                    onClick={() => setMegaMenuOpen(false)}
                    className="group block p-2.5 rounded-lg hover:bg-[#f2f7f7] transition-colors"
                  >
                    <div className="text-sm font-semibold text-[#1a1e23] group-hover:text-[#397dff] transition-colors">
                      Bags, boxes &amp; tables
                    </div>
                    <div className="text-xs text-[#6e797b] mt-0.5">
                      Stickers, table cards and wall posters
                    </div>
                  </Link>
                </div>
              </div>

              {/* Column 3: Resources & Tools */}
              <div className="md:col-span-3 pl-0 md:pl-8 pt-6 md:pt-0">
                <p className="vf-section-label mb-3 text-xs uppercase tracking-wider text-[#515a63]">
                  Resources
                </p>
                <div className="flex flex-col gap-2.5 text-xs text-[#515a63]">
                  <Link
                    href="/compliance"
                    onClick={() => setMegaMenuOpen(false)}
                    className="flex items-center gap-2 p-2 rounded hover:bg-[#f2f7f7] hover:text-[#1a1e23] transition-colors"
                  >
                    <span className="text-[#397dff]">🛡️</span>
                    <span>Our five compliance rules</span>
                  </Link>
                  <Link
                    href="/#mechanism"
                    onClick={() => setMegaMenuOpen(false)}
                    className="flex items-center gap-2 p-2 rounded hover:bg-[#f2f7f7] hover:text-[#1a1e23] transition-colors"
                  >
                    <span className="text-[#397dff]">📱</span>
                    <span>Interactive demo</span>
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setMegaMenuOpen(false)}
                    className="flex items-center gap-2 p-2 rounded hover:bg-[#f2f7f7] hover:text-[#1a1e23] transition-colors"
                  >
                    <span className="text-[#397dff]">🏷️</span>
                    <span>₹499/month, flat</span>
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMegaMenuOpen(false)}
                    className="flex items-center gap-2 p-2 rounded bg-[#e7f5fd] text-[#397dff] font-semibold hover:bg-[#d6edfc] transition-colors mt-2"
                  >
                    <span>Start 15-day free trial →</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Flyout Drawer */}
        {mobileMenuOpen && (
          <div className="pointer-events-auto md:hidden mt-2 mx-auto max-w-[360px] bg-[#1f2429] text-white rounded-2xl p-6 shadow-v2-elevated border border-[#2b3239] flex flex-col gap-4 text-right">
            <Link
              href="/how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-[#397dff] transition-colors"
            >
              How it works
            </Link>
            <Link
              href="/#mechanism"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-[#397dff] transition-colors"
            >
              Demo
            </Link>
            <Link
              href="/compliance"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-[#397dff] transition-colors"
            >
              Compliance
            </Link>
            <Link
              href="/#specialties"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-[#397dff] transition-colors"
            >
              Where it fits
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-[#397dff] transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium hover:text-[#397dff] transition-colors"
            >
              Owner login
            </Link>
            <div className="pt-3 border-t border-[#2b3239] flex flex-col gap-2">
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary w-full justify-center"
              >
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
