import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { listServices } from "@/server/services/growth";

export const GET = handler(async (request: Request) => {
  const db = getDb();
  await requireOwner(request, db);
  return Response.json(await listServices(db));
});
