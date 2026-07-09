/**
 * Base URL for backend calls.
 *
 * In the browser we call same-origin `/api/*`, which next.config.ts rewrites to
 * the FastAPI backend. That keeps the owner session cookie first-party and
 * avoids CORS preflights entirely (PUT from the admin tag editor, sendBeacon
 * with a JSON body from the flow). On the server (RSC / route handlers) there
 * is no origin to be relative to, so we hit the backend directly.
 */
export const API_BASE =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000" : "";
