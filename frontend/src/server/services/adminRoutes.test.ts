/**
 * Admin approval queue + founder ops (phase 7a). Ports of
 * backend/tests/test_ops_and_competitors.py (pending sends, cockpit, detail,
 * state override) plus the approval / reject / refund rules of SRS-19.
 * Rolled-back transactions on the dev DB, mock payment provider, no email key.
 */
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return {
    ...actual,
    getEnv: () => ({
      ...actual.getEnv(),
      environment: "local",
      isLocal: true,
      adminSessionSecret: "test-admin-secret",
      razorpayKeyId: "",
      razorpayKeySecret: "",
      googlePlacesApiKey: "",
      emailProviderApiKey: "",
    }),
  };
});

import { GET as listApprovals } from "@/app/api/admin/approvals/route";
import { POST as approve } from "@/app/api/admin/approvals/[outletId]/approve/route";
import { PATCH as patchPlace } from "@/app/api/admin/approvals/[outletId]/place/route";
import { GET as preview } from "@/app/api/admin/approvals/[outletId]/preview/route";
import { POST as reject } from "@/app/api/admin/approvals/[outletId]/reject/route";
import { POST as requestInfo } from "@/app/api/admin/approvals/[outletId]/request-info/route";
import { GET as metrics } from "@/app/api/admin/metrics/route";
import { GET as detail } from "@/app/api/admin/outlets/[outletId]/detail/route";
import { POST as overrideState } from "@/app/api/admin/outlets/[outletId]/state/route";
import { GET as pendingSends } from "@/app/api/admin/pending-sends/route";
import { POST as dismissSend } from "@/app/api/admin/pending-sends/[sendId]/dismiss/route";
import { POST as markSent } from "@/app/api/admin/pending-sends/[sendId]/sent/route";
import { schema, type DbLike } from "@/server/db";
import { notify } from "@/server/notifications";
import { bandFor, buildLink } from "@/server/services/adminOps";
import { inRolledBackTx, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";

const { events, notifications, outlets, payments, referralRewards, subscriptions, tags } = schema;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const AUTH = { authorization: "Bearer test-admin-secret" };
const req = (path: string, body?: unknown, method?: string, headers: Record<string, string> = AUTH) =>
  makeRequest(path, { body, method, headers });

async function pendingOutlet(tx: DbLike, overrides: Partial<typeof outlets.$inferInsert> = {}) {
  const account = await makeAccount(tx);
  const outlet = await makeOutlet(tx, account, {
    state: "pending_approval",
    slug: `pending-${crypto.randomUUID().slice(0, 8)}`,
    submittedAt: new Date(Date.now() - 3 * 3_600_000),
    googlePlaceId: "ChIJ_test",
    ...overrides,
  });
  return { account, outlet };
}

async function addPaidOrder(tx: DbLike, accountId: string, paymentStatus = "captured") {
  const [sub] = await tx
    .insert(subscriptions)
    .values({
      id: crypto.randomUUID(),
      accountId,
      plan: "annual",
      status: "active",
      provider: "mock",
      razorpayOrderId: "order_mock_x",
    })
    .returning();
  const [pay] = await tx
    .insert(payments)
    .values({
      id: crypto.randomUUID(),
      subscriptionId: sub.id,
      providerPaymentId: `pay_${crypto.randomUUID()}`,
      amountMinor: 99900,
      currencyCode: "INR",
      status: paymentStatus,
      webhookVerified: true,
    })
    .returning();
  return { sub, pay };
}

const ctx = (outletId: string) => routeCtx({ outletId });
const notesFor = (tx: DbLike, outletId: string) =>
  tx.select().from(notifications).where(eq(notifications.outletId, outletId));

describe("admin auth", () => {
  it("every admin route needs the bearer token", () =>
    inTx(async (tx) => {
      const { outlet } = await pendingOutlet(tx);
      const bad = { authorization: "Bearer nope" };
      const calls = [
        listApprovals(req("/api/admin/approvals", undefined, "GET", bad)),
        metrics(req("/api/admin/metrics", undefined, "GET", {})),
        pendingSends(req("/api/admin/pending-sends", undefined, "GET", bad)),
        approve(req("/api/admin/x", { place_verified: true, placement_confirmed: true }, "POST", bad), ctx(outlet.id)),
        detail(req("/api/admin/x", undefined, "GET", bad), ctx(outlet.id)),
        overrideState(req("/api/admin/x", { state: "active", reason: "because" }, "POST", bad), ctx(outlet.id)),
      ];
      for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row.state).toBe("pending_approval");
    }));
});

describe("approval queue", () => {
  it("lists pending outlets oldest first with owner, payment status and age", () =>
    inTx(async (tx) => {
      const { outlet: older } = await pendingOutlet(tx, { submittedAt: new Date(Date.now() - 50 * 3_600_000) });
      await pendingOutlet(tx, { state: "trial" }); // not pending: excluded
      const res = await listApprovals(req("/api/admin/approvals", undefined, "GET"));
      expect(res.status).toBe(200);
      const { items } = await res.json();
      const mine = items.find((i: { outlet_id: string }) => i.outlet_id === older.id);
      expect(mine.age_hours).toBeCloseTo(50, 0);
      expect(mine.preview_url).toBe(`/admin/preview/${older.id}`);
      expect(mine.payment_status).toBe("none");
      expect(mine.google_match).toMatchObject({ place_id: "ChIJ_test", address: null, rating: 4.9, review_count: 142 });
      expect(mine.owner.email).toContain("@example.com");
      const times = items.map((i: { submitted_at: string }) => Date.parse(i.submitted_at));
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }));

  it("reports payment_status for one-time and mandate signups", () =>
    inTx(async (tx) => {
      const { account, outlet } = await pendingOutlet(tx);
      await addPaidOrder(tx, account.id);
      const { account: acc2, outlet: o2 } = await pendingOutlet(tx);
      await tx.insert(subscriptions).values({
        id: crypto.randomUUID(), accountId: acc2.id, plan: "monthly", status: "created",
        provider: "mock", mandateStatus: "active",
      });
      const { items } = await (await listApprovals(req("/api/admin/approvals", undefined, "GET"))).json();
      const status = (id: string) => items.find((i: { outlet_id: string }) => i.outlet_id === id).payment_status;
      expect(status(outlet.id)).toBe("paid");
      expect(status(o2.id)).toBe("mandate_authorised");
    }));

  it("preview serves the full branded flow for a pending outlet, 404 otherwise", () =>
    inTx(async (tx) => {
      const { outlet } = await pendingOutlet(tx);
      await tx.insert(tags).values({
        id: crypto.randomUUID(), outletId: outlet.id, label: { en: "Friendly" }, phrases: { en: ["friendly staff"] },
        sortOrder: 0, active: true,
      });
      const res = await preview(req("/api/x", undefined, "GET"), ctx(outlet.id));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ collecting: false, preview: true });
      expect(body.outlet.google_review_url).toBe(outlet.googleReviewUrl);
      expect(body.tags.map((t: { label: string }) => t.label)).toEqual(["Friendly"]);

      const live = await makeOutlet(tx, await makeAccount(tx), { state: "trial" });
      expect((await preview(req("/api/x", undefined, "GET"), ctx(live.id))).status).toBe(404);
      expect((await preview(req("/api/x", undefined, "GET"), ctx("not-a-uuid"))).status).toBe(422);
    }));

  it("approve needs both checks, then activates with a fresh slug and emails the owner", () =>
    inTx(async (tx) => {
      const { outlet } = await pendingOutlet(tx);
      const call = (b: unknown) => approve(req("/api/x", b), ctx(outlet.id));

      const half = await call({ place_verified: true, placement_confirmed: false });
      expect(half.status).toBe(400);
      expect((await half.json()).detail.error.code).toBe("VALIDATION_FAILED");
      expect((await call({ place_verified: true })).status).toBe(422);

      const res = await call({ place_verified: true, placement_confirmed: true, notes: "ok" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.state).toBe("trial");
      expect(body.slug).toMatch(/^[a-z0-9]{7}$/);
      expect(body.short_url).toBe(`/r/${body.slug}`);

      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row).toMatchObject({
        state: "trial", slug: body.slug, placeVerified: true, placementConfirmed: true,
        approvedBy: "founder", baselineReviewCount: 142,
      });
      expect(Number(row.baselineRating)).toBe(4.9);
      expect(row.activatedAt).toEqual(row.approvedAt);
      expect(body.activated_at).toBe(row.activatedAt!.toISOString().replace("Z", "+00:00"));
      const sent = (await notesFor(tx, outlet.id)).filter((n) => n.template === "outlet_activated");
      expect(sent).toHaveLength(1);
      expect(sent[0].status).toBe("skipped_no_provider");

      // Second approval is a 404 and sends nothing more (idempotent).
      expect((await call({ place_verified: true, placement_confirmed: true })).status).toBe(404);
      expect((await notesFor(tx, outlet.id)).filter((n) => n.template === "outlet_activated")).toHaveLength(1);
    }));

  it("request-info keeps the outlet pending and emails the question", () =>
    inTx(async (tx) => {
      const { outlet } = await pendingOutlet(tx);
      const res = await requestInfo(req("/api/x", { message: "Is the pin right?" }), ctx(outlet.id));
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row.state).toBe("pending_approval");
      expect((await notesFor(tx, outlet.id)).map((n) => n.template)).toEqual(["needs_info"]);
      expect((await requestInfo(req("/api/x", {}), ctx(outlet.id))).status).toBe(422);
    }));

  it("PATCH place corrects the Place ID and review URL; only while pending", () =>
    inTx(async (tx) => {
      const { outlet } = await pendingOutlet(tx);
      const res = await patchPlace(req("/api/x", { place_id: "ChIJ_new" }, "PATCH"), ctx(outlet.id));
      expect(res.status).toBe(204);
      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row.googlePlaceId).toBe("ChIJ_new");
      expect(row.googleReviewUrl).toBe("https://search.google.com/local/writereview?placeid=ChIJ_new");
      const live = await makeOutlet(tx, await makeAccount(tx), { state: "trial" });
      expect((await patchPlace(req("/api/x", { place_id: "z" }, "PATCH"), ctx(live.id))).status).toBe(404);
    }));

  it("reject with refund: refunds the capture, cancels the sub, voids the reward, emails once", () =>
    inTx(async (tx) => {
      const { account, outlet } = await pendingOutlet(tx);
      const { sub, pay } = await addPaidOrder(tx, account.id);
      const referrer = await makeAccount(tx, "r");
      await tx.insert(referralRewards).values({
        id: crypto.randomUUID(), referrerAccountId: referrer.id, referredAccountId: account.id, status: "earned",
      });

      const call = () => reject(req("/api/x", { reason: "Not a real business" }), ctx(outlet.id));
      const res = await call();
      expect(res.status).toBe(204);

      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row).toMatchObject({ state: "rejected", rejectionReason: "Not a real business" });
      const [p] = await tx.select().from(payments).where(eq(payments.id, pay.id));
      expect(p.status).toBe("refunded");
      const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(s.status).toBe("cancelled");
      expect(s.cancelledAt).not.toBeNull();
      const [reward] = await tx.select().from(referralRewards).where(eq(referralRewards.referredAccountId, account.id));
      expect(reward.status).toBe("void");
      expect((await notesFor(tx, outlet.id)).filter((n) => n.template === "signup_rejected")).toHaveLength(1);

      // A repeat must not refund or email again.
      expect((await call()).status).toBe(404);
      expect((await notesFor(tx, outlet.id)).filter((n) => n.template === "signup_rejected")).toHaveLength(1);
    }));

  it("reject with refund=false leaves the payment captured", () =>
    inTx(async (tx) => {
      const { account, outlet } = await pendingOutlet(tx);
      const { pay } = await addPaidOrder(tx, account.id);
      const res = await reject(req("/api/x", { reason: "Duplicate", refund: false }), ctx(outlet.id));
      expect(res.status).toBe(204);
      const [p] = await tx.select().from(payments).where(and(eq(payments.id, pay.id)));
      expect(p.status).toBe("captured");
      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row.state).toBe("rejected");
    }));
});

describe("pending sends", () => {
  it("queues a tap for high-value templates only, and marks it sent", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      await tx.update(schema.accounts).set({ ownerPhone: "+919876543210" }).where(eq(schema.accounts.id, account.id));
      const outlet = await makeOutlet(tx, account, { businessName: "Pending Sends Clinic" });
      await notify(tx, {
        accountId: account.id, outletId: outlet.id, toEmail: "x@example.com",
        template: "collection_paused", data: { business_name: "Pending Sends Clinic", payment_link: "http://x/pay" },
      });
      await notify(tx, {
        accountId: account.id, outletId: outlet.id, toEmail: "x@example.com",
        template: "first_scan", data: { business_name: "Pending Sends Clinic" },
      });
      const list = async () =>
        (await (await pendingSends(req("/api/admin/pending-sends", undefined, "GET"))).json()).filter(
          (i: { business_name: string }) => i.business_name === "Pending Sends Clinic",
        );
      const items = await list();
      expect(items).toHaveLength(1);
      expect(items[0].link.startsWith("https://wa.me/919876543210?text=")).toBe(true);
      const sid = items[0].id;

      const res = await markSent(req("/api/x", undefined, "POST"), routeCtx({ sendId: sid }));
      expect(res.status).toBe(204);
      expect(await list()).toHaveLength(0);
      const [n] = await tx.select().from(notifications).where(eq(notifications.id, sid));
      expect(n.status).toBe("sent");
      expect(n.sentAt).not.toBeNull();

      // A settled send cannot be flipped by a stale tab.
      expect((await dismissSend(req("/api/x", undefined, "POST"), routeCtx({ sendId: sid }))).status).toBe(204);
      const [after] = await tx.select().from(notifications).where(eq(notifications.id, sid));
      expect(after.status).toBe("sent");
    }));

  it("dismiss works; unknown and non-click-to-chat ids are 404", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const [queued] = await tx.insert(notifications).values({
        id: crypto.randomUUID(), accountId: account.id, template: "credits_low", channel: "click_to_chat",
        status: "queued", toPhone: "919876543210", body: "hi",
      }).returning();
      const [email] = await tx.insert(notifications).values({
        id: crypto.randomUUID(), accountId: account.id, template: "credits_low", channel: "email", status: "sent",
      }).returning();
      expect((await dismissSend(req("/api/x", undefined, "POST"), routeCtx({ sendId: queued.id }))).status).toBe(204);
      const [row] = await tx.select().from(notifications).where(eq(notifications.id, queued.id));
      expect(row.status).toBe("dismissed");
      for (const id of [email.id, crypto.randomUUID()]) {
        expect((await markSent(req("/api/x", undefined, "POST"), routeCtx({ sendId: id }))).status).toBe(404);
      }
    }));

  it("wa.me link encodes like Python's urllib quote", () => {
    expect(buildLink("+91 98765-43210", "a b/c!'()*&é")).toBe(
      "https://wa.me/919876543210?text=a%20b/c%21%27%28%29%2A%26%C3%A9",
    );
  });
});

describe("cockpit, detail, state override", () => {
  it("bands", () => {
    expect(bandFor(null)[0]).toBe("unknown");
    expect(bandFor(0.04)[0]).toBe("stop");
    expect(bandFor(0.07)[0]).toBe("iterate");
    expect(bandFor(0.15)[0]).toBe("fix");
    expect(bandFor(0.25)[0]).toBe("push");
  });

  it("metrics and detail reflect scans, payments and tags", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const outlet = await makeOutlet(tx, account, { state: "trial", activatedAt: new Date(Date.now() - 20 * 86_400_000) });
      await tx.insert(events).values({ outletId: outlet.id, type: "scan" });
      await addPaidOrder(tx, account.id);
      await tx.insert(tags).values({
        id: crypto.randomUUID(), outletId: outlet.id, label: { hi: "अच्छा" }, phrases: {}, sortOrder: 0, active: true,
      });

      const data = await (await metrics(req("/api/admin/metrics", undefined, "GET"))).json();
      const mine = data.outlets.find((o: { outlet_id: string }) => o.outlet_id === outlet.id);
      expect(mine).toMatchObject({ scans: 1, completed: 0, conversion: 0 });
      expect(data.window_days).toBe(30);
      expect(data.trial_eligible).toBeGreaterThanOrEqual(1);

      const res = await detail(req("/api/x", undefined, "GET"), ctx(outlet.id));
      const d = await res.json();
      expect(d).toMatchObject({ business_name: "Test Clinic", scans_30d: 1, completed_30d: 0, hub_mode: "direct" });
      expect(d.tags).toEqual([expect.objectContaining({ label: "अच्छा", phrases: [], active: true })]);
      expect(d.payments).toEqual([expect.objectContaining({ amount_minor: 99900, currency_code: "INR", status: "captured" })]);
      expect((await detail(req("/api/x", undefined, "GET"), ctx(crypto.randomUUID()))).status).toBe(404);
    }));

  it("zero_scan lists a live outlet a week in with no scans", () =>
    inTx(async (tx) => {
      await makeOutlet(tx, await makeAccount(tx), {
        state: "trial", businessName: "Zero Scan Co", activatedAt: new Date(Date.now() - 8 * 86_400_000),
      });
      const data = await (await metrics(req("/api/admin/metrics", undefined, "GET"))).json();
      expect(data.zero_scan).toContain("Zero Scan Co");
    }));

  it("state override validates, applies and logs the previous state", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx), { state: "suspended" });
      const call = (b: unknown) => overrideState(req("/api/x", b), ctx(outlet.id));
      expect((await call({ state: "active", reason: "" })).status).toBe(422);
      expect((await call({ state: "active", reason: "x".repeat(301) })).status).toBe(422);
      const bad = await call({ state: "pending_payment", reason: "nope nope" });
      expect(bad.status).toBe(400);
      expect((await bad.json()).detail.error.code).toBe("INVALID_STATE");
      expect((await overrideState(req("/api/x", { state: "active", reason: "okay" }), ctx(crypto.randomUUID()))).status).toBe(404);

      expect((await call({ state: "active", reason: "comped for pilot" })).status).toBe(204);
      const [row] = await tx.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(row.state).toBe("active");
      const [log] = (await notesFor(tx, outlet.id)).filter((n) => n.template === "admin_state_override");
      expect(log).toMatchObject({ channel: "internal", status: "sent", error: "suspended -> active: comped for pilot" });
    }));
});
