import { describe, expect, it } from "vitest";

import { exampleDashboard } from "./exampleDashboard";

const TAGS = ["Friendly staff", "Fair prices", "Quick service", "Clean shop", "Good range", "Fresh stock", "Easy parking", "Helpful advice"].map(
  (label) => ({ label }),
);
const TODAY = new Date(2026, 10, 20, 15, 0, 0);

/** Every string anywhere in a value, with its path. */
function strings(value: unknown, path = "$"): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  return [];
}

describe("exampleDashboard", () => {
  it("is deterministic for a seed", () => {
    expect(exampleDashboard("place-abc", TAGS, TODAY)).toEqual(exampleDashboard("place-abc", TAGS, TODAY));
  });

  it("differs between seeds", () => {
    const a = exampleDashboard("place-abc", TAGS, TODAY);
    const b = exampleDashboard("place-xyz", TAGS, TODAY);
    expect(a.trend.days.map((d) => d.scans)).not.toEqual(b.trend.days.map((d) => d.scans));
  });

  it("covers 30 consecutive days ending today", () => {
    const { trend } = exampleDashboard("place-abc", TAGS, TODAY);
    expect(trend.days).toHaveLength(30);
    expect(trend.range).toBe("30d");
    expect(trend.days.at(-1)!.date).toBe("2026-11-20");
    expect(trend.days[0].date).toBe("2026-10-22");
    expect(new Set(trend.days.map((d) => d.date)).size).toBe(30);
  });

  it("keeps totals, overview and funnel consistent at a believable scale", () => {
    for (const seed of ["a", "b", "ChIJ123", "ChIJzzz", "shop-42"]) {
      const d = exampleDashboard(seed, TAGS, TODAY);
      const scans = d.trend.days.reduce((n, x) => n + x.scans, 0);
      const completed = d.trend.days.reduce((n, x) => n + x.completed, 0);
      expect(d.trend.totals.scans).toBe(scans);
      expect(d.trend.totals.completed).toBe(completed);
      expect(d.overview.scans).toBe(scans);
      expect(d.overview.completed_flows).toBe(completed);
      expect(d.trend.days.every((x) => x.completed <= x.scans && x.scans >= 0)).toBe(true);
      expect(scans).toBeGreaterThanOrEqual(110);
      expect(scans).toBeLessThanOrEqual(190);
      expect(d.trend.totals.conversion_rate).toBeGreaterThanOrEqual(0.15);
      expect(d.trend.totals.conversion_rate).toBeLessThanOrEqual(0.35);

      const steps = d.funnel.steps.map((s) => s.step);
      expect(steps).toEqual(["scan", "flow_start", "rating_selected", "tags_selected", "draft_viewed", "copy_tapped", "handoff"]);
      const counts = d.funnel.steps.map((s) => s.count);
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
      expect(counts[0]).toBe(scans);
      expect(d.funnel.steps.find((s) => s.step === "copy_tapped")!.count).toBe(completed);

      const tagCounts = d.tagFrequency.tags.map((t) => t.count);
      expect(d.tagFrequency.tags.map((t) => t.label)).toEqual(TAGS.map((t) => t.label));
      for (let i = 1; i < tagCounts.length; i++) expect(tagCounts[i]).toBeLessThan(tagCounts[i - 1]);
      expect(tagCounts.every((c) => c >= 1)).toBe(true);

      expect(d.feedback.map((f) => f.rating)).toEqual([2, 4]);
      expect(d.overview.feedback_count).toBe(d.feedback.length);
    }
  });

  it("is busier at weekends", () => {
    const { trend } = exampleDashboard("place-abc", TAGS, TODAY);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    expect(avg(trend.days.filter((d) => isWeekend(d.date)).map((d) => d.scans))).toBeGreaterThan(
      avg(trend.days.filter((d) => !isWeekend(d.date)).map((d) => d.scans)),
    );
  });

  it("carries no sentence-like text anywhere (CR-1)", () => {
    const d = exampleDashboard("place-abc", TAGS, TODAY);
    const tagLabels = new Set(TAGS.map((t) => t.label));
    for (const [path, s] of strings(d)) {
      if (tagLabels.has(s)) continue; // the caller's own tag labels
      expect(s, path).not.toMatch(/[.!?]/);
      expect(s.trim().split(/\s+/).length, path).toBeLessThan(4);
    }
    for (const f of d.feedback) expect(Object.keys(f).sort()).toEqual(["hasPhone", "hoursAgo", "id", "rating"]);
  });

  it("handles no tags", () => {
    expect(exampleDashboard("x", [], TODAY).tagFrequency.tags).toEqual([]);
  });
});
