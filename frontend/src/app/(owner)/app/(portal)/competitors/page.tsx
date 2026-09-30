"use client";

import { useState } from "react";

import { Button, Card, EmptyState, ErrorState, Field, Skeleton, useToast } from "@/components/ui";
import {
  addCompetitor,
  DashboardApiError,
  getCompetitors,
  removeCompetitor,
  type CompetitorsView,
  type Standing,
} from "@/lib/dashboard/api";
import { searchPlaces, type PlaceSearchResult } from "@/lib/signup/api";
import { useAsync } from "@/lib/useAsync";

const ERRORS: Record<string, string> = {
  LIMIT_REACHED: "You're following the maximum of 3. Remove one to add another.",
  ALREADY_WATCHING: "You're already following that business.",
  CANNOT_WATCH_SELF: "That's your own listing.",
};

export default function CompetitorsPage() {
  const { data, error, reload } = useAsync(getCompetitors, []);
  const [local, setLocal] = useState<CompetitorsView | null>(null);
  const view = local ?? data;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Competitors</h1>
        <p className="text-sm text-text-2 mt-1">
          Follow up to three nearby businesses. We check their public Google reviews every week, so you can see who is gaining fastest.
        </p>
      </div>

      {error ? (
        <ErrorState message="We couldn't load this page." onRetry={reload} />
      ) : !view ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Headline view={view} />
          <Standings view={view} onChange={setLocal} />
          {view.competitors.length < view.limit && <AddCompetitor onChange={setLocal} />}
          <p className="text-xs text-text-2">
            Only public Google data (rating and review count) is used, the same numbers anyone can see on Google Maps. It works the same whether or not a rival also uses Revyu.
          </p>
        </>
      )}
    </>
  );
}

function Headline({ view }: { view: CompetitorsView }) {
  return (
    <section className="v2-card-elevated border border-accent/20 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">This week</p>
      <p className="font-display text-xl sm:text-2xl text-ink mt-1.5">{view.headline}</p>
    </section>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted text-xs">first check pending</span>;
  const tone = value > 0 ? "text-[#2f6b1a]" : "text-text-2";
  return (
    <span className={`tabular-nums font-semibold ${tone}`}>
      {value > 0 ? "+" : ""}
      {value} this week
    </span>
  );
}

function Standings({ view, onChange }: { view: CompetitorsView; onChange: (v: CompetitorsView) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const rows: (Standing & { you?: boolean })[] = [{ ...view.me, you: true }, ...view.competitors];
  const max = Math.max(...rows.map((r) => r.review_count ?? 0), 1);

  async function remove(id: string) {
    setBusy(id);
    try {
      onChange(await removeCompetitor(id));
      toast("Stopped following");
    } catch {
      toast("Couldn't remove that. Please try again.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="You vs. who you follow">
      <ul className="flex flex-col gap-4">
        {rows.map((r) => (
          <li key={r.id ?? "me"}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className={`text-sm truncate ${r.you ? "font-bold text-ink" : "text-ink"}`}>
                {r.name}
                {r.you && " (you)"}
              </span>
              <span className="text-sm tabular-nums text-text-2">
                {r.review_count ?? "–"} reviews · {r.rating ?? "–"}★
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-paper-subtle overflow-hidden" aria-hidden>
              <div
                className={`h-full rounded-full ${r.you ? "bg-accent" : "bg-line-strong"}`}
                style={{ width: `${Math.max(3, Math.round(((r.review_count ?? 0) / max) * 100))}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <Delta value={r.delta} />
              {r.id && (
                <button
                  onClick={() => remove(r.id!)}
                  disabled={busy === r.id}
                  className="min-h-[44px] px-1 text-text-2 hover:text-alert font-semibold cursor-pointer disabled:opacity-50"
                  aria-label={`Stop following ${r.name}`}
                >
                  Stop following
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {view.competitors.length === 0 && (
        <div className="mt-4">
          <EmptyState icon="⚑" title="You're not following anyone yet" body="Search for a nearby business below to start." />
        </div>
      )}
    </Card>
  );
}

function AddCompetitor({ onChange }: { onChange: (v: CompetitorsView) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 3) {
      setError("Type at least 3 letters of the business name and area.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setResults(await searchPlaces(query.trim()));
    } catch {
      setError("We couldn't search right now. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function add(p: PlaceSearchResult) {
    setAdding(p.place_id);
    setError(null);
    try {
      onChange(await addCompetitor(p.place_id, p.name));
      setResults(null);
      setQuery("");
      toast(`Now following ${p.name}`);
    } catch (e) {
      setError(
        (e instanceof DashboardApiError && ERRORS[e.code]) || "We couldn't add that business. Please try again."
      );
    } finally {
      setAdding(null);
    }
  }

  return (
    <Card title="Follow a business">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        <div className="flex-1">
          <Field
            label="Business name and area"
            placeholder="e.g. Sharma Stores, Indiranagar"
            value={query}
            error={error}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" loading={searching}>
          Search
        </Button>
      </form>

      {results && (
        <ul className="mt-4 flex flex-col gap-2">
          {results.length === 0 && <li className="text-sm text-text-2">No match. Try adding the area.</li>}
          {results.map((r) => (
            <li key={r.place_id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{r.name}</p>
                <p className="text-sm text-text-2 truncate">
                  {r.address}
                  {r.review_count != null && ` · ${r.rating ?? "–"}★ (${r.review_count})`}
                </p>
              </div>
              <Button variant="secondary" loading={adding === r.place_id} onClick={() => add(r)} className="shrink-0">
                Follow
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
