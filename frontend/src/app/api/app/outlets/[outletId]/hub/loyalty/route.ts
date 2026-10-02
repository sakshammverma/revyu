import { handler, parseJson } from "@/server/http";
import { noContent, ownOutlet, type OutletCtx } from "@/server/hubRoute";
import { getLoyalty, programBody, putProgram } from "@/server/services/loyaltyConfig";

export const GET = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  return Response.json(await getLoyalty(db, outlet));
});

export const PUT = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  await putProgram(db, outlet, await parseJson(request, programBody));
  return noContent();
});
