import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { adminPrintKits } from "@/server/services/growthAdmin";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await adminPrintKits(getDb()));
});
