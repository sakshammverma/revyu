import { getDb } from "@/server/db";
import { handler, HttpError } from "@/server/http";
import { RazorpayProvider } from "@/server/services/payments";
import { handleEvent } from "@/server/services/webhooks";

export const POST = handler(async (request: Request) => {
  // The signature covers the exact bytes Razorpay sent, so verify before parsing.
  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("X-Razorpay-Signature") ?? "";
  if (!new RazorpayProvider().verifyWebhookSignature(raw, signature)) {
    throw new HttpError(400, "WEBHOOK_SIGNATURE_INVALID");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "WEBHOOK_BODY_INVALID");
  }
  const event = (payload as { event?: unknown } | null)?.event;

  // One transaction per delivery: a failure rolls everything back and the 5xx
  // makes Razorpay retry (handlers are idempotent).
  await getDb().transaction((tx) => handleEvent(tx, typeof event === "string" ? event : "", payload));
  return Response.json({ status: "ok" });
});
