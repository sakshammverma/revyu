"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export function HeroScrollShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [manualScrub, setManualScrub] = useState<number | null>(null);

  useEffect(() => {
    function handleScroll() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate how far the component has scrolled through viewport
      const start = windowHeight * 0.85;
      const end = windowHeight * 0.15;
      const total = start - end;
      const current = start - rect.top;
      const progress = Math.min(Math.max(current / total, 0), 1);
      
      setScrollProgress(progress);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const activeProgress = manualScrub !== null ? manualScrub : scrollProgress;

  return (
    <div ref={containerRef} className="relative w-full border-b border-line bg-paper">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-line text-xs font-mono text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="font-semibold text-ink uppercase tracking-wider">
            [FIG 01 // CHECKOUT SCAN TELEMETRY]
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-ink-subtle">
            SCROLL TO ACTIVATE OR USE SCRUBBER
          </span>
          <span className="font-bold text-brand bg-brand/10 px-2 py-0.5 border border-brand/20">
            {Math.round(activeProgress * 100)}% ACTIVE
          </span>
        </div>
      </div>

      {/* Main Image Viewport with 1:1 Cross-Fade */}
      <div className="relative w-full aspect-[16/9] max-h-[620px] overflow-hidden bg-paper-subtle select-none group">
        {/* Layer 1: Idle Stand (Base) */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero-stand-idle.jpg"
            alt="Revyu Smart QR and NFC Counter Stand on a shop counter"
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1200px) 100vw, 1200px"
          />
        </div>

        {/* Layer 2: Active Glowing Interaction (Cross-faded by scroll/scrub) */}
        <div
          className="absolute inset-0 transition-opacity duration-150 ease-out"
          style={{ opacity: activeProgress }}
        >
          <Image
            src="/images/hero-stand-active.jpg"
            alt="Customer scanning Revyu stand with instant 5-star review assembly"
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1200px) 100vw, 1200px"
          />
        </div>

        {/* Floating Dynamic Status Pills */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 flex flex-col gap-2">
          <div
            className={`px-3.5 py-1.5 backdrop-blur-md border text-xs font-semibold tracking-wide transition-all duration-300 shadow-sm ${
              activeProgress > 0.4
                ? "bg-brand text-white border-brand shadow-brand/20"
                : "bg-white/90 text-ink border-line"
            }`}
          >
            {activeProgress > 0.4 ? (
              <span className="flex items-center gap-1.5">
                <span className="text-amber-300">★★★★★</span>
                <span>Review Generated &amp; Synced</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-positive" />
                <span>Standby: Ready at Checkout</span>
              </span>
            )}
          </div>

          {activeProgress > 0.6 && (
            <div className="animate-fade-in px-3.5 py-1.5 backdrop-blur-md bg-white/95 border border-line text-xs font-medium text-ink shadow-sm flex items-center gap-2">
              <span className="text-positive font-bold">✓</span>
              <span>1-Tap Google Maps Handoff</span>
            </div>
          )}
        </div>

        {/* Bottom Interactive Control Bar */}
        <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 backdrop-blur-md bg-white/90 border border-line shadow-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <span className="text-cta">⚡</span>
            <span>Interactive Checkout Simulator:</span>
            <span className="text-ink-muted hidden md:inline font-normal">
              Scroll down or drag slider to trigger review assembly
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-64">
            <span className="text-[11px] font-mono text-ink-muted uppercase">Idle</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={activeProgress}
              onChange={(e) => setManualScrub(parseFloat(e.target.value))}
              className="w-full h-2 bg-paper-subtle border border-line accent-cta cursor-pointer"
              aria-label="Simulate review scan progress"
            />
            <span className="text-[11px] font-mono text-brand font-bold uppercase">Active</span>
            {manualScrub !== null && (
              <button
                type="button"
                onClick={() => setManualScrub(null)}
                className="text-[11px] text-ink-muted hover:text-ink underline ml-1 cursor-pointer"
              >
                Auto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
