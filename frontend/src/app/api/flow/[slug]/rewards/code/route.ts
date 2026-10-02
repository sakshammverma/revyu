import { getDb } from "@/server/db";
import { handler, HttpError, rateLimit } from "@/server/http";
import { walletMember } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { requireOutlet } from "@/server/services/flow";
import { visitCode } from "@/server/services/loyalty";
import { isCollecting } from "@/server/services/outletState";
import { generateTextQrSvg } from "@/server/services/qr";

export const GET = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "wallet_code", 240, 3600, db);
  const outlet = await requireOutlet(db, slug);
  if (!isCollecting(outlet.state)) throw new HttpError(403, "PAUSED");
  const out = visitCode(await walletMember(db, outlet, request));
  // Built here from our own string so the staff console can scan it.
  return Response.json({ ...out, qr_svg: generateTextQrSvg(out.code) });
});
