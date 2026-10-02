import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { outletDetail } from "@/server/services/adminOps";
import { guidParam } from "@/server/services/routeParams";

export const GET = handler(async (request: Request, { params }: { params: Promise<{ outletId: string }> }) => {
  requireAdmin(request);
  return Response.json(await outletDetail(getDb(), guidParam((await params).outletId)));
});
