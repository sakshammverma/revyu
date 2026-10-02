import { getDb } from "@/server/db";
import { handler, rateLimit } from "@/server/http";
import { walletMember } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { requireOutlet } from "@/server/services/flow";
import { deleteMember, wallet } from "@/server/services/loyalty";

export const GET = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "wallet", 240, 3600, db);
  const outlet = await requireOutlet(db, slug);
  return Response.json(await wallet(db, await walletMember(db, outlet, request), outlet.id));
});

export const DELETE = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  const outlet = await requireOutlet(db, slug);
  await deleteMember(db, await walletMember(db, outlet, request));
  return new Response(null, { status: 204 });
});
