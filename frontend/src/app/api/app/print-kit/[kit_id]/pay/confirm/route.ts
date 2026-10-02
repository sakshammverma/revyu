import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { confirmPrintKitPayment, payConfirmBody } from "@/server/services/growth";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ kit_id: string }> };

export const POST = handler(async (request: Request, { params }: Ctx) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const id = guidParam((await params).kit_id);
  const body = await parseJson(request, payConfirmBody);
  return Response.json(await confirmPrintKitPayment(db, owner, id, body));
});
