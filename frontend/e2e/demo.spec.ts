/**
 * The public try-it page (/demo) runs the real CustomerFlow on a fixed example,
 * with no database. These tests cover what the flow gained with it: the step
 * shown when a customer comes back from Google, the language switch, and the
 * CR-3 boundary on the new screens (same assertions as compliance.spec.ts).
 */
import { expect, test, type Page } from "@playwright/test";

import { resolveFlowLanguage } from "../src/lib/flow/strings";

// SRS-17.1g: the approved neutral label set. Add to it only with policy review.
const APPROVED_LABELS = ["Post publicly on Google"];

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

async function privateOption(page: Page) {
  return page.getByRole("button", { name: /send private feedback to the owner/i });
}

/** Rate, optionally draft, go to the stand-in Google page and come back. */
async function goToGoogleAndBack(page: Page, stars: number) {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Rate ${stars} out of 5 stars` }).click();
  if (stars >= 4) {
    await page.getByRole("button", { name: "friendly staff" }).click();
    await page.getByRole("button", { name: /write my draft/i }).click();
    await page.getByRole("button", { name: /copy & continue to google/i }).click();
    await page.getByRole("button", { name: /open google review page/i }).click();
  } else {
    await page.getByRole("button", { name: /post publicly on google/i }).click();
  }
  await page.waitForURL(/\/demo\/google/);
  await page.getByRole("button", { name: /post \(demo\)/i }).click();
  await page.waitForURL(/\/demo$/);
  await expect(page.getByRole("heading", { name: /did your review go through/i })).toBeVisible();
}

for (const stars of [1, 3, 5]) {
  test(`${stars}★: coming back from Google asks how it went, with both options still on screen`, async ({ page }) => {
    await goToGoogleAndBack(page, stars);
    await assertGoogleOption(page, `${stars}★ returned`);
    await expect(await privateOption(page)).toBeVisible();

    await page.getByRole("button", { name: /yes, i posted it/i }).click();
    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible();
    await assertGoogleOption(page, `${stars}★ thank-you`);
    await expect(await privateOption(page)).toBeVisible();
  });
}

test("the returned screen is the same at a low and a high rating, apart from the kept draft", async ({ page }) => {
  await goToGoogleAndBack(page, 1);
  const low = await page.getByRole("button").allInnerTexts();
  await goToGoogleAndBack(page, 5);
  const high = (await page.getByRole("button").allInnerTexts()).filter((t) => !/copy again/i.test(t));
  expect(high).toEqual(low);
});

test("the draft is kept on return and can be copied again", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await goToGoogleAndBack(page, 5);
  await page.getByRole("button", { name: "Copy again" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Sharma General Store");
});

test("language switch: Hindi text, the approved English labels kept, and it survives the steps", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /हिन्दी/ }).click();
  await expect(page.getByRole("heading", { name: /आपका अनुभव कैसा रहा/ })).toBeVisible();
  await assertGoogleOption(page, "Hindi rating screen");
  await expect(await privateOption(page)).toBeVisible();

  await page.getByRole("button", { name: "5 में से 2 स्टार दें" }).click();
  await expect(page.getByLabel("आपका निजी संदेश")).toBeVisible();
  await assertGoogleOption(page, "Hindi private screen");

  await page.getByRole("button", { name: /switch to english/i }).click();
  await expect(page.getByLabel(/your private message/i)).toBeVisible();
});

test("starting over after a reload: the back gesture never shows a step from the last run", async ({ page }) => {
  await goToGoogleAndBack(page, 5);
  await page.getByRole("button", { name: /yes, i posted it/i }).click();
  await page.reload();
  await page.getByRole("button", { name: "Rate 2 out of 5 stars" }).click();
  await expect(page.getByLabel(/your private message/i)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /how was your visit/i })).toBeVisible();
});

test.describe("which language the flow opens in", () => {
  test("English shop, English phone: English, and no switch offered", () => {
    expect(resolveFlowLanguage({ outletLocale: "en-IN", acceptLanguage: "en-IN,en;q=0.9" })).toEqual({ lang: "en", offered: ["en"] });
  });
  test("a Hindi outlet opens in Hindi and offers English", () => {
    expect(resolveFlowLanguage({ outletLocale: "hi-IN", acceptLanguage: "en-US" })).toEqual({ lang: "hi", offered: ["en", "hi"] });
  });
  test("a Hindi phone at an English shop opens in Hindi", () => {
    expect(resolveFlowLanguage({ outletLocale: "en", acceptLanguage: "hi-IN,hi;q=0.9,en;q=0.8" }).lang).toBe("hi");
  });
  test("Hindi as a second phone language only offers the switch", () => {
    expect(resolveFlowLanguage({ outletLocale: "en", acceptLanguage: "en-IN,hi;q=0.8" })).toEqual({ lang: "en", offered: ["en", "hi"] });
  });
  test("the customer's saved choice wins", () => {
    expect(resolveFlowLanguage({ saved: "en", outletLocale: "hi", acceptLanguage: "hi" }).lang).toBe("en");
  });
  test("unsupported languages fall back to English", () => {
    expect(resolveFlowLanguage({ saved: "xx", outletLocale: "ta-IN", acceptLanguage: "ta,*;q=0.1" })).toEqual({ lang: "en", offered: ["en"] });
  });
});
