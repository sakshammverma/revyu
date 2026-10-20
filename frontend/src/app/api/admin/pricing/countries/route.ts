import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { adminSetCountry, countryBody } from "@/server/services/pricingAdmin";

export const PUT = handler(async (request: Request) => {
  requireAdmin(request);
  const body = await parseJson(request, countryBody);
  return Response.json(await adminSetCountry(getDb(), body));
});
