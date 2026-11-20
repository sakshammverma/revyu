import { z } from "zod";

import { requireSales } from "@/server/auth/sales";
import { getDb } from "@/server/db";
import { handler, HttpError } from "@/server/http";
import { placeIdSchema } from "@/server/schemas";
import { buildKit, cleanShopName, isVerticalKey, requestOrigin } from "@/server/services/salesDemo";

const kitQuery = z.object({
  place_id: placeIdSchema,
  name: z.string().trim().min(1).max(120),
  vertical: z.string().refine(isVerticalKey),
});

/** Try link, sign-up links and their QR codes for one shop. No Google calls. */
export const GET = handler(async (request: Request) => {
  const db = getDb();
  await requireSales(request, db);
  const params = new URL(request.url).searchParams;
  const query = kitQuery.safeParse({
    place_id: params.get("place_id") ?? undefined,
    name: params.get("name") ?? undefined,
    vertical: params.get("vertical") ?? undefined,
  });
  if (!query.success || !cleanShopName(query.data.name)) throw new HttpError(422, "VALIDATION_ERROR");
  const { place_id, name, vertical } = query.data;
  return Response.json(buildKit(requestOrigin(request), { placeId: place_id, name, vertical }));
});
