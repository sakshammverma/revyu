/**
 * Example activity for the sales demo's dashboard preview (/marketing, step 3).
 *
 * Pure and deterministic: the same seed (the prospect's place id) always gives the
 * same month, so the preview doesn't jump around between renders or re-opens.
 * The scale follows the conversion design doc: about 150 scans a month, 20-30% of
 * them reaching a copied draft, busier at weekends.
 *
 * Every number here is labelled "Example" on screen. Nothing here is a forecast for
 * the shop, and there is no message text anywhere (CR-1): private feedback is only a
 * rating, an age and whether a phone number came with it.
 */
import type { Funnel, Overview, TagFrequency, Trend, TrendDay } from "@/lib/dashboard/api";

export interface ExampleFeedback {
  id: string;
  rating: number;
  hoursAgo: number;
  hasPhone: boolean;
}

export interface ExampleDashboard {
  trend: Trend;
  overview: Overview;
  funnel: Funnel;
  tagFrequency: TagFrequency;
  feedback: ExampleFeedback[];
}

const DAYS = 30;
const DAY_MS = 86_400_000;

/** FNV-1a: a stable 32-bit number from any string. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator returning [0, 1). */
function rng(seed: string): () => number {
  let a = hashSeed(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rate = (completed: number, scans: number) => (scans ? Math.round((completed / scans) * 1e4) / 1e4 : 0);

export function exampleDashboard(seed: string, tags: { label: string }[], today: Date = new Date()): ExampleDashboard {
  const rand = rng(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();

  // The shop's "typical" completion rate for the month, 20-30%.
  const share = between(0.2, 0.3);
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  const days: TrendDay[] = Array.from({ length: DAYS }, (_, i) => {
    const t = end - (DAYS - 1 - i) * DAY_MS;
    const weekend = [0, 6].includes(new Date(t).getUTCDay());
    // Weekdays about 4, weekends about 7.5: roughly 150 over 30 days.
    const scans = Math.max(0, Math.round((weekend ? 7.5 : 4) + between(-2, 2)));
    const completed = Math.min(scans, Math.max(0, Math.round(scans * (share + between(-0.08, 0.08)))));
    return { date: new Date(t).toISOString().slice(0, 10), scans, completed };
  });

  const scans = days.reduce((n, d) => n + d.scans, 0);
  const completed = days.reduce((n, d) => n + d.completed, 0);

  const trend: Trend = {
    range: "30d",
    timezone: "Asia/Kolkata",
    days,
    totals: { scans, completed, conversion_rate: rate(completed, scans) },
    // A preview of a first month: no earlier month to compare with, so no change chips.
    previous: null,
  };

  const overview: Overview = {
    outlet_id: "example",
    business_name: "",
    state: "trial",
    scans,
    completed_flows: completed,
    conversion_rate: rate(completed, scans),
    trial_flow_count: completed,
    feedback_count: 2,
    unresolved_count: 2,
    dashboard_locked: false,
  };

  // Each step at most the one before; "copy_tapped" is the same number as "drafts copied".
  const flowStart = Math.round(scans * between(0.86, 0.92));
  const rated = Math.min(flowStart, Math.round(scans * between(0.64, 0.72)));
  const tagged = Math.min(rated, Math.round(scans * between(0.52, 0.58)));
  const draft = Math.max(completed, Math.min(tagged, Math.round(scans * between(0.4, 0.46))));
  const handoff = Math.round(completed * between(0.85, 0.95));
  const counts: [string, number][] = [
    ["scan", scans],
    ["flow_start", flowStart],
    ["rating_selected", rated],
    ["tags_selected", tagged],
    ["draft_viewed", draft],
    ["copy_tapped", completed],
    ["handoff", handoff],
  ];
  const funnel: Funnel = {
    steps: counts.map(([step, count], i) => {
      const prev = i > 0 ? counts[i - 1][1] : null;
      const drop = prev !== null && prev > 0 ? Math.round((1 - count / prev) * 1000) / 10 : null;
      return { step, count, drop_off_pct: drop };
    }),
    note: "",
  };

  // Tag counts fall off down the list; never below 1, strictly decreasing while room allows.
  let top = Math.max(tags.length, Math.round(tagged * between(0.5, 0.6)));
  const tagFrequency: TagFrequency = {
    tags: tags.map((t, i) => {
      if (i > 0) top = Math.max(tags.length - i, Math.min(top - 1, Math.round(top * between(0.7, 0.85))));
      return { label: t.label, count: Math.max(1, top) };
    }),
  };

  const feedback: ExampleFeedback[] = [
    { id: "example-1", rating: 2, hoursAgo: Math.round(between(2, 8)), hasPhone: true },
    { id: "example-2", rating: 4, hoursAgo: Math.round(between(20, 44)), hasPhone: rand() < 0.5 },
  ];

  return { trend, overview, funnel, tagFrequency, feedback };
}
