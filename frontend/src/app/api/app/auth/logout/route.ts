import { SESSION_COOKIE, readCookie } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { clearedSessionCookie, revokeSession } from "@/server/services/ownerAuth";

export const POST = handler(async (request: Request) => {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await revokeSession(getDb(), token);
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearedSessionCookie() } });
});
