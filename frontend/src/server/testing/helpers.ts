/**
 * Test helpers. Every test runs inside a transaction that is always rolled
 * back, so the dev database is left untouched (mirrors backend/tests/conftest.py).
 */
import { hashToken, SESSION_COOKIE } from "@/server/auth/owner";
import { getDb, schema, type DbLike } from "@/server/db";

class Rollback extends Error {}

export async function inRolledBackTx(fn: (tx: DbLike) => Promise<void>): Promise<void> {
  try {
    await getDb().transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

export async function makeAccount(db: DbLike, tag = "a") {
  const n = uid();
  const [account] = await db
    .insert(schema.accounts)
    .values({
      id: crypto.randomUUID(),
      ownerPhone: `+91${n}${tag}`,
      ownerEmail: `${tag}-${n}@example.com`,
      ownerName: `Owner ${tag}`,
      otpChannel: "email",
      currencyCode: "INR",
      paymentProvider: "razorpay",
    })
    .returning();
  return account;
}

export async function makeOutlet(
  db: DbLike,
  account: { id: string },
  overrides: Partial<typeof schema.outlets.$inferInsert> = {},
) {
  const [outlet] = await db
    .insert(schema.outlets)
    .values({
      id: crypto.randomUUID(),
      accountId: account.id,
      slug: `t-${uid()}${uid()}`,
      businessName: "Test Clinic",
      vertical: "dental",
      countryCode: "IN",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      state: "trial",
      source: "admin",
      placeVerified: false,
      placementConfirmed: false,
      trialFlowCount: 0,
      hubMode: "direct",
      googleReviewUrl: "https://search.google.com/local/writereview?placeid=TEST",
      ...overrides,
    })
    .returning();
  return outlet;
}

export async function makeSession(
  db: DbLike,
  outlet: { id: string },
  opts: { ageSeconds?: number; device?: string | null } = {},
) {
  const [session] = await db
    .insert(schema.sessions)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      deviceHash: opts.device === undefined ? crypto.randomUUID() : opts.device,
      completed: false,
      countedForTrial: false,
      startedAt: new Date(Date.now() - (opts.ageSeconds ?? 30) * 1000),
    })
    .returning();
  return session;
}

export async function addEvent(db: DbLike, outlet: { id: string }, sessionId: string | null, type: string) {
  await db.insert(schema.events).values({ outletId: outlet.id, sessionId, type });
}

/* ---------------------------------------------------------------- HTTP */

/** Insert a live owner session (hashed, like login does) and return the raw cookie value. */
export async function issueOwnerSession(db: DbLike, account: { id: string }): Promise<string> {
  const raw = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(schema.ownerSessions).values({
    id: crypto.randomUUID(),
    accountId: account.id,
    token: hashToken(raw),
    revoked: false,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return raw;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Raw session cookie value; omit for an anonymous request. */
  session?: string;
}

/** Build a Request the way the browser would send it to a route handler. */
export function makeRequest(path: string, opts: RequestOptions = {}): Request {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.session) headers.cookie = `${SESSION_COOKIE}=${opts.session}`;
  if (opts.body !== undefined) headers["content-type"] ??= "application/json";
  return new Request(new URL(path, "http://localhost:3000"), {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

/** Route handler context for dynamic segments: `routeCtx({ slug: "x" })`. */
export const routeCtx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
