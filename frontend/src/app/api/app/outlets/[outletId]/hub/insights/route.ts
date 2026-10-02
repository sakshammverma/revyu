import { handler, HttpError } from "@/server/http";
import { ownOutlet, type OutletCtx } from "@/server/hubRoute";
import { hubInsights } from "@/server/services/hubConfig";

export const GET = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await ownOutlet(request, ctx);
  const raw = new URL(request.url).searchParams.get("days");
  if (raw !== null && !/^[+-]?\d+$/.test(raw.trim())) throw new HttpError(422, "VALIDATION_ERROR");
  return Response.json(await hubInsights(db, outlet, raw === null ? 30 : Number(raw)));
});
