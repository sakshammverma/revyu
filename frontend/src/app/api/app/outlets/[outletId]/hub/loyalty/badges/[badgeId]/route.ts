import { handler, parseJson } from "@/server/http";
import { guidParam, noContent, ownOutlet } from "@/server/hubRoute";
import { badgeBody, editBadge, retireBadge } from "@/server/services/loyaltyConfig";

type Ctx = { params: Promise<{ outletId: string; badgeId: string }> };

export const PUT = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  const badgeId = guidParam((await ctx.params).badgeId);
  const body = await parseJson(request, badgeBody);
  return Response.json(await editBadge(db, outlet, badgeId, body));
});

export const DELETE = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  await retireBadge(db, outlet, guidParam((await ctx.params).badgeId));
  return noContent();
});
