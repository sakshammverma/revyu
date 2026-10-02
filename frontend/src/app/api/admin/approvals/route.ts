import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { listApprovalQueue } from "@/server/services/adminApprovals";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await listApprovalQueue(getDb()));
});
