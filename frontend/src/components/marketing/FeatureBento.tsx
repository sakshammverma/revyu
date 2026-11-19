"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { getDemoVertical } from "@/lib/marketing/demo";
import { InteractiveTag, usePlayground, useTablist } from "./interact";
import { Reveal } from "./Reveal";

// The four files generated for every approved outlet (backend/app/services/print_assets.py).
// We ship files, not hardware: the owner prints them anywhere (CR-4).
const KIT = [
  { id: "standee", name: "Counter standee", size: "A5 · 148 × 210 mm", where: "Reception desk or payment counter", image: "/images/print-counter-standee.jpg" },
  { id: "sticker", name: "Counter sticker", size: "100 × 100 mm", where: "By the till, on bags and boxes", image: "/images/print-counter-sticker.jpg" },
  { id: "card", name: "Handout card", size: "A7 · 74 × 105 mm", where: "With the bill or in the delivery bag", image: "/images/print-handout-card.jpg" },
  { id: "receipt", name: "Receipt footer", size: "80 × 60 mm", where: "Printed on every bill, scanned at home", image: "/images/print-receipt-footer.jpg" },
];

const TAGS = getDemoVertical("general").tags;

function Tile({ children, className = "", order = 0 }: { children: ReactNode; className?: string; order?: number }) {
  return (
    <Reveal order={order} className={className}>
      <div className="lift flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-v2-rest sm:p-7">{children}</div>
    </Reveal>
  );
}

function TileHead({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">{kicker}</p>
      <h3 className="mt-1.5 font-display text-xl leading-snug text-ink sm:text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-2">{body}</p>
    </>
  );
}

/** Everything a shop gets, as one grid: the print kit, the dashboard, the inbox, and the small things that matter. */
export function FeatureBento() {
  const [kit, setKit] = useState(0);
  const { markTried } = usePlayground("kit");
  const pick = (i: number) => {
    markTried();
    setKit(i);
  };
  const { listProps, tabProps, panelProps } = useTablist(KIT.length, kit, pick, "kit");
  const current = KIT[kit];

  return (
    <section id="kit" aria-labelledby="kit-title" className="mx-auto max-w-[1296px] px-4 py-16 sm:px-8 sm:py-24">
      <div className="max-w-3xl">
        <p className="vf-section-label mb-2 uppercase tracking-wider">What you get</p>
        <h2 id="kit-title" className="heading-h2">
          Print it once. It asks every customer from then on.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-text-muted sm:text-lg">
          One flat plan includes all of this. No tiers and no add-ons.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-6">
        {/* Print kit */}
        <Tile className="lg:col-span-4 lg:row-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <TileHead
                kicker="Print kit"
                title="Four print-ready files, emailed to you"
                body="Your QR code on a standee, a sticker, a handout card and a receipt footer. Print them at any local printer. Each one says “Scan to share your experience”, never “give us 5 stars”."
              />
            </div>
            <InteractiveTag />
          </div>

          <div {...listProps} aria-label="Print files" className="mt-5 flex flex-wrap gap-2">
            {KIT.map((item, i) => (
              <button
                key={item.id}
                type="button"
                {...tabProps(i)}
                onClick={() => pick(i)}
                className={`min-h-[44px] cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${
                  i === kit ? "border-accent bg-accent text-white" : "border-line bg-white text-text-2 hover:border-accent/50 hover:text-ink"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div {...panelProps} className="relative mt-4 min-h-[280px] flex-1 overflow-hidden rounded-xl border border-line bg-paper-subtle sm:min-h-[300px]">
            {KIT.map((item, i) => (
              <Image
                key={item.id}
                src={item.image}
                alt={i === kit ? `${item.name} print file, shown for a fictional shop` : ""}
                fill
                sizes="(min-width: 1024px) 800px, 100vw"
                className={`object-cover lg:origin-[80%_55%] lg:scale-[1.55] object-[85%_center] transition-opacity duration-500 ${i === kit ? "opacity-100" : "opacity-0"}`}
              />
            ))}
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-night/85 to-transparent p-4 pt-12 text-white">
              <div>
                <p className="text-sm font-semibold">{current.name}</p>
                <p className="text-xs text-white/85">{current.where}</p>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">{current.size}</span>
            </div>
          </div>
        </Tile>

        {/* Dashboard */}
        <Tile className="lg:col-span-2" order={1}>
          <TileHead kicker="Dashboard" title="See what your code is doing" body="Scans, completed flows and the tags customers pick most." />
          <div aria-hidden className="mt-5 flex flex-1 items-end gap-2">
            {[38, 52, 44, 66, 58, 80, 72].map((h, i) => (
              <span key={i} className={`flex-1 rounded-t-md ${i === 5 ? "bg-accent" : "bg-accent/20"}`} style={{ height: `${h}px` }} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">Sample chart</p>
        </Tile>

        {/* Private inbox */}
        <Tile className="lg:col-span-2" order={2}>
          <TileHead kicker="Private inbox" title="Hear it before it festers" body="Any customer, at any rating, can write to you privately. You get an email and can reply the same day." />
          <div className="mt-5 rounded-xl border border-line bg-bg p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="rounded-full bg-warning-50 px-2 py-0.5 font-bold text-warning">2★ private</span>
              <span className="text-text-muted">Sample message</span>
            </div>
            <p className="mt-2 text-sm leading-snug text-ink">Billing took too long and nobody told me why.</p>
          </div>
        </Tile>

        {/* Your tags */}
        <Reveal className="lg:col-span-3" order={1}>
          <div className="night-surface flex h-full flex-col overflow-hidden rounded-2xl p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft">Your tags</p>
            <h3 className="mt-1.5 font-display text-xl leading-snug text-white sm:text-2xl">Up to eight things worth praising, chosen by you</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Start from a default set and change it to fit what you sell. Drafts are built only from the tags a customer taps.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <li key={t.id} className="glass-dark rounded-full px-3 py-1.5 text-[13px] font-medium text-white">
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* No app + languages */}
        <Tile className="lg:col-span-3" order={2}>
          <TileHead
            kicker="For your customer"
            title="No app, no account, their own language"
            body="The code opens a web page on their phone. They can read it in English or हिन्दी."
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg px-3.5 py-2 text-sm font-medium text-ink">
              <svg aria-hidden width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
                <path d="M2 5V3.5a3.5 3.5 0 0 1 7 0V5h.5A1.500 1.500 0 0 1 11 6.500v5A1.500 1.500 0 0 1 9.500 13h-8A1.500 1.500 0 0 1 0 11.500v-5A1.500 1.500 0 0 1 1.500 5H2Zm1.500 0h4V3.500a2 2 0 0 0-4 0V5Z" />
              </svg>
              revyu.in
            </span>
            <span className="inline-flex overflow-hidden rounded-xl border border-line text-sm font-semibold">
              <span className="bg-accent px-3.5 py-2 text-white">English</span>
              <span className="bg-white px-3.5 py-2 text-text-2">हिन्दी</span>
            </span>
            <Link href="/demo" className="ml-auto text-sm font-semibold text-accent-hover underline underline-offset-4 hover:no-underline">
              Open the customer page →
            </Link>
          </div>
        </Tile>
      </div>
    </section>
  );
}
