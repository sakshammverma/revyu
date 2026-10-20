"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { usePricing } from "@/lib/pricing";
import { GhostHand, InteractiveTag, TryHint, useCountUp, useInView, usePlayground } from "./interact";

// "One customer covers a year" (documents/21-CONVERSION-DESIGN.md §6).
// Pure arithmetic on our published price and the owner's own average bill —
// no conversion-rate, review-count or revenue projections (03-COMPLIANCE.md).
// The slider runs in launch-market (INR) units and is scaled to the visitor's
// market by the ratio of their monthly price to the launch price, so a typical
// bill stays proportionate to the plan price in any currency.
const LAUNCH_MONTHLY_MINOR = 49_900;

export function ROICalculatorSection() {
  const pricing = usePricing();
  const [pos, setPos] = useState(1500);
  const { tried, markTried } = usePlayground("roi");
  const demoRef = useRef<HTMLDivElement>(null);
  const inView = useInView(demoRef);
  const touch = (n: number) => {
    markTried();
    setPos(n);
  };

  const monthlyMinor = pricing.monthlyMinor ?? LAUNCH_MONTHLY_MINOR;
  const annualMinor = pricing.annualMinor ?? monthlyMinor * 9;
  const scale = monthlyMinor / LAUNCH_MONTHLY_MINOR;
  const scaled = (n: number) => Math.max(1, Math.round(n * scale));
  const show = (minor: number) => (pricing.ready ? pricing.money(minor) : "…");
  const showMajor = (major: number) => show(major * 100);

  const avgBill = scaled(pos);
  const customersPerYearAnnual = useCountUp(Math.max(1, Math.ceil(annualMinor / 100 / avgBill)));
  const customersPerYearMonthly = useCountUp(Math.max(1, Math.ceil((monthlyMinor * 12) / 100 / avgBill)));
  const shownBill = useCountUp(avgBill);
  const fill = ((pos - 200) / (10000 - 200)) * 100;

  return (
    <div id="calculator" className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-line p-6 sm:p-12 lg:p-16">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-text-2 flex items-center gap-3">
            The price, in customers <InteractiveTag />
          </p>
          <h2 className="heading-h2 font-display text-ink">
            One new customer can cover a whole year.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-text-muted leading-relaxed">
            Slide to your average bill. This is only the arithmetic of our price — we don&apos;t guess how many
            reviews or customers you&apos;ll get.
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#fcfcfc] rounded-2xl border border-line p-6 sm:p-10">
          {/* Left Column: slider */}
          <div ref={demoRef} className="lg:col-span-6 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="avg-bill" className="text-sm font-semibold text-ink">
                  Average bill per customer
                </label>
                <span className="font-display text-2xl font-bold text-accent-hover px-3 py-1 rounded-lg bg-accent/10">
                  {showMajor(shownBill)}
                </span>
              </div>
              <div className="relative py-2">
                <input
                  id="avg-bill"
                  type="range"
                  min="200"
                  max="10000"
                  step="100"
                  value={pos}
                  onChange={(e) => touch(Number(e.target.value))}
                  aria-valuetext={pricing.ready ? showMajor(avgBill) : undefined}
                  style={{ "--fill": `${fill}%` } as React.CSSProperties}
                  className={`range-fill w-full ${tried ? "" : "afford-ring"}`}
                />
                <GhostHand
                  play={inView && !tried}
                  path={[
                    { x: "13%", y: "55%" },
                    { x: "38%", y: "55%" },
                    { x: "13%", y: "55%" },
                  ]}
                  onStep={(i) => {
                    if (!tried && i > 0) setPos(i === 1 ? 4000 : 1500);
                  }}
                />
              </div>
              <div className="mt-2 flex justify-center">
                <TryHint label="Drag to your average bill" done={tried} />
              </div>
              <div className="flex justify-between text-[11px] text-text-muted mt-2">
                <span>{showMajor(scaled(200))}</span>
                <span>{showMajor(scaled(2500))}</span>
                <span>{showMajor(scaled(5000))}</span>
                <span>{showMajor(scaled(10000))}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-line shadow-2xs flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-line">
                <span className="text-text-2">Monthly plan · {show(monthlyMinor)} × 12</span>
                <span className="font-bold text-ink">{show(monthlyMinor * 12)} / year</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <span className="text-accent-hover">✽</span> Annual plan
                </span>
                <span className="font-bold text-success-strong text-sm">{show(annualMinor)} / year</span>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Prices include every feature and every business type. No tiers, no setup fee.
            </p>
          </div>

          {/* Right Column: arithmetic cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Stat
              label="Customers to cover the annual plan"
              value={pricing.ready ? `${customersPerYearAnnual}` : "…"}
              note={customersPerYearAnnual === 1 ? "One visit pays for the year" : "New customers, across a whole year"}
              tone="green"
            />
            <Stat
              label="Customers to cover the monthly plan"
              value={pricing.ready ? `${customersPerYearMonthly}` : "…"}
              note="Over twelve months"
            />
            <Stat label="Annual plan, per day" value={show(Math.round(annualMinor / 365))} note="Less than a daily cup of tea or coffee" tone="blue" />
            <Stat label="Free before you pay" value="15 days" note="First charge comes after the trial" />
          </div>
        </div>

        {/* CTA Bar */}
        <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-text-2">
            <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            <span>Your numbers are in your dashboard before you decide anything</span>
          </div>
          <Link href="/signup" className="btn-primary self-start sm:self-auto text-xs py-2.5 px-5">
            <span>Start 15-day trial →</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "ink",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "ink" | "green" | "blue";
}) {
  const color = tone === "green" ? "text-success-strong" : tone === "blue" ? "text-accent-hover" : "text-ink";
  return (
    <div className="p-5 rounded-xl bg-white border border-line shadow-2xs">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`font-display text-3xl sm:text-4xl font-bold mt-1.5 ${color}`}>{value}</p>
      <p className="text-[11px] text-text-2 mt-1">{note}</p>
    </div>
  );
}
