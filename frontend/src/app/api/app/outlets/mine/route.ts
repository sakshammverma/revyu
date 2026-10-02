import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { getMyOutlet } from "@/server/services/dashboard";

export const GET = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await getMyOutlet(db, owner.id));
});
