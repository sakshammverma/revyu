/**
 * Access to the in-shop sales demo (/marketing and /api/marketing/*).
 *
 * Two bearer tokens open it: the founder's ADMIN_SESSION_SECRET, or the shared
 * field-agent SALES_DEMO_PIN when that is set. The tool only reads public Google
 * data, but every lookup is a billed Places call, which is what this guards.
 *
 * Wrong guesses are capped with a failure-only lockout, made race-free by
 * reserve-then-release: every non-empty token first takes a hit atomically
 * (hit_rate_limit) on its network's key and on a global key, and only a token
 * that matches gives the hits back. So a burst of parallel guesses can't all
 * read "under the limit" before any miss is written, and a presenter who types
 * the PIN right is never counted. IPv6 callers are bucketed by their /64, so
 * rotating addresses inside one allocation doesn't buy more guesses.
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { clientIp, HttpError } from "@/server/http";

const WINDOW_SECONDS = 3600;
/** Wrong tokens per network per hour. */
const FAILS_PER_HOUR = 10;
/** Wrong tokens per hour across every network: bounds a distributed guess. */
const GLOBAL_FAILS_PER_HOUR = 100;
const GLOBAL_KEY = "sales_pin_fail:all";

/** Constant-time equality that also hides the expected length (both sides hashed first). */
function sameSecret(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Expands an IPv6 address to its 8 hextets ("" when it isn't one we can parse). */
function ipv6Hextets(ip: string): string[] | null {
  let addr = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  // An embedded IPv4 tail (::ffff:1.2.3.4) becomes two hextets.
  const v4 = addr.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    addr = addr.slice(0, v4.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const all = [...head, ...Array<string>(fill).fill("0"), ...tail];
  if (all.length !== 8 || !all.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return all.map((h) => h.replace(/^0+(?=.)/, ""));
}

/** The lockout bucket for a client address: the /64 for IPv6, the address itself for IPv4. */
export function networkBucket(ip: string): string {
  if (!ip.includes(":")) return ip;
  const hextets = ipv6Hextets(ip);
  return hextets ? `${hextets.slice(0, 4).join(":")}::/64` : ip;
}

/** Takes one hit on `key` atomically; false when that hit is over the limit. */
async function take(key: string, limit: number, db: DbLike): Promise<boolean> {
  const rows = await db.execute<{ ok: boolean }>(sql`select hit_rate_limit(${key}, ${limit}, ${WINDOW_SECONDS}) as ok`);
  return rows[0]?.ok !== false;
}

/** Gives back a hit taken by `take` in the current window. */
async function giveBack(key: string, db: DbLike): Promise<void> {
  await db.execute(
    sql`update rate_limit_hits set hits = hits - 1
        where key = ${key}
          and hits > 0
          and window_start = to_timestamp(floor(extract(epoch from now()) / ${WINDOW_SECONDS}) * ${WINDOW_SECONDS})`,
  );
}

export async function requireSales(request: Request, db: DbLike = getDb()): Promise<"admin" | "sales"> {
  const { adminSessionSecret, salesDemoPin, disableRateLimits } = getEnv();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  // No token, no guess: nothing to count.
  if (!token) throw new HttpError(401, "UNAUTHORIZED");

  const netKey = `sales_pin_fail:${networkBucket(clientIp(request))}`;
  const taken: string[] = [];
  if (!disableRateLimits) {
    const netOk = await take(netKey, FAILS_PER_HOUR, db);
    taken.push(netKey);
    const allOk = netOk && (await take(GLOBAL_KEY, GLOBAL_FAILS_PER_HOUR, db));
    if (netOk) taken.push(GLOBAL_KEY);
    if (!allOk) {
      // Locked out: this token is never compared, so it isn't a guess either.
      for (const key of taken) await giveBack(key, db);
      throw new HttpError(429, "RATE_LIMITED", "Too many wrong PINs. Try again in an hour.");
    }
  }

  // Compare against both every time, so the response time doesn't say which one matched.
  const isAdmin = sameSecret(token, adminSessionSecret);
  const isSales = sameSecret(token, salesDemoPin);
  const role = isAdmin ? "admin" : isSales ? "sales" : null;
  if (!role) throw new HttpError(401, "UNAUTHORIZED");
  for (const key of taken) await giveBack(key, db);
  return role;
}
