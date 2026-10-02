import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { handler, HttpError, parseJson, rateLimit } from "@/server/http";
import { otpVerifyBody } from "@/server/schemas";
import { findAccountByEmail, sessionCookie, verifyOtp } from "@/server/services/ownerAuth";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  await rateLimit(request, "otp_verify", 20, 900, db);
  const body = await parseJson(request, otpVerifyBody);

  const account = await findAccountByEmail(db, body.email);
  if (!account) throw new HttpError(400, "OTP_INVALID");

  const result = await verifyOtp(db, account, body.code);
  if (!result.ok) {
    throw result.reason === "attempts_exceeded"
      ? new HttpError(429, "OTP_ATTEMPTS_EXCEEDED")
      : new HttpError(400, "OTP_INVALID");
  }
  return Response.json(
    { session_token: result.session.rawToken, expires_at: result.session.expiresAt.toISOString() },
    { headers: { "Set-Cookie": sessionCookie(result.session.rawToken, !getEnv().isLocal) } },
  );
});
