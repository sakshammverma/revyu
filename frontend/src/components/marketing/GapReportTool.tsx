"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Card, ErrorState, Field, Skeleton } from "@/components/ui";
import { emailGapReport, fetchGapReport, GapApiError, type GapBusiness, type GapReport } from "@/lib/gap/api";
import { searchPlaces, type PlaceSearchResult } from "@/lib/signup/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function GapReportTool() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [report, setReport] = useState<GapReport | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 3) {
      setSearchError("Type at least 3 letters of your business name and area.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setReport(null);
    try {
      setResults(await searchPlaces(query.trim()));
    } catch {
      setSearchError("We couldn't search right now. Please try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  async function pick(id: string) {
    setPlaceId(id);
    setLoadingReport(true);
    setReportError(null);
    try {
      setReport(await fetchGapReport(id));
    } catch (e) {
      setReportError(
        e instanceof GapApiError && e.status === 429
          ? "You've run a lot of reports. Please try again in an hour."
          : "We couldn't build your report. Please try another listing."
      );
    } finally {
      setLoadingReport(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
        >
          <div className="flex-1">
            <Field
              label="Your business on Google"
              placeholder="e.g. Sharma General Store, Indiranagar"
              value={query}
              error={searchError}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" loading={searching} className="sm:min-w-[140px]">
            Find my business
          </Button>
        </form>

        {results && !report && !loadingReport && (
          <div className="mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-text-2">No match. Try adding your area, like &ldquo;Sharma Store Indiranagar&rdquo;.</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink mb-2">Pick your listing</p>
                <ul className="flex flex-col gap-2">
                  {results.map((r) => (
                    <li key={r.place_id}>
                      <button
                        onClick={() => pick(r.place_id)}
                        className="w-full text-left min-h-[56px] rounded-xl border border-line-strong bg-sheet hover:border-accent hover:bg-accent-50/40 px-4 py-3 cursor-pointer transition-colors"
                      >
                        <span className="block font-semibold text-ink">{r.name}</span>
                        <span className="block text-sm text-text-2">
                          {r.address}
                          {r.review_count != null && ` · ${r.rating ?? "–"}★ (${r.review_count} reviews)`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Card>

      {loadingReport && (
        <div aria-busy="true" aria-label="Building your report" className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-56" />
        </div>
      )}

      {reportError && <ErrorState message={reportError} onRetry={placeId ? () => pick(placeId) : undefined} />}

      {report && placeId && <ReportView report={report} placeId={placeId} />}
    </div>
  );
}

function ReportView({ report, placeId }: { report: GapReport; placeId: string }) {
  const rows: (GapBusiness & { you?: boolean })[] = [{ ...report.business, you: true }, ...report.competitors].sort(
    (a, b) => (b.review_count ?? 0) - (a.review_count ?? 0)
  );
  const max = Math.max(...rows.map((r) => r.review_count ?? 0), 1);

  return (
    <div className="flex flex-col gap-5">
      <section className="v2-card-elevated border border-accent/20 p-5 sm:p-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Your review gap</p>
        <p className="font-display text-5xl sm:text-6xl text-ink tabular-nums mt-2">
          {report.review_gap > 0 ? report.review_gap : "0"}
        </p>
        <p className="text-text-2 mt-2 max-w-xl mx-auto">{report.headline}</p>
      </section>

      <Card title="You vs. the strongest nearby" description="Public Google data, same category, within 3 km.">
        <ul className="flex flex-col gap-4">
          {rows.map((r) => {
            const pct = Math.max(4, Math.round(((r.review_count ?? 0) / max) * 100));
            return (
              <li key={r.place_id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={`truncate ${r.you ? "font-bold text-ink" : "text-text-2"}`}>
                    {r.name}
                    {r.you && " (you)"}
                  </span>
                  <span className="tabular-nums shrink-0 text-ink font-semibold">
                    {r.review_count ?? "–"} reviews · {r.rating ?? "–"}★
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-paper-subtle overflow-hidden" aria-hidden>
                  <div className={`h-full rounded-full ${r.you ? "bg-accent" : "bg-line-strong"}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-text-2 mt-5">
          Reviews come from customers choosing to write them. Revyu makes it easy to ask every customer, but we can&rsquo;t
          promise a particular number or ranking.
        </p>
      </Card>

      <EmailCapture placeId={placeId} />
    </div>
  );
}

function EmailCapture({ placeId }: { placeId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await emailGapReport(placeId, email.trim());
      setSent(true);
    } catch (e) {
      setError(
        e instanceof GapApiError && e.status === 429
          ? "Too many requests. Please try again in an hour."
          : "We couldn't send that. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="grid gap-5 sm:grid-cols-2 sm:items-center">
        <div>
          <h2 className="font-display text-xl text-ink">Close the gap</h2>
          <p className="text-sm text-text-2 mt-1">
            A QR on your receipt helps every happy customer write a Google review in their own words. ₹499/month, 15-day free trial.
          </p>
          <Link
            href={`/signup?place=${encodeURIComponent(placeId)}`}
            className="btn-primary mt-4 min-h-[48px] w-full sm:w-auto"
          >
            Start free trial
          </Link>
        </div>
        <div className="sm:border-l sm:border-line sm:pl-5">
          {sent ? (
            <p role="status" className="text-sm text-ink font-semibold">
              Sent. Check your inbox for your gap report.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex flex-col gap-3"
              noValidate
            >
              <Field
                label="Email me this report"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                error={error}
                hint="We use your email once, to send the report."
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" variant="secondary" loading={busy}>
                Send my report
              </Button>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
