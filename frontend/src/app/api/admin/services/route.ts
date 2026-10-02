import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { adminCreateService, adminServices, serviceBody } from "@/server/services/growthAdmin";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await adminServices(getDb()));
});

export const POST = handler(async (request: Request) => {
  requireAdmin(request);
  const body = await parseJson(request, serviceBody);
  return Response.json(await adminCreateService(getDb(), body), { status: 201 });
});
