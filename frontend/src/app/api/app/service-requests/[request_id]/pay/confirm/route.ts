import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { confirmRequestPayment, payConfirmBody } from "@/server/services/growth";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ request_id: string }> };

export const POST = handler(async (request: Request, { params }: Ctx) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const id = guidParam((await params).request_id);
  const body = await parseJson(request, payConfirmBody);
  return Response.json(await confirmRequestPayment(db, owner, id, body));
});
