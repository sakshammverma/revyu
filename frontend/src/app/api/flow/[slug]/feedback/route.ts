import { after } from "next/server";

import { getDb } from "@/server/db";
import { handler, parseJson, rateLimit, rateLimitKey } from "@/server/http";
import type { SlugContext } from "@/server/routes";
import { feedbackBody } from "@/server/schemas";
import { requireOutlet, submitFeedback } from "@/server/services/flow";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  // Per IP is a flood guard sized for carrier-grade NAT and venue Wi-Fi, where many
  // customers share an address; per session bounds one client; per outlet is a
  // ceiling on how many owner alert emails a script can trigger.
  await rateLimit(request, "feedback", 200, 3600, db);
  const outlet = await requireOutlet(db, slug);
  await rateLimitKey(`feedback_outlet:${outlet.id}`, 60, 3600, db);
  const body = await parseJson(request, feedbackBody);
  await rateLimitKey(`feedback_session:${body.session_id}`, 10, 3600, db);
  const created = await submitFeedback(db, outlet, {
    sessionId: body.session_id,
    rating: body.rating ?? null,
    message: body.message,
    contact: body.contact ?? null,
    feedbackId: body.feedback_id ?? null,
    defer: (task) => after(task),
  });
  return Response.json(created, { status: 201 });
});
