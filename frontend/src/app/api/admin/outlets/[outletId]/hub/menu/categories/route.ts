import { handler, parseJson } from "@/server/http";
import { mapHubErrors, anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { categoryBody } from "@/server/hubSchemas";
import { addCategory } from "@/server/services/hubConfig";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, categoryBody);
  return Response.json(await mapHubErrors(() => addCategory(db, outlet, body.name)), { status: 201 });
});
