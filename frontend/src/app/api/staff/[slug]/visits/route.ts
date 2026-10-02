import { getDb } from "@/server/db";
import { handler, HttpError, parseJson, rateLimit } from "@/server/http";
import { mapLoyaltyErrors, staffContext, visitBody } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { recordVisit } from "@/server/services/loyalty";
import { isCollecting } from "@/server/services/outletState";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "staff_visit", 120, 3600, db);
  const { outlet, pinId } = await staffContext(db, request, slug);
  const body = await parseJson(request, visitBody);
  if (!isCollecting(outlet.state)) throw new HttpError(403, "PAUSED");
  return Response.json(await mapLoyaltyErrors(() => recordVisit(db, outlet.id, pinId, body.code)));
});
