import type { CustomerHealth, CustomerRow } from "@/lib/admin/api";
import { formatMoney } from "@/lib/format";

const DAY_MS = 86_400_000;

/** One label + one colour per health verdict; the bar colour is never the only signal. */
export const HEALTH: Record<CustomerHealth, { label: string; bar: string; text: string; pill: string }> = {
  at_risk: { label: "At risk", bar: "bg-alert", text: "text-alert", pill: "bg-alert-50 text-alert border-alert/25" },
  watch: { label: "Watch", bar: "bg-warning", text: "text-warning", pill: "bg-warning-50 text-warning border-warning/25" },
  healthy: { label: "Healthy", bar: "bg-success", text: "text-success-strong", pill: "bg-success-50 text-success-strong border-success/25" },
  onboarding: { label: "Onboarding", bar: "bg-accent", text: "text-accent-hover", pill: "bg-accent-50 text-accent-hover border-accent/25" },
  inactive: { label: "Inactive", bar: "bg-line-strong", text: "text-text-2", pill: "bg-paper-subtle text-text-2 border-line-strong" },
};

export function HealthPill({ health }: { health: CustomerHealth }) {
  const h = HEALTH[health];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${h.pill}`}>
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${h.bar}`} />
      {h.label}
    </span>
  );
}

/** "today", "yesterday", "5d ago", "3 mo ago". */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 45) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

/** Change vs the previous 30 days; null when there is no base to compare with. */
export function change(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return (cur - prev) / prev;
}

export function Trend({ cur, prev, className = "" }: { cur: number; prev: number; className?: string }) {
  const c = change(cur, prev);
  if (c === null) return prev === 0 && cur > 0 ? <span className={`text-xs font-semibold text-success-strong ${className}`}>New</span> : null;
  const r = Math.round(c * 100);
  if (r === 0) return <span className={`text-xs font-semibold text-text-2 ${className}`}>±0%</span>;
  const up = r > 0;
  return (
    <span className={`text-xs font-semibold tabular-nums ${up ? "text-success-strong" : "text-alert"} ${className}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "up" : "down"}</span> {Math.abs(r)}%
    </span>
  );
}

/** Plan line for a customer: what they pay, or where they are in the trial. */
export function planSummary(c: CustomerRow): { main: string; sub: string } {
  const b = c.billing;
  if (b.mrr_minor > 0) {
    return {
      main: `${formatMoney(b.mrr_minor, b.currency_code)}/mo`,
      sub: b.cancelled ? "Cancelled" : b.plan === "annual" ? "Annual" : "Monthly",
    };
  }
  if (c.state === "trial") {
    const d = c.trial?.days_left;
    return { main: "Trial", sub: d === null || d === undefined ? "Not live yet" : `${d}d left${b.will_convert ? " · auto-pays" : ""}` };
  }
  if (c.state === "locked") {
    const left = c.trial?.credits_left;
    return { main: "Unpaid", sub: left === null || left === undefined ? "Trial over" : `${left} reviews left` };
  }
  if (c.stage === "onboarding") return { main: "–", sub: c.state === "pending_approval" ? "Awaiting approval" : "Signing up" };
  if (b.lifetime_minor > 0) return { main: "–", sub: `Paid ${formatMoney(b.lifetime_minor, b.currency_code)} total` };
  return { main: "–", sub: "Never paid" };
}

/** Sum of MRR across currencies, primary first (INR is the launch market). */
export function mrrParts(mrr: Record<string, number>): { primary: string; rest: string[] } {
  const entries = Object.entries(mrr).sort(([a], [b]) => (a === "INR" ? -1 : b === "INR" ? 1 : a.localeCompare(b)));
  if (!entries.length) return { primary: formatMoney(0, "INR"), rest: [] };
  const [first, ...others] = entries;
  return { primary: formatMoney(first[1], first[0]), rest: others.map(([cur, v]) => formatMoney(v, cur)) };
}

/** wa.me needs the country code; Indian owners often type a bare 10-digit number. */
export function waLink(phone: string, country = "IN"): string {
  let digits = phone.replace(/\D/g, "");
  if (country === "IN" && digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}`;
}
