import { handler } from "@/server/http";
import { guidParam, noContent, anyOutlet } from "@/server/hubRoute";
import { parseBoolQuery } from "@/server/loyaltyRoute";
import { setPinActive } from "@/server/services/loyaltyConfig";

type Ctx = { params: Promise<{ outletId: string; pinId: string }> };

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const pinId = guidParam((await ctx.params).pinId);
  const active = parseBoolQuery(new URL(request.url).searchParams.get("active"), true);
  await setPinActive(db, outlet, pinId, active);
  return noContent();
});
