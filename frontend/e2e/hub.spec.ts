/**
 * Hub, modules and loyalty on a 360x640 phone (documents/22-HUB-AND-MODULES.md).
 * Switches the demo outlet into hub mode for the run and restores `direct`
 * afterwards, so the compliance specs keep testing the plain review flow.
 */
import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

const SLUG = "demo-dental";
const PIN = "4321";

function adminToken(): string {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const env = fs.readFileSync(path.join(process.cwd(), "..", "backend", ".env"), "utf8");
  const m = env.match(/^ADMIN_SESSION_SECRET=(.*)$/m);
  if (!m) throw new Error("ADMIN_SESSION_SECRET not found");
  return m[1].trim();
}

const H = () => ({ Authorization: `Bearer ${adminToken()}` });

async function configureHub(request: APIRequestContext) {
  const cfg = await (await request.get(`/api/flow/${SLUG}/config`)).json();
  const base = `/api/admin/outlets/${cfg.outlet.id}/hub`;
  const ok = async (p: Promise<{ ok(): boolean; status(): number; text(): Promise<string> }>, allow: number[] = []) => {
    const r = await p;
    if (!r.ok() && !allow.includes(r.status())) throw new Error(`${r.status()} ${await r.text()}`);
  };

  await ok(request.put(`${base}/links`, { headers: H(), data: { links: [
    { kind: "instagram", url: "@demodental", enabled: true },
    { kind: "whatsapp", url: "+91 98765 43210", enabled: true },
  ] } }));

  const state = await (await request.get(base, { headers: H() })).json();
  if (!state.menu.some((c: { items: unknown[] }) => c.items.length)) {
    const cat = await (await request.post(`${base}/menu/categories`, { headers: H(), data: { name: "Cleaning" } })).json();
    await ok(request.post(`${base}/menu/items`, { headers: H(), data: { category_id: cat.id, name: "Scaling", amount_minor: 150000 } }));
  }
  await ok(request.post(`${base}/loyalty/acknowledge`, { headers: H() }));
  const loyalty = await (await request.get(`${base}/loyalty`, { headers: H() })).json();
  if (!loyalty.badges.some((b: { active: boolean }) => b.active)) {
    await ok(request.post(`${base}/loyalty/badges`, { headers: H(), data: {
      name: "Regular", icon: "sparkle", visits_required: 1, active: true,
      reward: { type: "percent_discount", percent: 10, title: "10% off next visit", expires_days: 30 },
    } }));
  }
  await ok(request.post(`${base}/loyalty/staff-pins`, { headers: H(), data: { label: "Desk", pin: PIN } }), [422]);
  await ok(request.put(`${base}/modules`, { headers: H(), data: { modules: ["review", "connect", "menu", "rewards"].map((module) => ({ module, enabled: true })) } }));
  await ok(request.patch(base, { headers: H(), data: { hub_mode: "menu" } }));
  return base;
}

test.describe.configure({ mode: "serial" });

let base = "";
const phone = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  base = await configureHub(request);
  await request.dispose();
});

test.afterAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  if (base) await request.patch(base, { headers: H(), data: { hub_mode: "direct" } });
  await request.dispose();
});

test("hub shows equal neutral tiles that fit a 360px phone", async ({ page }) => {
  await page.goto(`/r/${SLUG}`);
  const tiles = page.locator("main ul > li a");
  await expect(tiles).toHaveCount(4);
  await expect(tiles.nth(0)).toContainText("Share your experience");

  // Under `next dev` the stylesheet can land after the server-rendered HTML; measure once styled.
  await expect.poll(async () => (await tiles.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(100);

  const boxes = await tiles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThan(1); // equal weight (FR-80)
  expect(boxes.map((b) => Math.round(b.height)).every((h) => h >= 100), `tile heights: ${boxes.map((b) => Math.round(b.height))}`).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // CR-6.2: no tile links one module to another.
  const texts = await tiles.allInnerTexts();
  expect(texts[0]).not.toMatch(/reward|discount|badge|loyal|offer|free/i);
  for (const t of texts.slice(1)) expect(t).not.toMatch(/review|rating|google|stars?\b/i);
});

test("hub has no serious accessibility violations", async ({ page }) => {
  await page.goto(`/r/${SLUG}`);
  await page.locator("main ul > li a").first().waitFor();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
});

test("review tile opens the unchanged review flow and back returns to the hub", async ({ page }) => {
  await page.goto(`/r/${SLUG}`);
  await page.getByRole("link", { name: /Share your experience/ }).click();
  await expect(page).toHaveURL(/\/r\/demo-dental\/review\?from=hub/);
  await expect(page.getByRole("heading", { name: /How was your visit/i })).toBeVisible();
  await page.getByRole("link", { name: /Dental|demo/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}$`));
});

test("connect lists owner links that open safely in a new tab", async ({ page }) => {
  await page.goto(`/r/${SLUG}/connect`);
  const wa = page.locator('a[href="https://wa.me/919876543210"]');
  await expect(wa).toBeVisible();
  await expect(wa).toHaveAttribute("target", "_blank");
  await expect(wa).toHaveAttribute("rel", /noopener/);
  await expect(page.locator('a[href^="https://instagram.com/"]')).toBeVisible();
  await expect(page.getByRole("link", { name: /Hub|Dental|demo/i }).first()).toBeVisible(); // way back (FR-84)
});

test("menu renders items with prices from minor units", async ({ page }) => {
  await page.goto(`/r/${SLUG}/menu`);
  await expect(page.getByText("Scaling")).toBeVisible();
  await expect(page.getByText("₹1,500")).toBeVisible();
});

test("rewards copy never mentions the review side (CR-6.2)", async ({ page }) => {
  await page.goto(`/r/${SLUG}/rewards`);
  await expect(page.getByRole("heading", { name: "Start your wallet" })).toBeVisible();
  const text = await page.locator("main, body").first().innerText();
  expect(text).not.toMatch(/review|rating|google|\bstars?\b|feedback/i);
});

test("customer joins, staff records the visit and redeems once", async ({ page, browser }) => {
  // Three browser contexts and a dozen first-hit route compiles under `next dev`.
  test.setTimeout(60_000);
  await page.goto(`/r/${SLUG}/rewards`);
  await page.getByLabel("Your name").fill("E2E Customer");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Create my wallet" }).click();
  await expect(page.getByText("Hi, E2E Customer")).toBeVisible();

  await page.getByRole("button", { name: "Show at counter" }).click();
  const codeEl = page.locator('[role="dialog"] p[aria-live="polite"]');
  await expect(codeEl).toHaveText(/^[A-Z0-9]{4}-\d{6}$/);
  const code = (await codeEl.innerText()).trim();
  await expect(page.locator('[role="dialog"] [role="img"] svg')).toBeVisible(); // QR for the scanner

  // Staff phone: separate context, PIN pad, then the code.
  const staffCtx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const staff = await staffCtx.newPage();
  await staff.goto(`/staff/${SLUG}`);
  for (const d of PIN) await staff.getByRole("button", { name: d, exact: true }).click();
  await staff.getByRole("button", { name: "Go" }).click();
  await staff.getByLabel("Customer code").fill(code);
  await staff.getByRole("button", { name: "Record visit" }).click();
  await expect(staff.getByText(/Visit recorded/)).toBeVisible();
  await expect(staff.getByText(/New badge: Regular/)).toBeVisible();

  await staff.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(staff.getByText(/redeemed for E2E Customer/)).toBeVisible();
  await expect(staff.getByText("No rewards waiting.")).toBeVisible();

  // Staff can also look a member up by id and issue a transfer code.
  const memberId = code.split("-")[0];
  await staff.getByLabel("Customer code").fill(memberId);
  await staff.getByRole("button", { name: "Look up member to redeem" }).click();
  await staff.getByRole("button", { name: /Get a transfer code/ }).click();
  const transfer = (await staff.getByRole("status").filter({ hasText: "Give them" }).innerText()).match(/\d{6}/)![0];
  await staffCtx.close();

  // Customer closes the code screen; progress and the used reward show.
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("You've earned every badge")).toBeVisible();
  await expect(page.getByText("Used and expired")).toBeVisible();

  // A new phone claims the wallet with the staff-issued code; the old one is signed out.
  const fresh = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const p2 = await fresh.newPage();
  await p2.goto(`/r/${SLUG}/rewards`);
  await p2.getByRole("button", { name: /Already have a wallet/ }).click();
  await p2.getByLabel("Mobile number").fill(phone);
  await p2.getByLabel("Transfer code").fill(transfer);
  await p2.getByRole("button", { name: "Move my wallet" }).click();
  await expect(p2.getByText("Hi, E2E Customer")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Start your wallet" })).toBeVisible();
  await fresh.close();
});

test("editor preview is quiet: no events, tiles inert", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => r.url().includes("/api/events") && posts.push(r.postData() ?? ""));
  await page.goto(`/r/${SLUG}?preview=1`);
  await expect(page.locator("main ul > li a")).toHaveCount(4);
  await page.locator("main ul > li a").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}\\?preview=1$`));
  expect(posts).toEqual([]);
});

test("unknown code lands on the branded page", async ({ page }) => {
  await page.goto("/r/definitely-not-a-real-slug");
  await expect(page.getByText(/couldn.t find that page/i)).toBeVisible();
});
