import { handler, parseJson } from "@/server/http";
import { ownOutlet, type OutletCtx } from "@/server/hubRoute";
import { addBadge, badgeBody } from "@/server/services/loyaltyConfig";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  const body = await parseJson(request, badgeBody);
  return Response.json(await addBadge(db, outlet, body), { status: 201 });
});
