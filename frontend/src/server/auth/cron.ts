/**
 * Auth for /api/cron/*. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the CRON_SECRET env var is set; pg_cron / curl callers
 * send the same header. An unset secret refuses every call.
 */
import { timingSafeEqual } from "node:crypto";

import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";

export function requireCron(request: Request): void {
  const secret = getEnv().cronSecret;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "UNAUTHORIZED");
  }
}
