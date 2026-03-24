import type { NextConfig } from "next";

// Proxies /api/* to the FastAPI backend so owner-session cookies are
// same-origin from the browser's perspective. Cross-origin cookies (frontend
// on :3000, backend on :8000) require SameSite=None + Secure, which browsers
// refuse to honor over plain HTTP in local dev — same-origin avoids the
// whole problem and matches how this will be deployed anyway (one public
// origin fronting both services, or a shared parent domain).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
      // Owner-uploaded images (menu photos, cover) are served by the backend.
      {
        source: "/uploads/:path*",
        destination: `${API_BASE}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
