import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { listPendingSends } from "@/server/services/adminOps";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await listPendingSends(getDb()));
});
