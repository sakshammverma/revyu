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
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
}));
