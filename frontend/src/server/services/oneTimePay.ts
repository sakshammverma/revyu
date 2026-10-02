/**
 * One-time payments (service quotes, print kit) over the PaymentProvider
 * interface. Port of backend/app/services/one_time_pay.py. A payment is only
 * marked paid after the provider's signature for that exact order verifies;
 * the amount always comes from our own records, never from the client.
 */
import { and, eq } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { getProvider, getProviderByName, PaymentProviderUnavailableError } from "./payments";

const { servicePayments } = schema;

export type ServicePayment = typeof servicePayments.$inferSelect;
type AccountLike = { id: string; ownerEmail: string; ownerName: string | null; ownerPhone: string | null };

/** Becomes `{detail:{error:{code,message}}}`, same as the Python PayError mapping. */
export class PayError extends HttpError {
  constructor(code: string, message: string, status = 409) {
    super(status, code, message);
  }
}

export async function startPayment(
  db: DbLike,
  account: AccountLike,
  args: { kind: string; refId: string; amountMinor: number; currencyCode: string },
) {
  const { kind, refId, amountMinor, currencyCode } = args;
  if (amountMinor <= 0) throw new PayError("NOTHING_TO_PAY", "There is nothing to pay.");
  let intent;
  try {
    intent = await getProvider("IN").createOrder({ amountMinor, currencyCode, customerEmail: account.ownerEmail });
  } catch (err) {
    if (err instanceof PaymentProviderUnavailableError) {
      throw new PayError("PAYMENT_UNAVAILABLE", "Payments are unavailable right now. Please try again shortly.", 503);
    }
    throw err;
  }
  await db.insert(servicePayments).values({
    id: crypto.randomUUID(),
    accountId: account.id,
    kind,
    refId,
    amountMinor,
    currencyCode,
    provider: intent.provider,
    providerOrderId: intent.providerOrderId ?? "",
    status: "created",
  });
  // Same shape the signup checkout uses, so the existing widget runs it.
  return {
    provider: intent.provider,
    mode: intent.mode,
    amount_minor: amountMinor,
    currency_code: currencyCode,
    key_id: intent.keyId,
    subscription_id: null,
    order_id: intent.providerOrderId,
    trial_days: 0,
    prefill: { name: account.ownerName || "", email: account.ownerEmail, contact: account.ownerPhone || "" },
  };
}

export async function confirmPayment(
  db: DbLike,
  account: Pick<AccountLike, "id">,
  args: { kind: string; refId: string; paymentId: string; orderId: string; signature: string },
): Promise<ServicePayment> {
  const { kind, refId, paymentId, orderId, signature } = args;
  const [pay] = await db
    .select()
    .from(servicePayments)
    .where(
      and(
        eq(servicePayments.providerOrderId, orderId),
        eq(servicePayments.accountId, account.id),
        eq(servicePayments.kind, kind),
        eq(servicePayments.refId, refId),
      ),
    )
    .limit(1);
  if (!pay) throw new PayError("UNKNOWN_ORDER", "We couldn't match that payment.", 404);
  if (pay.status === "paid") return pay; // idempotent: a double-submit is not an error

  const ok = getProviderByName(pay.provider).verifyCheckoutSignature({ paymentId, signature, orderId });
  if (!ok) throw new PayError("BAD_SIGNATURE", "We couldn't verify that payment.", 400);

  const paidAt = new Date();
  const [updated] = await db
    .update(servicePayments)
    .set({ status: "paid", providerPaymentId: pay.provider === "mock" ? null : paymentId, paidAt })
    .where(and(eq(servicePayments.id, pay.id), eq(servicePayments.status, "created")))
    .returning();
  if (updated) return updated;
  // Lost a race with a concurrent confirm: it is paid now.
  const [current] = await db.select().from(servicePayments).where(eq(servicePayments.id, pay.id)).limit(1);
  return current;
}
