import { handler, parseJson } from "@/server/http";
import { mapHubErrors, noContent, ownOutlet, type OutletCtx } from "@/server/hubRoute";
import { orderBody } from "@/server/hubSchemas";
import { orderCategories } from "@/server/services/hubConfig";

export const PUT = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  const body = await parseJson(request, orderBody);
  await mapHubErrors(() => orderCategories(db, outlet, body.ids));
  return noContent();
});
