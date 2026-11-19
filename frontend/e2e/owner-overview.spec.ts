/**
 * The owner Overview page in each outlet state. Hermetic: every /api/app call is
 * answered here, so it needs no owner session, writes nothing to the database,
 * and can assert exact numbers. Set SHOT_DIR to also save a screenshot per state.
 */
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import QRCode from "qrcode";

const OUTLET_ID = "11111111-2222-4333-8444-555555555555";

type State = "active" | "trial" | "locked";

/** 30 days ending 17 Nov 2026, busier at weekends, with a quiet first week. */
function trendDays(n: number) {
  const end = Date.UTC(2026, 10, 17);
  return Array.from({ length: n }, (_, i) => {
    const t = end - (n - 1 - i) * 86_400_000;
    const weekend = [0, 6].includes(new Date(t).getUTCDay());
    const scans = Math.round((weekend ? 19 : 9) + 6 * Math.sin(i / 2.3) + i / 4);
    return { date: new Date(t).toISOString().slice(0, 10), scans, completed: Math.round(scans * (0.28 + 0.1 * Math.sin(i))) };
  });
}

function home(state: State, opts: { range?: string; empty?: boolean; feedback?: boolean } = {}) {
  const n = opts.range === "7d" ? 7 : 30;
  const days = opts.empty ? trendDays(n).map((d) => ({ ...d, scans: 0, completed: 0 })) : trendDays(n);
  const scans = days.reduce((t, d) => t + d.scans, 0);
  const completed = days.reduce((t, d) => t + d.completed, 0);
  const overview = {
    outlet_id: OUTLET_ID,
    business_name: "Sharma Sweets",
    state,
    scans: opts.empty ? 0 : 612,
    completed_flows: opts.empty ? 0 : 188,
    conversion_rate: opts.empty ? 0 : 0.3072,
    trial_flow_count: 0,
    feedback_count: opts.feedback ? 2 : 0,
    unresolved_count: opts.feedback ? 2 : 0,
    dashboard_locked: state === "locked",
  };
  if (state === "locked") return { overview, range: "30d", trend: null, funnel: null, rating: null, open_feedback: null };
  return {
    overview,
    range: n === 7 ? "7d" : "30d",
    trend: {
      range: n === 7 ? "7d" : "30d",
      timezone: "Asia/Kolkata",
      days,
      totals: { scans, completed, conversion_rate: scans ? Math.round((completed / scans) * 1e4) / 1e4 : 0 },
      previous: opts.empty ? null : { scans: Math.round(scans * 0.82), completed: Math.round(completed * 0.74), conversion_rate: 0.25 },
    },
    funnel: {
      steps: [
        ["scan", scans],
        ["flow_start", Math.round(scans * 0.86)],
        ["rating_selected", Math.round(scans * 0.71)],
        ["tags_selected", Math.round(scans * 0.55)],
        ["draft_viewed", Math.round(scans * 0.46)],
        ["copy_tapped", completed],
        ["handoff", Math.round(completed * 0.92)],
      ].map(([step, count]) => ({ step, count, drop_off_pct: null })),
      note: "",
      self_reported: opts.empty ? { came_back: 0, said_posted: 0 } : { came_back: 41, said_posted: 33 },
    },
    rating: {
      baseline_rating: 4.2,
      baseline_review_count: 86,
      current_rating: opts.empty ? 4.2 : 4.5,
      current_review_count: opts.empty ? 86 : 131,
      polled_at: opts.empty ? null : "2026-11-15T04:30:00+00:00",
    },
    open_feedback: opts.feedback
      ? [
          { id: "f1", rating: 2, message: "Waited twenty minutes at the counter and nobody said a word. The sweets were good though.", contact: "+91 98765 43210", resolved: false, created_at: new Date(Date.now() - 3 * 3_600_000).toISOString() },
          { id: "f2", rating: 5, message: "Please start stocking sugar-free kaju katli!", contact: null, resolved: false, created_at: new Date(Date.now() - 26 * 3_600_000).toISOString() },
        ]
      : [],
  };
}

async function open(page: Page, state: State, opts: { empty?: boolean; feedback?: boolean } = {}) {
  // Any cookie value gets past the proxy's "no cookie at all" redirect; the mocked API never checks it.
  await page.context().addCookies([{ name: "session_token", value: "e2e", url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }]);
  const qr = await QRCode.toBuffer("https://revyu.in/r/sharma-sweets", { margin: 0, width: 256 });
  const patched: string[] = [];
  await page.route("**/api/app/**", (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ json: body });
    if (url.pathname.endsWith("/outlets/mine"))
      return json({ outlet_id: OUTLET_ID, business_name: "Sharma Sweets", state, collecting: true, slug: "sharma-sweets" });
    if (url.pathname.endsWith("/billing/status"))
      return json({
        outlet_id: OUTLET_ID,
        state,
        subscription_status: state === "active" ? "active" : null,
        plan: state === "active" ? "monthly" : null,
        current_period_end: null,
        trial_days_left: state === "trial" ? 9 : null,
        trial_days_total: 14,
        credits_left: state === "locked" ? 6 : null,
        scans_waiting: 188,
        can_pay: true,
        plans: [{ code: "monthly", amount_minor: 49900, currency_code: "INR" }],
        annual_saving_minor: 0,
        payments: [],
        referral_discounts_earned: 0,
      });
    if (url.pathname.endsWith("/home")) return json(home(state, { ...opts, range: url.searchParams.get("range") ?? "30d" }));
    if (url.pathname.endsWith("/qr")) return route.fulfill({ body: qr, contentType: "image/png" });
    if (url.pathname.includes("/feedback/") && route.request().method() === "PATCH") {
      patched.push(url.pathname.split("/").pop()!);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404, json: { detail: { error: { code: "NOT_MOCKED" } } } });
  });
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening)$/);
  return { patched };
}

async function shot(page: Page, name: string) {
  if (!process.env.SHOT_DIR) return;
  await page.screenshot({ path: path.join(process.env.SHOT_DIR, `${name}.png`), fullPage: true });
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("active: numbers, change against the period before, rating, journey and QR", async ({ page }) => {
    await open(page, "active");
    const days = trendDays(30);
    const scans = days.reduce((t, d) => t + d.scans, 0);
    await expect(page.getByText(scans.toLocaleString("en-IN"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Changes compare with the 30 days before.")).toBeVisible();
    await expect(page.getByText("up 22 percent")).toBeAttached();
    await expect(page.getByRole("img", { name: "4.5 out of 5 stars" })).toBeVisible();
    await expect(page.getByText("new Google reviews since you joined")).toBeVisible();
    await expect(page.getByRole("heading", { name: "From scan to Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toHaveAttribute("href", /\/qr\?format=png$/);
    // No private feedback waiting: the reply card is not there at all.
    await expect(page.getByText(/need(s)? a reply/)).toHaveCount(0);
    await shot(page, "desktop-active");

    // The chart answers the keyboard as well as the pointer.
    const chart = page.getByRole("group", { name: /Daily QR scans/ });
    await chart.focus();
    await page.keyboard.press("End");
    await expect(chart.getByText("Tue, 17 Nov")).toBeVisible();
    await shot(page, "desktop-active-tooltip");

    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page.getByText("Changes compare with the 7 days before.")).toBeVisible();
    await expect(page.getByText("How far customers got, last 7 days")).toBeVisible();
    await shot(page, "desktop-active-7d");
  });

  test("private feedback is answered from the Overview", async ({ page }) => {
    const { patched } = await open(page, "active", { feedback: true });
    await expect(page.getByRole("heading", { name: "2 private messages need a reply" })).toBeVisible();
    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/919876543210");
    await shot(page, "desktop-feedback");
    await page.getByRole("button", { name: "Mark resolved" }).first().click();
    await expect(page.getByRole("heading", { name: "1 private message needs a reply" })).toBeVisible();
    expect(patched).toEqual(["f1"]);
  });

  test("locked: counts and the unlock offer, no detail", async ({ page }) => {
    await open(page, "locked");
    await expect(page.getByRole("heading", { name: "612 scans and 188 completed reviews are waiting for you" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Unlock for ₹499\/month/ })).toHaveAttribute("href", "/app/billing");
    await expect(page.getByRole("heading", { name: "From scan to Google" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "7 days" })).toHaveCount(0);
    await shot(page, "desktop-locked");
  });

  test("first run: setup steps instead of a wall of zeros", async ({ page }) => {
    await open(page, "trial", { empty: true });
    await expect(page.getByRole("heading", { name: "Set up your QR" })).toBeVisible();
    await expect(page.getByText("9 days left in your free trial")).toBeVisible();
    await expect(page.getByText("First check this week")).toBeVisible();
    await expect(page.getByRole("group", { name: /Daily QR scans/ })).toHaveCount(0);
    await shot(page, "desktop-first-run");
  });
});

test.describe("phone (360x640)", () => {
  test("trial: nothing overflows sideways and the plan button is reachable", async ({ page }) => {
    await open(page, "trial", { feedback: true });
    await expect(page.getByText("9 days left in your free trial")).toBeVisible();
    await expect(page.getByText("₹499/month")).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose a plan" })).toHaveAttribute("href", "/app/billing");
    await expect(page.getByRole("group", { name: /Daily QR scans/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, "phone-trial");
  });
});
