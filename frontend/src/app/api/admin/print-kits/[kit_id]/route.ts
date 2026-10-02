import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { adminKitStatus, kitStatusBody } from "@/server/services/growthAdmin";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ kit_id: string }> };

export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  requireAdmin(request);
  const id = guidParam((await params).kit_id);
  const body = await parseJson(request, kitStatusBody);
  await adminKitStatus(getDb(), id, body.status);
  return new Response(null, { status: 204 });
});
