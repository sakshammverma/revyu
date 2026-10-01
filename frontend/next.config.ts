import type { NextConfig } from "next";

// Proxies /api/* to the FastAPI backend so owner-session cookies are
// same-origin from the browser's perspective. Cross-origin cookies (frontend
// on :3000, backend on :8000) require SameSite=None + Secure, which browsers
// refuse to honor over plain HTTP in local dev — same-origin avoids the
// whole problem and matches how this will be deployed anyway (one public
// origin fronting both services, or a shared parent domain).
// 127.0.0.1, not localhost: Node resolves localhost to ::1 first and uvicorn
// only listens on IPv4, which made every proxied call fail with ECONNREFUSED.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
  async rewrites() {
    // `fallback`, not a plain array: a plain array is `afterFiles`, which runs
    // BEFORE dynamic routes, so `/api/:path*` would swallow route handlers like
    // /api/flow/[slug]/config. Fallback rewrites only apply to paths no route
    // handler claimed, which is exactly the strangler seam: endpoints already
    // ported to Next route handlers are served here, everything else still
    // proxies to FastAPI until documents/25-SUPABASE-MIGRATION-PLAN.md is done.
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${API_BASE}/api/:path*`,
        },
        // Owner-uploaded images (menu photos, cover) are served by the backend.
        {
          source: "/uploads/:path*",
          destination: `${API_BASE}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
