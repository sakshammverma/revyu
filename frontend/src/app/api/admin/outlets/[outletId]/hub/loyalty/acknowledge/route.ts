import { handler } from "@/server/http";
import { noContent, anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { acknowledge } from "@/server/services/loyaltyConfig";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  await acknowledge(db, outlet, "admin");
  return noContent();
});
