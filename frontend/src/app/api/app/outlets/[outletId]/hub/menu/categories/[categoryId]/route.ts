import { handler, parseJson } from "@/server/http";
import { guidParam, mapHubErrors, noContent, ownOutlet } from "@/server/hubRoute";
import { categoryBody } from "@/server/hubSchemas";
import { deleteCategory, renameCategory } from "@/server/services/hubConfig";

type Ctx = { params: Promise<{ outletId: string; categoryId: string }> };

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  const categoryId = guidParam((await ctx.params).categoryId);
  const body = await parseJson(request, categoryBody);
  await mapHubErrors(() => renameCategory(db, outlet, categoryId, body.name));
  return noContent();
});

export const DELETE = handler(async (request: Request, ctx: Ctx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  const categoryId = guidParam((await ctx.params).categoryId);
  await mapHubErrors(() => deleteCategory(db, outlet, categoryId));
  return noContent();
});
