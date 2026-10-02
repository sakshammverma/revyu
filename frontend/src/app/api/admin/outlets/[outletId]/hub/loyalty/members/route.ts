import { handler } from "@/server/http";
import { anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { memberRows } from "@/server/services/loyalty";

export const GET = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  return Response.json({ items: await memberRows(db, outlet.id) });
});
