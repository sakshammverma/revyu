import { getDb } from "@/server/db";
import { clientIp, handler, parseJson, rateLimit } from "@/server/http";
import { eventsBody } from "@/server/schemas";
import { recordEvents } from "@/server/services/events";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  await rateLimit(request, "events", 300, 3600, db);
  const body = await parseJson(request, eventsBody);
  const result = await recordEvents(db, {
    outletId: body.outlet_id,
    sessionId: body.session_id ?? null,
    events: body.events,
    clientIp: clientIp(request),
  });
  return Response.json(result, { status: 202 });
});
