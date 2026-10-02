import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { adminRequest, adminUpdateBody, adminUpdateRequest } from "@/server/services/growthAdmin";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ request_id: string }> };

export const GET = handler(async (request: Request, { params }: Ctx) => {
  requireAdmin(request);
  return Response.json(await adminRequest(getDb(), guidParam((await params).request_id)));
});

export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  requireAdmin(request);
  const id = guidParam((await params).request_id);
  const body = await parseJson(request, adminUpdateBody);
  return Response.json(await adminUpdateRequest(getDb(), id, body));
});
