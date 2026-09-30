import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// path.join yields the right separators for the platform (cmd.exe rejects "/").
const python =
  process.platform === "win32"
    ? path.join(".venv", "Scripts", "python.exe")
    : path.join(".venv", "bin", "python");

// Compliance + UX tests. They run against the real API with the seeded demo
// outlet (`python -m app.seeds.dev_outlet`, slug demo-dental).
//   npm run test:e2e
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
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `${python} -m uvicorn app.main:app --port 8000`,
      cwd: "../backend",
      env: { DISABLE_RATE_LIMITS: "true" },
      url: "http://localhost:8000/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
