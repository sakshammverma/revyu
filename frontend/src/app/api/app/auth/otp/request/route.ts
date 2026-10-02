import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { handler, parseJson, rateLimit } from "@/server/http";
import { notify } from "@/server/notifications";
import { otpRequestBody } from "@/server/schemas";
import { findAccountByEmail, requestOtp } from "@/server/services/ownerAuth";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  await rateLimit(request, "otp_request", 10, 900, db);
  const body = await parseJson(request, otpRequestBody);

  // Unknown email and "asked too often" both answer 204: a different status
  // would reveal which addresses are registered (SRS-15.2 posture).
  const account = await findAccountByEmail(db, body.email);
  if (account) {
    await db.transaction(async (tx) => {
      const issued = await requestOtp(tx, account);
      if (!issued) return;
      const link = `${getEnv().frontendBaseUrl.replace(/\/+$/, "")}/app/auth/magic?token=${issued.magicToken}`;
      await notify(tx, {
        accountId: account.id,
        outletId: null,
        toEmail: account.ownerEmail,
        template: "otp_login",
        data: { code: issued.code, magic_link: link },
      });
    });
  }
  return new Response(null, { status: 204 });
});
