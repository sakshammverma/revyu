import { getDb } from "@/server/db";
import { handler, parseJson, rateLimit } from "@/server/http";
import { createSignup, signupBody } from "@/server/services/signup";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  await rateLimit(request, "signup", 10, 3600, db);
  const body = await parseJson(request, signupBody);
  return Response.json(await createSignup(db, body), { status: 201 });
});
