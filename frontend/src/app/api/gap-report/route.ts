import { getDb } from "@/server/db";
import { orPlaces503 } from "@/server/gapRoute";
import { handler, HttpError, rateLimit } from "@/server/http";
import { gapReportQuery } from "@/server/schemas";
import { buildReport } from "@/server/services/gapReport";

export const GET = handler(async (request: Request) => {
  await rateLimit(request, "gap", 20, 3600, getDb());
  const query = gapReportQuery.safeParse({ place_id: new URL(request.url).searchParams.get("place_id") ?? undefined });
  if (!query.success) throw new HttpError(422, "VALIDATION_ERROR");
  return Response.json(await orPlaces503(() => buildReport(query.data.place_id)));
});
