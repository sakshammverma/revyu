import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { adminPricing } from "@/server/services/pricingAdmin";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await adminPricing(getDb()));
});
