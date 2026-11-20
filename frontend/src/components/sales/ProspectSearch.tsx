"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { SalesApiError, searchShops } from "@/lib/marketing/salesApi";
import { RECENT_KEY, type PlaceSearchResult, type RecentShop } from "@/lib/marketing/salesTypes";

/** What a pick needs: a search result, or a recent shop re-opened from this device. */
export type ShopPick = Pick<PlaceSearchResult, "place_id" | "name" | "address">;

export function readRecent(): RecentShop[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((r): r is RecentShop => !!r && typeof r.place_id === "string" && typeof r.name === "string")
      : [];
  } catch {
    return [];
  }
}

function searchError(e: unknown): string {
  if (e instanceof SalesApiError) {
    if (e.status === 503) return "Google search is unavailable right now. Try again in a minute.";
    if (e.status === 429) return "Search limit reached for now. Try again later, or open a recent shop.";
    if (e.status === 0) return "No connection. Check the internet and try again.";
  }
  return "Search didn't work. Try again.";
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(mins)) return "";
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function ProspectSearch({
  onPick,
  onSignOut,
  notice,
}: {
  onPick: (shop: ShopPick) => void;
  onSignOut: () => void;
  /** A message from the last attempt (e.g. the demo couldn't be built). */
  notice?: string | null;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [recent, setRecent] = useState<RecentShop[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only, read once after hydration
    setRecent(readRecent());
  }, []);

  async function search(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) {
      setError("Type the shop's name and area.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResults(await searchShops(query));
    } catch (err) {
      setResults(null);
      setError(searchError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="marketing-root min-h-[100dvh] bg-bg text-ink">
      <div className="mx-auto w-full max-w-xl px-5 pt-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <Logo className="text-ink" />
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[44px] px-3 -mr-3 rounded-[var(--r-control)] text-sm font-semibold text-text-2 hover:text-ink cursor-pointer"
          >
            Sign out
          </button>
        </div>

        <h1 className="font-display text-4xl text-ink mt-10 tracking-tight">Find the shop</h1>
        <p className="text-text-2 mt-2">Search its Google listing. The demo is built from its public numbers.</p>

        {notice && (
          <p role="alert" className="mt-5 rounded-[var(--r-control)] border border-alert/30 bg-alert-50 px-4 py-3 text-sm text-alert">
            {notice}
          </p>
        )}

        <label className="block mt-6 text-sm font-semibold text-ink" htmlFor="prospect-q">
          Shop name and area
        </label>
        <form onSubmit={search} className="mt-2 flex flex-col gap-3 sm:flex-row" role="search" noValidate>
          <input
            id="prospect-q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sharma Sweets, Lajpat Nagar"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "prospect-err" : undefined}
            className="flex-1 min-h-[52px] rounded-[var(--r-control)] border border-line-strong bg-sheet px-4 text-base text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button type="submit" loading={busy} className="min-h-[52px] px-6">
            Search
          </Button>
        </form>
        {error && (
          <p id="prospect-err" role="alert" className="mt-3 text-sm text-alert">
            {error}
          </p>
        )}

        {results && (
          <section aria-label="Search results" className="mt-6">
            {results.length === 0 ? (
              <p className="text-sm text-text-2">No shops found. Try adding the area or the market name.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {results.map((r) => (
                  <li key={r.place_id} className="flow-step">
                    <button
                      type="button"
                      onClick={() => onPick(r)}
                      className="w-full min-h-[64px] text-left rounded-[var(--r-card)] border border-line bg-sheet px-4 py-3.5 transition-colors hover:border-accent focus-visible:border-accent cursor-pointer"
                    >
                      <span className="block font-semibold text-ink">{r.name}</span>
                      {r.address && <span className="block text-sm text-text-2 mt-0.5 line-clamp-2">{r.address}</span>}
                      <span className="block text-sm text-text-2 mt-1">
                        {r.rating !== null ? (
                          <>
                            <span aria-hidden className="text-star">★</span> {r.rating.toFixed(1)}
                          </>
                        ) : (
                          "No rating"
                        )}
                        {" · "}
                        {r.review_count !== null ? `${r.review_count.toLocaleString()} reviews` : "no reviews yet"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {recent.length > 0 && (
          <section aria-labelledby="recent-h" className="mt-10">
            <h2 id="recent-h" className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Recent shops
            </h2>
            <ul className="mt-3 divide-y divide-line rounded-[var(--r-card)] border border-line bg-sheet overflow-hidden">
              {recent.map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    onClick={() => onPick({ place_id: r.place_id, name: r.name, address: r.address })}
                    className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper-subtle cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink truncate">{r.name}</span>
                      {r.address && <span className="block text-xs text-text-2 truncate">{r.address}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">{ago(r.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-muted">Kept on this device only.</p>
          </section>
        )}
      </div>
    </main>
  );
}
