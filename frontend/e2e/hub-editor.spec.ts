/**
 * The QR-page editor and Growth Services admin, driven in a real browser via
 * the admin mount (same components the owner uses at /app/hub).
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SLUG = "demo-dental";

function adminToken(): string {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const env = fs.readFileSync(path.join(process.cwd(), "..", "backend", ".env"), "utf8");
  return (env.match(/^ADMIN_SESSION_SECRET=(.*)$/m) ?? [])[1]?.trim() ?? "";
}

test.use({ viewport: { width: 1280, height: 900 } });
test.describe.configure({ mode: "serial" });

let outletId = "";

async function openEditor(page: Page) {
  await page.addInitScript((t) => sessionStorage.setItem("revyu:admin-token", t), adminToken());
  await page.goto(`/admin/outlets/${outletId}`);
  await expect(page.getByRole("tab", { name: "Page" })).toBeVisible();
}

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  outletId = (await (await request.get(`/api/flow/${SLUG}/config`)).json()).outlet.id;
  // Clear anything a previously interrupted run left behind.
  const hub = `/api/admin/outlets/${outletId}/hub`;
  const headers = { Authorization: `Bearer ${adminToken()}` };
  const state = await (await request.get(hub, { headers })).json();
  for (const c of state.menu as { id: string; name: string }[])
    if (c.name === "E2E Category") await request.delete(`${hub}/menu/categories/${c.id}`, { headers });
  await request.dispose();
});

test("page tab: modules, profile and live preview", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole("radio", { name: "Show my page" })).toBeVisible();
  for (const name of ["Share your experience", "Connect with us", "Rewards"])
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(page.getByTitle("Customer view preview")).toBeVisible();

  await page.getByLabel("Tagline").fill("Gentle family dentistry");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Business details saved")).toBeVisible();
});

test("an empty module cannot be switched on, and says why", async ({ page }) => {
  await openEditor(page);
  // Turn Connect off, empty its links via the API-backed editor, then try to turn it on.
  await page.getByRole("tab", { name: "Connect" }).click();
  const remove = page.getByRole("button", { name: "Remove" });
  if (await remove.count()) {
    while (await remove.count()) await remove.first().click();
    await page.getByRole("button", { name: "Save links" }).click();
    await expect(page.getByText("Links saved")).toBeVisible();
  }

  await page.getByRole("tab", { name: "Page" }).click();
  await page.getByRole("switch", { name: "Connect with us on or off" }).click(); // off
  await page.getByRole("switch", { name: "Connect with us on or off" }).click(); // on again -> refused
  await expect(page.getByText(/Add at least one link/).first()).toBeVisible();
});

test("connect tab rejects off-platform links and saves valid ones", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Connect" }).click();
  await page.getByRole("button", { name: "+ Add link" }).click();
  await page.getByLabel("Link address").fill("https://evil.com/x"); // kind defaults to Instagram
  await page.getByRole("button", { name: "Save links" }).click();
  await expect(page.getByText(/look like an Instagram link/)).toBeVisible();

  await page.getByLabel("Link address").fill("@demodental");
  await page.getByRole("button", { name: "Save links" }).click();
  await expect(page.getByText("Links saved")).toBeVisible();
  await page.getByRole("button", { name: "+ Add link" }).click();
  await page.getByLabel("Link type").last().selectOption("whatsapp");
  await page.getByLabel("Link address").last().fill("+91 98765 43210");
  await page.getByRole("button", { name: "Save links" }).click();
  await expect(page.getByText("Links saved")).toBeVisible();

  await page.getByRole("tab", { name: "Page" }).click();
  await page.getByRole("switch", { name: "Connect with us on or off" }).click();
  await expect(page.getByRole("switch", { name: "Connect with us on or off" })).toBeChecked();
});

test("menu tab: add a category and an item with a price, then remove them", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: /Services|Menu/ }).click();
  await page.getByLabel("New category name").fill("E2E Category");
  await page.getByRole("button", { name: "Add category" }).click();
  const card = page.locator("section", { hasText: "E2E Category" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "+ Add item" }).click();
  const dlg = page.getByRole("dialog", { name: "New item" });
  await dlg.getByLabel("Name", { exact: true }).fill("E2E Item");
  await dlg.getByLabel("Price (₹)").fill("249.50");
  await dlg.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByText("E2E Item")).toBeVisible();
  await expect(card.getByText("₹249.50")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("E2E Category")).toHaveCount(0);
});

test("rewards tab shows the programme and opens the badge form", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Rewards" }).click();
  // First hit of the admin loyalty route compiles under `next dev`, which can exceed the 5s default.
  await expect(page.getByText("Badges and rewards")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Staff counter").first()).toBeVisible();
  await page.getByRole("button", { name: "+ Add badge" }).click();
  await expect(page.getByRole("dialog", { name: "New badge" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("growth services admin: catalogue has the five services, no prices", async ({ page }) => {
  await page.addInitScript((t) => sessionStorage.setItem("revyu:admin-token", t), adminToken());
  await page.goto("/admin/services");
  await expect(page.getByRole("tab", { name: "Requests" })).toBeVisible();
  await page.getByRole("tab", { name: "Catalogue" }).click();
  for (const name of ["Website building", "Landing video", "Content management pipeline", "Instagram automation", "WhatsApp automation"])
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/₹\s?\d/);
  await page.getByRole("tab", { name: "Print kits" }).click();
  await expect(page.getByText(/Print kit deliveries|No delivery requests/)).toBeVisible();
});
