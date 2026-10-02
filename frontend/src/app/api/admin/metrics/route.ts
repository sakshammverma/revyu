import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { cockpit } from "@/server/services/adminOps";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await cockpit(getDb()));
});
