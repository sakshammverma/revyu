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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Wraps a route handler: HttpError -> its status, anything else -> logged 500
 * with no detail leaked to the client.
 */
export function handler<C>(fn: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json(errorBody(err.code, err.message === err.code ? undefined : err.message), {
          status: err.status,
        });
      }
      console.error("Unhandled route error", err);
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
  if (getEnv().disableRateLimits) return;
  const key = `${name}:${clientIp(request)}`;
  const rows = await db.execute<{ ok: boolean }>(
    sql`select hit_rate_limit(${key}, ${limit}, ${windowSeconds}) as ok`,
  );
  if (rows[0]?.ok === false) throw new HttpError(429, "RATE_LIMITED");
}
