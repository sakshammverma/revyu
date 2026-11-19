import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { customerProfile } from "@/server/services/adminCustomers";
import { guidParam } from "@/server/services/routeParams";

export const GET = handler(async (request: Request, { params }: { params: Promise<{ outletId: string }> }) => {
  requireAdmin(request);
  return Response.json(await customerProfile(getDb(), guidParam((await params).outletId)));
});
