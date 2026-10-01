import { getDb } from "@/server/db";
import { handler, parseJson, rateLimit } from "@/server/http";
import type { SlugContext } from "@/server/routes";
import { sessionBody } from "@/server/schemas";
import { createSession, requireOutlet } from "@/server/services/flow";

export const POST = handler(async (request: Request, { params }: SlugContext) => {
  const { slug } = await params;
  const db = getDb();
  await rateLimit(request, "session", 60, 3600, db);
  const outlet = await requireOutlet(db, slug);
  const body = await parseJson(request, sessionBody);
  const session = await createSession(db, outlet, {
    sessionId: body.session_id,
    deviceHash: body.device_hash ?? null,
  });
  return Response.json(session, { status: 201 });
});
