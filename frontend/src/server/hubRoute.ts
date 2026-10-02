/** Shared plumbing for the /api/app/outlets/[outletId]/hub/... route handlers. */
import { z } from "zod";

import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { HttpError } from "@/server/http";
import { HubConfigError, requireOwnOutlet, toHttpError } from "@/server/services/hubConfig";

export type OutletCtx = { params: Promise<{ outletId: string }> };

/**
 * Same order as the FastAPI dependencies: session (401), then the path id
 * (422 if malformed), then ownership (403). Body validation comes after.
 */
export async function ownOutlet(request: Request, ctx: { params: Promise<{ outletId: string }> }) {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const { outletId } = await ctx.params;
  if (!z.guid().safeParse(outletId).success) throw new HttpError(422, "VALIDATION_ERROR");
  return { db, owner, outlet: await requireOwnOutlet(db, owner, outletId) };
}

/** A malformed child id in the path is a 422, like pydantic's UUID path type. */
export function guidParam(value: string): string {
  if (!z.guid().safeParse(value).success) throw new HttpError(422, "VALIDATION_ERROR");
  return value;
}

/** Run a service call, turning HubConfigError into the API error shape. */
export async function mapHubErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HubConfigError) throw toHttpError(e);
    throw e;
  }
}

export const noContent = () => new Response(null, { status: 204 });
