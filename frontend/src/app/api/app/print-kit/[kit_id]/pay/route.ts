import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { payPrintKit } from "@/server/services/growth";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ kit_id: string }> };

export const POST = handler(async (request: Request, { params }: Ctx) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await payPrintKit(db, owner, guidParam((await params).kit_id)));
});
