import { handler, parseJson } from "@/server/http";
import { mapHubErrors, noContent, anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { modulesBody } from "@/server/hubSchemas";
import { setModules } from "@/server/services/hubConfig";

export const PUT = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, modulesBody);
  await mapHubErrors(() => setModules(db, outlet, body.modules, { isAdmin: true }));
  return noContent();
});
