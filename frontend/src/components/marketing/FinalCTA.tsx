"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export function FinalCTA() {
  const [email, setEmail] = useState("");

  return (
    <div className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-8 sm:p-14 lg:p-20 relative overflow-hidden text-center bg-white shadow-v2-elevated rounded-2xl">
        {/* Subtle contour lines watermark in background */}
        <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
          <Image
            src="/assets/contour-lines.svg"
            alt="Contour lines background pattern"
            width={1200}
            height={600}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#397dff]/10 text-[#397dff] flex items-center justify-center text-xl font-display mb-6 shadow-2xs">
            ✽
          </div>

          <h2 className="heading-h2 font-display text-3xl sm:text-5xl lg:text-[54px] text-[#1a1e23] leading-tight tracking-tight">
            The shop next door asks everyone. Will you?
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[#515a63] leading-relaxed max-w-xl mx-auto">
            Every week you wait, their count moves and yours stays where it is. Start free, print your code, and let it ask for you.
          </p>

          {/* Email Capture Pill */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) {
                window.location.href = `/signup?email=${encodeURIComponent(email.trim())}`;
              } else {
                window.location.href = "/signup";
              }
            }}
            className="mt-8 sm:mt-10 w-full max-w-md bg-white border border-[#e8ecec] p-1.5 rounded-full shadow-v2-elevated flex items-center gap-2 hover:border-[#cbd5e1] transition-colors"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your business email"
              className="flex-1 bg-transparent px-4 py-2.5 text-xs sm:text-sm text-[#1a1e23] placeholder-[#9aa1a3] outline-hidden"
            />
            <button
              type="submit"
              className="btn-primary text-xs sm:text-sm py-2 sm:py-2.5 px-5 sm:px-6 cursor-pointer"
            >
              <span>Start free trial</span>
            </button>
          </form>

          {/* Reassurance Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-[#6e797b]">
            <span className="flex items-center gap-1.5">
              <span className="text-[#16a34a] font-bold">✓</span> 15-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#16a34a] font-bold">✓</span> QR + print files by email
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#16a34a] font-bold">✓</span> Cancel anytime
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
