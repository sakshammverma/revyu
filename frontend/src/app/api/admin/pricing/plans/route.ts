import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { adminSetPlanPrice, planPriceBody } from "@/server/services/pricingAdmin";

export const PUT = handler(async (request: Request) => {
  requireAdmin(request);
  const body = await parseJson(request, planPriceBody);
  return Response.json(await adminSetPlanPrice(getDb(), body));
});
