import { handler, parseJson } from "@/server/http";
import { anyOutlet, mapHubErrors, noContent, type OutletCtx } from "@/server/hubRoute";
import { availabilityBody } from "@/server/hubSchemas";
import { setAvailability } from "@/server/services/hubConfig";

/** Admin-only: Revyu decides which modules an outlet's owner may switch on. */
export const PUT = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, availabilityBody);
  await mapHubErrors(() => setAvailability(db, outlet, body.module, body.available));
  return noContent();
});
