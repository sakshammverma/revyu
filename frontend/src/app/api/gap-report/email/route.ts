import { getDb } from "@/server/db";
import { orPlaces503 } from "@/server/gapRoute";
import { handler, parseJson, rateLimit, rateLimitKey } from "@/server/http";
import { gapReportEmailBody } from "@/server/schemas";
import { emailReport } from "@/server/services/gapReport";

export const POST = handler(async (request: Request) => {
  const db = getDb();
  await rateLimit(request, "gap_email", 5, 3600, db);
  const body = await parseJson(request, gapReportEmailBody);
  // Anyone can type any address here: cap what one inbox can be sent.
  await rateLimitKey(`gap_email_to:${body.email.trim().toLowerCase()}`, 2, 86400, db);
  await orPlaces503(() => emailReport(db, body.place_id, body.email));
  return Response.json({ status: "sent" }, { status: 202 });
});
