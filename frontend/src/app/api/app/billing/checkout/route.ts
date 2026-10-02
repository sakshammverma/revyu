import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { checkoutBodySchema, createBillingCheckout } from "@/server/services/ownerBilling";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const body = await parseJson(request, checkoutBodySchema);
  return Response.json(await createBillingCheckout(db, owner, body.plan), { status: 201 });
});
