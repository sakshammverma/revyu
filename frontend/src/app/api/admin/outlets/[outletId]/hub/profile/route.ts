import { handler, parseJson } from "@/server/http";
import { noContent, anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { profileBody } from "@/server/hubSchemas";
import { patchProfile } from "@/server/services/hubConfig";

export const PATCH = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  await patchProfile(db, outlet, await parseJson(request, profileBody));
  return noContent();
});
