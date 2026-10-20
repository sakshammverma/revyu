import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Visitors to the owner dashboard with no session cookie at all go straight to login,
// instead of downloading the dashboard, waiting for a 401 and then being sent there.
// A cookie that is present but expired still gets the client-side redirect (with ?next=).
// This is a convenience, never the access check: every owner API route verifies the session.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/app/login") || pathname.startsWith("/app/auth")) return NextResponse.next();
  const login = new URL("/app/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // `session_token` is SESSION_COOKIE in src/server/auth/owner.ts (not imported: proxy stays self-contained).
  matcher: [{ source: "/app/:path*", missing: [{ type: "cookie", key: "session_token" }] }],
};
