import { handler, parseJson } from "@/server/http";
import { anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { addPin, pinBody } from "@/server/services/loyaltyConfig";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, pinBody);
  return Response.json(await addPin(db, outlet, body), { status: 201 });
});
