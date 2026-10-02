import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { POST as logout } from "@/app/api/app/auth/logout/route";
import { GET as magic } from "@/app/api/app/auth/magic/route";
import { POST as otpRequest } from "@/app/api/app/auth/otp/request/route";
import { POST as otpVerify } from "@/app/api/app/auth/otp/verify/route";
import { hashToken, requireOwner, resolveOwnerSession } from "@/server/auth/owner";
import { schema, type DbLike } from "@/server/db";
import { inRolledBackTx, makeAccount, makeRequest } from "@/server/testing/helpers";
import {
  findAccountByEmail,
  issueSession,
  normalizeEmail,
  OTP_MAX_ATTEMPTS,
  OTP_REQUEST_MAX_PER_WINDOW,
  requestOtp,
  revokeSession,
  verifyMagicLink,
  verifyOtp,
} from "./ownerAuth";

const { notifications, otpCodes, ownerSessions } = schema;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

describe("sessions", () => {
  it("stores only the hash and can be revoked", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const { rawToken } = await issueSession(db, account);
      const [row] = await db.select().from(ownerSessions).where(eq(ownerSessions.accountId, account.id));
      expect(row.token).toBe(hashToken(rawToken));
      expect(row.token).not.toBe(rawToken);
      expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/); // same shape as secrets.token_urlsafe(32)
      expect((await resolveOwnerSession(db, rawToken))?.id).toBe(account.id);
      await revokeSession(db, rawToken);
      expect(await resolveOwnerSession(db, rawToken)).toBeNull();
    }));
});

describe("email lookup", () => {
  it("normalises the domain only, like pydantic EmailStr", () => {
    expect(normalizeEmail("Owner.Name@EXAMPLE.Com")).toBe("Owner.Name@example.com");
  });

  it("finds an account regardless of the domain's case", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const [local, domain] = account.ownerEmail.split("@");
      expect((await findAccountByEmail(db, `${local}@${domain.toUpperCase()}`))?.id).toBe(account.id);
      expect(await findAccountByEmail(db, "nobody@example.com")).toBeNull();
    }));
});

describe("OTP", () => {
  it("accepts the right code once and issues a session", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const issued = (await requestOtp(db, account))!;
      const first = await verifyOtp(db, account, issued.code);
      expect(first.ok).toBe(true);
      expect(await verifyOtp(db, account, issued.code)).toEqual({ ok: false, reason: "invalid" }); // single use
    }));

  it("persists wrong guesses and locks after five (the Python never did)", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const { code } = (await requestOtp(db, account))!;
      const wrong = code === "000000" ? "111111" : "000000";
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        expect(await verifyOtp(db, account, wrong)).toEqual({ ok: false, reason: "invalid" });
      }
      const [row] = await db.select().from(otpCodes).where(eq(otpCodes.accountId, account.id));
      expect(row.attempts).toBe(OTP_MAX_ATTEMPTS);
      // Even the correct code is refused once the budget is spent.
      expect(await verifyOtp(db, account, code)).toEqual({ ok: false, reason: "attempts_exceeded" });
    }));

  it("rejects an expired code and unknown accounts", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const { code } = (await requestOtp(db, account))!;
      const later = new Date(Date.now() + 11 * 60 * 1000);
      expect(await verifyOtp(db, account, code, later)).toEqual({ ok: false, reason: "invalid" });
      const other = await makeAccount(db, "b");
      expect(await verifyOtp(db, other, "123456")).toEqual({ ok: false, reason: "invalid" });
    }));

  it("allows three requests per 15 minutes, then silently stops", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      for (let i = 0; i < OTP_REQUEST_MAX_PER_WINDOW; i++) expect(await requestOtp(db, account)).not.toBeNull();
      expect(await requestOtp(db, account)).toBeNull();
    }));

  it("only the newest unconsumed code counts", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const older = (await requestOtp(db, account))!;
      // now() is frozen inside a transaction, so age the first code explicitly.
      await db.update(otpCodes).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(otpCodes.accountId, account.id));
      const newer = (await requestOtp(db, account))!;
      if (older.code !== newer.code) {
        expect((await verifyOtp(db, account, older.code)).ok).toBe(false);
      }
      expect((await verifyOtp(db, account, newer.code)).ok).toBe(true);
    }));
});

describe("magic link", () => {
  it("is hashed at rest and single use", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const { magicToken } = (await requestOtp(db, account))!;
      const [row] = await db.select().from(otpCodes).where(eq(otpCodes.accountId, account.id));
      expect(row.magicToken).toBe(hashToken(magicToken));
      const first = await verifyMagicLink(db, magicToken);
      expect(first.ok).toBe(true);
      expect(await verifyMagicLink(db, magicToken)).toEqual({ ok: false, reason: "invalid" });
      expect(await verifyMagicLink(db, "never-issued")).toEqual({ ok: false, reason: "invalid" });
    }));

  it("expires after ten minutes", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const { magicToken } = (await requestOtp(db, account))!;
      expect(await verifyMagicLink(db, magicToken, new Date(Date.now() + 11 * 60 * 1000))).toEqual({
        ok: false,
        reason: "invalid",
      });
    }));
});

describe("login over HTTP handlers", () => {
  const cookieOf = (res: Response) => res.headers.get("set-cookie") ?? "";
  const rawFrom = (res: Response) => /session_token=([^;]+)/.exec(cookieOf(res))![1];

  it("full journey: request code -> verify -> cookie authenticates -> logout revokes", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);

      const req = await otpRequest(makeRequest("/api/app/auth/otp/request", { body: { email: account.ownerEmail } }));
      expect(req.status).toBe(204);
      const [otp] = await tx.select().from(otpCodes).where(eq(otpCodes.accountId, account.id));
      const mail = await tx
        .select()
        .from(notifications)
        .where(and(eq(notifications.accountId, account.id), eq(notifications.template, "otp_login")));
      expect(mail).toHaveLength(1);

      const bad = await otpVerify(makeRequest("/api/app/auth/otp/verify", { body: { email: account.ownerEmail, code: "12345" } }));
      expect(bad.status).toBe(422); // not six digits

      const ok = await otpVerify(makeRequest("/api/app/auth/otp/verify", { body: { email: account.ownerEmail, code: otp.code } }));
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(Object.keys(body).sort()).toEqual(["expires_at", "session_token"]);
      const cookie = cookieOf(ok);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain(`Max-Age=${30 * 24 * 3600}`);
      expect(cookie).not.toContain("Secure"); // ENVIRONMENT=local
      const raw = rawFrom(ok);
      expect(body.session_token).toBe(raw);

      expect((await requireOwner(makeRequest("/api/app/x", { session: raw }), tx)).id).toBe(account.id);

      const out = await logout(makeRequest("/api/app/auth/logout", { method: "POST", session: raw }));
      expect(out.status).toBe(204);
      expect(cookieOf(out)).toContain("Max-Age=0");
      await expect(requireOwner(makeRequest("/api/app/x", { session: raw }), tx)).rejects.toMatchObject({ status: 401 });
    }));

  it("an unknown email gets the same 204 and a generic 400 on verify", () =>
    inTx(async () => {
      const res = await otpRequest(makeRequest("/api/app/auth/otp/request", { body: { email: "ghost@example.com" } }));
      expect(res.status).toBe(204);
      const verify = await otpVerify(makeRequest("/api/app/auth/otp/verify", { body: { email: "ghost@example.com", code: "123456" } }));
      expect(verify.status).toBe(400);
      expect(await verify.json()).toEqual({ detail: { error: { code: "OTP_INVALID" } } });
    }));

  it("a wrong code is 400 OTP_INVALID and the lockout answers 429", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      await otpRequest(makeRequest("/api/app/auth/otp/request", { body: { email: account.ownerEmail } }));
      const [otp] = await tx.select().from(otpCodes).where(eq(otpCodes.accountId, account.id));
      const wrong = otp.code === "000000" ? "111111" : "000000";
      const attempt = () =>
        otpVerify(makeRequest("/api/app/auth/otp/verify", { body: { email: account.ownerEmail, code: wrong } }));
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) expect((await attempt()).status).toBe(400);
      const locked = await attempt();
      expect(locked.status).toBe(429);
      expect(await locked.json()).toEqual({ detail: { error: { code: "OTP_ATTEMPTS_EXCEEDED" } } });
    }));

  it("the magic link logs in once", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const { magicToken } = (await requestOtp(tx, account))!;
      const res = await magic(makeRequest(`/api/app/auth/magic?token=${encodeURIComponent(magicToken)}`));
      expect(res.status).toBe(200);
      expect(cookieOf(res)).toContain("session_token=");
      const again = await magic(makeRequest(`/api/app/auth/magic?token=${encodeURIComponent(magicToken)}`));
      expect(again.status).toBe(400);
      expect((await magic(makeRequest("/api/app/auth/magic"))).status).toBe(422);
    }));
});
