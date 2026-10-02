import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { myRequest } from "@/server/services/growth";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ request_id: string }> };

export const GET = handler(async (request: Request, { params }: Ctx) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await myRequest(db, owner, guidParam((await params).request_id)));
});
