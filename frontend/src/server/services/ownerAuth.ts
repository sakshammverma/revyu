/**
 * Owner login: email + OTP, no password (SRS-10.1, OD-16). Port of
 * backend/app/services/owner_auth.py + backend/app/api/auth.py.
 *
 * 6-digit code, 10-minute expiry, max 5 attempts (SRS-10.2). A single-use magic
 * link ships alongside the code (SRS-10.1a). Sessions last 30 days and are
 * revocable (SRS-10.3). Codes, magic tokens and session tokens are stored
 * hashed or single-use; only the holder of the raw value can use them.
 */
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { hashToken } from "@/server/auth/owner";
import { schema, type DbLike } from "@/server/db";

const { accounts, otpCodes, ownerSessions } = schema;

export type Account = typeof accounts.$inferSelect;

export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const OTP_REQUEST_MAX_PER_WINDOW = 3;
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_MAX_AGE = SESSION_DURATION_MS / 1000;

/** Lower-cases the domain like pydantic's EmailStr, so lookups match what signup stored. */
export function normalizeEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? email : email.slice(0, at) + "@" + email.slice(at + 1).toLowerCase();
}

export async function findAccountByEmail(db: DbLike, email: string): Promise<Account | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.ownerEmail, normalizeEmail(email)))
    .limit(1);
  return account ?? null;
}

/**
 * Returns the code and magic token, or null when this account has asked for
 * too many codes recently. Callers must treat null exactly like "unknown
 * email" (a 429 would reveal that the address is registered).
 */
export async function requestOtp(
  db: DbLike,
  account: Pick<Account, "id">,
  now: Date = new Date(),
): Promise<{ code: string; magicToken: string } | null> {
  const recent = await db
    .select({ id: otpCodes.id })
    .from(otpCodes)
    .where(and(eq(otpCodes.accountId, account.id), gte(otpCodes.createdAt, new Date(now.getTime() - OTP_REQUEST_WINDOW_MS))));
  if (recent.length >= OTP_REQUEST_MAX_PER_WINDOW) return null;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const magicToken = randomBytes(32).toString("base64url");
  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    accountId: account.id,
    code,
    magicToken: hashToken(magicToken),
    attempts: 0,
    consumed: false,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
  });
  return { code, magicToken };
}

export interface IssuedSession {
  rawToken: string;
  expiresAt: Date;
}

export async function issueSession(db: DbLike, account: Pick<Account, "id">, now: Date = new Date()): Promise<IssuedSession> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  await db.insert(ownerSessions).values({
    id: crypto.randomUUID(),
    accountId: account.id,
    token: hashToken(rawToken),
    revoked: false,
    expiresAt,
  });
  return { rawToken, expiresAt };
}

export type VerifyResult =
  | { ok: true; session: IssuedSession }
  | { ok: false; reason: "invalid" | "attempts_exceeded" };

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Not transactional on purpose: a wrong guess must persist its attempt count
 * even though the request then fails. (The Python version incremented
 * `attempts` and then raised, which rolled the increment back, so the
 * 5-attempt lockout never engaged.)
 */
export async function verifyOtp(
  db: DbLike,
  account: Pick<Account, "id">,
  code: string,
  now: Date = new Date(),
): Promise<VerifyResult> {
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.accountId, account.id), eq(otpCodes.consumed, false)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) return { ok: false, reason: "invalid" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "attempts_exceeded" };
  if (now > otp.expiresAt) return { ok: false, reason: "invalid" };

  if (!safeEqual(otp.code, code)) {
    await db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, otp.id));
    return { ok: false, reason: "invalid" };
  }
  // Single use, even under a race between two correct submissions.
  const claimed = await db
    .update(otpCodes)
    .set({ consumed: true })
    .where(and(eq(otpCodes.id, otp.id), eq(otpCodes.consumed, false)))
    .returning({ id: otpCodes.id });
  if (claimed.length === 0) return { ok: false, reason: "invalid" };
  return { ok: true, session: await issueSession(db, account, now) };
}

export async function verifyMagicLink(db: DbLike, magicToken: string, now: Date = new Date()): Promise<VerifyResult> {
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.magicToken, hashToken(magicToken)), eq(otpCodes.consumed, false)))
    .limit(1);
  if (!otp || now > otp.expiresAt) return { ok: false, reason: "invalid" };

  const claimed = await db
    .update(otpCodes)
    .set({ consumed: true })
    .where(and(eq(otpCodes.id, otp.id), eq(otpCodes.consumed, false)))
    .returning({ id: otpCodes.id });
  if (claimed.length === 0) return { ok: false, reason: "invalid" };
  return { ok: true, session: await issueSession(db, { id: otp.accountId }, now) };
}

export async function revokeSession(db: DbLike, rawToken: string): Promise<void> {
  await db.update(ownerSessions).set({ revoked: true }).where(eq(ownerSessions.token, hashToken(rawToken)));
}

/** Set-Cookie value for a freshly issued session (httponly, lax, 30 days, secure outside local). */
export function sessionCookie(rawToken: string, secure: boolean): string {
  return [
    `session_token=${rawToken}`,
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export const clearedSessionCookie = (): string =>
  "session_token=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";
