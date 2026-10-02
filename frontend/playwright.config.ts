import { defineConfig, devices } from "@playwright/test";

// Compliance + UX tests. They run against the real API (Next route handlers)
// and the seeded demo outlet (slug demo-dental; seed with `python -m
// app.seeds.dev_outlet` from backend/, see CLAUDE.md).
//   npm run test:e2e
// There is no separate API process any more. Rate limits are disabled for the
// dev server because they persist in the database.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Specs share the seeded demo outlet (hub specs change its config), so one worker.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // The compliance boundary is measured on a small phone (SRS-17.1b).
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 640 },
  },
  webServer: {
    command: "npm run dev",
    env: { DISABLE_RATE_LIMITS: "true" },
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
