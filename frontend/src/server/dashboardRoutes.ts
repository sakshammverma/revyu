import { z } from "zod";

import { requireOwner, type Account } from "@/server/auth/owner";
import { getDb, type Db } from "@/server/db";
import { HttpError, handler } from "@/server/http";
import { getOwnOutletOr403, type Outlet } from "@/server/services/dashboard";

export type OutletContext = { params: Promise<{ outletId: string }> };

/** FastAPI answers a malformed UUID path param with 422 (after auth has passed). */
export function requireUuid(value: string): string {
  if (!z.guid().safeParse(value).success) throw new HttpError(422, "VALIDATION_ERROR");
  return value;
}

/** Owner-authenticated GET scoped to /api/app/outlets/[outletId]/..., 403 unless the outlet is theirs (SRS-15.6). */
export function outletGet<T>(build: (db: Db, outlet: Outlet, request: Request, owner: Account) => Promise<T>) {
  return handler(async (request: Request, { params }: OutletContext) => {
    const { outletId } = await params;
    const db = getDb();
    const owner = await requireOwner(request, db);
    requireUuid(outletId);
    const outlet = await getOwnOutletOr403(db, owner.id, outletId);
    return Response.json(await build(db, outlet, request, owner));
  });
}
