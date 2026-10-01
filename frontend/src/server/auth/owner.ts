/**
 * Owner session resolution. Port of backend/app/services/owner_auth.py
 * (resolve_session) and backend/app/core/owner_auth_dep.py. Reads the same
 * `session_token` cookie and `owner_sessions` rows the Python login issues, so
 * an owner logged in through FastAPI is recognised here. Phase 3 swaps the
 * implementation for Supabase Auth; callers only use requireOwner().
 *
 * Tokens are stored hashed (sha256); only the holder of the raw cookie value
 * can use a session.
 */
import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb, schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";

const { accounts, ownerSessions } = schema;

export type Account = typeof accounts.$inferSelect;

export const SESSION_COOKIE = "session_token";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export async function resolveOwnerSession(db: DbLike, rawToken: string, now: Date = new Date()): Promise<Account | null> {
  const [session] = await db
    .select()
    .from(ownerSessions)
    .where(eq(ownerSessions.token, hashToken(rawToken)))
    .limit(1);
  if (!session || session.revoked || now > session.expiresAt) return null;
  const [account] = await db.select().from(accounts).where(eq(accounts.id, session.accountId)).limit(1);
  return account ?? null;
}

/** SRS-15.6: owners access only their own outlet's data, enforced server-side. */
export async function requireOwner(request: Request, db: DbLike = getDb()): Promise<Account> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) throw new HttpError(401, "UNAUTHORIZED");
  const account = await resolveOwnerSession(db, token);
  if (!account) throw new HttpError(401, "UNAUTHORIZED");
  return account;
}
