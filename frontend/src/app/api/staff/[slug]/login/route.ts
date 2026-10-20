import { getDb } from "@/server/db";
import { handler, HttpError, parseJson, rateLimit, rateLimitKey, rateLimitReached } from "@/server/http";
import { staffLoginBody } from "@/server/loyaltyRoute";
import type { SlugContext } from "@/server/routes";
import { requireOutlet } from "@/server/services/flow";
import { findPin, makeStaffToken } from "@/server/services/loyalty";

const STAFF_PIN_FAILS_PER_HOUR = 20;

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "staff_login", 10, 900, db);
  const body = await parseJson(request, staffLoginBody);
  const outlet = await requireOutlet(db, slug);
  // Per-IP limits alone don't stop a PIN guessed from many IPs: cap wrong PINs
  // per outlet too. Only failures count, so staff who type it right are never
  // blocked by the limit itself.
  const failKey = `staff_pin_fail:${outlet.id}`;
  if (await rateLimitReached(failKey, STAFF_PIN_FAILS_PER_HOUR, 3600, db)) {
    throw new HttpError(429, "RATE_LIMITED", "Too many wrong PINs. Try again in an hour, or ask the owner.");
  }
  const pin = await findPin(db, outlet.id, body.pin);
  if (!pin) {
    await rateLimitKey(failKey, STAFF_PIN_FAILS_PER_HOUR, 3600, db).catch(() => {});
    throw new HttpError(401, "BAD_PIN", "Wrong PIN.");
  }
  return Response.json({
    token: makeStaffToken(outlet.id, pin.id),
    label: pin.label,
    outlet_name: outlet.businessName,
  });
});
