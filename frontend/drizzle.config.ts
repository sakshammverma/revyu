import { defineConfig } from "drizzle-kit";

// Used only for `drizzle-kit pull` (introspection). Migrations stay in Alembic
// until the Python backend is retired (documents/25-SUPABASE-MIGRATION-PLAN.md).
export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle-introspect",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
