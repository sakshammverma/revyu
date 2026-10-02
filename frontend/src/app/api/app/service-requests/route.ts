import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { AlreadyRequestedError, createRequest, myRequests, requestBody } from "@/server/services/growth";

export const GET = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await myRequests(db, owner));
});

export const POST = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const body = await parseJson(request, requestBody);
  try {
    return Response.json(await createRequest(db, owner, body), { status: 201 });
  } catch (err) {
    // The 409 body also carries the id of the existing open request.
    if (err instanceof AlreadyRequestedError) return err.toResponse();
    throw err;
  }
});
