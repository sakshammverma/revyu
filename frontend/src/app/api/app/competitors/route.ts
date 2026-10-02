import { z } from "zod";

import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { HttpError, handler, parseJson } from "@/server/http";
import { addWatch, competitorsOut, getOutletFor, WatchError } from "@/server/services/competitors";

// Lengths count code points, like pydantic's min_length/max_length.
const len = (min: number, max: number) => (s: string) => {
  const n = Array.from(s).length;
  return n >= min && n <= max;
};
const addBody = z.object({
  place_id: z.string().refine(len(3, 200)),
  name: z.string().refine(len(1, 120)),
});

export const GET = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  return Response.json(await competitorsOut(db, await getOutletFor(db, owner.id)));
});

export const POST = handler(async (request: Request) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const body = await parseJson(request, addBody);
  const outlet = await getOutletFor(db, owner.id);
  try {
    await addWatch(db, outlet, body.place_id, body.name);
  } catch (err) {
    if (err instanceof WatchError) throw new HttpError(409, err.code);
    throw err;
  }
  return Response.json(await competitorsOut(db, outlet), { status: 201 });
});
