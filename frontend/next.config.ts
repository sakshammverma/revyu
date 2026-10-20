import type { NextConfig } from "next";

// Applied to every response. Kept compatible with what the app actually does:
// the hub editor previews /r/* in a same-origin iframe (frame-ancestors
// 'self'), the staff console scans member QRs with the camera (camera=self),
// and Razorpay Checkout opens its own window from checkout.razorpay.com. A
// full script-src CSP is not set because Next injects inline bootstrap scripts
// and Razorpay loads remote ones; see documents/26-DEPLOYMENT.md.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
  // Vercel serves HTTPS only; browsers ignore this header over plain http (local dev).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// The API lives in this app (src/app/api/**), so there is nothing to proxy:
// the browser, the owner session cookie and the route handlers share one
// origin. (Until the Supabase migration finished this file rewrote /api/* to
// a FastAPI process; see documents/25-SUPABASE-MIGRATION-PLAN.md.)
const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Owner, admin, staff and API responses carry private data: never cache in shared caches.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
