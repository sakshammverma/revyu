import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { validateReviewUrl, validateUrlBody } from "@/server/services/adminOutlets";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ outletId: string }> };

export const POST = handler(async (request: Request, ctx: Ctx) => {
  requireAdmin(request);
  const outletId = guidParam((await ctx.params).outletId);
  const body = await parseJson(request, validateUrlBody);
  return Response.json(await validateReviewUrl(getDb(), outletId, body.google_review_url));
});
