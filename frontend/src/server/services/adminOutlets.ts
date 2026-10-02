/**
 * Admin outlet management. Port of backend/app/api/admin_outlets.py
 * (SRS-11.2/11.10/11.19, FR-35/36/37/39): list, create, validate review URL,
 * edit tags, activate, CSV bulk import.
 */
import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import {
  AmbiguousPlaceError,
  buildReviewUrl,
  getPlaceSnapshot,
  PlacesUnavailableError,
  resolvePlaceId,
} from "./places";
import { pyIso } from "./pyDate";
import { seedTags } from "./signup";
import { generateUniqueSlug } from "./slug";

const { accounts, outlets, tags } = schema;

export const createOutletBody = z.object({
  business_name: z.string(),
  vertical: z.string(),
  owner_phone: z.string(),
  owner_email: z.email(),
  owner_name: z.string().nullish(),
  google_maps_url: z.string().nullish(),
  place_id: z.string().nullish(),
});
export type CreateOutletBody = z.infer<typeof createOutletBody>;

export const validateUrlBody = z.object({ google_review_url: z.string() });

export const updateTagsBody = z.object({
  tags: z.array(
    z.object({
      id: z.guid().nullish(),
      label: z.string(),
      phrases: z.array(z.string()),
      sort_order: z.number().int(),
      active: z.boolean().default(true),
    }),
  ),
});
export type UpdateTagsBody = z.infer<typeof updateTagsBody>;

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

/** The 409 AMBIGUOUS_PLACE body carries `candidates`, which HttpError cannot; the route renders it. */
export class AmbiguousPlaceHttp extends Error {
  constructor(public candidates: { place_id: string; name: string; address: string | null }[]) {
    super("AMBIGUOUS_PLACE");
  }
}

/* ------------------------------------------------------------------ list */

export async function listOutlets(
  db: DbLike,
  filters: { state?: string | null; vertical?: string | null; source?: string | null },
) {
  // SRS-11.19: `source` stands in for "import batch" at v1.
  const conds: SQL[] = [];
  if (filters.state) conds.push(eq(outlets.state, filters.state));
  if (filters.vertical) conds.push(eq(outlets.vertical, filters.vertical));
  if (filters.source) conds.push(eq(outlets.source, filters.source));
  const rows = await db
    .select()
    .from(outlets)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(outlets.createdAt));
  return {
    items: rows.map((o) => ({
      outlet_id: o.id,
      business_name: o.businessName,
      vertical: o.vertical,
      state: o.state,
      source: o.source,
      created_at: pyIso(o.createdAt),
    })),
  };
}

/* ---------------------------------------------------------------- create */

/** place_id wins; otherwise the Maps URL is resolved. Throws HttpError / AmbiguousPlaceHttp. */
export async function resolvePlaceOr400(googleMapsUrl?: string | null, placeId?: string | null): Promise<string> {
  if (placeId) return placeId;
  if (!googleMapsUrl) throw new HttpError(400, "VALIDATION_FAILED", "place_id or google_maps_url required");
  try {
    return await resolvePlaceId(googleMapsUrl);
  } catch (e) {
    if (e instanceof AmbiguousPlaceError) {
      throw new AmbiguousPlaceHttp(
        e.candidates.map((c) => ({ place_id: c.place_id, name: c.name, address: c.address })),
      );
    }
    if (e instanceof PlacesUnavailableError) throw new HttpError(503, "PLACES_UNAVAILABLE", e.message);
    throw e;
  }
}

export async function createOutlet(db: DbLike, body: CreateOutletBody) {
  const placeId = await resolvePlaceOr400(body.google_maps_url, body.place_id);
  try {
    return await db.transaction(async (tx) => {
      let [account] = await tx.select().from(accounts).where(eq(accounts.ownerPhone, body.owner_phone)).limit(1);
      if (!account) {
        [account] = await tx
          .insert(accounts)
          .values({
            id: crypto.randomUUID(),
            ownerPhone: body.owner_phone,
            ownerEmail: body.owner_email,
            ownerName: body.owner_name ?? null,
            otpChannel: "email",
            currencyCode: "INR",
            paymentProvider: "razorpay",
          })
          .returning();
      }
      const slug = await generateUniqueSlug(tx); // permanent: kept at activation
      const [outlet] = await tx
        .insert(outlets)
        .values({
          id: crypto.randomUUID(),
          accountId: account.id,
          slug,
          businessName: body.business_name,
          vertical: body.vertical,
          countryCode: "IN",
          locale: "en-IN",
          timezone: "Asia/Kolkata",
          googlePlaceId: placeId,
          googleReviewUrl: buildReviewUrl(placeId),
          state: "draft",
          source: "admin",
          placeVerified: false,
          placementConfirmed: false,
          trialFlowCount: 0,
          hubMode: "direct",
        })
        .returning();
      await seedTags(tx, outlet.id, body.vertical);
      return { outlet_id: outlet.id, slug: outlet.slug, state: outlet.state };
    });
  } catch (e) {
    // Python let this surface as a 500 (existing email with a new phone, or a
    // place already attached elsewhere); it is a client conflict, so say so.
    if (isUniqueViolation(e)) throw new HttpError(409, "DUPLICATE_BUSINESS");
    throw e;
  }
}

/* ----------------------------------------------------------- validate-url */

export async function validateReviewUrl(db: DbLike, outletId: string, url: string) {
  // FR-35: structural check only (the write-review endpoint with a placeid).
  const valid = url.includes("search.google.com/local/writereview") && url.includes("placeid=");
  if (valid) {
    await db.update(outlets).set({ googleReviewUrl: url, updatedAt: new Date() }).where(eq(outlets.id, outletId));
  }
  return { valid, reason: valid ? null : "URL does not match the expected Google review-write format" };
}

/* ------------------------------------------------------------------ tags */

export async function updateTags(db: DbLike, outletId: string, body: UpdateTagsBody) {
  const [outlet] = await db.select({ id: outlets.id }).from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");

  await db.transaction(async (tx) => {
    const existing = new Set((await tx.select({ id: tags.id }).from(tags).where(eq(tags.outletId, outletId))).map((t) => t.id));
    const submitted = new Set<string>();
    for (const item of body.tags) {
      if (item.id && existing.has(item.id)) {
        await tx
          .update(tags)
          .set({ label: { en: item.label }, phrases: { en: item.phrases }, sortOrder: item.sort_order, active: item.active })
          .where(eq(tags.id, item.id));
        submitted.add(item.id);
      } else {
        await tx.insert(tags).values({
          id: crypto.randomUUID(),
          outletId,
          label: { en: item.label },
          phrases: { en: item.phrases },
          sortOrder: item.sort_order,
          active: item.active,
        });
      }
    }
    // Omitted tags are deactivated, not deleted: events reference their ids.
    for (const id of existing) {
      if (!submitted.has(id)) await tx.update(tags).set({ active: false }).where(eq(tags.id, id));
    }
  });
}

/* -------------------------------------------------------------- activate */

const invalid = (message: string) => new HttpError(400, "VALIDATION_FAILED", message);

export async function activateOutlet(db: DbLike, outletId: string, now = new Date()) {
  // FR-37/39, SRS-11.6/11.8/11.21: per-outlet, manual, needs a real owner_email.
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  // Self-serve signups go through the approvals route instead.
  if (outlet.state !== "draft") throw invalid(`cannot activate from state ${outlet.state}`);
  if (!outlet.googleReviewUrl || !outlet.businessName) throw invalid("review URL and business name required");

  const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
  if (!account || account.ownerEmail.startsWith("placeholder-")) {
    throw invalid("a real owner_email is required before activation (SRS-11.21)");
  }
  const [activeTag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.outletId, outletId), eq(tags.active, true)))
    .limit(1);
  if (!activeTag) throw invalid("at least one active tag required");

  // The slug is minted at draft creation and never changes (C-6, SRS-12.9);
  // only legacy placeholder slugs are replaced.
  const slug = /^(draft-|pending-)/.test(outlet.slug) ? await generateUniqueSlug(db) : outlet.slug;
  const set: Partial<typeof outlets.$inferInsert> = {
    slug,
    state: "trial",
    activatedAt: now,
    placeVerified: true,
    placementConfirmed: true,
    updatedAt: now,
  };
  let baselineRating = outlet.baselineRating;
  let baselineCount = outlet.baselineReviewCount;
  if (outlet.googlePlaceId) {
    try {
      const [rating, count] = await getPlaceSnapshot(outlet.googlePlaceId);
      baselineRating = rating === null ? null : rating.toFixed(1);
      baselineCount = count;
      set.baselineRating = baselineRating;
      set.baselineReviewCount = baselineCount;
    } catch (e) {
      if (!(e instanceof PlacesUnavailableError)) throw e;
    }
  }
  await db.update(outlets).set(set).where(eq(outlets.id, outletId));

  return {
    slug,
    short_url: `/r/${slug}`,
    baseline_rating: baselineRating === null ? null : Number(baselineRating),
    baseline_review_count: baselineCount,
    activated_at: pyIso(now),
  };
}

/* ----------------------------------------------------------- bulk import */

/** RFC 4180 CSV reader (what Python's csv module accepts); blank lines yield no record. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldQuoted = false;
  let rowQuoted = false;
  const endField = () => {
    row.push(field);
    field = "";
    fieldQuoted = false;
  };
  const endRecord = () => {
    endField();
    if (!(row.length === 1 && row[0] === "" && !rowQuoted)) records.push(row);
    row = [];
    rowQuoted = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"' && field === "" && !fieldQuoted) {
      inQuotes = true;
      fieldQuoted = true;
      rowQuoted = true;
    } else if (c === ",") endField();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRecord();
    } else field += c;
  }
  if (field !== "" || row.length > 0 || fieldQuoted) endRecord();
  return records;
}

export interface BulkImportRow {
  row: number;
  outlet_id: string | null;
  slug: string | null;
  status: "draft" | "error";
  error: string | null;
}

const errorRow = (row: number, error: string): BulkImportRow => ({
  row,
  outlet_id: null,
  slug: null,
  status: "error",
  error,
});

async function importRow(db: DbLike, rowNum: number, row: Record<string, string>): Promise<BulkImportRow> {
  const get = (k: string) => (row[k] ?? "").trim();
  const businessName = get("business_name");
  const vertical = get("vertical");
  const ownerPhone = get("owner_phone");
  let ownerEmail = get("owner_email");
  const mapsUrl = get("google_maps_url");

  if (!businessName || !vertical || !ownerPhone) return errorRow(rowNum, "MISSING_REQUIRED_FIELD");

  // SRS-11.20: prospecting rows may lack an email; the placeholder is unique
  // so a 50-row batch never collides on accounts.owner_email.
  if (!ownerEmail) {
    ownerEmail = `placeholder-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}@revyu.pending`;
  } else {
    const [dup] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.ownerEmail, ownerEmail)).limit(1);
    if (dup) return errorRow(rowNum, "EMAIL_DUPLICATE");
  }

  // Resolved before touching accounts, so a failed row leaves nothing behind
  // (Python created the account first and kept it on a place failure).
  let placeId: string | null = null;
  let reviewUrl: string | null = null;
  if (mapsUrl) {
    try {
      placeId = await resolvePlaceId(mapsUrl);
      reviewUrl = buildReviewUrl(placeId);
    } catch (e) {
      if (e instanceof AmbiguousPlaceError) return errorRow(rowNum, "AMBIGUOUS_PLACE");
      if (e instanceof PlacesUnavailableError) return errorRow(rowNum, "PLACE_ID_NOT_FOUND");
      throw e;
    }
  }

  let [account] = await db.select().from(accounts).where(eq(accounts.ownerPhone, ownerPhone)).limit(1);
  if (!account) {
    [account] = await db
      .insert(accounts)
      .values({
        id: crypto.randomUUID(),
        ownerPhone,
        ownerEmail,
        ownerName: null,
        otpChannel: "email",
        currencyCode: "INR",
        paymentProvider: "razorpay",
      })
      .returning();
  }
  const slug = await generateUniqueSlug(db);
  const [outlet] = await db
    .insert(outlets)
    .values({
      id: crypto.randomUUID(),
      accountId: account.id,
      slug,
      businessName,
      vertical,
      countryCode: "IN",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      googlePlaceId: placeId,
      googleReviewUrl: reviewUrl,
      state: "draft",
      source: "bulk_import",
      placeVerified: false,
      placementConfirmed: false,
      trialFlowCount: 0,
      hubMode: "direct",
    })
    .returning();
  await seedTags(db, outlet.id, vertical);
  return { row: rowNum, outlet_id: outlet.id, slug: outlet.slug, status: "draft", error: null };
}

/** SRS-11.10: every row lands in draft; a bad row reports its own error and never blocks the batch. */
export async function bulkImport(db: DbLike, csvText: string) {
  const records = parseCsv(csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText);
  const header = records[0] ?? [];
  const rows: BulkImportRow[] = [];
  await db.transaction(async (tx) => {
    for (const [idx, record] of records.slice(1).entries()) {
      const obj: Record<string, string> = {};
      header.forEach((h, j) => {
        if (j < record.length) obj[h] = record[j];
      });
      rows.push(await importRow(tx, idx + 1, obj));
    }
  });
  const created = rows.filter((r) => r.status === "draft").length;
  return { created, failed: rows.length - created, rows };
}
