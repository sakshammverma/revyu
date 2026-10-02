import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { confirmBillingCheckout } from "@/server/services/ownerBilling";
import { confirmBody } from "@/server/services/signup";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const body = await parseJson(request, confirmBody);
  return Response.json(await confirmBillingCheckout(db, owner, body));
});
