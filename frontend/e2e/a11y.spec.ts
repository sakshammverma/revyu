/**
 * Automated WCAG 2 A/AA scan of the public pages on a small phone. axe finds only part of
 * what matters (it can't judge reading order or whether copy makes sense), so this is a
 * floor, not a certificate: serious and critical findings fail the build.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { name: "home", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "how it works", path: "/how-it-works" },
  { name: "compliance", path: "/compliance" },
  { name: "signup", path: "/signup" },
  { name: "gap report", path: "/gap-report" },
  { name: "customer flow", path: "/r/demo-dental/review" },
];

for (const p of PAGES) {
  test(`${p.name}: no serious or critical WCAG A/AA violations at 360x640`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: "networkidle" });
    // Let load-in animations settle so contrast is measured on the final colours.
    await page.waitForTimeout(1500);
    // The dimmed side phones of the product demo are inert (not focusable or clickable) and decorative
    // while they are not in front; the phone in front is still scanned. [data-illustration] is the mock Google
    // search result, whose competitor rows are dimmed on purpose (aria-hidden, no information of its own).
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[inert]").exclude("[data-illustration]").analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 6).map((n) => `${n.target.join(' ')} [${n.any[0]?.message?.slice(0, 90) ?? ''}]`).join(' | ')}`),
    ).toEqual([]);
  });
}
