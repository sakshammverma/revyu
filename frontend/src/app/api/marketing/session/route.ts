import { requireSales } from "@/server/auth/sales";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";

/** The sales demo's gate checks a PIN here before showing anything. */
export const GET = handler(async (request: Request) => {
  const db = getDb();
  const role = await requireSales(request, db);
  return Response.json({ role });
});
