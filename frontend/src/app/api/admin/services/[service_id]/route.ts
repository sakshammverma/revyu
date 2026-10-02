import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { adminUpdateService, serviceBody } from "@/server/services/growthAdmin";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ service_id: string }> };

export const PUT = handler(async (request: Request, { params }: Ctx) => {
  requireAdmin(request);
  const id = guidParam((await params).service_id);
  const body = await parseJson(request, serviceBody);
  return Response.json(await adminUpdateService(getDb(), id, body));
});
