import { describe, expect, it, vi } from "vitest";

// .env.local turns rate limits off for local dev and e2e; these tests exercise the limiter itself.
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return { ...actual, getEnv: () => ({ ...actual.getEnv(), disableRateLimits: false }) };
});

import { requireAdmin } from "@/server/auth/admin";
import { hashToken, readCookie, requireOwner, resolveOwnerSession } from "@/server/auth/owner";
import { schema } from "@/server/db";
import { loadEnv, normalizeDatabaseUrl } from "@/server/env";
import { clientIp, handler, HttpError, parseJson, rateLimit } from "@/server/http";
import { render, TEMPLATES } from "@/server/notifications/templates";
import { normalisePhone } from "@/server/notifications";
import { eventsBody, feedbackBody, sessionBody } from "@/server/schemas";
import { inRolledBackTx, makeAccount } from "@/server/testing/helpers";

const { ownerSessions } = schema;

const req = (headers: Record<string, string> = {}, body?: unknown) =>
  new Request("http://localhost/api/x", {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("env", () => {
  it("normalises Python and Supabase URLs to a plain postgresql:// URL", () => {
    expect(normalizeDatabaseUrl("postgresql+psycopg://u:p@h:5432/d")).toBe("postgresql://u:p@h:5432/d");
    expect(normalizeDatabaseUrl("postgres://u:p@h:5432/d")).toBe("postgresql://u:p@h:5432/d");
  });

  it("prefers DATABASE_POOL_URL (the transaction pooler) when set", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://a@s/d", DATABASE_POOL_URL: "postgresql://a@p/d" });
    expect(env.databaseUrl).toBe("postgresql://a@p/d");
  });

  it("local boot allows defaults", () => {
    expect(loadEnv({ DATABASE_URL: "postgresql://a@h/d" }).isLocal).toBe(true);
  });

  it("any other environment refuses default secrets and missing keys", () => {
    expect(() => loadEnv({ ENVIRONMENT: "production", DATABASE_URL: "postgresql://a@h/d" })).toThrow(
      /ADMIN_SESSION_SECRET[\s\S]*RAZORPAY_KEY_ID[\s\S]*EMAIL_PROVIDER_API_KEY/,
    );
  });

  it("requires a database URL", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL is required/);
  });

  it("DISABLE_RATE_LIMITS is only honoured locally", () => {
    const prod = {
      ENVIRONMENT: "production",
      DATABASE_URL: "postgresql://a@h/d",
      ADMIN_SESSION_SECRET: "x".repeat(32),
      AUTH_SECRET: "y".repeat(32),
      CRON_SECRET: "z".repeat(32),
      FRONTEND_BASE_URL: "https://revyu.example.com",
      PUBLIC_FLOW_BASE_URL: "https://revyu.example.com",
      RAZORPAY_KEY_ID: "k",
      RAZORPAY_KEY_SECRET: "k",
      RAZORPAY_WEBHOOK_SECRET: "k",
      GOOGLE_PLACES_API_KEY: "k",
      EMAIL_PROVIDER_API_KEY: "k",
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      DISABLE_RATE_LIMITS: "true",
    };
    expect(loadEnv(prod).disableRateLimits).toBe(false);
    expect(loadEnv({ DATABASE_URL: "postgresql://a@h/d", DISABLE_RATE_LIMITS: "true" }).disableRateLimits).toBe(true);
  });
});

describe("rate limiter (shared across instances via Postgres)", () => {
  it("blocks after the limit and keys per IP and name", () =>
    inRolledBackTx(async (db) => {
      const name = `t${crypto.randomUUID().slice(0, 8)}`;
      const from = (ip: string) => req({ "x-forwarded-for": ip });
      await rateLimit(from("1.1.1.1"), name, 2, 60, db);
      await rateLimit(from("1.1.1.1"), name, 2, 60, db);
      await expect(rateLimit(from("1.1.1.1"), name, 2, 60, db)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
      await rateLimit(from("2.2.2.2"), name, 2, 60, db); // another client is unaffected
      await rateLimit(from("1.1.1.1"), `${name}-other`, 2, 60, db); // another limiter is unaffected
    }));

  it("takes the first address of x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(req())).toBe("unknown");
  });
});

describe("admin auth", () => {
  it("accepts only the exact bearer secret", async () => {
    const { getEnv } = await import("@/server/env");
    const secret = getEnv().adminSessionSecret;
    expect(() => requireAdmin(req({ authorization: `Bearer ${secret}` }))).not.toThrow();
    for (const bad of ["", "Bearer nope", `bearer ${secret}`, `Bearer ${secret}x`, secret]) {
      expect(() => requireAdmin(req(bad ? { authorization: bad } : {}))).toThrow(HttpError);
    }
  });
});

describe("owner session", () => {
  it("parses cookies", () => {
    const r = req({ cookie: "a=1; session_token=abc%2Bdef; b=2" });
    expect(readCookie(r, "session_token")).toBe("abc+def");
    expect(readCookie(r, "missing")).toBeNull();
    expect(readCookie(req(), "session_token")).toBeNull();
  });

  it("resolves a hashed session, and refuses revoked or expired ones", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const make = async (over: Partial<typeof ownerSessions.$inferInsert>) => {
        const raw = crypto.randomUUID();
        await db.insert(ownerSessions).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          token: hashToken(raw),
          revoked: false,
          expiresAt: new Date(Date.now() + 86_400_000),
          ...over,
        });
        return raw;
      };
      expect((await resolveOwnerSession(db, await make({})))?.id).toBe(account.id);
      expect(await resolveOwnerSession(db, await make({ revoked: true }))).toBeNull();
      expect(await resolveOwnerSession(db, await make({ expiresAt: new Date(Date.now() - 1000) }))).toBeNull();
      expect(await resolveOwnerSession(db, "never-issued")).toBeNull();

      const raw = await make({});
      expect((await requireOwner(req({ cookie: `session_token=${raw}` }), db)).id).toBe(account.id);
      await expect(requireOwner(req(), db)).rejects.toMatchObject({ status: 401 });
    }));

  it("matches the hash the Python backend stores (sha256 hex)", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("request schemas (mirror the pydantic models)", () => {
  const id = crypto.randomUUID();
  it("session", () => {
    expect(sessionBody.safeParse({ session_id: id }).success).toBe(true);
    expect(sessionBody.safeParse({ session_id: id, device_hash: null }).success).toBe(true);
    expect(sessionBody.safeParse({ session_id: id, device_hash: "x".repeat(129) }).success).toBe(false);
    expect(sessionBody.safeParse({ session_id: "nope" }).success).toBe(false);
  });
  it("feedback", () => {
    expect(feedbackBody.safeParse({ session_id: id, message: "ok" }).success).toBe(true);
    expect(feedbackBody.safeParse({ session_id: id, message: "ok", rating: 5, contact: null }).success).toBe(true);
    expect(feedbackBody.safeParse({ session_id: id, message: "ok", rating: 6 }).success).toBe(false);
    expect(feedbackBody.safeParse({ session_id: id, message: "ok", rating: 0 }).success).toBe(false);
    expect(feedbackBody.safeParse({ session_id: id, message: "x".repeat(2001) }).success).toBe(false);
    expect(feedbackBody.safeParse({ session_id: id }).success).toBe(false);
  });
  it("events", () => {
    const ok = { outlet_id: id, events: [{ type: "scan", payload: {} }] };
    expect(eventsBody.safeParse(ok).success).toBe(true);
    expect(eventsBody.safeParse({ ...ok, session_id: null }).success).toBe(true);
    expect(eventsBody.safeParse({ ...ok, events: Array(51).fill({ type: "scan" }) }).success).toBe(false);
    expect(eventsBody.safeParse({ ...ok, events: [{ type: "x".repeat(41) }] }).success).toBe(false);
  });
});

describe("handler wrapper", () => {
  it("maps HttpError to its status with FastAPI's error shape", async () => {
    const res = await handler(async () => {
      throw new HttpError(404, "OUTLET_NOT_FOUND");
    })(req(), undefined);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: { error: { code: "OUTLET_NOT_FOUND" } } });
  });

  it("hides unexpected errors behind a bare 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handler(async () => {
      throw new Error("db password is hunter2");
    })(req(), undefined);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    log.mockRestore();
  });

  it("422s a malformed JSON body", async () => {
    const bad = new Request("http://localhost/x", { method: "POST", body: "{nope" });
    await expect(parseJson(bad, sessionBody)).rejects.toMatchObject({ status: 422 });
  });
});

describe("notification templates", () => {
  it("every template renders", () => {
    const data = { business_name: "Acme", code: "123456", magic_link: "m", payment_link: "p", credits_left: 3, days_left: 2 };
    for (const t of TEMPLATES) {
      const [subject, body] = render(t, data);
      expect(subject.length).toBeGreaterThan(0);
      expect(body.length).toBeGreaterThan(0);
    }
  });

  it("matches the Python wording for the lifecycle emails", () => {
    expect(render("credits_low", { business_name: "Acme", credits_left: 3, payment_link: "L" })).toEqual([
      "Only a few Revyu reviews left before collection pauses",
      "Acme can collect 3 more reviews before the QR shows a neutral page. Unlock now to keep collecting: L",
    ]);
    expect(render("private_feedback_received", { business_name: "Acme" })[1]).toContain("Rating: n/a.");
    expect(() => render("nope", {})).toThrow();
  });

  it("normalises phones for click-to-chat", () => {
    expect(normalisePhone("+91 98765-43210")).toBe("919876543210");
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
  });
});
