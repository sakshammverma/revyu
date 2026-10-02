import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { approveBody, approveOutlet } from "@/server/services/adminApprovals";
import { guidParam } from "@/server/services/routeParams";

export const POST = handler(async (request: Request, { params }: { params: Promise<{ outletId: string }> }) => {
  requireAdmin(request);
  const outletId = guidParam((await params).outletId);
  const body = await parseJson(request, approveBody);
  return Response.json(await approveOutlet(getDb(), outletId, body));
});
