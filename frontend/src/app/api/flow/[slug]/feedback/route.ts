import { getDb } from "@/server/db";
import { handler, parseJson, rateLimit } from "@/server/http";
import type { SlugContext } from "@/server/routes";
import { feedbackBody } from "@/server/schemas";
import { requireOutlet, submitFeedback } from "@/server/services/flow";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "feedback", 10, 3600, db);
  const outlet = await requireOutlet(db, slug);
  const body = await parseJson(request, feedbackBody);
  const created = await submitFeedback(db, outlet, {
    sessionId: body.session_id,
    rating: body.rating ?? null,
    message: body.message,
    contact: body.contact ?? null,
  });
  return Response.json(created, { status: 201 });
});
