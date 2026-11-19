import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { adminQueueCounts } from "@/server/services/adminCustomers";

/** Badge counts for the admin sidebar: work waiting on the founder. */
export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json(await adminQueueCounts(getDb()));
});
