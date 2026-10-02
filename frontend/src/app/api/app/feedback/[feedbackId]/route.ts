import { z } from "zod";

import { requireOwner } from "@/server/auth/owner";
import { requireUuid } from "@/server/dashboardRoutes";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { resolveFeedback } from "@/server/services/dashboard";

const resolveBody = z.object({ resolved: z.boolean() });

export const PATCH = handler(async (request: Request, { params }: { params: Promise<{ feedbackId: string }> }) => {
  const { feedbackId } = await params;
  const db = getDb();
  const owner = await requireOwner(request, db);
  requireUuid(feedbackId);
  const body = await parseJson(request, resolveBody);
  await resolveFeedback(db, owner.id, feedbackId, body.resolved);
  return new Response(null, { status: 204 });
});
