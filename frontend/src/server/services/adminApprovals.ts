/**
 * Founder approval queue (SRS-19). Port of backend/app/api/admin.py.
 * Routes live under /api/admin/approvals and are all behind requireAdmin().
 *
 * Every state transition claims the outlet with a conditional UPDATE
 * (state = 'pending_approval'), so a double click or two admin tabs can never
 * approve twice, refund twice, or reject an approved outlet.
 */
import { randomInt } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";
import { notify } from "@/server/notifications";
import { latestSubscription, releaseSignupPayment } from "./billing";
import { buildFlowConfig } from "./flow";
import { buildReviewUrl, getPlaceSnapshot, PlacesUnavailableError } from "./places";
import { pyIso } from "./pyDate";
import { voidReward } from "./referrals";

const { accounts, outlets } = schema;

export const approveBody = z.object({
  place_verified: z.boolean(),
  placement_confirmed: z.boolean(),
  notes: z.string().nullish(),
});
export const requestInfoBody = z.object({ message: z.string() });
export const rejectBody = z.object({ reason: z.string(), refund: z.boolean().default(true) });
export const correctPlaceBody = z.object({ place_id: z.string() });

type OutletRow = typeof outlets.$inferSelect;

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 6-8 chars, URL-safe, non-sequential (documents/05-DATA-MODEL.md 3.2). */
export async function generateUniqueSlug(db: DbLike, length = 7): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = Array.from({ length }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join("");
    const [hit] = await db.select({ id: outlets.id }).from(outlets).where(eq(outlets.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  throw new Error("Could not generate a unique slug after 20 attempts");
}

export async function paymentStatus(db: DbLike, accountId: string): Promise<string> {
  const sub = await latestSubscription(db, accountId);
  if (!sub) return "none";
  if (sub.razorpayOrderId) return sub.status === "active" ? "paid" : sub.status;
  return sub.mandateStatus === "active" ? "mandate_authorised" : `mandate_${sub.mandateStatus}`;
}

async function pendingOr404(db: DbLike, outletId: string): Promise<OutletRow> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet || outlet.state !== "pending_approval") throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function listApprovalQueue(db: DbLike) {
  // SRS-19.1: oldest first, with age since submitted_at.
  const rows = await db
    .select({ outlet: outlets, account: accounts })
    .from(outlets)
    .leftJoin(accounts, eq(accounts.id, outlets.accountId))
    .where(eq(outlets.state, "pending_approval"))
    .orderBy(asc(outlets.submittedAt));

  const now = Date.now();
  const items = [];
  for (const { outlet, account } of rows) {
    const ageHours = outlet.submittedAt ? round1((now - outlet.submittedAt.getTime()) / 3_600_000) : 0;
    let rating: number | null = null;
    let reviewCount: number | null = null;
    if (outlet.googlePlaceId) {
      try {
        [rating, reviewCount] = await getPlaceSnapshot(outlet.googlePlaceId);
      } catch (err) {
        if (!(err instanceof PlacesUnavailableError)) throw err; // queue must render if Places is down
      }
    }
    items.push({
      outlet_id: outlet.id,
      business_name: outlet.businessName,
      vertical: outlet.vertical,
      owner: {
        name: account?.ownerName ?? null,
        phone: account?.ownerPhone ?? "",
        email: account?.ownerEmail ?? "",
      },
      google_match: {
        place_id: outlet.googlePlaceId,
        name: outlet.businessName,
        address: null, // SRS-19.2 wants a full address; needs a Places details call
        rating,
        review_count: reviewCount,
      },
      preview_url: `/admin/preview/${outlet.id}`,
      payment_status: await paymentStatus(db, outlet.accountId),
      submitted_at: outlet.submittedAt ? pyIso(outlet.submittedAt) : null,
      age_hours: ageHours,
    });
  }
  return { items };
}

/** SRS-19.2: a working, fully branded preview, served by id (pending outlets have no real slug). */
export async function previewOutlet(db: DbLike, outletId: string) {
  return buildFlowConfig(db, await pendingOr404(db, outletId), { forcePreview: true });
}

export async function approveOutlet(db: DbLike, outletId: string, body: z.infer<typeof approveBody>) {
  const outlet = await pendingOr404(db, outletId);
  // SRS-19.3: both checks are required, explicitly; no implicit approval.
  if (!(body.place_verified && body.placement_confirmed)) {
    throw new HttpError(400, "VALIDATION_FAILED", "place_verified and placement_confirmed must both be true");
  }

  // Baseline capture is best-effort and a network call, so it runs before the
  // claim; approval must not block on it.
  let baseline: [number | null, number | null] | null = null;
  if (outlet.googlePlaceId) {
    try {
      baseline = await getPlaceSnapshot(outlet.googlePlaceId);
    } catch (err) {
      if (!(err instanceof PlacesUnavailableError)) throw err;
    }
  }

  const slug = await generateUniqueSlug(db);
  const now = new Date();
  const [claimed] = await db
    .update(outlets)
    .set({
      slug,
      placeVerified: true,
      placementConfirmed: true,
      approvedAt: now,
      approvedBy: "founder", // single-admin v1 (see auth/admin.ts)
      state: "trial",
      activatedAt: now,
      updatedAt: now,
      ...(baseline
        ? { baselineRating: baseline[0] === null ? null : String(baseline[0]), baselineReviewCount: baseline[1] }
        : {}),
    })
    .where(and(eq(outlets.id, outletId), eq(outlets.state, "pending_approval")))
    .returning();
  if (!claimed) throw new HttpError(404, "OUTLET_NOT_FOUND"); // lost a race with another approve/reject

  // SRS-19.5: email the owner their dashboard link (QR + print files live there).
  const [account] = await db.select().from(accounts).where(eq(accounts.id, claimed.accountId)).limit(1);
  if (account) {
    const env = getEnv();
    await notify(db, {
      accountId: account.id,
      outletId: claimed.id,
      toEmail: account.ownerEmail,
      template: "outlet_activated",
      data: {
        business_name: claimed.businessName,
        short_url: `${env.publicFlowBaseUrl.replace(/\/+$/, "")}/r/${slug}`,
        dashboard_url: `${env.frontendBaseUrl.replace(/\/+$/, "")}/app/login`,
      },
    });
  }
  return { state: "trial", slug, short_url: `/r/${slug}`, activated_at: pyIso(now) };
}

/** SRS-19.6: stays pending_approval, payment retained, owner emailed the question. */
export async function requestInfo(db: DbLike, outletId: string, body: z.infer<typeof requestInfoBody>) {
  const outlet = await pendingOr404(db, outletId);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
  if (account) {
    await notify(db, {
      accountId: account.id,
      outletId: outlet.id,
      toEmail: account.ownerEmail,
      template: "needs_info",
      data: { business_name: outlet.businessName, message: body.message },
    });
  }
}

export async function rejectOutlet(db: DbLike, outletId: string, body: z.infer<typeof rejectBody>) {
  const outlet = await pendingOr404(db, outletId);
  // Claim first: only one request can pass this point, so refunds run once.
  const [claimed] = await db
    .update(outlets)
    .set({ state: "rejected", rejectionReason: body.reason, updatedAt: new Date() })
    .where(and(eq(outlets.id, outletId), eq(outlets.state, "pending_approval")))
    .returning({ id: outlets.id });
  if (!claimed) throw new HttpError(404, "OUTLET_NOT_FOUND");

  // SRS-19.7: refund captured payments and cancel any mandate. Gateway
  // failures are logged for manual follow-up rather than blocking rejection.
  const oneTime = (await paymentStatus(db, outlet.accountId)) === "paid";
  const problems = body.refund ? await releaseSignupPayment(db, outlet.accountId) : [];
  await voidReward(db, outlet.accountId);

  const [account] = await db.select().from(accounts).where(eq(accounts.id, outlet.accountId)).limit(1);
  if (account) {
    let refundLine: string;
    if (!body.refund) refundLine = "Please contact us about your payment.";
    else if (problems.length) refundLine = "We're processing your refund and will confirm by email.";
    else if (oneTime) refundLine = "Your payment has been refunded in full; it can take 5–7 business days to appear.";
    else refundLine = "Your payment authorisation has been cancelled — you will not be charged.";
    await notify(db, {
      accountId: account.id,
      outletId: outlet.id,
      toEmail: account.ownerEmail,
      template: "signup_rejected",
      data: { business_name: outlet.businessName, reason: body.reason, refund_line: refundLine },
    });
  }
}

/** SRS-19.8: admin may correct the Place ID before approving. */
export async function correctPlace(db: DbLike, outletId: string, body: z.infer<typeof correctPlaceBody>) {
  await pendingOr404(db, outletId);
  await db
    .update(outlets)
    .set({ googlePlaceId: body.place_id, googleReviewUrl: buildReviewUrl(body.place_id), updatedAt: new Date() })
    .where(and(eq(outlets.id, outletId), eq(outlets.state, "pending_approval")));
}
