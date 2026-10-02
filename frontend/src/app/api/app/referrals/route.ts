import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { referralOverview } from "@/server/services/referrals";

export const GET = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await referralOverview(db, owner));
});
