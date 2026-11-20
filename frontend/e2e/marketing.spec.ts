/**
 * The in-shop sales demo (/marketing) and its scan-to-try page.
 *
 * Google is never called: /api/marketing/search and /api/marketing/prospect are faked
 * in the browser with page.route (.env.local can hold a real, billed Places key). The
 * kit route makes no Google calls, so the page and the tests use the real one, unlocked
 * with the admin secret. Prices come from the local DB.
 *
 * The try page carries the CR-3 boundary of the real customer flow: the Google option
 * is on screen at a low and a high rating (same checks as compliance.spec.ts).
 */
import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// SRS-17.1g: the approved neutral label set. Add to it only with policy review.
const APPROVED_LABELS = ["Post publicly on Google"];

const SHOP = "Gupta Sweets";
const PLACE_ID = "e2e_gupta_sweets_place";

function adminToken(): string {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const env = fs.readFileSync(path.join(process.cwd(), "..", "backend", ".env"), "utf8");
  return (env.match(/^ADMIN_SESSION_SECRET=(.*)$/m) ?? [])[1]?.trim() ?? "";
}

const business = (place_id: string, name: string, rating: number, review_count: number) => ({
  place_id,
  name,
  rating,
  review_count,
});

/** A fixed, made-up listing: 4.3★ with 47 reviews against rivals with 180, 132 and 96. */
const PROSPECT = {
  place_id: PLACE_ID,
  report: {
    business: business(PLACE_ID, SHOP, 4.3, 47),
    competitors: [
      business("e2e_rival_a", "Mithaas Corner", 4.5, 180),
      business("e2e_rival_b", "Bikaner House", 4.4, 132),
      business("e2e_rival_c", "Laddu Point", 4.1, 96),
    ],
    review_gap: 133,
    rank_by_reviews: 4,
    group_size: 4,
    headline: "",
  },
  shop: { type_label: "Sweet shop", address: "Lajpat Nagar, New Delhi", country_code: "IN" },
  vertical: "bakery",
  fetched_at: new Date().toISOString(),
};

const SEARCH = {
  results: [{ place_id: PLACE_ID, name: SHOP, address: "Lajpat Nagar, New Delhi", rating: 4.3, review_count: 47 }],
};

/** Fakes the two Google-backed routes. Anything else under /api/marketing hits the real server. */
async function fakeGoogle(page: Page) {
  await page.route("**/api/marketing/search**", (route) => route.fulfill({ json: SEARCH }));
  await page.route("**/api/marketing/prospect**", (route) => route.fulfill({ json: PROSPECT }));
}

async function unlocked(page: Page) {
  await page.addInitScript((t) => localStorage.setItem("revyu:sales-pin", t), adminToken());
  await fakeGoogle(page);
}

/** Unlock, search the fake shop, pick it, and land on step 1. */
async function openDeck(page: Page) {
  await unlocked(page);
  await page.goto("/marketing");
  await page.getByLabel("Shop name and area").fill("Gupta Sweets Lajpat Nagar");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(SHOP) }).first().click();
  await expect(page.getByRole("heading", { name: `${SHOP} on Google today.` })).toBeVisible();
}

async function next(page: Page) {
  await page.getByRole("button", { name: /^(Next|Start) →$/ }).click();
}

async function kitTryPath(request: APIRequestContext): Promise<string> {
  const qs = new URLSearchParams({ place_id: PLACE_ID, name: SHOP, vertical: "bakery" });
  const res = await request.get(`/api/marketing/kit?${qs}`, { headers: { Authorization: `Bearer ${adminToken()}` } });
  expect(res.status()).toBe(200);
  const kit = await res.json();
  expect(kit.try.url).toContain("/marketing/try/");
  return new URL(kit.try.url).pathname;
}

async function assertGoogleOption(page: Page, where: string) {
  const btn = page.getByRole("button", { name: new RegExp(APPROVED_LABELS.join("|")) }).first();
  await expect(btn, `Google option present at ${where}`).toBeVisible();
  const box = (await btn.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y, `starts on screen at ${where}`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `above the fold at ${where}`).toBeLessThanOrEqual(viewport.height);
  expect(box.height, `>=44px tall at ${where}`).toBeGreaterThanOrEqual(44);
  expect(APPROVED_LABELS, `label approved at ${where}`).toContain((await btn.innerText()).trim());
}

async function axe(page: Page) {
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[inert]").analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    bad.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 6).map((n) => `${n.target.join(" ")} [${n.any[0]?.message?.slice(0, 120) ?? ""}]`).join(" | ")}`),
  ).toEqual([]);
}

test.describe("sales deck", () => {
  test("the gate rejects a wrong PIN and stays locked", async ({ page }) => {
    await fakeGoogle(page);
    await page.goto("/marketing");
    await page.getByLabel("Sales PIN").fill("not-the-pin-e2e");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That PIN didn't work.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find the shop" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("revyu:sales-pin"))).toBeNull();
  });

  test("the gate has no serious or critical WCAG A/AA violations", async ({ page }) => {
    await page.goto("/marketing");
    await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
    await axe(page);
  });

  test("walks the four steps on real-vs-example data and hands off to a pre-filled signup", async ({ page }) => {
    await openDeck(page);

    // 1. On Google today: real public numbers.
    await expect(page.getByText("Live from Google").first()).toBeVisible();
    await expect(page.getByText("47", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("180", { exact: true }).first()).toBeVisible();

    // 2. The counter standee with the shop's name and a real QR.
    await next(page);
    await expect(page.getByRole("heading", { name: "This goes on your counter." })).toBeVisible();
    const standeeQr = page.getByRole("img", { name: `QR code: open ${SHOP}'s customer page` });
    await expect(standeeQr).toBeVisible();
    expect(await standeeQr.evaluate((n) => n.tagName.toLowerCase())).toBe("svg");
    expect(await standeeQr.locator("path").first().getAttribute("d")).toBeTruthy();
    await expect(page.getByText(SHOP, { exact: true }).last()).toBeVisible();

    // 3. The dashboard preview: every card says whether it is live or example.
    await next(page);
    await expect(page.getByText(/This card: Example/).first()).toBeVisible();
    await expect(page.getByText(/This card: Live from Google/).first()).toBeAttached();
    await expect(page.getByText("4.3").first()).toBeAttached();
    await expect(page.getByText(`This is ${SHOP}’s dashboard. Activity numbers are an example; the Google numbers are real.`)).toBeVisible();

    // 4. Start: the local DB price and a sign-up QR.
    await next(page);
    await expect(page.getByRole("heading", { name: "Start free today." })).toBeVisible();
    await expect(page.getByText(/₹/).first()).toBeVisible();
    await expect(page.getByRole("img", { name: `QR code: start the monthly free trial for ${SHOP}` })).toBeVisible();

    await page.getByRole("link", { name: "Fill it in on this phone" }).click();
    await page.waitForURL(/\/signup\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("src")).toMatch(/^\d{9,11}\.[A-Za-z0-9_-]{16}$/);
    expect(url.searchParams.get("type")).toBe("bakery");
    await expect(page.getByLabel("Business name")).toHaveValue(SHOP);
  });

  test("the deck survives a trip to the try page and comes back on the dashboard", async ({ page }) => {
    await openDeck(page);
    await next(page);
    await page.getByRole("link", { name: "Try it on this phone" }).click();
    await page.waitForURL(/\/marketing\/try\/[^/]+\?via=deck/);
    await page.getByRole("button", { name: "Rate 2 out of 5 stars" }).click();
    await assertGoogleOption(page, "2★ from the deck");
    await page.goto("/marketing?resume=dashboard");
    await expect(page.getByText(`This is ${SHOP}’s dashboard. Activity numbers are an example; the Google numbers are real.`)).toBeVisible();
    expect(page.url()).not.toContain("resume=");
  });

  test("the deck steps have no serious or critical WCAG A/AA violations", async ({ page }) => {
    await openDeck(page);
    await axe(page);
    for (let i = 0; i < 3; i++) {
      await next(page);
      await axe(page);
    }
  });

  test("End demo clears the deck, and locks the founder's admin secret away again", async ({ page }) => {
    await openDeck(page);
    await page.getByRole("button", { name: "Demo menu" }).click();
    await page.getByRole("button", { name: "End demo" }).click();
    // Unlocked with the admin secret (the full /api/admin bearer): ending the demo signs out.
    await expect(page.getByRole("heading", { name: "Sales demo" })).toBeVisible();
    await expect(page.getByLabel("Sales PIN")).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("revyu:sales:deck"))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem("revyu:sales-pin"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("revyu:sales-pin"))).toBeNull();
  });
});

test.describe("scan-to-try page", () => {
  let tryPath = "";

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext({ baseURL: `http://localhost:${process.env.E2E_PORT ?? 3000}` });
    tryPath = await kitTryPath(request);
    await request.dispose();
  });

  for (const stars of [1, 5]) {
    test(`${stars}★: the Google option is on screen at 360x640`, async ({ page }) => {
      await page.goto(tryPath);
      await expect(page.getByText(SHOP).first()).toBeVisible();
      await page.getByRole("button", { name: `Rate ${stars} out of 5 stars` }).click();
      await assertGoogleOption(page, `${stars}★ try page`);
    });
  }

  test("the Google option leads to the labelled stand-in with the shop's name, and back", async ({ page }) => {
    await page.goto(tryPath);
    await page.getByRole("button", { name: "Rate 1 out of 5 stars" }).click();
    await page.getByRole("button", { name: /post publicly on google/i }).click();
    await page.waitForURL(/\/marketing\/try\/[^/]+\/google/);
    await expect(page.getByText(/Demo stand-in/)).toBeVisible();
    await expect(page.getByRole("heading", { name: SHOP })).toBeVisible();
    await page.getByRole("button", { name: /post \(demo\)/i }).click();
    await page.waitForURL((u) => u.pathname === tryPath);
    await expect(page.getByRole("heading", { name: /did your review go through/i })).toBeVisible();
    await assertGoogleOption(page, "1★ returned");
  });

  test("a forged token shows the neutral ended screen", async ({ page }) => {
    const [payload] = tryPath.split("/").pop()!.split(".");
    await page.goto(`/marketing/try/${payload}.AAAAAAAAAAAAAAAAAAAAAA`);
    await expect(page.getByRole("heading", { name: "This demo has ended" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rate 1 out of 5 stars/ })).toHaveCount(0);
    await page.goto("/marketing/try/not-a-token/google");
    await expect(page.getByRole("heading", { name: "This demo has ended" })).toBeVisible();
  });

  test("no serious or critical WCAG A/AA violations at 360x640", async ({ page }) => {
    await page.goto(tryPath, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Rate 5 out of 5 stars" })).toBeVisible();
    await axe(page);
  });
});

// Screenshots for review: SHOT_DIR=../qa-revyu/marketing-shots npx playwright test e2e/marketing.spec.ts -g screenshots
test.describe("screenshots", () => {
  test.skip(!process.env.SHOT_DIR, "set SHOT_DIR to save screenshots");

  for (const vp of [
    { width: 360, height: 640 },
    { width: 1280, height: 800 },
  ]) {
    test(`screenshots at ${vp.width}x${vp.height}`, async ({ page, request }) => {
      const dir = path.resolve(process.env.SHOT_DIR!);
      fs.mkdirSync(dir, { recursive: true });
      const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}-${vp.width}x${vp.height}.png`) });
      await page.setViewportSize(vp);

      await page.goto("/marketing");
      await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
      await shot("0-gate");

      await openDeck(page);
      await page.waitForTimeout(800);
      await shot("1-gap");
      await next(page);
      await page.waitForTimeout(800);
      await shot("2-try");
      await next(page);
      await page.waitForTimeout(800);
      await shot("3-dashboard");
      // The dashboard scrolls inside the deck, not the document (fullPage can't reach it), so make
      // the viewport tall enough for the whole preview, capture the region, then restore the size.
      const preview = page.getByRole("region", { name: /Preview of .*dashboard/ });
      const tall = await preview.evaluate((el) => el.scrollHeight);
      await page.setViewportSize({ width: vp.width, height: tall + 400 });
      await page.waitForTimeout(400);
      await preview.screenshot({ path: path.join(dir, `3-dashboard-full-${vp.width}x${vp.height}.png`) });
      await page.setViewportSize(vp);
      await next(page);
      await page.waitForTimeout(800);
      await shot("4-start");

      const tryPath = await kitTryPath(request);
      await page.goto(tryPath);
      await expect(page.getByRole("button", { name: "Rate 5 out of 5 stars" })).toBeVisible();
      await shot("5-try-page");
      await page.getByRole("button", { name: "Rate 5 out of 5 stars" }).click();
      await page.waitForTimeout(500);
      await shot("6-try-page-5star");
    });
  }
});
