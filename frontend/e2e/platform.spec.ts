/**
 * Production-readiness checks that need a real server: security headers,
 * crawler rules, admin entry point, and the customer's way back from the
 * low-rating screen.
 */
import { expect, test } from "@playwright/test";

const SLUG = "demo-dental";

test("every page carries the security headers", async ({ request }) => {
  for (const path of ["/", `/r/${SLUG}`, "/api/health"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("SAMEORIGIN");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'self'");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
  expect((await request.get("/api/health")).headers()["cache-control"]).toContain("no-store");
});

test("robots keeps private and per-outlet pages out of search", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  for (const path of ["/app", "/admin", "/staff", "/r/", "/api/"]) expect(body).toContain(`Disallow: ${path}`);
  expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("/admin opens the metrics cockpit instead of a 404", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/metrics$/);
});

test("cross-origin cookie writes are refused", async ({ request }) => {
  const res = await request.post("/api/app/auth/logout", {
    headers: { cookie: "session_token=x", origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  });
  expect(res.status()).toBe(403);
});

test("a low rating can go back and change the rating (mis-tapped star)", async ({ page }) => {
  await page.goto(`/r/${SLUG}/review`);
  await page.getByRole("button", { name: "Rate 1 out of 5 stars" }).click();
  await expect(page.getByRole("button", { name: "Post publicly on Google" })).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByRole("heading", { name: "How was your visit?" })).toBeVisible();
  await page.getByRole("button", { name: "Rate 5 out of 5 stars" }).click();
  await expect(page.getByRole("heading", { name: "What stood out?" })).toBeVisible();
});
