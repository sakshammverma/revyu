/**
 * Growth Services (what Revyu sells owners) and the QR print kit, owner side.
 * Port of the owner_router in backend/app/api/growth.py. The admin side is a
 * later phase and stays on FastAPI. No public price is shown anywhere
 * (decision 2026-10-01): pricing is a quote.
 */
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";
import { render } from "@/server/notifications/templates";
import { confirmPayment, startPayment } from "./oneTimePay";
import { pyIso } from "./pyDate";

const { outlets, printKitOrders, serviceCatalog, serviceRequestEvents, serviceRequests } = schema;

type Account = typeof schema.accounts.$inferSelect;
type ServiceRequest = typeof serviceRequests.$inferSelect;
type Kit = typeof printKitOrders.$inferSelect;

export const PRINT_KIT_DELIVERY_FEE_MINOR = 19_900; // INR 199, flat (decision 2026-10-01)
export const OPEN_STATUSES = ["requested", "quoted", "accepted", "in_progress"];

/* ------------------------------------------------------------- schemas */

export const requestBody = z.object({
  service_key: z.string(),
  brief: z.string().max(2000).nullish(),
  answers: z.record(z.string(), z.string()).nullish(),
});
export const messageBody = z.object({ body: z.string().min(1).max(2000) });
export const payConfirmBody = z.object({
  razorpay_payment_id: z.string().max(100),
  razorpay_order_id: z.string().max(100),
  razorpay_signature: z.string().max(200),
});
export const printKitBody = z.object({
  method: z.enum(["deliver", "self_print"]),
  address: z.string().max(500).nullish(),
  phone: z.string().max(32).nullish(),
});

/** 409 ALREADY_REQUESTED carries the existing request id next to code/message. */
export class AlreadyRequestedError extends HttpError {
  constructor(public existingId: string) {
    super(409, "ALREADY_REQUESTED", "You already have an open request for this service.");
  }
  toResponse(): Response {
    return Response.json(
      { detail: { error: { code: this.code, message: this.message, id: this.existingId } } },
      { status: 409 },
    );
  }
}

/* -------------------------------------------------------------- helpers */

/** Python slices by code point; JS strings slice by UTF-16 unit. */
const clip = (s: string, n: number) => Array.from(s).slice(0, n).join("");

async function myOutlet(db: DbLike, owner: Pick<Account, "id">) {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, owner.id)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}

function serviceDict(s: typeof serviceCatalog.$inferSelect) {
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    tagline: s.tagline,
    description_md: s.descriptionMd,
    deliverables: s.deliverables,
    questions: s.questions,
    lead_time_days: s.leadTimeDays,
    cover_image_url: s.coverImageUrl,
  };
}

async function addEvent(db: DbLike, reqId: string, kind: string, body: string, actor: string) {
  await db.insert(serviceRequestEvents).values({ id: crypto.randomUUID(), requestId: reqId, kind, body, actor });
}

/** Owner view of a request (internal `note` events are never shown, SRS: owner privacy). */
async function requestDict(db: DbLike, req: ServiceRequest, detail = false) {
  const [svc] = await db.select().from(serviceCatalog).where(eq(serviceCatalog.id, req.serviceId)).limit(1);
  const d: Record<string, unknown> = {
    id: req.id,
    status: req.status,
    service_key: svc.key,
    service_name: svc.name,
    brief: req.brief,
    answers: req.answers,
    currency_code: req.currencyCode,
    quoted_amount_minor: req.quotedAmountMinor,
    due_at: req.dueAt ? pyIso(req.dueAt) : null,
    paid: req.paidAt !== null,
    created_at: pyIso(req.createdAt),
    updated_at: pyIso(req.updatedAt),
  };
  if (detail) {
    const events = await db
      .select()
      .from(serviceRequestEvents)
      .where(and(eq(serviceRequestEvents.requestId, req.id), ne(serviceRequestEvents.kind, "note")))
      .orderBy(asc(serviceRequestEvents.createdAt));
    d.events = events.map((e) => ({
      id: e.id,
      kind: e.kind,
      body: e.body,
      actor: e.actor,
      created_at: pyIso(e.createdAt),
    }));
  }
  return d;
}

async function reload(db: DbLike, id: string): Promise<ServiceRequest> {
  const [req] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  return req;
}

/**
 * Founder alert (ADMIN_NOTIFY_EMAIL). Best-effort, like the Python: no address
 * configured means nothing is sent, and a failing provider never fails the
 * owner's request.
 */
export async function tellAdmin(subjectLine: string, message: string): Promise<void> {
  const env = getEnv();
  const to = env.adminNotifyEmail;
  if (!to) return;
  const data = {
    service_name: subjectLine,
    message,
    dashboard_url: `${env.frontendBaseUrl}/admin/services/requests`,
  };
  const [subject, body] = render("service_update", data);
  if (!env.emailProviderApiKey) {
    console.info(`EMAIL [no provider configured] to=${to} subject=${subject}\n${body}`);
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.emailProviderApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFromAddress, to: [to], subject, text: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (err) {
    console.error(`Admin email failed to=${to}: ${err instanceof Error ? err.message : err}`);
  }
}

async function mine(db: DbLike, owner: Pick<Account, "id">, requestId: string): Promise<ServiceRequest> {
  const [req] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).limit(1);
  if (!req || req.accountId !== owner.id) throw new HttpError(404, "NOT_FOUND");
  return req;
}

/* -------------------------------------------------------------- catalog */

export async function listServices(db: DbLike) {
  const rows = await db
    .select()
    .from(serviceCatalog)
    .where(eq(serviceCatalog.active, true))
    .orderBy(asc(serviceCatalog.sortOrder));
  return { items: rows.map(serviceDict) };
}

/* ------------------------------------------------------------- requests */

export async function createRequest(db: DbLike, owner: Account, body: z.infer<typeof requestBody>) {
  const outlet = await myOutlet(db, owner);
  const [svc] = await db
    .select()
    .from(serviceCatalog)
    .where(and(eq(serviceCatalog.key, body.service_key), eq(serviceCatalog.active, true)))
    .limit(1);
  if (!svc) throw new HttpError(404, "SERVICE_NOT_FOUND");
  const [dup] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.outletId, outlet.id),
        eq(serviceRequests.serviceId, svc.id),
        inArray(serviceRequests.status, OPEN_STATUSES),
      ),
    )
    .limit(1);
  if (dup) throw new AlreadyRequestedError(dup.id);

  const answers = Object.fromEntries(Object.entries(body.answers ?? {}).map(([k, v]) => [clip(k, 40), clip(v, 500)]));
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(serviceRequests).values({
      id,
      accountId: owner.id,
      outletId: outlet.id,
      serviceId: svc.id,
      status: "requested",
      brief: (body.brief ?? "").trim() || null,
      answers,
      currencyCode: "INR",
    });
    await addEvent(tx, id, "status_changed", "Request received", "owner");
  });
  await tellAdmin(`New request: ${svc.name}`, `${outlet.businessName} requested ${svc.name}.`);
  return requestDict(db, await reload(db, id), true);
}

export async function myRequests(db: DbLike, owner: Pick<Account, "id">) {
  const rows = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.accountId, owner.id))
    .orderBy(desc(serviceRequests.createdAt));
  return { items: await Promise.all(rows.map((r) => requestDict(db, r))) };
}

export async function myRequest(db: DbLike, owner: Pick<Account, "id">, requestId: string) {
  return requestDict(db, await mine(db, owner, requestId), true);
}

export async function ownerMessage(db: DbLike, owner: Pick<Account, "id">, requestId: string, text: string) {
  const req = await mine(db, owner, requestId);
  await addEvent(db, req.id, "message", text.trim(), "owner");
  await tellAdmin("New message on a service request", text.trim());
  return requestDict(db, req, true);
}

export async function acceptQuote(db: DbLike, owner: Pick<Account, "id">, requestId: string) {
  const req = await mine(db, owner, requestId);
  if (req.status !== "quoted") throw new HttpError(409, "NOT_QUOTED", "There is no quote to accept.");
  await db.transaction(async (tx) => {
    // Status guard in the UPDATE: a concurrent cancel cannot be overwritten.
    const moved = await tx
      .update(serviceRequests)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, req.id), eq(serviceRequests.status, "quoted")))
      .returning({ id: serviceRequests.id });
    if (moved.length === 0) throw new HttpError(409, "NOT_QUOTED", "There is no quote to accept.");
    await addEvent(tx, req.id, "status_changed", "Quote accepted", "owner");
  });
  await tellAdmin("Quote accepted", `Request ${req.id} was accepted by the owner.`);
  return requestDict(db, await reload(db, req.id), true);
}

export async function cancelRequest(db: DbLike, owner: Pick<Account, "id">, requestId: string) {
  const req = await mine(db, owner, requestId);
  const cannot = () => new HttpError(409, "CANNOT_CANCEL", "Work has started. Message us to change this.");
  if (!["requested", "quoted"].includes(req.status)) throw cannot();
  await db.transaction(async (tx) => {
    const moved = await tx
      .update(serviceRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, req.id), inArray(serviceRequests.status, ["requested", "quoted"])))
      .returning({ id: serviceRequests.id });
    if (moved.length === 0) throw cannot();
    await addEvent(tx, req.id, "status_changed", "Cancelled by you", "owner");
  });
  return requestDict(db, await reload(db, req.id), true);
}

export async function payRequest(db: DbLike, owner: Account, requestId: string) {
  const req = await mine(db, owner, requestId);
  if (!["accepted", "in_progress"].includes(req.status) || req.paidAt !== null) {
    throw new HttpError(409, "NOT_PAYABLE", "This request isn't waiting for payment.");
  }
  // The amount is the founder's quote on our record, never a client value.
  return startPayment(db, owner, {
    kind: "service_request",
    refId: req.id,
    amountMinor: req.quotedAmountMinor ?? 0,
    currencyCode: req.currencyCode,
  });
}

export async function confirmRequestPayment(
  db: DbLike,
  owner: Account,
  requestId: string,
  body: z.infer<typeof payConfirmBody>,
) {
  const req = await mine(db, owner, requestId);
  const pay = await confirmPayment(db, owner, {
    kind: "service_request",
    refId: req.id,
    paymentId: body.razorpay_payment_id,
    orderId: body.razorpay_order_id,
    signature: body.razorpay_signature,
  });
  // Claim paid_at atomically so a double submit logs "Payment received" once.
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .update(serviceRequests)
      .set({ paidAt: pay.paidAt ?? new Date(), updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, req.id), isNull(serviceRequests.paidAt)))
      .returning({ id: serviceRequests.id });
    if (rows.length) await addEvent(tx, req.id, "status_changed", "Payment received", "owner");
    return rows.length > 0;
  });
  if (claimed) {
    await tellAdmin(
      "Payment received",
      `Request ${req.id} was paid (${(pay.amountMinor / 100).toFixed(2)} ${pay.currencyCode}).`,
    );
  }
  return requestDict(db, await reload(db, req.id), true);
}

/* ------------------------------------------------------------ print kit */

function kitDict(k: Kit) {
  return {
    id: k.id,
    method: k.method,
    fee_minor: k.feeMinor,
    currency_code: k.currencyCode,
    address: k.address,
    phone: k.phone,
    status: k.status,
    created_at: pyIso(k.createdAt),
  };
}

export async function printKitInfo(db: DbLike, owner: Pick<Account, "id">) {
  const outlet = await myOutlet(db, owner);
  const rows = await db
    .select()
    .from(printKitOrders)
    .where(eq(printKitOrders.outletId, outlet.id))
    .orderBy(desc(printKitOrders.createdAt));
  return {
    delivery_fee_minor: PRINT_KIT_DELIVERY_FEE_MINOR,
    currency_code: "INR",
    orders: rows.map(kitDict),
  };
}

export async function orderPrintKit(db: DbLike, owner: Pick<Account, "id">, body: z.infer<typeof printKitBody>) {
  const outlet = await myOutlet(db, owner);
  const address = (body.address ?? "").trim();
  const phone = (body.phone ?? "").trim();
  if (body.method === "deliver" && !(address && phone)) {
    throw new HttpError(422, "ADDRESS_REQUIRED", "Enter a delivery address and phone number.");
  }
  const [kit] = await db
    .insert(printKitOrders)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      method: body.method,
      // Flat fee (decision 2026-10-01); self-print is free and needs no fulfilment.
      feeMinor: body.method === "deliver" ? PRINT_KIT_DELIVERY_FEE_MINOR : 0,
      currencyCode: "INR",
      address: address || null,
      phone: phone || null,
      status: body.method === "deliver" ? "requested" : "delivered",
    })
    .returning();
  if (body.method === "deliver") {
    await tellAdmin("Print kit delivery requested", `${outlet.businessName}: ${kit.address} / ${kit.phone}`);
  }
  return kitDict(kit);
}

async function ownKit(db: DbLike, owner: Pick<Account, "id">, kitId: string): Promise<Kit> {
  const outlet = await myOutlet(db, owner);
  const [kit] = await db.select().from(printKitOrders).where(eq(printKitOrders.id, kitId)).limit(1);
  if (!kit || kit.outletId !== outlet.id) throw new HttpError(404, "NOT_FOUND");
  return kit;
}

export async function payPrintKit(db: DbLike, owner: Account, kitId: string) {
  const kit = await ownKit(db, owner, kitId);
  if (kit.method !== "deliver" || kit.status !== "requested") {
    throw new HttpError(409, "NOT_PAYABLE", "This order doesn't need payment.");
  }
  return startPayment(db, owner, {
    kind: "print_kit",
    refId: kit.id,
    amountMinor: kit.feeMinor,
    currencyCode: kit.currencyCode,
  });
}

export async function confirmPrintKitPayment(
  db: DbLike,
  owner: Account,
  kitId: string,
  body: z.infer<typeof payConfirmBody>,
) {
  const kit = await ownKit(db, owner, kitId);
  await confirmPayment(db, owner, {
    kind: "print_kit",
    refId: kit.id,
    paymentId: body.razorpay_payment_id,
    orderId: body.razorpay_order_id,
    signature: body.razorpay_signature,
  });
  await db
    .update(printKitOrders)
    .set({ status: "paid" })
    .where(and(eq(printKitOrders.id, kit.id), eq(printKitOrders.status, "requested")));
  const [fresh] = await db.select().from(printKitOrders).where(eq(printKitOrders.id, kit.id)).limit(1);
  return kitDict(fresh);
}
