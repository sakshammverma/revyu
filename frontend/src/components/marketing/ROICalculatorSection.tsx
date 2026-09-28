"use client";

import { useState } from "react";
import Link from "next/link";

// "One customer covers a year" (documents/21-CONVERSION-DESIGN.md §6).
// Pure arithmetic on our published price and the owner's own average bill —
// no conversion-rate, review-count or revenue projections (03-COMPLIANCE.md).
const MONTHLY = 499;
const ANNUAL = 4499;

export function ROICalculatorSection() {
  const [avgBill, setAvgBill] = useState(1500);

  const customersPerYearAnnual = Math.max(1, Math.ceil(ANNUAL / avgBill));
  const customersPerYearMonthly = Math.max(1, Math.ceil((MONTHLY * 12) / avgBill));
  const perDay = Math.round(ANNUAL / 365);

  return (
    <div id="calculator" className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            The price, in customers
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            One new customer can cover a whole year.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#6e797b] leading-relaxed">
            Slide to your average bill. This is only the arithmetic of our price — we don&apos;t guess how many
            reviews or customers you&apos;ll get.
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#fcfcfc] rounded-2xl border border-[#e8ecec] p-6 sm:p-10">
          {/* Left Column: slider */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="avg-bill" className="text-sm font-semibold text-[#1a1e23]">
                  Average bill per customer
                </label>
                <span className="font-display text-2xl font-bold text-[#397dff] px-3 py-1 rounded-lg bg-[#397dff]/10">
                  ₹{avgBill.toLocaleString("en-IN")}
                </span>
              </div>
              <input
                id="avg-bill"
                type="range"
                min="200"
                max="10000"
                step="100"
                value={avgBill}
                onChange={(e) => setAvgBill(Number(e.target.value))}
                className="w-full h-2.5 bg-[#e8ecec] rounded-lg appearance-none cursor-pointer accent-[#397dff]"
              />
              <div className="flex justify-between text-[11px] text-[#9aa1a3] mt-2">
                <span>₹200</span>
                <span>₹2,500</span>
                <span>₹5,000</span>
                <span>₹10,000</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#e8ecec] shadow-2xs flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#e8ecec]">
                <span className="text-[#515a63]">Monthly plan · ₹499 × 12</span>
                <span className="font-bold text-[#1a1e23]">₹{(MONTHLY * 12).toLocaleString("en-IN")} / year</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-[#1a1e23] flex items-center gap-1.5">
                  <span className="text-[#397dff]">✽</span> Annual plan
                </span>
                <span className="font-bold text-[#16a34a] text-sm">₹{ANNUAL.toLocaleString("en-IN")} / year</span>
              </div>
            </div>

            <p className="text-xs text-[#6e797b] leading-relaxed">
              Prices include every feature and every business type. No tiers, no setup fee.
            </p>
          </div>

          {/* Right Column: arithmetic cards */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Stat
              label="Customers to cover the annual plan"
              value={`${customersPerYearAnnual}`}
              note={customersPerYearAnnual === 1 ? "One visit pays for the year" : "New customers, across a whole year"}
              tone="green"
            />
            <Stat
              label="Customers to cover the monthly plan"
              value={`${customersPerYearMonthly}`}
              note="Over twelve months"
            />
            <Stat label="Annual plan, per day" value={`₹${perDay}`} note="Less than a cup of chai" tone="blue" />
            <Stat label="Free before you pay" value="15 days" note="Then 10 review credits" />
          </div>
        </div>

        {/* CTA Bar */}
        <div className="mt-8 pt-6 border-t border-[#e8ecec] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#515a63]">
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
  const color = tone === "green" ? "text-[#16a34a]" : tone === "blue" ? "text-[#397dff]" : "text-[#1a1e23]";
  return (
    <div className="p-5 rounded-xl bg-white border border-[#e8ecec] shadow-2xs">
      <p className="text-xs text-[#6e797b]">{label}</p>
      <p className={`font-display text-3xl sm:text-4xl font-bold mt-1.5 ${color}`}>{value}</p>
      <p className="text-[11px] text-[#515a63] mt-1">{note}</p>
    </div>
  );
}
