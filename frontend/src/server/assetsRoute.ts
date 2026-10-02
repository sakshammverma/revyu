/** Outlet lookup for the QR / print-asset endpoints (backend/app/api/assets.py). */
import { z } from "zod";

import type { Account } from "@/server/auth/owner";
import type { DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { requireOwnOutlet } from "@/server/services/hubConfig";

export async function requireAssetOutlet(db: DbLike, owner: Pick<Account, "id">, outletId: string) {
  if (!z.guid().safeParse(outletId).success) throw new HttpError(422, "VALIDATION_ERROR");
  const outlet = await requireOwnOutlet(db, owner, outletId);
  // No QR/print assets exist before approval (SRS-18.7).
  if (outlet.slug.startsWith("pending-")) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}
