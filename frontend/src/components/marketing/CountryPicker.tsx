"use client";

import { usePricing } from "@/lib/pricing";

// Markets we show prices for. Display only: what a business is charged follows
// its own country, checked at signup, not this choice.
const COUNTRIES = ["IN", "US", "GB", "CA", "AU", "NZ", "SG", "AE", "DE", "FR", "IT", "ES", "NL", "IE", "SA", "MY", "ID", "BR", "MX", "ZA"];

export function CountryPicker({ className = "" }: { className?: string }) {
  const pricing = usePricing();
  if (!pricing.country) return null;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const name = (c: string) => (c === "*" ? "Other countries" : (names.of(c) ?? c));
  const options = COUNTRIES.includes(pricing.country) ? COUNTRIES : [pricing.country, ...COUNTRIES];
  return (
    <label className={`inline-flex items-center gap-2 text-xs text-text-2 ${className}`}>
      <span>Prices shown for</span>
      <select
        aria-label="Country for prices"
        value={pricing.country}
        onChange={(e) => pricing.setCountry(e.target.value)}
        className="rounded-lg border border-line-strong bg-white px-2 py-1.5 text-xs font-semibold text-ink"
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {name(c)}
          </option>
        ))}
      </select>
    </label>
  );
}
