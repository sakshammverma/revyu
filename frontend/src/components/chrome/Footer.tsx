"use client";

import { useState } from "react";
import Link from "next/link";

export function Footer() {
  const [email, setEmail] = useState("");

  return (
    <div className="mx-2 sm:mx-3 mb-3 mt-12 sm:mt-16">
      <footer className="rounded-2xl bg-[#1f2429] text-white p-8 sm:p-12 lg:p-16 border border-[#2b3239]">
        {/* Top Grid: CTA on Left, 3 Columns on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-12 border-b border-[#2b3239]">
          {/* Left Column: CTA Headline & Email Capture */}
          <div className="lg:col-span-6 flex flex-col justify-between max-w-lg">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
                <div className="w-7 h-7 rounded-lg bg-[#397dff] flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:bg-[#2f68db] transition-colors">
                  R
                </div>
                <span className="font-display text-2xl text-white tracking-tight">
                  Revyu
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#397dff] mb-1" />
              </Link>

              <h3 className="heading-h3 font-display text-white text-2xl sm:text-3xl leading-snug">
                A printed QR that helps your customers write their own Google reviews.
              </h3>
              <p className="mt-3 text-sm text-[#9aa1a3] leading-relaxed">
                For any local shop or business. No app, no gating, no incentives.
              </p>
            </div>

            {/* Email Capture Pill on Dark */}
            <div className="mt-6 sm:mt-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  window.location.href = `/signup?email=${encodeURIComponent(email)}`;
                }}
                className="flex items-center p-1.5 rounded-xl bg-white/5 border border-white/15 focus-within:border-[#397dff] focus-within:bg-white/10 transition-all max-w-[400px]"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter business email"
                  className="flex-1 px-3 py-1.5 text-sm text-white placeholder-[#9aa1a3] bg-transparent focus:outline-none"
                />
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-3.5 shrink-0"
                >
                  <span>Start trial</span>
                  <span className="font-bold">→</span>
                </button>
              </form>
              <p className="text-[11px] text-[#9aa1a3] mt-2">
                15 days free · then ₹499/month flat · cancel anytime
              </p>
            </div>
          </div>

          {/* Right Columns: Links */}
          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {/* Column 1: Platform */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9aa1a3] mb-4">
                Platform
              </p>
              <ul className="flex flex-col gap-3 text-sm text-[#e2e4e5]">
                <li>
                  <Link href="/how-it-works" className="hover:text-white hover:underline transition-colors">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/#mechanism" className="hover:text-white hover:underline transition-colors">
                    Try the demo
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white hover:underline transition-colors">
                    Pricing &amp; Plans
                  </Link>
                </li>
                <li>
                  <Link href="/app" className="hover:text-white hover:underline transition-colors">
                    Owner login
                  </Link>
                </li>
                <li>
                  <Link href="/compliance" className="hover:text-white hover:underline transition-colors">
                    Our five rules
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Specialties */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9aa1a3] mb-4">
                Where it fits
              </p>
              <ul className="flex flex-col gap-3 text-sm text-[#e2e4e5]">
                <li>
                  <Link href="/#specialties" className="hover:text-white hover:underline transition-colors">
                    Billing counter
                  </Link>
                </li>
                <li>
                  <Link href="/#specialties" className="hover:text-white hover:underline transition-colors">
                    Bills &amp; receipts
                  </Link>
                </li>
                <li>
                  <Link href="/#specialties" className="hover:text-white hover:underline transition-colors">
                    Tables &amp; shelves
                  </Link>
                </li>
                <li>
                  <Link href="/#specialties" className="hover:text-white hover:underline transition-colors">
                    Bags &amp; packaging
                  </Link>
                </li>
                <li>
                  <Link href="/#specialties" className="hover:text-white hover:underline transition-colors">
                    Any local business
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9aa1a3] mb-4">
                Company &amp; Legal
              </p>
              <ul className="flex flex-col gap-3 text-sm text-[#e2e4e5]">
                <li>
                  <Link href="/signup" className="text-[#397dff] font-semibold hover:underline transition-colors">
                    Start 15-day trial →
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white hover:underline transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white hover:underline transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/refund-policy" className="hover:text-white hover:underline transition-colors">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white hover:underline transition-colors">
                    Contact &amp; Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Policy Guarantee */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9aa1a3]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#449127] animate-pulse" />
            <span>Google link shown at every rating · no incentives, ever</span>
          </div>
          <p>© {new Date().getFullYear()} Revyu. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
