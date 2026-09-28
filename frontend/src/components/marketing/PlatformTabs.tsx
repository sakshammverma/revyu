"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

import { getDemoVertical } from "@/lib/marketing/demo";

// One tab per QR placement; tags come from the general vertical (backend/app/verticals/).
// Background photos are decorative only.
const TAG_LIST = (key: string) =>
  getDemoVertical(key)
    .tags.map((t) => t.label)
    .join(" · ");

const TABS = [
  {
    id: "counter",
    title: "Billing counter",
    desc: "Standee next to the till",
    image: "/images/landscape-architectural-haven.jpg",
    headline: "Happy customers rarely think to say so on Google. The QR at the till gives them a reason to.",
    subtext: `Default tags: ${TAG_LIST("general")}.`,
    features: [
      { title: "Scan on their own phone", text: "A standee or sticker at the counter. Customers scan when it suits them, no app, no login." },
      { title: "Your listing, verified", text: "We check the Google listing you picked before going live, so reviews never land on a stranger's shop." },
      { title: "Unhappy customers reach you first", text: "At 1–3 stars, a private note to you is offered first — the Google button stays right below it." },
    ],
  },
  {
    id: "receipt",
    title: "Bill or receipt",
    desc: "QR printed on the bill",
    image: "/images/landscape-dolomites-alpine.jpg",
    headline: "Every customer gets a bill. Put the QR on it and every customer gets asked the same way.",
    subtext: `Default tags: ${TAG_LIST("general")}.`,
    features: [
      { title: "Take-home placement", text: "Customers scan later, at home, with no one watching, which keeps the review honest." },
      { title: "Tags you can change", text: "The default eight can be edited for your shop, so the options match what you actually sell." },
      { title: "Editable every time", text: "Customers can rewrite or clear the draft before copying. It is always their review." },
    ],
  },
  {
    id: "table",
    title: "Table or shelf",
    desc: "Card on a table, shelf or wall",
    image: "/images/nature-terrace-fields.jpg",
    headline: "Regulars are your best advertisement — if they write it down.",
    subtext: `Default tags: ${TAG_LIST("general")}.`,
    features: [
      { title: "Table cards and wall posters", text: "Print-ready files for A4 posters, table tents and small cards." },
      { title: "No incentives, ever", text: "No discounts or freebies for reviews. That rule protects your Google profile." },
      { title: "See what customers pick", text: "Your dashboard shows which tags come up most — a simple read on what customers value." },
    ],
  },
  {
    id: "packaging",
    title: "Packaging & delivery",
    desc: "Sticker on bags and boxes",
    image: "/images/landscape-emerald-forest.jpg",
    headline: "Not every customer walks past the counter. A sticker on the bag reaches the rest.",
    subtext: `Default tags: ${TAG_LIST("general")}.`,
    features: [
      { title: "Bag, box or delivery slip", text: "A small sticker or slip travels home with the order." },
      { title: "Private feedback inbox", text: "Anyone can send you a private note at any rating. You read and resolve it in your dashboard." },
      { title: "Google link at every rating", text: "No threshold, no delay, no hidden button. That is the rule, and we don't bend it." },
    ],
  },
  {
    id: "anywhere",
    title: "Any business",
    desc: "One flat price for everyone",
    image: "/images/landscape-ocean-horizon.jpg",
    headline: "If customers visit you and search for you on Google, Revyu fits.",
    subtext: `Default tags: ${TAG_LIST("general")}.`,
    features: [
      { title: "No pressure framing", text: "The printed prompt says “scan to share your experience” — never “give us 5 stars”." },
      { title: "Works for any shop or service", text: "Retail, food, repairs, salons, clinics, studios — change the tags to match." },
      { title: "One flat price", text: "₹499 a month, the same for every kind of business. No tiers, no add-ons." },
    ],
  },
];

export function PlatformTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);

  // Switch image and content after every 3.3 seconds
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % TABS.length);
      setCycleKey((k) => k + 1);
    }, 3300);

    return () => clearInterval(interval);
  }, [isPaused, activeTab]);

  function handleTabClick(idx: number) {
    setActiveTab(idx);
    setCycleKey((k) => k + 1);
  }

  const current = TABS[activeTab];

  return (
    <div id="specialties" className="mx-2 sm:mx-3 my-12 sm:my-16">
      <section
        className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            Built for every kind of shop
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            Wherever customers pay, the QR fits.
          </h2>
        </div>

        {/* 5-Column Tab Switcher */}
        <div className="grid grid-cols-2 lg:grid-cols-5 rounded-xl border border-[#e8ecec] bg-[#fcfcfc] overflow-hidden divide-x divide-y lg:divide-y-0 divide-[#e8ecec]">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(idx)}
                className={`relative p-4 sm:p-5 text-left transition-colors cursor-pointer ${
                  isActive ? "bg-white" : "bg-[#fcfcfc] hover:bg-white/60"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#397dff] shrink-0" />
                  )}
                  <p className={`text-sm sm:text-base font-semibold leading-tight ${isActive ? "text-[#1a1e23]" : "text-[#515a63]"}`}>
                    {tab.title}
                  </p>
                </div>
                <p className="text-xs text-[#6e797b] line-clamp-1">
                  {tab.desc}
                </p>

                {/* 3.3s Progress Underline */}
                {isActive && !isPaused && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#e8ecec] overflow-hidden">
                    <div
                      key={`tab-progress-${idx}-${cycleKey}`}
                      className="h-full bg-[#397dff] animate-[tabFill_3.3s_linear]"
                    />
                  </div>
                )}
                {isActive && isPaused && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#397dff]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Large Stage Frame (Product UI on top of Cinematic Landscape) */}
        <div className="mt-8 rounded-2xl overflow-hidden border border-[#e8ecec] bg-[#1a1e23] shadow-v2-rest relative">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] min-h-[340px] sm:min-h-[440px] w-full">
            {TABS.map((tab, idx) => (
              <div
                key={tab.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  activeTab === idx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <Image
                  src={tab.image}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1e23]/95 via-[#1a1e23]/50 to-transparent z-20 pointer-events-none" />

            {/* Overlaid UI Content */}
            <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 text-white max-w-2xl z-30">
              <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-[#397dff] text-white mb-3">
                {current.title}
              </span>
              <h3 className="font-display text-xl sm:text-3xl text-white mb-2 leading-snug">
                {current.headline}
              </h3>
              <p className="text-xs sm:text-sm text-[#e2e4e5] leading-relaxed max-w-xl">
                {current.subtext}
              </p>
            </div>
          </div>
        </div>

        {/* 3-Column Feature Row Below Stage */}
        <div className="mt-8 pt-8 border-t border-[#e8ecec] grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {current.features.map((feat, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#e7f5fd] text-[#397dff] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1a1e23]">{feat.title}</p>
                <p className="text-xs text-[#6e797b] mt-1 leading-relaxed">{feat.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
