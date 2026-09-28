"use client";

import { useState } from "react";
import Image from "next/image";

// Mirrors backend/app/services/print_assets.py — these are the files we
// generate for every approved outlet. We ship files, not hardware: the owner
// prints them locally (CR-4: printed material, on the customer's own phone).
const KIT_ITEMS = [
  {
    id: "receipt",
    name: "Receipt footer",
    tagline: "Take-home · the recommended default",
    description:
      "A small QR block sized for thermal receipt printers and invoice copies. The customer finds it later, at home, on their own time — the lowest-pressure place to ask.",
    specs: [
      { label: "Size", val: "80 × 60 mm" },
      { label: "Format", val: "Print-ready PDF" },
      { label: "Prompt", val: "“Scan to share your experience”" },
      { label: "Placement", val: "Receipts, invoice copies, appointment slips" },
    ],
  },
  {
    id: "handout",
    name: "Handout card",
    tagline: "Take-home · hand over with the bill",
    description:
      "A pocket card with your business name and QR. Staff can hand it over or point at it — they never stand over the customer while they complete it.",
    specs: [
      { label: "Size", val: "A7 (74 × 105 mm)" },
      { label: "Format", val: "Print-ready PDF" },
      { label: "Prompt", val: "“Scan to share your experience”" },
      { label: "Placement", val: "With the bill, in the appointment folder" },
    ],
  },
  {
    id: "standee",
    name: "Counter standee",
    tagline: "Counter · near the payment point",
    description:
      "A larger A5 print for a stand at reception or the payment counter. The customer scans with their own phone — never a tablet handed over by staff.",
    specs: [
      { label: "Size", val: "A5 (148 × 210 mm)" },
      { label: "Format", val: "Print-ready PDF" },
      { label: "Prompt", val: "“Scan to share your experience”" },
      { label: "Placement", val: "Reception desk, payment counter" },
    ],
  },
  {
    id: "sticker",
    name: "Counter sticker",
    tagline: "Counter · next to the card machine",
    description:
      "A square sticker for the counter, till or card machine. Same QR, same neutral wording — never “leave us 5 stars”, never an incentive.",
    specs: [
      { label: "Size", val: "100 × 100 mm" },
      { label: "Format", val: "Print-ready PDF" },
      { label: "Prompt", val: "“Scan to share your experience”" },
      { label: "Placement", val: "Till, card machine, counter top" },
    ],
  },
];

export function HardwareShowcase() {
  const [activeItem, setActiveItem] = useState(0);
  const current = KIT_ITEMS[activeItem];

  return (
    <section className="mx-2 sm:mx-3 my-12 sm:my-16">
      <div className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16">
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            Your print kit
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            Four print-ready files. Print them anywhere.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6e797b] leading-relaxed">
            Once your business is verified, we email your QR code and four PDFs with your name on them. Print at your local shop or on your own receipt printer — no hardware to wait for.
          </p>
        </div>

        {/* 3-Column Tab Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 rounded-xl border border-[#e8ecec] bg-[#fcfcfc] overflow-hidden divide-x divide-y md:divide-y-0 divide-[#e8ecec] mb-8">
          {KIT_ITEMS.map((item, idx) => {
            const isActive = activeItem === idx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveItem(idx)}
                className={`p-4 sm:p-5 text-left transition-colors cursor-pointer ${
                  isActive ? "bg-white" : "bg-[#fcfcfc] hover:bg-white/60"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? "bg-[#397dff]" : "bg-[#d1d5db]"
                    }`}
                  />
                  <p
                    className={`text-sm sm:text-base font-semibold leading-tight ${
                      isActive ? "text-[#1a1e23]" : "text-[#515a63]"
                    }`}
                  >
                    {item.name}
                  </p>
                </div>
                <p className="text-xs text-[#6e797b] line-clamp-1">{item.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Print asset visual & specs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#f8fafc] rounded-2xl border border-[#e8ecec] p-6 sm:p-10">
          {/* Visual Showcase (Left 7 cols) */}
          <div className="lg:col-span-7 relative aspect-[16/10] rounded-xl overflow-hidden border border-[#e8ecec] bg-[#1a1e23] flex items-center justify-center">
            {/* Background Cinematic Atmosphere */}
            <Image
              src="/images/landscape-architectural-haven.jpg"
              alt=""
              fill
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1e23] via-[#1a1e23]/60 to-transparent" />

            {/* Print asset card */}
            <div className="relative z-10 p-6 sm:p-8 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#e7f5fd] text-[#397dff] flex items-center justify-center text-xl font-bold mx-auto mb-3">
                ▦
              </div>
              <p className="font-display text-base sm:text-lg font-bold text-[#1a1e23]">
                {current.name}
              </p>
              <p className="text-xs text-[#6e797b] mt-1 leading-snug">
                QR opens your review flow, linked to the Google listing we verified with you
              </p>

              {/* Asset traits */}
              <div className="mt-4 pt-4 border-t border-[#e8ecec] flex items-center justify-center gap-4 text-xs font-semibold text-[#515a63]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
                  Your name on it
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#397dff]" />
                  Neutral wording
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Specs (Right 5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-[#397dff]/10 text-[#397dff] mb-2">
                Included with every plan
              </span>
              <h3 className="font-display text-xl sm:text-2xl text-[#1a1e23] leading-snug mb-3">
                {current.name}
              </h3>
              <p className="text-xs sm:text-sm text-[#515a63] leading-relaxed mb-6">
                {current.description}
              </p>
            </div>

            {/* Spec Table */}
            <div className="rounded-xl border border-[#e8ecec] bg-white divide-y divide-[#e8ecec] overflow-hidden text-xs">
              {current.specs.map((s, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <span className="text-[#6e797b] font-medium">{s.label}</span>
                  <span className="text-[#1a1e23] font-semibold text-right max-w-[200px]">
                    {s.val}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <a href="/signup" className="btn-primary text-xs py-2 px-4">
                <span>Start free trial →</span>
              </a>
              <span className="text-xs text-[#6e797b]">Emailed when you&apos;re approved</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
