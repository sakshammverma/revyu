import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { markSent } from "@/server/services/adminOps";
import { guidParam } from "@/server/services/routeParams";

export const POST = handler(async (request: Request, { params }: { params: Promise<{ sendId: string }> }) => {
  requireAdmin(request);
  await markSent(getDb(), guidParam((await params).sendId));
  return new Response(null, { status: 204 });
});
