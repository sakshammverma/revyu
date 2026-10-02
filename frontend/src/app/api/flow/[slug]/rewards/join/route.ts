import { getDb } from "@/server/db";
import { handler, HttpError, parseJson, rateLimit } from "@/server/http";
import { joinBody, mapLoyaltyErrors, rewardsModuleOn } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { requireOutlet } from "@/server/services/flow";
import { join, wallet } from "@/server/services/loyalty";
import { isCollecting } from "@/server/services/outletState";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "loyalty_join", 20, 3600, db);
  const body = await parseJson(request, joinBody);
  const outlet = await requireOutlet(db, slug);
  if (!(isCollecting(outlet.state) && (await rewardsModuleOn(db, outlet)))) throw new HttpError(404, "NOT_AVAILABLE");
  const { member, token } = await mapLoyaltyErrors(() => join(db, outlet.id, body.name, body.phone, body.consent), {
    PHONE_EXISTS: 409,
  });
  return Response.json({ token, wallet: await wallet(db, member, outlet.id) }, { status: 201 });
});
