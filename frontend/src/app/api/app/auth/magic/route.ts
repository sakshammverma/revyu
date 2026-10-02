import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { handler, HttpError, rateLimit } from "@/server/http";
import { sessionCookie, verifyMagicLink } from "@/server/services/ownerAuth";

export const GET = handler(async (request: Request) => {
  const db = getDb();
  await rateLimit(request, "magic", 20, 900, db);
  const token = new URL(request.url).searchParams.get("token");
  if (!token) throw new HttpError(422, "VALIDATION_ERROR");

  const result = await verifyMagicLink(db, token);
  if (!result.ok) throw new HttpError(400, "OTP_INVALID");
  return Response.json(
    { session_token: result.session.rawToken, expires_at: result.session.expiresAt.toISOString() },
    { headers: { "Set-Cookie": sessionCookie(result.session.rawToken, !getEnv().isLocal) } },
  );
});
