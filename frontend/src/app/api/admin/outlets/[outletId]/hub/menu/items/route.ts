import { handler, parseJson } from "@/server/http";
import { mapHubErrors, anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { itemBody } from "@/server/hubSchemas";
import { addItem } from "@/server/services/hubConfig";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, itemBody);
  return Response.json(await mapHubErrors(() => addItem(db, outlet, body)), { status: 201 });
});
