import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";

/** Error body keeps FastAPI's shape so existing client code keeps working. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function errorBody(code: string, message?: string) {
  return { detail: { error: message ? { code, message } : { code } } };
}

/**
 * The caller's IP for rate limiting. Vercel sets x-vercel-forwarded-for and
 * x-real-ip itself (and overwrites a client-sent x-forwarded-for), so those win.
 * Behind any other proxy, make sure it overwrites x-real-ip, or every limit
 * keyed on IP can be bypassed with a forged header.
 */
export function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for cookie-authenticated writes. SameSite=Lax already stops
 * cross-site POSTs carrying the owner cookie in modern browsers; this also
 * refuses same-site-but-cross-origin ones (another subdomain) and old
 * browsers. Requests without the owner cookie (webhooks, beacons, staff and
 * wallet calls that use header tokens) are not affected.
 */
export function isCrossOriginCookieWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  if (!/(?:^|;\s*)session_token=/.test(request.headers.get("cookie") ?? "")) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = request.headers.get("origin");
  if (!origin) return false; // non-browser client: it can't hold a victim's cookie
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/**
 * Wraps a route handler: HttpError -> its status, anything else -> logged 500
 * with no detail leaked to the client.
 */
export function handler<C>(fn: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx?: C): Promise<Response> => {
    try {
      if (isCrossOriginCookieWrite(request)) throw new HttpError(403, "CROSS_ORIGIN");
      return await fn(request, ctx as C);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json(errorBody(err.code, err.message === err.code ? undefined : err.message), {
          status: err.status,
        });
      }
      console.error("Unhandled route error", request.method, new URL(request.url).pathname, err);
      return Response.json(errorBody("INTERNAL"), { status: 500 });
    }
  };
}

export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(422, "VALIDATION_ERROR");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, "VALIDATION_ERROR");
  return parsed.data;
}

/**
 * Shared per-IP rate limit (Postgres fixed window, see migration a7e3c91d4b05).
 * Replaces backend/app/core/ratelimit.py, which only worked inside one process.
 */
export async function rateLimit(
  request: Request,
  name: string,
  limit: number,
  windowSeconds: number,
  db: DbLike = getDb(),
): Promise<void> {
  await rateLimitKey(`${name}:${clientIp(request)}`, limit, windowSeconds, db);
}

/** Same fixed-window limiter with a caller-chosen key (per outlet, per email...). */
export async function rateLimitKey(key: string, limit: number, windowSeconds: number, db: DbLike = getDb()): Promise<void> {
  if (getEnv().disableRateLimits) return;
  const rows = await db.execute<{ ok: boolean }>(
    sql`select hit_rate_limit(${key}, ${limit}, ${windowSeconds}) as ok`,
  );
  if (rows[0]?.ok === false) throw new HttpError(429, "RATE_LIMITED");
}

/**
 * True when `key` already has `limit` hits in the current window. Does not
 * count a hit, so a lockout can count only failures (see staff PIN login).
 */
export async function rateLimitReached(key: string, limit: number, windowSeconds: number, db: DbLike = getDb()): Promise<boolean> {
  if (getEnv().disableRateLimits) return false;
  const rows = await db.execute<{ hits: number }>(
    sql`select hits from rate_limit_hits
        where key = ${key}
          and window_start = to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds})`,
  );
  return (rows[0]?.hits ?? 0) >= limit;
}
