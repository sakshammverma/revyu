/**
 * Founder-only admin auth. Port of backend/app/core/admin_auth.py.
 *
 * v1 stopgap: a single shared bearer token compared against
 * ADMIN_SESSION_SECRET. Phase 3 of the Supabase plan replaces this with a
 * Supabase Auth user carrying an admin role; callers only use requireAdmin().
 */
import { timingSafeEqual } from "node:crypto";

import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";

export function requireAdmin(request: Request): void {
  const secret = getEnv().adminSessionSecret;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "UNAUTHORIZED");
  }
}
