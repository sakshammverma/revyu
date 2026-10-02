import { getDb } from "@/server/db";
import { handler, rateLimit } from "@/server/http";
import { mapLoyaltyErrors, staffContext } from "@/server/loyaltyRoute";
import { issueTransferCode } from "@/server/services/loyalty";

type Ctx = { params: Promise<{ slug: string; publicId: string }> };

export const POST = handler(async (request: Request, { params }: Ctx) => {
  const { slug, publicId } = await params;
  const db = getDb();
  await rateLimit(request, "staff_transfer", 30, 3600, db);
  const { outlet } = await staffContext(db, request, slug);
  return Response.json(await mapLoyaltyErrors(() => issueTransferCode(db, outlet.id, publicId)));
});
