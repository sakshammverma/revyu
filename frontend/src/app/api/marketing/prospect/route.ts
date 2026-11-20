import { requireSales } from "@/server/auth/sales";
import { getDb } from "@/server/db";
import { orPlaces503 } from "@/server/gapRoute";
import { handler, HttpError, rateLimitKey } from "@/server/http";
import { placeIdSchema } from "@/server/schemas";
import { buildProspect } from "@/server/services/salesDemo";

/** The shop's public Google numbers and its nearby rivals. Two billed Places calls. */
export const GET = handler(async (request: Request) => {
  const db = getDb();
  await requireSales(request, db);
  const placeId = placeIdSchema.safeParse(new URL(request.url).searchParams.get("place_id") ?? undefined);
  if (!placeId.success) throw new HttpError(422, "VALIDATION_ERROR");
  await rateLimitKey("marketing_places", 300, 86400, db);
  return Response.json(await orPlaces503(() => buildProspect(placeId.data)));
});
