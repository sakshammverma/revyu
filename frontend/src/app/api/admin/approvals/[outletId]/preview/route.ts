import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { previewOutlet } from "@/server/services/adminApprovals";
import { guidParam } from "@/server/services/routeParams";

export const GET = handler(async (request: Request, { params }: { params: Promise<{ outletId: string }> }) => {
  requireAdmin(request);
  const { outletId } = await params;
  return Response.json(await previewOutlet(getDb(), guidParam(outletId)));
});
