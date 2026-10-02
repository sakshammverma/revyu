import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { orderPrintKit, printKitBody, printKitInfo } from "@/server/services/growth";

export const GET = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await printKitInfo(db, owner));
});

export const POST = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const body = await parseJson(request, printKitBody);
  return Response.json(await orderPrintKit(db, owner, body), { status: 201 });
});
