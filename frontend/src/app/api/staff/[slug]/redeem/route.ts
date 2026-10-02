import { getDb } from "@/server/db";
import { handler, parseJson, rateLimit } from "@/server/http";
import { mapLoyaltyErrors, redeemBody, staffContext } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { redeem } from "@/server/services/loyalty";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "staff_redeem", 120, 3600, db);
  const { outlet, pinId } = await staffContext(db, request, slug);
  const body = await parseJson(request, redeemBody);
  return Response.json(await mapLoyaltyErrors(() => redeem(db, outlet.id, pinId, body.redeem_code)));
});
