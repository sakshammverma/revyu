import { getDb } from "@/server/db";
import { handler, HttpError, parseJson, rateLimit } from "@/server/http";
import { staffLoginBody } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { requireOutlet } from "@/server/services/flow";
import { findPin, makeStaffToken } from "@/server/services/loyalty";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "staff_login", 10, 900, db);
  const body = await parseJson(request, staffLoginBody);
  const outlet = await requireOutlet(db, slug);
  const pin = await findPin(db, outlet.id, body.pin);
  if (!pin) throw new HttpError(401, "BAD_PIN", "Wrong PIN.");
  return Response.json({
    token: makeStaffToken(outlet.id, pin.id),
    label: pin.label,
    outlet_name: outlet.businessName,
  });
});
