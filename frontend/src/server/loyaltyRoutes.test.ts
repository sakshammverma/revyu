/**
 * Route handlers for the wallet (/api/flow/[slug]/rewards/...), the staff
 * console (/api/staff/[slug]/...) and the owner loyalty setup, run inside
 * rolled-back transactions (pattern: testing/handlerPattern.test.ts).
 */
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown, limits: false }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
// Rate limits are switched off in .env.local; one test turns them on.
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return {
    ...actual,
    getEnv: () => {
      const env = actual.getEnv();
      return holder.limits ? { ...env, disableRateLimits: false } : env;
    },
  };
});

import { DELETE as deleteBadge, PUT as putBadge } from "@/app/api/app/outlets/[outletId]/hub/loyalty/badges/[badgeId]/route";
import { POST as postBadge } from "@/app/api/app/outlets/[outletId]/hub/loyalty/badges/route";
import { POST as postAck } from "@/app/api/app/outlets/[outletId]/hub/loyalty/acknowledge/route";
import { GET as getMembers } from "@/app/api/app/outlets/[outletId]/hub/loyalty/members/route";
import { GET as getRedemptions } from "@/app/api/app/outlets/[outletId]/hub/loyalty/redemptions/route";
import { GET as getLoyalty, PUT as putLoyalty } from "@/app/api/app/outlets/[outletId]/hub/loyalty/route";
import { PATCH as patchPin } from "@/app/api/app/outlets/[outletId]/hub/loyalty/staff-pins/[pinId]/route";
import { POST as postPin } from "@/app/api/app/outlets/[outletId]/hub/loyalty/staff-pins/route";
import { POST as postCode } from "@/app/api/flow/[slug]/rewards/join/route";
import { GET as getCode } from "@/app/api/flow/[slug]/rewards/code/route";
import { POST as postRecover } from "@/app/api/flow/[slug]/rewards/recover/route";
import { DELETE as deleteWallet, GET as getWallet } from "@/app/api/flow/[slug]/rewards/wallet/route";
import { POST as postStaffLogin } from "@/app/api/staff/[slug]/login/route";
import { GET as getStaffMember } from "@/app/api/staff/[slug]/member/[publicId]/route";
import { POST as postStaffTransfer } from "@/app/api/staff/[slug]/member/[publicId]/transfer/route";
import { POST as postStaffRedeem } from "@/app/api/staff/[slug]/redeem/route";
import { POST as postStaffVisit } from "@/app/api/staff/[slug]/visits/route";
import type { DbLike } from "@/server/db";
import { schema } from "@/server/db";
import { inRolledBackTx, issueOwnerSession, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";
import { enableRewards, makeProgram } from "@/server/testing/loyaltyFixtures";
import { eq } from "drizzle-orm";
import { visitCode } from "@/server/services/loyalty";

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

async function world(tx: DbLike, over: Parameters<typeof makeOutlet>[2] = {}) {
  const account = await makeAccount(tx);
  const outlet = await makeOutlet(tx, account, over);
  await enableRewards(tx, outlet);
  const { pin, badge } = await makeProgram(tx, outlet, { pin: "4821", cooldownHours: 0 });
  return { account, outlet, pin, badge, session: await issueOwnerSession(tx, account) };
}

const slugCtx = (slug: string) => routeCtx({ slug });
const flow = (slug: string, part: string) => `/api/flow/${slug}/rewards/${part}`;

async function joinWallet(slug: string, phone = "98765 43210", name = "Asha") {
  const res = await postCode(makeRequest(flow(slug, "join"), { body: { name, phone, consent: true } }), slugCtx(slug));
  return { res, json: await res.json() };
}

async function staffToken(slug: string, pin = "4821") {
  const res = await postStaffLogin(makeRequest(`/api/staff/${slug}/login`, { body: { pin } }), slugCtx(slug));
  return (await res.json()).token as string;
}

const staffReq = (slug: string, part: string, token: string, body?: unknown, method = "POST") =>
  makeRequest(`/api/staff/${slug}/${part}`, { method, body, headers: { authorization: `Bearer ${token}` } });

describe("wallet routes", () => {
  it("joins (201), serves the wallet and code with the token, and 401s without it", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const { res, json } = await joinWallet(outlet.slug);
      expect(res.status).toBe(201);
      expect(json.token).toHaveLength(32);
      expect(json.wallet).toMatchObject({ visits: 0, next_badge: { name: "Regular", remaining: 2 }, rewards: [] });
      expect(Object.keys(json.wallet).sort()).toEqual(["badges", "member", "next_badge", "rewards", "visits"]);
      const headers = { "x-wallet-token": json.token as string };

      const w = await getWallet(makeRequest(flow(outlet.slug, "wallet"), { headers }), slugCtx(outlet.slug));
      expect(w.status).toBe(200);
      expect((await w.json()).member.name).toBe("Asha");

      const c = await getCode(makeRequest(flow(outlet.slug, "code"), { headers }), slugCtx(outlet.slug));
      expect(c.status).toBe(200);
      const code = await c.json();
      expect(code.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-\d{6}$/);
      expect(code.expires_in).toBeGreaterThan(0);
      expect(code.expires_in).toBeLessThanOrEqual(60);
      expect(code.qr_svg).toMatch(/^<\?xml version='1.0' encoding='UTF-8'\?>\n<svg width="\d+(\.\d)?mm"/);

      for (const bad of [{}, { "x-wallet-token": "nope" }, { "x-wallet-token": "" }] as Record<string, string>[]) {
        for (const [handlerFn, part] of [[getWallet, "wallet"], [getCode, "code"]] as const) {
          const r = await handlerFn(makeRequest(flow(outlet.slug, part), { headers: bad }), slugCtx(outlet.slug));
          expect(r.status).toBe(401);
          expect(await r.json()).toEqual({ detail: { error: { code: "NO_WALLET" } } });
        }
      }
    }));

  it("a token only works at its own outlet", () =>
    inTx(async (tx) => {
      const a = await world(tx);
      const b = await world(tx);
      const { json } = await joinWallet(a.outlet.slug);
      const r = await getWallet(
        makeRequest(flow(b.outlet.slug, "wallet"), { headers: { "x-wallet-token": json.token } }),
        slugCtx(b.outlet.slug),
      );
      expect(r.status).toBe(401);
    }));

  it("rejects a second wallet for the same phone with 409 PHONE_EXISTS and a message", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      await joinWallet(outlet.slug);
      const { res, json } = await joinWallet(outlet.slug, "+91 98765-43210", "Someone else");
      expect(res.status).toBe(409);
      expect(json.detail.error.code).toBe("PHONE_EXISTS");
      expect(json.detail.error.message).toMatch(/transfer code/);
    }));

  it("validates the join body and the number (422), stores the consent choice as sent", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const bad = (body: unknown) => postCode(makeRequest(flow(outlet.slug, "join"), { body }), slugCtx(outlet.slug));
      expect((await bad({ name: "", phone: "9876543210" })).status).toBe(422);
      expect((await bad({ name: "A", phone: "123" })).status).toBe(422);
      const short = await bad({ name: "A", phone: "1234567" });
      expect(short.status).toBe(422);
      expect((await short.json()).detail.error.code).toBe("BAD_PHONE");
      const ok = await bad({ name: "No consent", phone: "9000000020" });
      expect(ok.status).toBe(201);
      const [row] = await tx.select().from(schema.loyaltyMembers).where(eq(schema.loyaltyMembers.phone, "919000000020"));
      expect(row.contactConsent).toBe(false);
    }));

  it("404 NOT_AVAILABLE when the module is off or the outlet is paused; unknown slug 404", () =>
    inTx(async (tx) => {
      const off = await makeOutlet(tx, await makeAccount(tx));
      await enableRewards(tx, off, { enabled: false });
      await makeProgram(tx, off);
      const noModule = await makeOutlet(tx, await makeAccount(tx));
      const paused = await world(tx, { state: "suspended" });
      for (const o of [off, noModule, paused.outlet]) {
        const { res, json } = await joinWallet(o.slug);
        expect(res.status).toBe(404);
        expect(json).toEqual({ detail: { error: { code: "NOT_AVAILABLE" } } });
      }
      const r = await postCode(makeRequest(flow("pl-nope", "join"), { body: { name: "A", phone: "9876543210" } }), slugCtx("pl-nope"));
      expect(r.status).toBe(404);
      expect((await r.json()).detail.error.code).toBe("OUTLET_NOT_FOUND");
    }));

  it("the code is 403 PAUSED when the outlet stops collecting", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const { json } = await joinWallet(outlet.slug);
      await tx.update(schema.outlets).set({ state: "suspended" }).where(eq(schema.outlets.id, outlet.id));
      const r = await getCode(makeRequest(flow(outlet.slug, "code"), { headers: { "x-wallet-token": json.token } }), slugCtx(outlet.slug));
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ detail: { error: { code: "PAUSED" } } });
    }));

  it("recovers a wallet with a staff transfer code, signing the old device out", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const { json } = await joinWallet(outlet.slug);
      const token = await staffToken(outlet.slug);
      const issued = await postStaffTransfer(
        staffReq(outlet.slug, `member/${json.wallet.member.public_id}/transfer`, token),
        routeCtx({ slug: outlet.slug, publicId: json.wallet.member.public_id }),
      );
      expect(issued.status).toBe(200);
      const { code, member, valid_minutes } = await issued.json();
      expect({ member, valid_minutes }).toEqual({ member: "Asha", valid_minutes: 15 });

      const recover = (body: unknown) => postRecover(makeRequest(flow(outlet.slug, "recover"), { body }), slugCtx(outlet.slug));
      expect((await recover({ phone: "9876543210", code: "12345" })).status).toBe(422); // not 6 digits
      const wrong = await recover({ phone: "9876543210", code: code === "000000" ? "111111" : "000000" });
      expect(wrong.status).toBe(422);
      expect((await wrong.json()).detail.error.code).toBe("BAD_TRANSFER");

      const ok = await recover({ phone: "98765 43210", code });
      expect(ok.status).toBe(200);
      const fresh = await ok.json();
      expect(fresh.token).not.toBe(json.token);
      expect(fresh.wallet.member.name).toBe("Asha");
      const old = await getWallet(makeRequest(flow(outlet.slug, "wallet"), { headers: { "x-wallet-token": json.token } }), slugCtx(outlet.slug));
      expect(old.status).toBe(401);
      expect((await recover({ phone: "98765 43210", code })).status).toBe(422); // single use
    }));

  it("deletes the wallet (204) and everything behind it", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const { json } = await joinWallet(outlet.slug);
      const headers = { "x-wallet-token": json.token as string };
      const none = await deleteWallet(makeRequest(flow(outlet.slug, "wallet"), { method: "DELETE" }), slugCtx(outlet.slug));
      expect(none.status).toBe(401);
      const del = await deleteWallet(makeRequest(flow(outlet.slug, "wallet"), { method: "DELETE", headers }), slugCtx(outlet.slug));
      expect(del.status).toBe(204);
      expect(await del.text()).toBe("");
      const again = await getWallet(makeRequest(flow(outlet.slug, "wallet"), { headers }), slugCtx(outlet.slug));
      expect(again.status).toBe(401);
      expect(await tx.select().from(schema.loyaltyMembers).where(eq(schema.loyaltyMembers.outletId, outlet.id))).toHaveLength(0);
    }));
});

describe("staff routes", () => {
  it("logs in with the PIN; wrong PIN is 401 BAD_PIN; bad shape is 422; unknown outlet 404", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const login = (slug: string, body: unknown) => postStaffLogin(makeRequest(`/api/staff/${slug}/login`, { body }), slugCtx(slug));
      const ok = await login(outlet.slug, { pin: "4821" });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ token: expect.stringMatching(/^[0-9a-f-]{36}\.[0-9a-f-]{36}\.\d+\.[0-9a-f]{64}$/), label: "Desk", outlet_name: "Test Clinic" });
      const wrong = await login(outlet.slug, { pin: "0000" });
      expect(wrong.status).toBe(401);
      expect(await wrong.json()).toEqual({ detail: { error: { code: "BAD_PIN", message: "Wrong PIN." } } });
      for (const pin of ["12", "1234567", "12a4", 1234]) expect((await login(outlet.slug, { pin })).status).toBe(422);
      expect((await login("pl-nope", { pin: "4821" })).status).toBe(404);
    }));

  it("a retired PIN no longer logs in", () =>
    inTx(async (tx) => {
      const { outlet, pin } = await world(tx);
      await tx.update(schema.staffPins).set({ active: false }).where(eq(schema.staffPins.id, pin.id));
      const r = await postStaffLogin(makeRequest(`/api/staff/${outlet.slug}/login`, { body: { pin: "4821" } }), slugCtx(outlet.slug));
      expect(r.status).toBe(401);
    }));

  it("rate limits login attempts per client (10 per 15 minutes)", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      holder.limits = true;
      try {
        const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.9`;
        const statuses: number[] = [];
        for (let i = 0; i < 12; i++) {
          const r = await postStaffLogin(
            makeRequest(`/api/staff/${outlet.slug}/login`, { body: { pin: "0000" }, headers: { "x-forwarded-for": ip } }),
            slugCtx(outlet.slug),
          );
          statuses.push(r.status);
          if (r.status === 429) expect(await r.json()).toEqual({ detail: { error: { code: "RATE_LIMITED" } } });
        }
        expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
        expect(statuses.slice(10)).toEqual([429, 429]);
      } finally {
        holder.limits = false;
      }
    }));

  it("needs a valid bearer token bound to this outlet", () =>
    inTx(async (tx) => {
      const a = await world(tx);
      const b = await world(tx);
      const tokenA = await staffToken(a.outlet.slug);
      const visit = (slug: string, auth?: string) =>
        postStaffVisit(
          makeRequest(`/api/staff/${slug}/visits`, { body: { code: "ABCD-123456" }, headers: auth ? { authorization: auth } : {} }),
          slugCtx(slug),
        );
      for (const auth of [undefined, "", "Bearer ", "Bearer garbage", tokenA.slice(0, -2) + "00"]) {
        const r = await visit(a.outlet.slug, auth === undefined ? undefined : auth.startsWith("Bearer") ? auth : `Bearer ${auth}`);
        expect(r.status).toBe(401);
        expect(await r.json()).toEqual({ detail: { error: { code: "UNAUTHORIZED" } } });
      }
      expect((await visit(b.outlet.slug, `Bearer ${tokenA}`)).status).toBe(401); // other outlet
      expect((await visit("pl-nope", `Bearer ${tokenA}`)).status).toBe(404);
      const lookup = await getStaffMember(
        makeRequest(`/api/staff/${a.outlet.slug}/member/ABCD`),
        routeCtx({ slug: a.outlet.slug, publicId: "ABCD" }),
      );
      expect(lookup.status).toBe(401);
    }));

  it("records visits (cool-down error is 422), lists pending rewards, redeems once", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const { json } = await joinWallet(outlet.slug);
      const publicId = json.wallet.member.public_id as string;
      const token = await staffToken(outlet.slug);
      const codeFor = async () =>
        (await (await getCode(makeRequest(flow(outlet.slug, "code"), { headers: { "x-wallet-token": json.token } }), slugCtx(outlet.slug))).json()).code as string;
      const visit = (code: string) => postStaffVisit(staffReq(outlet.slug, "visits", token, { code }), slugCtx(outlet.slug));

      const bad = await visit(`${publicId}-000000`);
      expect(bad.status).toBe(422);
      expect(await bad.json()).toEqual({
        detail: { error: { code: "BAD_CODE", message: "Code not recognised or expired. Ask them to refresh." } },
      });
      expect((await visit("xx")).status).toBe(422); // shorter than 3 characters is a body error
      const fmt = await visit("nodash");
      expect((await fmt.json()).detail.error).toEqual({ code: "BAD_CODE", message: "Enter the code like A7F3-123456" });

      const first = await visit(await codeFor());
      expect(first.status).toBe(200);
      expect((await first.json()).visits).toBe(1);

      // cooldown is 0 for this fixture; make it 12 to see the refusal
      await tx.update(schema.loyaltyPrograms).set({ cooldownHours: 12 }).where(eq(schema.loyaltyPrograms.outletId, outlet.id));
      const again = await visit(await codeFor());
      expect(again.status).toBe(422);
      expect((await again.json()).detail.error.code).toBe("COOLDOWN");
      await tx.update(schema.loyaltyPrograms).set({ cooldownHours: 0 }).where(eq(schema.loyaltyPrograms.outletId, outlet.id));

      const second = await (await visit(await codeFor())).json();
      expect(second).toMatchObject({ visits: 2, badges_earned: ["Regular"], rewards_ready: ["10% off"] });
      expect(Object.keys(second).sort()).toEqual(["badges_earned", "member", "pending_rewards", "rewards_ready", "visits"]);
      const redeemCode = second.pending_rewards[0].redeem_code as string;

      const lookup = await getStaffMember(staffReq(outlet.slug, `member/${publicId.toLowerCase()}`, token, undefined, "GET"), routeCtx({ slug: outlet.slug, publicId: publicId.toLowerCase() }));
      expect(lookup.status).toBe(200);
      const l = await lookup.json();
      expect(l.visits).toBe(2);
      expect(l.pending_rewards.map((g: { status: string }) => g.status)).toEqual(["available"]);
      const missing = await getStaffMember(staffReq(outlet.slug, "member/ZZZZ", token, undefined, "GET"), routeCtx({ slug: outlet.slug, publicId: "ZZZZ" }));
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({ detail: { error: { code: "NOT_FOUND", message: "No such member." } } });

      const redeem = (code: string) => postStaffRedeem(staffReq(outlet.slug, "redeem", token, { redeem_code: code }), slugCtx(outlet.slug));
      expect((await redeem("abc")).status).toBe(422); // too short
      const done = await redeem(redeemCode);
      expect(done.status).toBe(200);
      expect(await done.json()).toEqual({ title: "10% off", member: "Asha", public_id: publicId });
      const twice = await redeem(redeemCode);
      expect(twice.status).toBe(422);
      expect(await twice.json()).toEqual({ detail: { error: { code: "ALREADY_USED", message: "This reward was already redeemed" } } });
      expect((await (await redeem("NOSUCHCD")).json()).detail.error.code).toBe("BAD_REWARD");

      const after = await (await getStaffMember(staffReq(outlet.slug, `member/${publicId}`, token, undefined, "GET"), routeCtx({ slug: outlet.slug, publicId }))).json();
      expect(after.pending_rewards).toEqual([]);
    }));

  it("visits are 403 PAUSED when the outlet stops collecting, but a redemption still works", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const token = await staffToken(outlet.slug);
      await tx.update(schema.outlets).set({ state: "suspended" }).where(eq(schema.outlets.id, outlet.id));
      const r = await postStaffVisit(staffReq(outlet.slug, "visits", token, { code: "ABCD-123456" }), slugCtx(outlet.slug));
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ detail: { error: { code: "PAUSED" } } });
      const red = await postStaffRedeem(staffReq(outlet.slug, "redeem", token, { redeem_code: "ABCDEFGH" }), slugCtx(outlet.slug));
      expect((await red.json()).detail.error.code).toBe("BAD_REWARD");
    }));

  it("staff can issue a transfer code only for a member that exists", () =>
    inTx(async (tx) => {
      const { outlet } = await world(tx);
      const token = await staffToken(outlet.slug);
      const r = await postStaffTransfer(staffReq(outlet.slug, "member/ZZZZ/transfer", token), routeCtx({ slug: outlet.slug, publicId: "ZZZZ" }));
      expect(r.status).toBe(422);
      expect((await r.json()).detail.error).toEqual({ code: "NOT_FOUND", message: "No such member." });
    }));
});

describe("owner loyalty routes", () => {
  const path = (id: string, part = "") => `/api/app/outlets/${id}/hub/loyalty${part}`;
  const badgeBody = {
    name: "Gold",
    icon: "crown",
    visits_required: 5,
    active: true,
    reward: { type: "freebie", title: "Free coffee", terms: "One per visit", expires_days: 60 },
  };

  it("requires the owner session and ownership of the outlet", () =>
    inTx(async (tx) => {
      const a = await world(tx);
      const b = await world(tx);
      const anon = await getLoyalty(makeRequest(path(a.outlet.id)), routeCtx({ outletId: a.outlet.id }));
      expect(anon.status).toBe(401);
      const cross = await getLoyalty(makeRequest(path(a.outlet.id), { session: b.session }), routeCtx({ outletId: a.outlet.id }));
      expect(cross.status).toBe(403);
      expect(await cross.json()).toEqual({ detail: { error: { code: "FORBIDDEN" } } });
      const malformed = await getLoyalty(makeRequest(path("nope"), { session: a.session }), routeCtx({ outletId: "nope" }));
      expect(malformed.status).toBe(422);
    }));

  it("returns the programme state with badges, pins, staff url and stats", () =>
    inTx(async (tx) => {
      const { outlet, session, badge, pin } = await world(tx);
      const res = await getLoyalty(makeRequest(path(outlet.id), { session }), routeCtx({ outletId: outlet.id }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Object.keys(json).sort()).toEqual(["acknowledged", "badges", "cooldown_hours", "icons", "staff_pins", "staff_url", "stats", "terms"]);
      expect(json.acknowledged).toBe(true);
      expect(json.cooldown_hours).toBe(0);
      expect(json.icons).toEqual(["sparkle", "heart", "crown", "gift", "flame", "gem", "leaf", "bolt"]);
      expect(json.badges).toEqual([
        { id: badge.id, name: "Regular", icon: "sparkle", visits_required: 2, active: true,
          reward: { type: "percent_discount", percent: 10, value_minor: null, title: "10% off", terms: null, expires_days: 30 } },
      ]);
      expect(json.staff_pins).toEqual([{ id: pin.id, label: "Desk", active: true }]);
      expect(json.staff_url).toMatch(new RegExp(`/staff/${outlet.slug}$`));
      expect(json.stats).toEqual({ members: 0, visits_30d: 0, visits_total: 0, badges_awarded: 0, rewards_issued: 0, rewards_redeemed: 0 });
    }));

  it("PUT validates cooldown and terms; acknowledge records who accepted", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const outlet = await makeOutlet(tx, account);
      const session = await issueOwnerSession(tx, account);
      const ctx = routeCtx({ outletId: outlet.id });
      const put = (body: unknown) => putLoyalty(makeRequest(path(outlet.id), { method: "PUT", body, session }), ctx);
      expect((await put({ cooldown_hours: -1 })).status).toBe(422);
      expect((await put({ cooldown_hours: 721 })).status).toBe(422);
      expect((await put({ cooldown_hours: 1.5 })).status).toBe(422);
      expect((await put({ cooldown_hours: 6, terms: "x".repeat(1001) })).status).toBe(422);
      const ok = await put({ cooldown_hours: 6, terms: " One visit per day " });
      expect(ok.status).toBe(204);
      const before = await (await getLoyalty(makeRequest(path(outlet.id), { session }), ctx)).json();
      expect(before).toMatchObject({ acknowledged: false, cooldown_hours: 6, terms: "One visit per day" });
      const ack = await postAck(makeRequest(path(outlet.id, "/acknowledge"), { method: "POST", session }), ctx);
      expect(ack.status).toBe(204);
      const after = await (await getLoyalty(makeRequest(path(outlet.id), { session }), ctx)).json();
      expect(after.acknowledged).toBe(true);
      const [row] = await tx.select().from(schema.loyaltyPrograms).where(eq(schema.loyaltyPrograms.outletId, outlet.id));
      expect(row).toMatchObject({ acknowledgedBy: "owner", cooldownHours: 6 });
    }));

  it("creates, edits and retires badges", () =>
    inTx(async (tx) => {
      const { outlet, session } = await world(tx);
      const ctx = routeCtx({ outletId: outlet.id });
      const created = await postBadge(makeRequest(path(outlet.id, "/badges"), { body: badgeBody, session }), ctx);
      expect(created.status).toBe(201);
      const b = await created.json();
      expect(b).toMatchObject({ name: "Gold", icon: "crown", visits_required: 5, active: true });
      expect(b.reward).toEqual({ type: "freebie", percent: null, value_minor: null, title: "Free coffee", terms: "One per visit", expires_days: 60 });

      const bctx = routeCtx({ outletId: outlet.id, badgeId: b.id });
      const edit = await putBadge(
        makeRequest(path(outlet.id, `/badges/${b.id}`), { method: "PUT", session, body: { ...badgeBody, name: "Platinum", reward: { type: "percent_discount", percent: 25, title: "25% off" } } }),
        bctx,
      );
      expect(edit.status).toBe(200);
      expect((await edit.json()).reward).toMatchObject({ type: "percent_discount", percent: 25, terms: null, expires_days: null });

      const bad = (body: unknown) => postBadge(makeRequest(path(outlet.id, "/badges"), { body, session }), ctx);
      expect((await bad({ ...badgeBody, icon: "star" })).status).toBe(422);
      const badIcon = await bad({ ...badgeBody, icon: "star" });
      expect((await badIcon.json()).detail.error.code).toBe("BAD_ICON");
      expect((await bad({ ...badgeBody, visits_required: 0 })).status).toBe(422);
      expect((await bad({ ...badgeBody, name: "   " })).status).toBe(422);
      const noPct = await bad({ ...badgeBody, reward: { type: "percent_discount", title: "x" } });
      expect(noPct.status).toBe(422);
      expect((await noPct.json()).detail.error).toEqual({ code: "BAD_REWARD", message: "Enter a discount percentage." });
      const noAmt = await bad({ ...badgeBody, reward: { type: "amount_discount", title: "x" } });
      expect((await noAmt.json()).detail.error.message).toBe("Enter a discount amount.");
      expect((await bad({ ...badgeBody, reward: { type: "gift_card", title: "x" } })).status).toBe(422);
      // icon omitted -> the first valid icon (FastAPI's default was invalid)
      const { icon: _icon, ...noIcon } = badgeBody;
      void _icon;
      expect((await (await bad(noIcon)).json()).icon).toBe("sparkle");

      const missing = routeCtx({ outletId: outlet.id, badgeId: crypto.randomUUID() });
      const nf = await putBadge(makeRequest(path(outlet.id, "/badges/x"), { method: "PUT", body: badgeBody, session }), missing);
      expect(nf.status).toBe(404);
      expect(await nf.json()).toEqual({ detail: { error: { code: "NOT_FOUND" } } });
      const malformed = await deleteBadge(
        makeRequest(path(outlet.id, "/badges/x"), { method: "DELETE", session }),
        routeCtx({ outletId: outlet.id, badgeId: "not-a-uuid" }),
      );
      expect(malformed.status).toBe(422);

      const del = await deleteBadge(makeRequest(path(outlet.id, `/badges/${b.id}`), { method: "DELETE", session }), bctx);
      expect(del.status).toBe(204);
      const state = await (await getLoyalty(makeRequest(path(outlet.id), { session }), ctx)).json();
      expect(state.badges.find((x: { id: string }) => x.id === b.id).active).toBe(false);
    }));

  it("another owner's badge is a 404 and cannot be edited", () =>
    inTx(async (tx) => {
      const a = await world(tx);
      const b = await world(tx);
      const r = await putBadge(
        makeRequest(path(b.outlet.id, `/badges/${a.badge.id}`), { method: "PUT", body: badgeBody, session: b.session }),
        routeCtx({ outletId: b.outlet.id, badgeId: a.badge.id }),
      );
      expect(r.status).toBe(404);
    }));

  it("manages staff PINs: create (201), duplicate refused, toggle via ?active", () =>
    inTx(async (tx) => {
      const { outlet, session } = await world(tx);
      const ctx = routeCtx({ outletId: outlet.id });
      const add = (body: unknown) => postPin(makeRequest(path(outlet.id, "/staff-pins"), { body, session }), ctx);
      expect((await add({ label: "x", pin: "12" })).status).toBe(422);
      expect((await add({ label: "x", pin: "abcd" })).status).toBe(422);
      expect((await add({ label: "", pin: "1234" })).status).toBe(422);
      const dup = await add({ label: "Dup", pin: "4821" });
      expect(dup.status).toBe(422);
      expect(await dup.json()).toEqual({ detail: { error: { code: "PIN_TAKEN", message: "Choose a different PIN." } } });
      const ok = await add({ label: "Weekend", pin: "135790" });
      expect(ok.status).toBe(201);
      const pin = await ok.json();
      expect(pin).toEqual({ id: expect.any(String), label: "Weekend", active: true });
      expect(await staffToken(outlet.slug, "135790")).toBeTruthy();

      const toggle = (id: string, q: string) =>
        patchPin(makeRequest(path(outlet.id, `/staff-pins/${id}${q}`), { method: "PATCH", session }), routeCtx({ outletId: outlet.id, pinId: id }));
      expect((await toggle(pin.id, "?active=false")).status).toBe(204);
      const login = await postStaffLogin(makeRequest(`/api/staff/${outlet.slug}/login`, { body: { pin: "135790" } }), slugCtx(outlet.slug));
      expect(login.status).toBe(401);
      expect((await toggle(pin.id, "?active=maybe")).status).toBe(422);
      expect((await toggle(pin.id, "")).status).toBe(204); // default active=true
      expect((await toggle(crypto.randomUUID(), "?active=false")).status).toBe(404);
      expect((await toggle("nope", "?active=false")).status).toBe(422);
    }));

  it("lists members (name, phone, visits) and redemptions for the owner", () =>
    inTx(async (tx) => {
      const { outlet, session } = await world(tx);
      const { json } = await joinWallet(outlet.slug);
      const token = await staffToken(outlet.slug);
      const visit = async () => {
        const code = visitCode({ publicId: json.wallet.member.public_id, codeSecret: (await tx.select().from(schema.loyaltyMembers).where(eq(schema.loyaltyMembers.outletId, outlet.id)))[0].codeSecret }).code;
        return (await postStaffVisit(staffReq(outlet.slug, "visits", token, { code }), slugCtx(outlet.slug))).json();
      };
      await visit();
      const second = await visit();
      await postStaffRedeem(staffReq(outlet.slug, "redeem", token, { redeem_code: second.pending_rewards[0].redeem_code }), slugCtx(outlet.slug));

      const ctx = routeCtx({ outletId: outlet.id });
      const members = await (await getMembers(makeRequest(path(outlet.id, "/members"), { session }), ctx)).json();
      expect(members.items).toHaveLength(1);
      expect(members.items[0]).toMatchObject({ public_id: json.wallet.member.public_id, name: "Asha", phone: "919876543210", contact_consent: true, visits: 2 });
      expect(Object.keys(members.items[0]).sort()).toEqual(["contact_consent", "id", "joined_at", "last_visit", "name", "phone", "public_id", "visits"]);
      expect(members.items[0].last_visit).toMatch(/^\d{4}-\d\d-\d\dT.*\+00:00$/);
      const reds = await (await getRedemptions(makeRequest(path(outlet.id, "/redemptions"), { session }), ctx)).json();
      expect(reds.items).toEqual([{ title: "10% off", member: "Asha", public_id: json.wallet.member.public_id, redeemed_at: expect.any(String) }]);
      const state = await (await getLoyalty(makeRequest(path(outlet.id), { session }), ctx)).json();
      expect(state.stats).toMatchObject({ members: 1, visits_total: 2, badges_awarded: 1, rewards_redeemed: 1 });
    }));
});
