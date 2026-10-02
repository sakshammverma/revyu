/**
 * Growth Services + print kit, admin side. Port of the admin_router in
 * backend/app/api/growth.py. Every route is behind requireAdmin().
 *
 * Intended-behaviour deltas from the Python (see report):
 *  - PUT /services/{id} answers 409 KEY_TAKEN for a key owned by another
 *    service (Python let the unique constraint surface as a 500).
 *  - POST /services is race-safe (insert ... on conflict do nothing).
 *  - PATCH /service-requests/{id} locks the row, so two admin edits (or an
 *    admin edit racing an owner accept/cancel) serialise instead of
 *    overwriting each other; updated_at is bumped whenever the row changes.
 */
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";
import { notify } from "@/server/notifications";
import { pyIso } from "./pyDate";

const { accounts, outlets, printKitOrders, serviceCatalog, serviceRequestEvents, serviceRequests } = schema;

type Service = typeof serviceCatalog.$inferSelect;
type Kit = typeof printKitOrders.$inferSelect;

/* ------------------------------------------------------------- schemas */

export const serviceBody = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(1).max(80),
  tagline: z.string().max(160),
  description_md: z.string().max(8000).default(""),
  deliverables: z.array(z.string()).max(20).default([]),
  questions: z.array(z.record(z.string(), z.unknown())).max(12).default([]),
  lead_time_days: z.number().int().min(1).max(365).nullish().transform((v) => v ?? null),
  cover_image_url: z.string().max(300).nullish().transform((v) => v ?? null),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

/** ISO-8601 datetime -> Date. Offset-less values are read as UTC (Python stored them as-is in a UTC session). */
const dueAt = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/i.test(s.trim()))
  .transform((s) => {
    const t = s.trim().replace(" ", "T");
    return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(t) ? t : `${t}Z`);
  })
  .refine((d) => !Number.isNaN(d.getTime()));

export const adminUpdateBody = z.object({
  status: z.enum(["requested", "quoted", "accepted", "in_progress", "delivered", "declined", "cancelled"]).nullish(),
  quoted_amount_minor: z.number().int().min(0).max(1_000_000_000).nullish(),
  due_at: dueAt.nullish(),
  message: z.string().max(2000).nullish(), // visible to owner
  note: z.string().max(2000).nullish(), // internal only
});

export const kitStatusBody = z.object({ status: z.enum(["requested", "paid", "shipped", "delivered", "cancelled"]) });

/* -------------------------------------------------------------- helpers */

function serviceDict(s: Service) {
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
    active: s.active,
    sort_order: s.sortOrder,
  };
}

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

async function addEvent(db: DbLike, reqId: string, kind: string, body: string, actor: string) {
  await db.insert(serviceRequestEvents).values({ id: crypto.randomUUID(), requestId: reqId, kind, body, actor });
}

type ReqRow = {
  req: typeof serviceRequests.$inferSelect;
  svc: Service;
  outlet: typeof outlets.$inferSelect;
  ownerEmail: string | null;
};

function baseQuery(db: DbLike) {
  return db
    .select({ req: serviceRequests, svc: serviceCatalog, outlet: outlets, ownerEmail: accounts.ownerEmail })
    .from(serviceRequests)
    .innerJoin(serviceCatalog, eq(serviceCatalog.id, serviceRequests.serviceId))
    .innerJoin(outlets, eq(outlets.id, serviceRequests.outletId))
    .leftJoin(accounts, eq(accounts.id, serviceRequests.accountId));
}

async function adminRequestDict(db: DbLike, row: ReqRow, detail: boolean) {
  const { req, svc, outlet, ownerEmail } = row;
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
    outlet_id: req.outletId,
    business_name: outlet.businessName,
    owner_email: ownerEmail,
  };
  if (detail) {
    const events = await db
      .select()
      .from(serviceRequestEvents)
      .where(eq(serviceRequestEvents.requestId, req.id))
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

async function loadRow(db: DbLike, id: string): Promise<ReqRow> {
  const [row] = await baseQuery(db).where(eq(serviceRequests.id, id)).limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND");
  return row;
}

/* ------------------------------------------------------------- services */

export async function adminServices(db: DbLike) {
  const rows = await db.select().from(serviceCatalog).orderBy(asc(serviceCatalog.sortOrder));
  return { items: rows.map(serviceDict) };
}

const keyTaken = () => new HttpError(409, "KEY_TAKEN", "That key is in use.");

export async function adminCreateService(db: DbLike, body: z.infer<typeof serviceBody>) {
  const [row] = await db
    .insert(serviceCatalog)
    .values({
      id: crypto.randomUUID(),
      key: body.key,
      name: body.name,
      tagline: body.tagline,
      descriptionMd: body.description_md,
      deliverables: body.deliverables,
      questions: body.questions,
      leadTimeDays: body.lead_time_days,
      coverImageUrl: body.cover_image_url,
      active: body.active,
      sortOrder: body.sort_order,
    })
    .onConflictDoNothing({ target: serviceCatalog.key })
    .returning();
  if (!row) throw keyTaken();
  return serviceDict(row);
}

export async function adminUpdateService(db: DbLike, id: string, body: z.infer<typeof serviceBody>) {
  const [existing] = await db.select({ id: serviceCatalog.id }).from(serviceCatalog).where(eq(serviceCatalog.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "NOT_FOUND");
  const [clash] = await db
    .select({ id: serviceCatalog.id })
    .from(serviceCatalog)
    .where(and(eq(serviceCatalog.key, body.key), ne(serviceCatalog.id, id)))
    .limit(1);
  if (clash) throw keyTaken();
  let row: Service | undefined;
  try {
    [row] = await db
      .update(serviceCatalog)
      .set({
        key: body.key,
        name: body.name,
        tagline: body.tagline,
        descriptionMd: body.description_md,
        deliverables: body.deliverables,
        questions: body.questions,
        leadTimeDays: body.lead_time_days,
        coverImageUrl: body.cover_image_url,
        active: body.active,
        sortOrder: body.sort_order,
      })
      .where(eq(serviceCatalog.id, id))
      .returning();
  } catch (err) {
    // Lost a race on the unique key between the check above and the write.
    if ((err as { code?: string; cause?: { code?: string } })?.code === "23505" || (err as { cause?: { code?: string } })?.cause?.code === "23505") {
      throw keyTaken();
    }
    throw err;
  }
  if (!row) throw new HttpError(404, "NOT_FOUND");
  return serviceDict(row);
}

/* ------------------------------------------------------------- requests */

export async function adminRequests(db: DbLike, status: string | null) {
  const q = baseQuery(db);
  const rows = await (status ? q.where(eq(serviceRequests.status, status)) : q)
    .orderBy(desc(serviceRequests.updatedAt))
    .limit(300);
  return { items: await Promise.all(rows.map((r) => adminRequestDict(db, r, false))) };
}

export async function adminRequest(db: DbLike, id: string) {
  return adminRequestDict(db, await loadRow(db, id), true);
}

async function tellOwner(db: DbLike, row: ReqRow, message: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, row.req.accountId)).limit(1);
  if (!account) return;
  await notify(db, {
    accountId: account.id,
    outletId: row.req.outletId,
    toEmail: account.ownerEmail,
    template: "service_update",
    data: {
      service_name: row.svc.name,
      message,
      dashboard_url: `${getEnv().frontendBaseUrl}/app/grow/${row.req.id}`,
    },
  });
}

export async function adminUpdateRequest(db: DbLike, id: string, body: z.infer<typeof adminUpdateBody>) {
  const ownerMsg: string[] = [];
  await db.transaction(async (tx) => {
    // Row lock: concurrent edits and owner accept/cancel serialise here.
    const [req] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, id)).for("update");
    if (!req) throw new HttpError(404, "NOT_FOUND");

    const quoted = body.quoted_amount_minor ?? req.quotedAmountMinor;
    const changeStatus = body.status && body.status !== req.status ? body.status : null;
    if (changeStatus === "quoted" && quoted === null) {
      throw new HttpError(422, "QUOTE_REQUIRED", "Enter a quote amount first.");
    }

    const set: Partial<typeof serviceRequests.$inferInsert> = {};
    if (body.quoted_amount_minor !== null && body.quoted_amount_minor !== undefined) {
      set.quotedAmountMinor = body.quoted_amount_minor;
    }
    if (body.due_at) set.dueAt = body.due_at;
    if (changeStatus) {
      set.status = changeStatus;
      const label = changeStatus.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
      await addEvent(tx, id, "status_changed", label, "admin");
      ownerMsg.push(`Status: ${label}.`);
    }
    if (Object.keys(set).length) {
      await tx
        .update(serviceRequests)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(serviceRequests.id, id));
    }
    const message = body.message?.trim();
    if (message) {
      await addEvent(tx, id, "message", message, "admin");
      ownerMsg.push(message);
    }
    const note = body.note?.trim();
    if (note) await addEvent(tx, id, "note", note, "admin");
  });

  const row = await loadRow(db, id);
  if (ownerMsg.length) await tellOwner(db, row, ownerMsg.join(" "));
  return adminRequestDict(db, row, true);
}

/* ------------------------------------------------------------ print kit */

export async function adminPrintKits(db: DbLike) {
  const rows = await db
    .select({ kit: printKitOrders, businessName: outlets.businessName })
    .from(printKitOrders)
    .innerJoin(outlets, eq(outlets.id, printKitOrders.outletId))
    .where(eq(printKitOrders.method, "deliver"))
    .orderBy(desc(printKitOrders.createdAt))
    .limit(200);
  return { items: rows.map((r) => ({ ...kitDict(r.kit), business_name: r.businessName })) };
}

export async function adminKitStatus(db: DbLike, id: string, status: z.infer<typeof kitStatusBody>["status"]) {
  const rows = await db
    .update(printKitOrders)
    .set({ status })
    .where(eq(printKitOrders.id, id))
    .returning({ id: printKitOrders.id });
  if (rows.length === 0) throw new HttpError(404, "NOT_FOUND");
}
