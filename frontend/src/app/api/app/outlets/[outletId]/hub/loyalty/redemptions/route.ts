import { handler } from "@/server/http";
import { ownOutlet, type OutletCtx } from "@/server/hubRoute";
import { redemptionLog } from "@/server/services/loyalty";

export const GET = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  return Response.json({ items: await redemptionLog(db, outlet.id) });
});
