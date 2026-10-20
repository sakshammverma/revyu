import { getDb } from "@/server/db";
import { clientIp, handler, parseJson, rateLimit, rateLimitKey } from "@/server/http";
import { eventsBody } from "@/server/schemas";
import { recordEvents } from "@/server/services/events";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  // Many customers share one carrier-grade NAT or venue Wi-Fi address, so the per-IP
  // ceiling is only a flood guard; the per-session limit is what bounds one client.
  await rateLimit(request, "events", 3000, 3600, db);
  const body = await parseJson(request, eventsBody);
  if (body.session_id) await rateLimitKey(`events_session:${body.session_id}`, 120, 3600, db);
  const result = await recordEvents(db, {
    outletId: body.outlet_id,
    sessionId: body.session_id ?? null,
    events: body.events,
    clientIp: clientIp(request),
  });
  return Response.json(result, { status: 202 });
});
