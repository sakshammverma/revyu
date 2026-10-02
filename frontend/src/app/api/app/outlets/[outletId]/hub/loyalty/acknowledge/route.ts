import { handler } from "@/server/http";
import { noContent, ownOutlet, type OutletCtx } from "@/server/hubRoute";
import { acknowledge } from "@/server/services/loyaltyConfig";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  await acknowledge(db, outlet, "owner");
  return noContent();
});
