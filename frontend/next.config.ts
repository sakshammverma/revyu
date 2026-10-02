import type { NextConfig } from "next";

// The API lives in this app (src/app/api/**), so there is nothing to proxy:
// the browser, the owner session cookie and the route handlers share one
// origin. (Until the Supabase migration finished this file rewrote /api/* to
// a FastAPI process; see documents/25-SUPABASE-MIGRATION-PLAN.md.)
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
};

export default nextConfig;
