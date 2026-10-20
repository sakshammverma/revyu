/**
 * Country-aware pricing: the marketing pages show the visitor's market.
 * Relies on the seeded country_pricing / plans rows (python -m app.seeds.plans).
 * ?country=XX previews a market locally, where there is no IP header.
 */
import { expect, test } from "@playwright/test";

const monthlyCard = (page: import("@playwright/test").Page) => page.locator("main").first();

test("India shows rupees by default locally", async ({ page }) => {
  await page.goto("/pricing");
  await expect(monthlyCard(page)).toContainText("₹499");
  await expect(monthlyCard(page)).toContainText("₹4,499");
});

test("a US visitor sees dollars", async ({ page }) => {
  await page.goto("/pricing?country=US");
  await expect(monthlyCard(page)).toContainText("$19");
  await expect(monthlyCard(page)).not.toContainText("₹");
});

test("a German visitor sees euros", async ({ page }) => {
  await page.goto("/pricing?country=DE");
  await expect(monthlyCard(page)).toContainText(/18\s?€/);
  await expect(monthlyCard(page)).not.toContainText("₹");
});

test("the picker switches the displayed market", async ({ page }) => {
  await page.goto("/pricing");
  await expect(monthlyCard(page)).toContainText("₹499");
  await page.getByLabel("Country for prices").selectOption("GB");
  await expect(monthlyCard(page)).toContainText("£15");
});

test("the home page promo bar follows the market", async ({ page }) => {
  await page.goto("/?country=US");
  await expect(page.getByText("/month, flat").first()).toContainText("$19");
});
