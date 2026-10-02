import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { correctPlaceBody, correctPlace } from "@/server/services/adminApprovals";
import { guidParam } from "@/server/services/routeParams";

export const PATCH = handler(async (request: Request, { params }: { params: Promise<{ outletId: string }> }) => {
  requireAdmin(request);
  const outletId = guidParam((await params).outletId);
  const body = await parseJson(request, correctPlaceBody);
  await correctPlace(getDb(), outletId, body);
  return new Response(null, { status: 204 });
});
