import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { customersOverview } from "@/server/services/adminCustomers";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await customersOverview(getDb()));
});
