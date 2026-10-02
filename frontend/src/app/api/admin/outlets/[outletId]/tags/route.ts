import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { updateTags, updateTagsBody } from "@/server/services/adminOutlets";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ outletId: string }> };

export const PUT = handler(async (request: Request, ctx: Ctx) => {
  requireAdmin(request);
  const outletId = guidParam((await ctx.params).outletId);
  const body = await parseJson(request, updateTagsBody);
  await updateTags(getDb(), outletId, body);
  return new Response(null, { status: 204 });
});
