import path from "node:path";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Server tests run against the dev database (DATABASE_URL in .env.local), each
// inside a transaction that is always rolled back - same approach as the
// pytest suite in backend/tests/conftest.py.
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      ...loadEnv(mode, process.cwd(), ""),
      // Hermetic: tests must never reach real providers, whatever keys a
      // developer keeps in .env.local (same rule as backend/tests/conftest.py,
      // which forces the mock payment provider).
      GOOGLE_PLACES_API_KEY: "",
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      RAZORPAY_WEBHOOK_SECRET: "",
      RAZORPAY_PLAN_ID_MONTHLY: "",
      RAZORPAY_PLAN_ID_ANNUAL: "",
      EMAIL_PROVIDER_API_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
}));
