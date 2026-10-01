/**
 * Customer flow: config, session, private feedback. Port of
 * backend/app/api/flow.py. This is the CR-3 boundary - nothing here may hide
 * or condition the Google link on rating (documents/03-COMPLIANCE.md).
 */
import { and, asc, eq, sql } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { notify } from "@/server/notifications";
import { isCollecting } from "./outletState";

const { accounts, outlets, privateFeedback, tags } = schema;
// `sessions` in the DB; named to avoid confusion with HTTP/auth sessions.
const customerSessions = schema.sessions;

export type Outlet = typeof outlets.$inferSelect;

const DEFAULT_LOCALE = "en";

/** SRS-1.1: slugs resolve case-insensitively (people retype printed URLs). */
export async function findOutletBySlug(db: DbLike, slug: string): Promise<Outlet | null> {
  const [outlet] = await db
    .select()
    .from(outlets)
    .where(sql`lower(${outlets.slug}) = lower(${slug})`)
    .limit(1);
  return outlet ?? null;
}

/** SRS-1.4: unknown slug gives a branded 404, no existence leak. */
export async function requireOutlet(db: DbLike, slug: string): Promise<Outlet> {
  const outlet = await findOutletBySlug(db, slug);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}

export interface FlowConfig {
  collecting: boolean;
  preview: boolean;
  outlet: {
    id: string;
    business_name: string;
    logo_url: string | null;
    vertical: string;
    google_review_url: string | null;
  };
  tags: { id: string; label: string; phrases: string[]; sort_order: number }[];
}

function pickLocale<T>(values: Record<string, T> | null, empty: T): T {
  if (!values) return empty;
  const preferred = values[DEFAULT_LOCALE];
  if (preferred !== undefined && !(Array.isArray(preferred) ? preferred.length === 0 : preferred === "")) {
    return preferred;
  }
  const first = Object.values(values)[0];
  return first ?? empty;
}

/** Shared by the public flow and the admin approval preview (SRS-19.2). */
export async function buildFlowConfig(
  db: DbLike,
  outlet: Outlet,
  opts: { forcePreview?: boolean } = {},
): Promise<FlowConfig> {
  const collecting = isCollecting(outlet.state) && !opts.forcePreview;
  const preview = Boolean(opts.forcePreview) || outlet.state === "draft"; // SRS-11.17
  const showFullFlow = collecting || preview;

  let tagConfigs: FlowConfig["tags"] = [];
  if (showFullFlow) {
    // Client-side draft assembly (OD-8): phrases ship with config so the draft
    // screen needs no round trip, the worst drop-off point.
    const rows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.outletId, outlet.id), eq(tags.active, true)))
      .orderBy(asc(tags.sortOrder));
    tagConfigs = rows.map((tag) => ({
      id: tag.id,
      label: pickLocale(tag.label as Record<string, string>, ""),
      phrases: pickLocale(tag.phrases as Record<string, string[]>, []),
      sort_order: tag.sortOrder,
    }));
  }

  return {
    collecting,
    preview,
    outlet: {
      id: outlet.id,
      business_name: outlet.businessName,
      logo_url: outlet.logoUrl,
      vertical: outlet.vertical,
      google_review_url: showFullFlow ? outlet.googleReviewUrl : null,
    },
    tags: tagConfigs,
  };
}

/** null = unknown slug (callers decide between a 404 page and a 404 response). */
export async function getFlowConfig(db: DbLike, slug: string): Promise<FlowConfig | null> {
  const outlet = await findOutletBySlug(db, slug);
  return outlet ? buildFlowConfig(db, outlet) : null;
}

export async function createSession(
  db: DbLike,
  outlet: Outlet,
  input: { sessionId: string; deviceHash: string | null },
): Promise<{ session_id: string; started_at: string }> {
  // Idempotent by session_id: a client retry or a React effect firing twice
  // must not error the customer flow. ON CONFLICT replaces the old
  // catch-IntegrityError-and-reread dance.
  await db
    .insert(customerSessions)
    .values({
      id: input.sessionId,
      outletId: outlet.id,
      deviceHash: input.deviceHash,
      completed: false,
      countedForTrial: false,
      startedAt: new Date(),
    })
    .onConflictDoNothing({ target: customerSessions.id });
  const [row] = await db.select().from(customerSessions).where(eq(customerSessions.id, input.sessionId)).limit(1);
  return { session_id: row.id, started_at: row.startedAt.toISOString() };
}

export async function submitFeedback(
  db: DbLike,
  outlet: Outlet,
  input: { sessionId: string; rating: number | null; message: string; contact: string | null },
): Promise<{ id: string; created_at: string }> {
  const [session] = await db
    .select({ id: customerSessions.id, outletId: customerSessions.outletId })
    .from(customerSessions)
    .where(eq(customerSessions.id, input.sessionId))
    .limit(1);
  if (!session || session.outletId !== outlet.id) throw new HttpError(400, "INVALID_SESSION");

  const message = input.message.trim();
  if (!message) throw new HttpError(400, "EMPTY_MESSAGE");

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    await tx.insert(privateFeedback).values({
      id,
      outletId: outlet.id,
      sessionId: session.id,
      rating: input.rating,
      message,
      contact: input.contact,
      resolved: false,
      createdAt,
    });
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
    if (account) {
      await notify(tx, {
        accountId: account.id,
        outletId: outlet.id,
        toEmail: account.ownerEmail,
        template: "private_feedback_received",
        data: { business_name: outlet.businessName, rating: input.rating ?? "n/a" },
      });
    }
    // CR-3 / SRS-7.5: submitting feedback never suppresses the Google link.
    // Nothing here instructs the client to hide anything, by design.
    return { id, created_at: createdAt.toISOString() };
  });
}
