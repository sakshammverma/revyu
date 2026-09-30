/**
 * The compliance boundary (documents/02-SRS.md SRS-17.1a-g, CR-3).
 *
 * "Private feedback presented first" is legitimate; "Google is hard to reach
 * after a low rating" is review gating. These assertions are what must fail CI
 * if the flow ever drifts toward the second.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

const SLUG = "demo-dental";
// SRS-17.1g: the approved neutral label set. Add to it only with policy review.
const APPROVED_LABELS = ["Post publicly on Google"];

/** Relative luminance per WCAG 2.x. */
function luminance([r, g, b]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function parseRgb(css: string): number[] {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unparseable colour: ${css}`);
  return m[1].split(",").slice(0, 3).map((n) => parseFloat(n));
}

/** Walks up to the first ancestor with a non-transparent background. */
async function contrastRatio(el: Locator): Promise<number> {
  const { fg, bg } = await el.evaluate((node) => {
    const fg = getComputedStyle(node).color;
    let cur: Element | null = node;
    let bg = "rgba(0, 0, 0, 0)";
    while (cur) {
      const b = getComputedStyle(cur).backgroundColor;
      if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") {
        bg = b;
        break;
      }
      cur = cur.parentElement;
    }
    if (bg === "rgba(0, 0, 0, 0)") bg = "rgb(255, 255, 255)";
    return { fg, bg };
  });
  const [l1, l2] = [luminance(parseRgb(fg)), luminance(parseRgb(bg))].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function googleButton(page: Page): Locator {
  return page.getByRole("button", { name: new RegExp(APPROVED_LABELS.join("|")) }).first();
}

/** (a)-(d) and (g): present, above the fold, >=44px, >=4.5:1, neutral label. */
async function assertGoogleOption(page: Page, where: string) {
  const btn = googleButton(page);
  await expect(btn, `(a) Google option present at ${where}`).toBeVisible();

  const box = await btn.boundingBox();
  expect(box, `(b) has a box at ${where}`).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.y, `(b) starts on screen at ${where}`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `(b) above the fold at 360x640 at ${where}`).toBeLessThanOrEqual(viewport.height);

  expect(box!.width, `(c) >=44px wide at ${where}`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `(c) >=44px tall at ${where}`).toBeGreaterThanOrEqual(44);

  expect(await contrastRatio(btn), `(d) contrast >=4.5:1 at ${where}`).toBeGreaterThanOrEqual(4.5);

  const label = (await btn.innerText()).trim();
  expect(APPROVED_LABELS, `(g) label "${label}" approved at ${where}`).toContain(label);
}

async function startAndRate(page: Page, stars: number) {
  // Stop the real Google page from loading; we only need to see the request.
  await page.route(/google\.com|goo\.gl/, (route) => route.fulfill({ status: 200, body: "stub" }));
  // The review flow is served at /review in both hub modes, so these
  // assertions also hold on the hub -> review path (SRS-20.4).
  await page.goto(`/r/${SLUG}/review`);
  await page.getByRole("button", { name: /start review/i }).click();
  await page.getByRole("radio", { name: new RegExp(`^${stars} stars?$`) }).click();
}

for (const stars of [1, 2, 3, 4, 5]) {
  test.describe(`rating ${stars}`, () => {
    test(`(a-d,g) Google option meets the boundary right after rating`, async ({ page }) => {
      await startAndRate(page, stars);
      await assertGoogleOption(page, `${stars}★ first screen`);
    });

    test(`(e) exactly one tap reaches the Google handoff`, async ({ page }) => {
      await startAndRate(page, stars);
      const request = page.waitForRequest(/google\.com|goo\.gl/, { timeout: 10_000 });
      await googleButton(page).click(); // one tap, no intermediate step
      expect((await request).url()).toMatch(/google|goo\.gl/);
    });

    test(`private feedback is reachable at this rating`, async ({ page }) => {
      await startAndRate(page, stars);
      if (stars >= 4) {
        await page.getByRole("button", { name: /send private feedback to the owner/i }).click();
      }
      await expect(page.getByLabel(/your private message/i)).toBeVisible();
    });

    test(`(f) Google option is still present after private feedback is sent`, async ({ page }) => {
      await startAndRate(page, stars);
      if (stars >= 4) {
        await page.getByRole("button", { name: /send private feedback to the owner/i }).click();
      }
      await page.getByLabel(/your private message/i).fill("Automated compliance test message");
      await page.getByRole("button", { name: /send privately to the owner/i }).click();
      await expect(page.getByText(/message sent directly to the owner/i)).toBeVisible();
      await assertGoogleOption(page, `${stars}★ after feedback`);
    });
  });
}

test.describe("positive path keeps the option on every step", () => {
  test("tags and draft screens both carry the Google option", async ({ page }) => {
    await startAndRate(page, 5);
    await assertGoogleOption(page, "tags screen");

    await page.getByRole("button", { name: /assemble my review/i }).click();
    await expect(page.getByLabel(/your review draft/i)).toBeVisible();
    await assertGoogleOption(page, "draft screen");
  });

  test("CR-2: the draft is disclosed and editable", async ({ page }) => {
    await startAndRate(page, 5);
    await page.getByRole("button", { name: /assemble my review/i }).click();
    await expect(page.getByText(/we.ve written this from what you selected/i)).toBeVisible();
    const draft = page.getByLabel(/your review draft/i);
    await draft.fill("My own words");
    await expect(draft).toHaveValue("My own words");
  });
});
