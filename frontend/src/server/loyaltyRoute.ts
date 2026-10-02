/** Shared plumbing for the wallet (/api/flow/[slug]/rewards/...) and staff (/api/staff/[slug]/...) routes. */
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { LoyaltyError, memberByToken, readStaffToken } from "@/server/services/loyalty";
import { requireOutlet, type Outlet } from "@/server/services/flow";

/** LoyaltyError -> 422 `{detail:{error:{code,message}}}`, with per-code status overrides. */
export async function mapLoyaltyErrors<T>(fn: () => Promise<T>, statusByCode: Record<string, number> = {}): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LoyaltyError) throw new HttpError(statusByCode[e.code] ?? 422, e.code, e.message);
    throw e;
  }
}

export async function rewardsModuleOn(db: DbLike, outlet: Pick<Outlet, "id">): Promise<boolean> {
  const [row] = await db
    .select({ enabled: schema.outletModules.enabled, available: schema.outletModules.available })
    .from(schema.outletModules)
    .where(and(eq(schema.outletModules.outletId, outlet.id), eq(schema.outletModules.module, "rewards")))
    .limit(1);
  return Boolean(row && row.enabled && row.available);
}

/** The wallet owner for this request (X-Wallet-Token), or 401 NO_WALLET. */
export async function walletMember(db: DbLike, outlet: Pick<Outlet, "id">, request: Request) {
  const token = request.headers.get("x-wallet-token");
  const member = token ? await memberByToken(db, outlet.id, token) : null;
  if (!member) throw new HttpError(401, "NO_WALLET");
  return member;
}

/** Outlet from the slug (404) plus the staff bearer token bound to it (401). */
export async function staffContext(db: DbLike, request: Request, slug: string) {
  const outlet = await requireOutlet(db, slug);
  const header = request.headers.get("authorization") ?? "";
  const raw = (header.startsWith("Bearer ") ? header.slice(7) : header).trim();
  const parsed = readStaffToken(raw);
  if (!parsed || parsed.outletId !== outlet.id) throw new HttpError(401, "UNAUTHORIZED");
  return { outlet, pinId: parsed.pinId };
}

export const joinBody = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  consent: z.boolean().default(false),
});
export const claimBody = z.object({ phone: z.string().min(6).max(20), code: z.string().regex(/^\d{6}$/) });
export const staffLoginBody = z.object({ pin: z.string().regex(/^\d{4,6}$/) });
export const visitBody = z.object({ code: z.string().min(3).max(20) });
export const redeemBody = z.object({ redeem_code: z.string().min(4).max(12) });

/** FastAPI's bool query parsing for `?active=`. */
export function parseBoolQuery(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "t", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "f", "no", "n", "off"].includes(v)) return false;
  throw new HttpError(422, "VALIDATION_ERROR");
}
