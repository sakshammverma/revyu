import { getDb } from "@/server/db";
import { handler, parseJson, rateLimit } from "@/server/http";
import { claimBody, mapLoyaltyErrors } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { requireOutlet } from "@/server/services/flow";
import { claimTransfer, wallet } from "@/server/services/loyalty";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "loyalty_claim", 10, 900, db);
  const body = await parseJson(request, claimBody);
  const outlet = await requireOutlet(db, slug);
  const { member, token } = await mapLoyaltyErrors(() => claimTransfer(db, outlet.id, body.phone, body.code));
  return Response.json({ token, wallet: await wallet(db, member, outlet.id) });
});
