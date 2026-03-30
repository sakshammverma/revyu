"use client";

import { useState } from "react";
import Link from "next/link";

export function PromoBar() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative z-50 h-12 bg-[#1f2429] text-white flex items-center justify-between px-4 sm:px-8 overflow-hidden border-b border-[#2b3239]">
      {/* Background Animated Glow Art */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60 animate-promo-glow"
        aria-hidden="true"
      >
        <div className="w-[600px] h-[36px] bg-[radial-gradient(ellipse_at_center,_rgba(57,125,255,0.45)_0%,_transparent_70%)] blur-md" />
      </div>

      {/* Center Row Content */}
      <div className="relative z-10 mx-auto flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
        <span className="font-semibold text-white tracking-tight">₹499/month, flat</span>
        <span className="text-[#9aa1a3] hidden sm:inline">·</span>
        <span className="text-[#9aa1a3] hidden sm:inline">
          Ask every customer before the shop next door does · 15 days free
        </span>
        <span className="text-[#2b3239] hidden md:inline">|</span>
        <Link
          href="/signup"
          className="btn-pill-light text-xs font-semibold px-3 py-1 flex items-center gap-1.5 ml-2"
        >
          <span>Start free trial</span>
          <span className="text-[#397dff] font-bold">→</span>
        </Link>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="relative z-10 text-[#9aa1a3] hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors ml-2 cursor-pointer"
        aria-label="Dismiss banner"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
