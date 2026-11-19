"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/hub/Icons";
import { Card, EmptyState, ErrorState, OutletStatePill, Skeleton } from "@/components/ui";
import { fetchCustomer, fetchOutletDetail, type CustomerProfile as Profile, type OutletDetail } from "@/lib/admin/api";
import { formatDate, formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { ago, HEALTH, HealthPill, pct, planSummary, shortDate, Trend, waLink } from "./customerBits";
import { StateOverride, TagEditor } from "./OutletEditors";

export function CustomerProfile({ outletId }: { outletId: string }) {
  const { data, error, reload } = useAsync(
    () => Promise.all([fetchCustomer(outletId), fetchOutletDetail(outletId)]),
    [outletId],
  );

  if (error && !data) return <ErrorState message="Couldn't load this customer. Check your admin token." onRetry={reload} />;
  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading customer">
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  const [c, detail] = data;
  return <Loaded c={c} detail={detail} reload={reload} />;
}

function Loaded({ c, detail, reload }: { c: Profile; detail: OutletDetail; reload: () => void }) {
  const plan = planSummary(c);
  const h = HEALTH[c.health];
  const g = c.google;
  const b = c.billing;

  return (
    <div className="flex flex-col gap-5">
      {/* Identity + one-tap contact */}
      <header className="v2-sheet border border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <OutletStatePill state={c.state} />
              <HealthPill health={c.health} />
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-ink leading-tight">{c.business_name}</h1>
            <p className="text-sm text-text-2 mt-1">
              {[c.vertical, c.country_code, `Joined ${formatDate(c.joined_at)}`, c.activated_at && `Live since ${formatDate(c.activated_at)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Action href={waLink(c.owner.phone, c.country_code)} icon="whatsapp" label="WhatsApp" external primary />
            <Action href={`tel:${c.owner.phone}`} icon="phone" label="Call" />
            <Action href={`mailto:${c.owner.email}`} icon="mail" label="Email" />
            <Action href={`/r/${c.slug}`} icon="qr" label="Review page" external />
          </div>
        </div>

        {c.reasons.length > 0 && (
          <div
            role="status"
            className={`mt-5 rounded-xl border p-4 ${c.health === "at_risk" ? "bg-alert-50 border-alert/20" : "bg-warning-50 border-warning/25"}`}
          >
            <p className={`text-xs font-bold uppercase tracking-wider ${h.text}`}>Why this needs you</p>
            <ul className="mt-2 flex flex-col gap-1">
              {c.reasons.map((r) => (
                <li key={r} className="text-sm text-ink flex gap-2">
                  <span aria-hidden className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${h.bar}`} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {/* The four numbers that matter */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat label="Pays" value={plan.main} note={plan.sub} />
        <Stat label="Scans · 30d" value={c.usage.scans_30d.toLocaleString("en-IN")}>
          <Trend cur={c.usage.scans_30d} prev={c.usage.scans_prev_30d} />
          <span>vs {c.usage.scans_prev_30d} before</span>
        </Stat>
        <Stat label="Reviews · 30d" value={c.usage.reviews_30d.toLocaleString("en-IN")}>
          <Trend cur={c.usage.reviews_30d} prev={c.usage.reviews_prev_30d} />
          <span>{pct(c.usage.conversion_30d)} of scans</span>
        </Stat>
        <Stat
          label="Google rating"
          value={g.rating === null ? "–" : `★ ${g.rating.toFixed(1)}`}
          note={
            g.review_count === null
              ? "Not polled yet"
              : `${g.review_count.toLocaleString("en-IN")} reviews${g.gained !== null ? ` · ${g.gained >= 0 ? "+" : ""}${g.gained} since join` : ""}`
          }
        />
      </div>

      <ActivityChart series={c.series} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Billing">
          <Facts
            rows={[
              ["Plan", b.plan ? `${b.plan === "annual" ? "Annual" : "Monthly"}${b.cancelled ? " (cancelled)" : ""}` : "None"],
              ["Monthly value", b.mrr_minor ? formatMoney(b.mrr_minor, b.currency_code) : "–"],
              ["Paid to date", formatMoney(b.lifetime_minor, b.currency_code)],
              ["Last payment", b.last_paid_at ? formatDate(b.last_paid_at) : "Never"],
              renewal(b),
              ...(c.trial ? ([["Trial", trialText(c)]] as [string, string][]) : []),
              ...(b.grace_until ? ([["Grace until", formatDate(b.grace_until)]] as [string, string][]) : []),
            ]}
          />
          {detail.payments.length > 0 && (
            <>
              <p className="mt-5 mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Payments</p>
              <ul className="divide-y divide-line text-sm">
                {detail.payments.map((p, i) => (
                  <li key={i} className="py-2 flex items-center justify-between gap-3">
                    <span className="text-text-2 tabular-nums">{formatDate(p.created_at)}</span>
                    <span className="ml-auto font-semibold tabular-nums text-ink">{formatMoney(p.amount_minor, p.currency_code)}</span>
                    <span className={`w-20 text-right text-xs font-semibold ${p.status === "captured" ? "text-success-strong" : p.status === "failed" ? "text-alert" : "text-text-2"}`}>
                      {p.status === "captured" ? "Paid" : p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Owner">
          <Facts
            rows={[
              ["Name", c.owner.name ?? "–"],
              ["Phone", c.owner.phone],
              ["Email", c.owner.email],
              ["Last in dashboard", c.owner_last_seen_at ? `${ago(c.owner_last_seen_at)} (${shortDate(c.owner_last_seen_at)})` : "Never"],
              ["Last scan", ago(c.usage.last_scan_at)],
              ["Review page", `/r/${c.slug}`],
            ]}
          />
        </Card>
      </div>

      <Messages items={detail.notifications} />

      <AdminControls detail={detail} outletId={c.outlet_id} reload={reload} />
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function renewal(b: Profile["billing"]): [string, string] {
  if (!b.renews_at) return ["Renews", "–"];
  if (new Date(b.renews_at).getTime() < Date.now()) return ["Expired", formatDate(b.renews_at)];
  return [b.cancelled ? "Access ends" : "Renews", formatDate(b.renews_at)];
}

function trialText(c: Profile): string {
  const t = c.trial!;
  if (c.state === "locked") return t.credits_left === null ? "Over, not paid" : `Over · ${t.credits_left} reviews left before collection stops`;
  if (t.days_left === null) return "Not live yet";
  return `${t.days_left} days left${c.billing.will_convert ? " · pays automatically" : " · no payment set up"}`;
}

function Action({ href, icon, label, external, primary }: { href: string; icon: string; label: string; external?: boolean; primary?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-[var(--r-control)] text-sm font-semibold transition-colors ${
        primary ? "bg-accent text-white hover:bg-accent-hover" : "bg-sheet text-ink border border-line-strong hover:bg-paper-subtle"
      }`}
    >
      <Icon name={icon} className="w-4 h-4" />
      {label}
    </a>
  );
}

function Stat({ label, value, note, children }: { label: string; value: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-sheet p-4 sm:p-5 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-2">{label}</p>
      <p className="mt-2 text-2xl sm:text-[28px] leading-none font-bold tracking-tight tabular-nums text-ink truncate">{value}</p>
      {(note || children) && (
        <div className="mt-2 text-xs text-text-2 leading-snug flex flex-wrap items-center gap-x-1.5">
          {note}
          {children}
        </div>
      )}
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="text-sm grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-2">{k}</dt>
          <dd className="text-ink font-medium min-w-0 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Daily scans for 30 days, split into those that became a review and those that did not. */
function ActivityChart({ series }: { series: Profile["series"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((d) => d.scans));
  // A round top line so the scale reads at a glance.
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
  const top = Math.ceil(max / step) * step;
  const totalScans = series.reduce((a, d) => a + d.scans, 0);
  const totalReviews = series.reduce((a, d) => a + d.reviews, 0);
  const label = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const active = hover === null ? null : series[hover];

  return (
    <Card
      title="Last 30 days"
      description={`${totalScans.toLocaleString("en-IN")} scans · ${totalReviews.toLocaleString("en-IN")} became reviews`}
      action={
        <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1 text-xs text-text-2 shrink-0" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Reviewed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-chart-1-soft" /> Scanned, no review
          </span>
        </div>
      }
    >
      {totalScans === 0 ? (
        <EmptyState title="No scans in the last 30 days" body="Check the QR stand is placed where customers pay." />
      ) : (
        <>
          <div className="relative pl-8">
            {/* Recessive grid: baseline, midline, top */}
            {[0, 0.5, 1].map((f) => (
              <div key={f} aria-hidden className="absolute left-8 right-0 border-t border-line" style={{ bottom: `${f * 100}%` }}>
                <span className="absolute -left-8 -translate-y-1/2 w-6 text-right text-[11px] text-text-muted tabular-nums">
                  {Math.round(top * f)}
                </span>
              </div>
            ))}
            <div className="relative h-44 flex items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
              {series.map((d, i) => {
                const missed = Math.max(0, d.scans - d.reviews);
                return (
                  <button
                    key={d.day}
                    type="button"
                    aria-label={`${label(d.day)}: ${count(d.scans, "scan")}, ${count(d.reviews, "review")}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="relative flex-1 h-full flex flex-col justify-end gap-[2px] cursor-default rounded-t-[4px] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
                  >
                    <span aria-hidden className={`absolute inset-x-[-1px] inset-y-0 rounded ${hover === i ? "bg-paper-subtle" : ""}`} />
                    {missed > 0 && (
                      <span
                        aria-hidden
                        className="relative w-full bg-chart-1-soft rounded-t-[4px]"
                        style={{ height: `${(missed / top) * 100}%` }}
                      />
                    )}
                    {d.reviews > 0 && (
                      <span
                        aria-hidden
                        className={`relative w-full bg-accent ${missed > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: `${(d.reviews / top) * 100}%` }}
                      />
                    )}
                  </button>
                );
              })}
              {active && hover !== null && (
                <div
                  role="presentation"
                  className="pointer-events-none absolute -top-2 -translate-y-full z-10 rounded-lg bg-ink text-white px-3 py-2 text-xs shadow-lg whitespace-nowrap"
                  style={{ left: `clamp(0px, calc(${((hover + 0.5) / series.length) * 100}% - 70px), calc(100% - 140px))` }}
                >
                  <p className="font-semibold">{label(active.day)}</p>
                  <p className="tabular-nums text-white/85">
                    {count(active.scans, "scan")} · {count(active.reviews, "review")}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div aria-hidden className="pl-8 mt-2 flex justify-between text-[11px] text-text-muted">
            <span>{shortDate(`${series[0].day}T12:00:00`)}</span>
            <span>{shortDate(`${series[Math.floor(series.length / 2)].day}T12:00:00`)}</span>
            <span>Today</span>
          </div>
        </>
      )}
    </Card>
  );
}

const MESSAGES_SHOWN = 6;

function Messages({ items }: { items: OutletDetail["notifications"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, MESSAGES_SHOWN);
  return (
    <Card
      title="Messages & changes"
      description="Emails, WhatsApp and admin overrides for this customer, newest first."
      action={
        items.length > MESSAGES_SHOWN ? (
          <button type="button" onClick={() => setAll(!all)} className="text-sm font-semibold text-accent-hover hover:underline min-h-[44px] shrink-0 cursor-pointer">
            {all ? "Show less" : `Show all ${items.length}`}
          </button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState title="Nothing sent yet" />
      ) : (
        <ul className="divide-y divide-line text-sm">
          {shown.map((n, i) => (
            <li key={i} className="py-2.5 flex items-center gap-3">
              <span className="text-text-2 tabular-nums w-16 shrink-0">{shortDate(n.created_at)}</span>
              <span className="text-ink truncate flex-1">{n.template.replaceAll("_", " ")}</span>
              <span className="text-xs text-text-2 shrink-0">
                {n.channel.replaceAll("_", " ")} · <span className={n.status === "failed" ? "text-alert font-semibold" : ""}>{n.status.replaceAll("_", " ")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AdminControls({ detail, outletId, reload }: { detail: OutletDetail; outletId: string; reload: () => void }) {
  return (
    <details className="group v2-sheet border border-line">
      <summary className="list-none cursor-pointer p-4 sm:p-6 flex items-center justify-between gap-3 min-h-[44px]">
        <span>
          <span className="block font-semibold text-ink">Admin controls</span>
          <span className="block text-sm text-text-2">Change state, edit review tags, set up the QR page.</span>
        </span>
        <span aria-hidden className="text-text-2 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6 flex flex-col gap-5">
        <Link
          href={`/admin/outlets/${outletId}`}
          className="self-start inline-flex items-center gap-2 text-sm font-semibold text-accent-hover hover:underline min-h-[44px]"
        >
          <Icon name="layout" className="w-4 h-4" /> Edit QR page (hub, menu, loyalty) →
        </Link>
        <StateOverride detail={detail} onDone={reload} />
        <TagEditor detail={detail} onSaved={reload} />
      </div>
    </details>
  );
}
