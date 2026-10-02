import { requireOwner } from "@/server/auth/owner";
import { requireUuid } from "@/server/dashboardRoutes";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { competitorsOut, getOutletFor, removeWatch } from "@/server/services/competitors";

export const DELETE = handler(async (request: Request, { params }: { params: Promise<{ watchId: string }> }) => {
  const { watchId } = await params;
  const db = getDb();
  const owner = await requireOwner(request, db);
  const outlet = await getOutletFor(db, owner.id);
  requireUuid(watchId);
  await removeWatch(db, outlet, watchId);
  return Response.json(await competitorsOut(db, outlet));
});
