"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { API_BASE } from "@/lib/api-base";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/** GET /api/pricing: the plans for the visitor's market (display only). */
export interface PublicPricing {
  country_code: string;
  currency_code: string;
  locale: string;
  plans: { code: string; amount_minor: number }[];
  annual_saving_minor: number;
}

export interface PricingView {
  loading: boolean;
  /** False if the price could not be loaded; callers should hide the price, not guess one. */
  ready: boolean;
  country: string | null;
  currency: string | null;
  locale: string | null;
  monthlyMinor: number | null;
  annualMinor: number | null;
  /** Formatted in the visitor's currency and locale, or null while loading. */
  monthly: string | null;
  annual: string | null;
  annualPerMonth: string | null;
  saving: string | null;
  money: (amountMinor: number) => string;
  /** The visitor's own display choice. Never decides what is charged. */
  setCountry: (code: string | null) => void;
}

const PricingContext = createContext<PricingView | null>(null);

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  const { data, loading } = useAsync<PublicPricing | null>(async () => {
    // Runs in the browser only. A ?country=XX in the page URL previews that market.
    const country = picked ?? new URLSearchParams(window.location.search).get("country");
    const res = await fetch(`${API_BASE}/api/pricing${country ? `?country=${encodeURIComponent(country)}` : ""}`);
    return res.ok ? ((await res.json()) as PublicPricing) : null;
  }, [picked]);

  const setCountry = useCallback((code: string | null) => setPicked(code), []);

  const view = useMemo<PricingView>(() => {
    const monthlyMinor = data?.plans.find((p) => p.code === "monthly")?.amount_minor ?? null;
    const annualMinor = data?.plans.find((p) => p.code === "annual")?.amount_minor ?? null;
    const currency = data?.currency_code ?? null;
    const locale = data?.locale ?? null;
    const money = (amountMinor: number) => formatMoney(amountMinor, currency ?? "USD", locale ?? undefined);
    return {
      loading: loading && !data,
      ready: !!data && monthlyMinor !== null,
      country: data?.country_code ?? null,
      currency,
      locale,
      monthlyMinor,
      annualMinor,
      monthly: monthlyMinor !== null ? money(monthlyMinor) : null,
      annual: annualMinor !== null ? money(annualMinor) : null,
      annualPerMonth: annualMinor !== null ? money(Math.round(annualMinor / 12)) : null,
      saving: data && data.annual_saving_minor > 0 ? money(data.annual_saving_minor) : null,
      money,
      setCountry,
    };
  }, [data, loading, setCountry]);

  return <PricingContext.Provider value={view}>{children}</PricingContext.Provider>;
}

const EMPTY: PricingView = {
  loading: true,
  ready: false,
  country: null,
  currency: null,
  locale: null,
  monthlyMinor: null,
  annualMinor: null,
  monthly: null,
  annual: null,
  annualPerMonth: null,
  saving: null,
  money: (n) => String(n),
  setCountry: () => {},
};

/** Outside a provider (e.g. a page rendered without the marketing layout) this stays "loading". */
export const usePricing = (): PricingView => useContext(PricingContext) ?? EMPTY;

/** Inline price for copy: `<Price plan="monthly" />`. Reserves its width until loaded so text doesn't jump. */
export function Price({ plan }: { plan: "monthly" | "annual" | "annualPerMonth" | "saving" }) {
  const p = usePricing();
  const text = p[plan];
  if (text) return <>{text}</>;
  if (!p.loading) return <>-</>; // load failed: no price rather than a guessed one
  return <span aria-hidden className="inline-block w-[3ch] animate-pulse rounded bg-line align-middle">&nbsp;</span>;
}
