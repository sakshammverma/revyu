"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Icon } from "@/components/hub/Icons";
import { EmptyState, ErrorState, OutletStatePill, Skeleton } from "@/components/ui";
import { fetchCustomers, type CustomerRow, type CustomersOverview } from "@/lib/admin/api";
import { useAsync } from "@/lib/useAsync";
import { ago, HEALTH, mrrParts, pct, planSummary, Trend } from "./customerBits";

type Tab = "all" | "attention" | "paying" | "trial" | "onboarding" | "inactive";
type Sort = "attention" | "mrr" | "scans" | "newest";

const TABS: { id: Tab; label: string; match: (c: CustomerRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "attention", label: "Needs attention", match: (c) => c.health === "at_risk" || c.health === "watch" },
  { id: "paying", label: "Paying", match: (c) => c.stage === "paying" },
  { id: "trial", label: "Trial", match: (c) => c.stage === "trial" },
  { id: "onboarding", label: "Onboarding", match: (c) => c.stage === "onboarding" },
  { id: "inactive", label: "Inactive", match: (c) => c.stage === "paused" || c.stage === "inactive" },
];

const SEVERITY: Record<CustomerRow["health"], number> = { at_risk: 0, watch: 1, onboarding: 2, healthy: 3, inactive: 4 };

const SORTS: Record<Sort, { label: string; cmp: (a: CustomerRow, b: CustomerRow) => number }> = {
  attention: {
    label: "Needs attention first",
    cmp: (a, b) =>
      SEVERITY[a.health] - SEVERITY[b.health] || b.billing.mrr_minor - a.billing.mrr_minor || b.usage.scans_30d - a.usage.scans_30d,
  },
  mrr: { label: "Highest revenue", cmp: (a, b) => b.billing.mrr_minor - a.billing.mrr_minor || b.billing.lifetime_minor - a.billing.lifetime_minor },
  scans: { label: "Most scans", cmp: (a, b) => b.usage.scans_30d - a.usage.scans_30d },
  newest: { label: "Newest", cmp: (a, b) => b.joined_at.localeCompare(a.joined_at) },
};

export function CustomersView() {
  const { data, error, loading, reload } = useAsync(fetchCustomers, []);

  if (error && !data) return <ErrorState message="Couldn't load customers. Check your admin token." onRetry={reload} />;
  if (!data) return <LoadingState />;

  return <Loaded data={data} refreshing={loading} onRefresh={reload} />;
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading customers">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[120px] rounded-2xl" />)}
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

function Loaded({ data, refreshing, onRefresh }: { data: CustomersOverview; refreshing: boolean; onRefresh: () => void }) {
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("attention");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, data.customers.filter(t.match).length])) as Record<Tab, number>,
    [data.customers],
  );

  const rows = useMemo(() => {
    const match = TABS.find((t) => t.id === tab)!.match;
    const digits = q.replace(/\D/g, "");
    return data.customers
      .filter(match)
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.business_name} ${c.owner.name ?? ""} ${c.owner.email} ${c.slug} ${c.vertical}`.toLowerCase();
        return hay.includes(q) || (digits.length >= 3 && c.owner.phone.replace(/\D/g, "").includes(digits));
      })
      .sort(SORTS[sort].cmp);
  }, [data.customers, tab, sort, q]);

  return (
    <div className="flex flex-col gap-5">
      <Kpis data={data} onAttention={() => setTab("attention")} />
      <Inbox queue={data.queue} />

      <section aria-labelledby="customers-list" className="v2-sheet border border-line overflow-hidden">
        <h2 id="customers-list" className="sr-only">Customer list</h2>
        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-line flex flex-col gap-3">
          <div role="tablist" aria-label="Filter customers" className="flex gap-1 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 inline-flex items-center gap-2 px-3 min-h-[36px] rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
                    on ? "bg-ink text-white" : "text-text-2 hover:bg-paper-subtle hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span
                    className={`tabular-nums text-[11px] rounded-full px-1.5 min-w-5 ${
                      on ? "bg-white/20 text-white" : t.id === "attention" && counts.attention ? "bg-alert-50 text-alert" : "bg-paper-subtle text-text-2"
                    }`}
                  >
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search customers</span>
              <svg aria-hidden viewBox="0 0 20 20" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search business, owner, phone or email"
                className="w-full min-h-[42px] rounded-[var(--r-control)] border border-line-strong bg-sheet pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <div className="flex gap-2">
              <label className="flex-1 sm:flex-none">
                <span className="sr-only">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="w-full min-h-[42px] rounded-[var(--r-control)] border border-line-strong bg-sheet px-3 text-sm text-ink cursor-pointer"
                >
                  {(Object.keys(SORTS) as Sort[]).map((s) => (
                    <option key={s} value={s}>
                      {SORTS[s].label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh"
                title={`Updated ${new Date(data.generated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}
                className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-[var(--r-control)] border border-line-strong bg-sheet text-text-2 hover:text-ink hover:bg-paper-subtle disabled:opacity-50 cursor-pointer"
              >
                <svg aria-hidden viewBox="0 0 20 20" className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Column heads (desktop) */}
        <div aria-hidden className="hidden lg:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] gap-4 px-5 py-2.5 bg-paper-subtle/60 border-b border-line text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          <span>Customer</span>
          <span>Status</span>
          <span>Plan</span>
          <span className="text-right">Scans · 30d</span>
          <span className="text-right">Reviews · 30d</span>
          <span className="text-right">Google</span>
          <span className="text-right">Last scan</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={data.customers.length === 0 ? "No customers yet" : "Nobody matches"}
              body={data.customers.length === 0 ? "Approve your first signup and it shows up here." : "Try another tab or clear the search."}
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <CustomerItem key={c.outlet_id} c={c} />
            ))}
          </ul>
        )}
        <p className="px-5 py-3 border-t border-line text-xs text-text-muted">
          {rows.length} of {data.customers.length} customers · scans and reviews are the last 30 days, arrows compare with the 30 days before.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ KPIs */

function Kpi({
  label,
  value,
  children,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  children?: React.ReactNode;
  tone?: "default" | "alert";
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-2">{label}</p>
      <p className={`mt-2 text-[28px] sm:text-[32px] leading-none font-bold tracking-tight tabular-nums ${tone === "alert" ? "text-alert" : "text-ink"}`}>{value}</p>
      {children && <div className="mt-2 text-xs text-text-2 leading-snug flex flex-wrap items-center gap-x-1.5">{children}</div>}
    </>
  );
  const cls = `text-left rounded-2xl border p-4 sm:p-5 min-w-0 ${
    tone === "alert" ? "bg-alert-50 border-alert/20" : "bg-sheet border-line"
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:border-alert/40 transition-colors`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Kpis({ data, onAttention }: { data: CustomersOverview; onAttention: () => void }) {
  const s = data.summary;
  const mrr = mrrParts(s.mrr);
  const attention = s.at_risk + s.watch;
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <Kpi label="Monthly revenue" value={mrr.primary}>
        <span>
          {s.paying} on a paid plan{mrr.rest.length ? ` · + ${mrr.rest.join(" + ")}` : ""}
        </span>
      </Kpi>
      <Kpi label="Live customers" value={s.live}>
        <span>
          {s.trials} on trial · {s.new_30d} new this month
        </span>
      </Kpi>
      <Kpi label="Reviews · 30 days" value={s.reviews_30d.toLocaleString("en-IN")}>
        <Trend cur={s.reviews_30d} prev={s.reviews_prev_30d} />
        <span>{pct(s.conversion_30d)} of {s.scans_30d.toLocaleString("en-IN")} scans</span>
      </Kpi>
      <Kpi
        label="Needs attention"
        value={attention}
        tone={s.at_risk ? "alert" : "default"}
        onClick={attention ? onAttention : undefined}
      >
        <span>{attention ? `${s.at_risk} at risk · ${s.watch} to watch` : "Everyone looks healthy"}</span>
      </Kpi>
    </div>
  );
}

function Inbox({ queue }: { queue: CustomersOverview["queue"] }) {
  const items = [
    queue.approvals > 0 && { href: "/admin/approvals", icon: "check", text: `${queue.approvals} signup${queue.approvals === 1 ? "" : "s"} waiting for approval` },
    queue.pending_sends > 0 && { href: "/admin/pending-sends", icon: "whatsapp", text: `${queue.pending_sends} WhatsApp message${queue.pending_sends === 1 ? "" : "s"} to send` },
  ].filter(Boolean) as { href: string; icon: string; text: string }[];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className="inline-flex items-center gap-2 pl-3 pr-4 min-h-[40px] rounded-full bg-accent-50 border border-accent/20 text-sm font-semibold text-accent-hover hover:bg-accent hover:text-white transition-colors"
        >
          <Icon name={i.icon} className="w-4 h-4" />
          {i.text}
          <span aria-hidden>→</span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- row */

function CustomerItem({ c }: { c: CustomerRow }) {
  const h = HEALTH[c.health];
  const plan = planSummary(c);
  const href = `/admin/customers/${c.outlet_id}`;
  const sub = [c.owner.name, c.vertical].filter(Boolean).join(" · ");
  const reason = c.reasons[0];
  const more = c.reasons.length - 1;
  const g = c.google;

  const name = (
    <Link href={href} className="font-semibold text-ink hover:text-accent-hover after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
      {c.business_name}
    </Link>
  );
  const reasonLine = reason && (
    <p className={`text-xs font-semibold mt-1 ${h.text}`}>
      {reason}
      {more > 0 && <span className="font-normal text-text-2"> · +{more} more</span>}
    </p>
  );
  const google =
    g.rating === null ? (
      <span className="text-text-muted">–</span>
    ) : (
      <>
        <span className="font-semibold text-ink tabular-nums">
          <span aria-hidden className="text-star">★</span> {g.rating.toFixed(1)}
        </span>
        {g.gained !== null && (
          <span className={`block text-xs tabular-nums ${g.gained > 0 ? "text-success-strong" : "text-text-2"}`}>
            {g.gained > 0 ? `+${g.gained}` : g.gained} since join
          </span>
        )}
      </>
    );

  return (
    <li className="relative hover:bg-paper-subtle/50 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:bg-accent-50/40">
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${h.bar}`} />
      <span className="sr-only">Health: {h.label}.</span>

      {/* Desktop row */}
      <div className="hidden lg:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] gap-4 items-center px-5 py-3.5 text-sm">
        <div className="min-w-0">
          <p className="truncate">{name}</p>
          <p className="text-xs text-text-2 truncate">{sub}</p>
          {reasonLine}
        </div>
        <div>
          <OutletStatePill state={c.state} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink tabular-nums truncate">{plan.main}</p>
          <p className="text-xs text-text-2 truncate">{plan.sub}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-ink tabular-nums">{c.usage.scans_30d.toLocaleString("en-IN")}</p>
          <Trend cur={c.usage.scans_30d} prev={c.usage.scans_prev_30d} />
        </div>
        <div className="text-right">
          <p className="font-semibold text-ink tabular-nums">{c.usage.reviews_30d.toLocaleString("en-IN")}</p>
          <p className="text-xs text-text-2 tabular-nums">{c.usage.conversion_30d === null ? "–" : `${pct(c.usage.conversion_30d)} conv.`}</p>
        </div>
        <div className="text-right">{google}</div>
        <div className="text-right text-text-2 tabular-nums">{c.stage === "onboarding" ? "–" : ago(c.usage.last_scan_at)}</div>
      </div>

      {/* Phone / tablet card */}
      <div className="lg:hidden px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px]">{name}</p>
            <p className="text-xs text-text-2 truncate">{sub}</p>
          </div>
          <OutletStatePill state={c.state} />
        </div>
        {reasonLine}
        <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div>
            <dt className="text-text-muted">Plan</dt>
            <dd className="font-semibold text-ink tabular-nums truncate">{plan.main}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Scans</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {c.usage.scans_30d} <Trend cur={c.usage.scans_30d} prev={c.usage.scans_prev_30d} className="text-[10px]" />
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Reviews</dt>
            <dd className="font-semibold text-ink tabular-nums">{c.usage.reviews_30d}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Google</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {g.rating === null ? "–" : `★ ${g.rating.toFixed(1)}`}
              {g.gained !== null && g.gained > 0 ? <span className="text-success-strong font-normal"> +{g.gained}</span> : null}
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}
