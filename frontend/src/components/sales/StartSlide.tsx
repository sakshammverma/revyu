"use client";

import { useState } from "react";

import { Segmented } from "@/components/ui/kit";
import { IfPriced, Price, usePricing } from "@/lib/pricing";
import type { QrShape, SalesKit } from "@/lib/marketing/salesTypes";

type Plan = "monthly" | "annual";

const INCLUDED = [
  "Your counter QR + print-ready files",
  "Your customer page in your name",
  "Private feedback with call/WhatsApp back",
  "Weekly Google count + nearby shops",
  "Set up with you today",
];

const NEXT_STEPS = [
  { title: "Sign up", note: "2 min" },
  { title: "We verify", note: "usually a few hours" },
  { title: "QR live", note: "on your counter" },
];

/** Relative link to the signup form, so "on this phone" stays on the deck's own origin. */
function localHref(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Minor units in one major unit of `currency` (100 for INR, 1 for JPY, 1000 for KWD). */
function minorPerMajor(currency: string): number {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return 10 ** digits;
  } catch {
    return 100;
  }
}

/**
 * The monthly price per day in whole units, rounded up ("about ₹17 a day", not "₹16.63"):
 * a rough figure should look rough. Null until prices load. Shared with the presenter cues.
 */
export function roughPerDay(pricing: ReturnType<typeof usePricing>): string | null {
  if (!pricing.ready || pricing.monthlyMinor === null) return null;
  const unit = minorPerMajor(pricing.currency ?? "USD");
  return pricing.money(Math.ceil(pricing.monthlyMinor / 30 / unit) * unit);
}

function Qr({ qr, label }: { qr: QrShape; label: string }) {
  const quiet = 4;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-quiet} ${-quiet} ${qr.size + quiet * 2} ${qr.size + quiet * 2}`}
      shapeRendering="crispEdges"
      className="h-[148px] w-[148px] rounded-[var(--r-media)] bg-white text-ink sm:h-[200px] sm:w-[200px]"
    >
      <rect x={-quiet} y={-quiet} width={qr.size + quiet * 2} height={qr.size + quiet * 2} fill="white" />
      <path d={qr.d} fill="currentColor" />
    </svg>
  );
}

/**
 * Step 4: the trial and the price, then a code the owner scans to sign up on their own phone
 * with the shop already filled in. Prices come from the API for the shop's market; nothing is
 * hardcoded and nothing is shown if they fail to load. No promo, no deadline.
 */
export function StartSlide({ kit, name, onEnd }: { kit: SalesKit; name: string; onEnd: () => void }) {
  const pricing = usePricing();
  const [plan, setPlan] = useState<Plan>("monthly");
  const perDay = roughPerDay(pricing);
  const link = kit.signup[plan];

  return (
    <div className="marketing-root mx-auto flex h-full max-w-4xl flex-col justify-center-safe gap-2.5 px-5 py-3 sm:gap-6 sm:px-8 sm:py-10">
      <h1 className="font-display text-[1.6rem] leading-[1.15] tracking-tight text-ink sm:text-5xl">Start free today.</h1>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-10">
        <div className="flex min-w-0 flex-col gap-2.5 sm:gap-6">
          <div>
            <p className="font-display text-[1.6rem] leading-[1.1] tracking-tight text-accent sm:text-5xl">15 days free</p>
            <p className="mt-1 text-sm text-ink sm:text-lg">
              then <span className="font-semibold"><Price plan="monthly" /></span> per month
            </p>
            {perDay && <p className="text-xs text-text-2 sm:text-sm">about {perDay} a day</p>}
            <IfPriced plan="annual">
              <p className="mt-1 text-xs text-text-2 sm:text-sm">
                or <Price plan="annual" /> a year
                <IfPriced plan="saving">
                  {" "}
                  <span className="whitespace-nowrap font-semibold text-success-strong">
                    · save <Price plan="saving" />
                  </span>
                </IfPriced>
              </p>
            </IfPriced>
          </div>

          <ul className="flex flex-col gap-1 sm:gap-2">
            {INCLUDED.map((i, n) => (
              <li
                key={i}
                className={`items-start gap-1.5 text-[13px] leading-snug text-ink sm:flex sm:gap-2 sm:text-sm ${n < 3 ? "flex" : "hidden"}`}
              >
                <span aria-hidden className="text-success sm:mt-0.5">✓</span>
                {i}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Segmented<Plan>
            label="Plan"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Yearly" },
            ]}
          />
          <div className="rounded-[var(--r-card)] border border-line bg-white p-1 shadow-v2-rest">
            <Qr qr={link.qr} label={`QR code: start the ${plan === "annual" ? "yearly" : "monthly"} free trial for ${name}`} />
          </div>
          <p className="max-w-[164px] text-center text-xs leading-snug text-text-2 sm:max-w-[216px]">
            Scan to start on your phone — your shop is already filled in
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2 border-t border-line pt-2.5 sm:pt-5">
        {NEXT_STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[11px] font-semibold text-accent">
              {i + 1}
            </span>
            <span className="min-w-0 text-[13px] leading-snug sm:text-sm">
              <span className="block font-semibold text-ink">{s.title}</span>
              <span className="hidden text-text-2 sm:inline">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1 text-[13px] leading-snug text-text-2 sm:text-sm">
        <p>
          Nothing is charged until your 15-day trial ends, and the trial starts once we verify your shop. Cancel before
          then and you pay nothing.
        </p>
        <p>Every customer sees the Google option — we never filter reviews.</p>
      </div>

      <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <a
          href={localHref(link.url)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-control)] bg-accent px-5 text-sm font-semibold text-white shadow-v2-btn hover:bg-accent-hover sm:w-auto"
        >
          Fill it in on this phone
        </a>
        <button
          type="button"
          onClick={onEnd}
          className="min-h-[44px] rounded-[var(--r-control)] px-3 text-sm font-semibold text-text-muted hover:text-ink cursor-pointer"
        >
          End demo
        </button>
      </div>
    </div>
  );
}
