import { handler, parseJson } from "@/server/http";
import { guidParam, mapHubErrors, noContent, anyOutlet } from "@/server/hubRoute";
import { itemBody } from "@/server/hubSchemas";
import { deleteItem, editItem } from "@/server/services/hubConfig";

type Ctx = { params: Promise<{ outletId: string; itemId: string }> };

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const itemId = guidParam((await ctx.params).itemId);
  const body = await parseJson(request, itemBody);
  return Response.json(await mapHubErrors(() => editItem(db, outlet, itemId, body)));
});

export const DELETE = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const itemId = guidParam((await ctx.params).itemId);
  await mapHubErrors(() => deleteItem(db, outlet, itemId));
  return noContent();
});
