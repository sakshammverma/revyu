import { requireSales } from "@/server/auth/sales";
import { getDb } from "@/server/db";
import { orPlaces503 } from "@/server/gapRoute";
import { handler, HttpError, rateLimitKey } from "@/server/http";
import { searchPlaces } from "@/server/services/places";

/** Find the shop for the sales demo. One billed Places call, under a global daily cap. */
export const GET = handler(async (request: Request) => {
  const db = getDb();
  await requireSales(request, db);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 200) throw new HttpError(422, "VALIDATION_ERROR");
  await rateLimitKey("marketing_places", 300, 86400, db);
  return Response.json({ results: await orPlaces503(() => searchPlaces(q)) });
});
