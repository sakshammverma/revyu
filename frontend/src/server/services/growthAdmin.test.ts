/**
 * Admin side of growth services, print kits and referrals. Ports of the admin
 * parts of backend/tests/test_growth_api.py and test_referrals_and_gap.py.
 * Runs in a rolled-back transaction on the dev DB.
 */
import { eq } from "drizzle-orm";
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
    getEnv: () => ({ ...actual.getEnv(), adminSessionSecret: "admin-test-secret", adminNotifyEmail: "" }),
  };
});

import { POST as postApply } from "@/app/api/admin/referrals/[reward_id]/apply/route";
import { GET as listRewards } from "@/app/api/admin/referrals/route";
import { PATCH as patchKit } from "@/app/api/admin/print-kits/[kit_id]/route";
import { GET as listKits } from "@/app/api/admin/print-kits/route";
import { GET as getRequest, PATCH as patchRequest } from "@/app/api/admin/service-requests/[request_id]/route";
import { GET as listRequests } from "@/app/api/admin/service-requests/route";
import { PUT as putService } from "@/app/api/admin/services/[service_id]/route";
import { GET as listServices, POST as postService } from "@/app/api/admin/services/route";
import { GET as ownerGetRequest } from "@/app/api/app/service-requests/[request_id]/route";
import { schema, type DbLike } from "@/server/db";
import { attachReferral, getOrCreateCode, markRefereePaid } from "@/server/services/referrals";
import { inRolledBackTx, issueOwnerSession, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";

const { notifications, printKitOrders, referralRewards, serviceCatalog, serviceRequests, serviceRequestEvents } = schema;

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const AUTH = { authorization: "Bearer admin-test-secret" };
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
type H = (r: Request, c: never) => Promise<Response>;
const call = (fn: unknown, path: string, opts: { method?: string; body?: unknown; params?: Record<string, string>; auth?: boolean } = {}) =>
  (fn as H)(
    makeRequest(path, { method: opts.method, body: opts.body, headers: opts.auth === false ? {} : AUTH }),
    (opts.params ? routeCtx(opts.params) : undefined) as never,
  );

const svcBody = (over: Record<string, unknown> = {}) => ({
  key: `t_${uid()}`,
  name: "Website",
  tagline: "A site",
  deliverables: ["a"],
  questions: [{ id: "q", label: "Domain?" }],
  sort_order: -1000,
  ...over,
});

async function seedRequest(tx: DbLike) {
  const owner = await makeAccount(tx, "g");
  const outlet = await makeOutlet(tx, owner, { businessName: "Fixture Biz" });
  const [svc] = await tx
    .insert(serviceCatalog)
    .values({ id: crypto.randomUUID(), key: `t_${uid()}`, name: "Website", tagline: "t", questions: [], deliverables: [], descriptionMd: "", active: true, sortOrder: -1000 })
    .returning();
  const [req] = await tx
    .insert(serviceRequests)
    .values({ id: crypto.randomUUID(), accountId: owner.id, outletId: outlet.id, serviceId: svc.id, status: "requested", currencyCode: "INR", answers: {} })
    .returning();
  return { owner, outlet, svc, req };
}

describe("admin auth", () => {
  it("every admin route needs the bearer token", async () => {
    const rid = crypto.randomUUID();
    const p = { request_id: rid, service_id: rid, kit_id: rid, reward_id: rid };
    for (const [fn, method, path] of [
      [listServices, "GET", "/api/admin/services"],
      [postService, "POST", "/api/admin/services"],
      [putService, "PUT", `/api/admin/services/${rid}`],
      [listRequests, "GET", "/api/admin/service-requests"],
      [getRequest, "GET", `/api/admin/service-requests/${rid}`],
      [patchRequest, "PATCH", `/api/admin/service-requests/${rid}`],
      [listKits, "GET", "/api/admin/print-kits"],
      [patchKit, "PATCH", `/api/admin/print-kits/${rid}`],
      [listRewards, "GET", "/api/admin/referrals"],
      [postApply, "POST", `/api/admin/referrals/${rid}/apply`],
    ] as const) {
      const res = await call(fn, path, { method, body: method === "GET" ? undefined : {}, params: p, auth: false });
      expect(res.status, path).toBe(401);
    }
  });
});

describe("admin service catalogue", () => {
  it("creates, lists (incl. inactive), updates; duplicate keys are 409; validation is 422", () =>
    inTx(async () => {
      const b = svcBody();
      const res = await call(postService, "/api/admin/services", { body: b });
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created).toMatchObject({ key: b.key, active: true, sort_order: -1000, lead_time_days: null, cover_image_url: null, description_md: "" });

      const dup = await call(postService, "/api/admin/services", { body: b });
      expect([dup.status, (await dup.json()).detail.error.code]).toEqual([409, "KEY_TAKEN"]);
      expect((await call(postService, "/api/admin/services", { body: svcBody({ key: "Bad Key" }) })).status).toBe(422);
      expect((await call(postService, "/api/admin/services", { body: svcBody({ lead_time_days: 0 }) })).status).toBe(422);

      const upd = await call(putService, "/x", {
        method: "PUT",
        body: { ...b, name: "Site v2", active: false, lead_time_days: 7 },
        params: { service_id: created.id },
      });
      expect(await upd.json()).toMatchObject({ name: "Site v2", active: false, lead_time_days: 7 });
      const items = (await (await call(listServices, "/api/admin/services")).json()).items;
      expect(items[0]).toMatchObject({ id: created.id, active: false });

      // Renaming onto another service's key is refused (Python: 500).
      const other = await (await call(postService, "/api/admin/services", { body: svcBody() })).json();
      const clash = await call(putService, "/x", { method: "PUT", body: { ...b, key: b.key }, params: { service_id: other.id } });
      expect([clash.status, (await clash.json()).detail.error.code]).toEqual([409, "KEY_TAKEN"]);

      const missing = crypto.randomUUID();
      expect((await call(putService, "/x", { method: "PUT", body: svcBody(), params: { service_id: missing } })).status).toBe(404);
      expect((await call(putService, "/x", { method: "PUT", body: svcBody(), params: { service_id: "nope" } })).status).toBe(422);
    }), 240_000);
});

describe("admin service requests", () => {
  it("lists with filter, shows detail incl. internal notes, quote flow, owner privacy, owner email", () =>
    inTx(async (tx) => {
      const { owner, outlet, req } = await seedRequest(tx);
      const rid = req.id;
      const p = { request_id: rid };

      const all = (await (await call(listRequests, "/api/admin/service-requests")).json()).items;
      expect(all.find((i: { id: string }) => i.id === rid)).toMatchObject({
        status: "requested",
        business_name: "Fixture Biz",
        owner_email: owner.ownerEmail,
        outlet_id: outlet.id,
        paid: false,
      });
      expect(all[0]).not.toHaveProperty("events");
      const filtered = (await (await call(listRequests, "/api/admin/service-requests?status=quoted")).json()).items;
      expect(filtered.find((i: { id: string }) => i.id === rid)).toBeUndefined();
      expect((await (await call(listRequests, "/api/admin/service-requests?status=")).json()).items.length).toBeGreaterThan(0);

      // Quoting needs an amount (already-present or in the same call).
      const noQuote = await call(patchRequest, "/x", { method: "PATCH", body: { status: "quoted" }, params: p });
      expect([noQuote.status, (await noQuote.json()).detail.error.code]).toEqual([422, "QUOTE_REQUIRED"]);
      const [untouched] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, rid));
      expect(untouched.status).toBe("requested");

      const due = "2027-01-15T10:00:00+05:30";
      const q = await call(patchRequest, "/x", {
        method: "PATCH",
        body: { status: "quoted", quoted_amount_minor: 1_500_000, due_at: due, message: " Here is your quote ", note: "margin is thin" },
        params: p,
      });
      expect(q.status).toBe(200);
      const body = await q.json();
      expect(body).toMatchObject({ status: "quoted", quoted_amount_minor: 1_500_000, due_at: "2027-01-15T04:30:00.000+00:00" });
      expect(body.events.map((e: { kind: string; body: string; actor: string }) => [e.kind, e.body, e.actor])).toEqual([
        ["status_changed", "Quoted", "admin"],
        ["message", "Here is your quote", "admin"],
        ["note", "margin is thin", "admin"],
      ]);
      // Owner mail logged once, template service_update.
      const mails = await tx.select().from(notifications).where(eq(notifications.accountId, owner.id));
      expect(mails.filter((m) => m.template === "service_update")).toHaveLength(1);

      // Admin detail shows notes; the owner's view hides them.
      expect((await (await call(getRequest, "/x", { params: p })).json()).events).toHaveLength(3);
      const session = await issueOwnerSession(tx, owner);
      const ownerView = await ownerGetRequest(makeRequest(`/api/app/service-requests/${rid}`, { session }), routeCtx(p));
      const ev = (await ownerView.json()).events as { kind: string }[];
      expect(ev.map((e) => e.kind)).toEqual(["status_changed", "message"]);

      // Same status again: no new status event; note-only edit does not email.
      const again = await call(patchRequest, "/x", { method: "PATCH", body: { status: "quoted", note: "n2" }, params: p });
      expect((await again.json()).events.filter((e: { kind: string }) => e.kind === "status_changed")).toHaveLength(1);
      expect((await tx.select().from(notifications).where(eq(notifications.accountId, owner.id))).filter((m) => m.template === "service_update")).toHaveLength(1);

      // A quote already on file satisfies the check; arbitrary transitions are allowed.
      const acc = await call(patchRequest, "/x", { method: "PATCH", body: { status: "in_progress" }, params: p });
      expect((await acc.json()).events.at(-1)).toMatchObject({ body: "In progress", kind: "status_changed" });

      expect((await call(getRequest, "/x", { params: { request_id: crypto.randomUUID() } })).status).toBe(404);
      expect((await call(patchRequest, "/x", { method: "PATCH", body: {}, params: { request_id: crypto.randomUUID() } })).status).toBe(404);
      expect((await call(patchRequest, "/x", { method: "PATCH", body: { status: "bogus" }, params: p })).status).toBe(422);
      expect((await call(patchRequest, "/x", { method: "PATCH", body: { quoted_amount_minor: -1 }, params: p })).status).toBe(422);
      expect((await tx.select().from(serviceRequestEvents).where(eq(serviceRequestEvents.requestId, rid))).length).toBe(5);
    }), 240_000);
});

describe("admin print kits", () => {
  it("lists delivery orders only, updates status with 204, 404 for unknown", () =>
    inTx(async (tx) => {
      const owner = await makeAccount(tx, "k");
      const outlet = await makeOutlet(tx, owner, { businessName: "Kit Biz" });
      const mk = (method: string) =>
        tx.insert(printKitOrders).values({ id: crypto.randomUUID(), outletId: outlet.id, method, feeMinor: method === "deliver" ? 19_900 : 0, currencyCode: "INR", status: "requested", address: "12 MG Road", phone: "999" }).returning();
      const [deliver] = await mk("deliver");
      const [own] = await mk("self_print");

      const items = (await (await call(listKits, "/api/admin/print-kits")).json()).items as { id: string; business_name: string }[];
      expect(items.find((i) => i.id === deliver.id)).toMatchObject({ business_name: "Kit Biz", method: "deliver", fee_minor: 19_900, status: "requested" });
      expect(items.find((i) => i.id === own.id)).toBeUndefined();

      const res = await call(patchKit, "/x", { method: "PATCH", body: { status: "shipped" }, params: { kit_id: deliver.id } });
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      expect((await tx.select().from(printKitOrders).where(eq(printKitOrders.id, deliver.id)))[0].status).toBe("shipped");
      expect((await call(patchKit, "/x", { method: "PATCH", body: { status: "lost" }, params: { kit_id: deliver.id } })).status).toBe(422);
      expect((await call(patchKit, "/x", { method: "PATCH", body: { status: "paid" }, params: { kit_id: crypto.randomUUID() } })).status).toBe(404);
    }), 240_000);
});

describe("admin referrals", () => {
  it("lists, filters, and applies an earned reward exactly once", () =>
    inTx(async (tx) => {
      const referrer = await makeAccount(tx, "r");
      const referred = await makeAccount(tx, "d");
      await makeOutlet(tx, referred, { businessName: "Referred Biz" });
      await attachReferral(tx, referred, await getOrCreateCode(tx, referrer));
      const [reward] = await tx.select().from(referralRewards).where(eq(referralRewards.referredAccountId, referred.id));
      const apply = (id: string) => call(postApply, "/x", { method: "POST", params: { reward_id: id } });

      // Pending rewards cannot be applied: the referee has not paid.
      const early = await apply(reward.id);
      expect([early.status, (await early.json()).detail.error.code]).toEqual([409, "NOT_EARNED"]);

      await markRefereePaid(tx, referred.id);
      const earned = (await (await call(listRewards, "/api/admin/referrals?status=earned")).json()) as Record<string, unknown>[];
      expect(earned.find((r) => r.id === reward.id)).toMatchObject({
        referrer_email: referrer.ownerEmail,
        referrer_name: referrer.ownerName,
        referred_business: "Referred Biz",
        status: "earned",
        discount_percent: 70,
      });
      expect(Object.keys(earned[0]).sort()).toEqual(["discount_percent", "earned_at", "id", "referred_business", "referrer_email", "referrer_name", "status"]);
      expect(((await (await call(listRewards, "/api/admin/referrals?status=applied")).json()) as { id: string }[]).some((r) => r.id === reward.id)).toBe(false);

      const ok = await apply(reward.id);
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ id: reward.id, status: "applied" });
      const [row] = await tx.select().from(referralRewards).where(eq(referralRewards.id, reward.id));
      expect(row.appliedAt).toBeTruthy();
      const second = await apply(reward.id);
      expect([second.status, (await second.json()).detail.error.code]).toEqual([409, "NOT_EARNED"]);
      expect((await tx.select().from(referralRewards).where(eq(referralRewards.id, reward.id)))[0].appliedAt).toEqual(row.appliedAt);

      expect((await apply(crypto.randomUUID())).status).toBe(404);
      expect((await apply("nope")).status).toBe(422);
    }), 240_000);
});
