import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { activateOutlet } from "@/server/services/adminOutlets";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ outletId: string }> };

export const POST = handler(async (request: Request, ctx: Ctx) => {
  requireAdmin(request);
  const outletId = guidParam((await ctx.params).outletId);
  return Response.json(await activateOutlet(getDb(), outletId));
});
