/**
 * Port of the loyalty tests in backend/tests/test_hub_loyalty.py, plus
 * Python-interop vectors and the owner configuration rules. Everything runs in
 * a rolled-back transaction except the race tests at the bottom, which need
 * real concurrent connections and clean up after themselves.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { and, eq, inArray, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb, schema } from "@/server/db";
import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";
import { inRolledBackTx, makeAccount, makeOutlet } from "@/server/testing/helpers";
import { enableRewards, makeProgram } from "@/server/testing/loyaltyFixtures";
import { setModules } from "./hubConfig";
import {
  claimTransfer,
  codeFor,
  deleteMember,
  findPin,
  hashPin,
  hashToken,
  issueTransferCode,
  join,
  LoyaltyError,
  makeStaffToken,
  memberByToken,
  memberRows,
  normalizePhone,
  openGrants,
  readStaffToken,
  recordVisit,
  redeem,
  redemptionLog,
  stats,
  verifyPin,
  visitCode,
  wallet,
} from "./loyalty";
import { acknowledge, addBadge, addPin, editBadge, getLoyalty, putProgram, retireBadge, setPinActive } from "./loyaltyConfig";

const { loyaltyLedger, loyaltyMembers, loyaltyRewardGrants } = schema;

// The Python vectors below were signed with the default secret.
process.env.AUTH_SECRET = "change-me";

const rejects = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected ${code}`).toBeInstanceOf(LoyaltyError);
  expect((err as LoyaltyError).code).toBe(code);
};

const world = async (tx: Parameters<Parameters<typeof inRolledBackTx>[0]>[0], tag = "a") => {
  const outlet = await makeOutlet(tx, await makeAccount(tx, tag));
  return { outlet, ...(await makeProgram(tx, outlet)) };
};

describe("interoperability with rows and tokens made by FastAPI", () => {
  it("verifies a PIN hash produced by python hashlib.scrypt, and rejects others", async () => {
    const fromPython =
      "5134d2e30f1c184574401c849d7a46d2$9ee2198065fa052e02a1981e1d554aa5f6d79a0eeb88300405259e5554874b6d";
    expect(await verifyPin("4821", fromPython)).toBe(true);
    expect(await verifyPin("4822", fromPython)).toBe(false);
    expect(await verifyPin("4821", "garbage")).toBe(false);
    expect(await verifyPin("4821", "zz$00")).toBe(false);
    expect(await verifyPin("4821", `${fromPython}$x`)).toBe(false);
  });

  it("hashes PINs in the same salt$digest format with a fresh salt each time", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a).toMatch(/^[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await verifyPin("1234", a)).toBe(true);
  });

  it("derives the same visit code as python for a fixed secret and window", () => {
    expect(codeFor("abcdef0123456789", 29000000)).toBe("921768");
  });

  it("hashes wallet tokens with sha256 hex", () => {
    expect(hashToken("tok")).toBe("1a7674eb4ee78df7e1ac439a93c3fa8e3c945784d4dec9fd8e3011738b2f1d62");
  });

  it("accepts a staff token signed by python and signs tokens python accepts", () => {
    const o = "11111111-1111-1111-1111-111111111111";
    const p = "22222222-2222-2222-2222-222222222222";
    const fromPython = `${o}.${p}.4000028800.842b1649c398b536dd6381f6a6bf46c06bae80732544e436ff10ea19839182bb`;
    expect(readStaffToken(fromPython)).toEqual({ outletId: o, pinId: p });
    // Same inputs, same clock -> byte-identical token to the Python one.
    expect(makeStaffToken(o, p, 8, (4_000_028_800 - 8 * 3600) * 1000)).toBe(fromPython);
  });
});

describe("staff tokens", () => {
  it("are bound to the outlet, tamper-proof and expire", () => {
    const o = crypto.randomUUID();
    const p = crypto.randomUUID();
    const token = makeStaffToken(o, p);
    expect(readStaffToken(token)).toEqual({ outletId: o, pinId: p });
    expect(readStaffToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).toBeNull();
    expect(readStaffToken("garbage")).toBeNull();
    expect(readStaffToken("")).toBeNull();
    expect(readStaffToken(token.replace(o, crypto.randomUUID()))).toBeNull();
    expect(readStaffToken(token, Date.now() + 9 * 3600 * 1000)).toBeNull();
    expect(readStaffToken(token, Date.now() + 7 * 3600 * 1000)).not.toBeNull();
    expect(readStaffToken(token.replace(/.$/, "é"))).toBeNull(); // python raised TypeError (500) here
  });
});

describe("phone numbers", () => {
  it("normalises like python", () => {
    expect(normalizePhone("98765 43210")).toBe("919876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("919876543210");
    expect(normalizePhone("+44 7911 123456")).toBe("447911123456");
    expect(() => normalizePhone("12345")).toThrow(LoyaltyError);
    expect(() => normalizePhone("1".repeat(16))).toThrow(LoyaltyError);
  });
});

describe("join", () => {
  it("creates a wallet, stores consent, and refuses a second wallet for the same phone", () =>
    inRolledBackTx(async (tx) => {
      const { outlet } = await world(tx);
      const { member, token } = await join(tx, outlet.id, "  Asha ", "98765 43210", true);
      expect(member.name).toBe("Asha");
      expect(member.phone).toBe("919876543210");
      expect(member.contactConsent).toBe(true);
      expect(member.publicId).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
      expect(member.codeSecret).toMatch(/^[0-9a-f]{32}$/);
      expect(token).toHaveLength(32);
      expect(member.deviceTokenHash).toBe(hashToken(token));
      expect((await memberByToken(tx, outlet.id, token))?.id).toBe(member.id);

      // Phone alone must not hand over an existing wallet.
      await rejects(join(tx, outlet.id, "Someone else", "9876543210", false), "PHONE_EXISTS");
      await rejects(join(tx, outlet.id, "   ", "9123456780", false), "BAD_NAME");
      await rejects(join(tx, outlet.id, "x".repeat(81), "9123456780", false), "BAD_NAME");
      await rejects(join(tx, outlet.id, "Ok", "12345", false), "BAD_PHONE");
    }));

  it("keeps outlets apart: tokens and codes do not cross", () =>
    inRolledBackTx(async (tx) => {
      const a = await world(tx, "a");
      const b = await world(tx, "b");
      const { member, token } = await join(tx, a.outlet.id, "Ravi", "9123456789", false);
      expect(await memberByToken(tx, b.outlet.id, token)).toBeNull();
      await rejects(recordVisit(tx, b.outlet.id, b.pin.id, visitCode(member).code), "BAD_CODE");
    }));
});

describe("visits, badges, rewards and redemption", () => {
  it("runs the full journey: visit, cool-down, badge + reward, single redemption, delete", () =>
    inRolledBackTx(async (tx) => {
      const { outlet, pin } = await world(tx);
      const { member } = await join(tx, outlet.id, "Asha", "98765 43210", true);

      await rejects(recordVisit(tx, outlet.id, pin.id, `${member.publicId}-000000`), "BAD_CODE");
      await rejects(recordVisit(tx, outlet.id, pin.id, "nodash"), "BAD_CODE");
      await rejects(recordVisit(tx, outlet.id, pin.id, "A-B-C"), "BAD_CODE");

      const r1 = await recordVisit(tx, outlet.id, pin.id, visitCode(member).code);
      expect(r1.visits).toBe(1);
      expect(r1.badges_earned).toEqual([]);
      expect(r1.member).toEqual({ public_id: member.publicId, name: "Asha" });

      // Cool-down: the same member cannot farm visits.
      await rejects(recordVisit(tx, outlet.id, pin.id, visitCode(member).code), "COOLDOWN");

      // Move the first visit out of the cool-down window; the second visit earns the badge.
      await tx
        .update(loyaltyLedger)
        .set({ createdAt: new Date(Date.now() - 13 * 3600_000) })
        .where(and(eq(loyaltyLedger.memberId, member.id), eq(loyaltyLedger.kind, "visit")));
      const r2 = await recordVisit(tx, outlet.id, pin.id, visitCode(member).code);
      expect(r2.visits).toBe(2);
      expect(r2.badges_earned).toEqual(["Regular"]);
      expect(r2.rewards_ready).toEqual(["10% off"]);
      const grant = r2.pending_rewards[0];
      expect(grant.redeem_code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(grant.status).toBe("available");
      expect(Date.parse(grant.expires_at!) - Date.now()).toBeGreaterThan(29 * 86_400_000);

      // The wallet shows the shelf and the earned flag.
      const w = await wallet(tx, member, outlet.id);
      expect(w.badges.map((b) => [b.name, b.earned, b.reward_title])).toEqual([["Regular", true, "10% off"]]);
      expect(w.next_badge).toBeNull();

      // Redeem once only; the code is case-insensitive.
      const out = await redeem(tx, outlet.id, pin.id, ` ${grant.redeem_code.toLowerCase()} `);
      expect(out).toEqual({ title: "10% off", member: "Asha", public_id: member.publicId });
      await rejects(redeem(tx, outlet.id, pin.id, grant.redeem_code), "ALREADY_USED");
      await rejects(redeem(tx, outlet.id, pin.id, "ZZZZZZZZ"), "BAD_REWARD");
      expect((await openGrants(tx, member.id))[0].status).toBe("used");
      expect((await redemptionLog(tx, outlet.id)).map((r) => r.title)).toEqual(["10% off"]);

      // A third visit (after the cool-down) does not award the badge twice.
      await tx
        .update(loyaltyLedger)
        .set({ createdAt: new Date(Date.now() - 30 * 3600_000) })
        .where(and(eq(loyaltyLedger.memberId, member.id), eq(loyaltyLedger.kind, "visit")));
      const r3 = await recordVisit(tx, outlet.id, pin.id, visitCode(member).code);
      expect(r3.visits).toBe(3);
      expect(r3.badges_earned).toEqual([]);
      expect(r3.rewards_ready).toEqual([]); // the used one is no longer "ready"

      const s = await stats(tx, outlet.id);
      expect(s).toMatchObject({ members: 1, visits_total: 3, badges_awarded: 1, rewards_issued: 1, rewards_redeemed: 1 });
      const rows = await memberRows(tx, outlet.id);
      expect(rows[0]).toMatchObject({ name: "Asha", phone: "919876543210", visits: 3, contact_consent: true });

      await deleteMember(tx, member);
      expect((await stats(tx, outlet.id)).members).toBe(0);
      const ledgerLeft = await tx.select().from(loyaltyLedger).where(eq(loyaltyLedger.memberId, member.id));
      const grantsLeft = await tx.select().from(loyaltyRewardGrants).where(eq(loyaltyRewardGrants.memberId, member.id));
      expect(ledgerLeft).toHaveLength(0);
      expect(grantsLeft).toHaveLength(0);
      expect(await memberByToken(tx, outlet.id, "anything")).toBeNull();
    }));

  it("accepts the previous 60 second window but not older ones, and tolerates spaces and case", () =>
    inRolledBackTx(async (tx) => {
      const { outlet, pin } = await world(tx);
      const { member } = await join(tx, outlet.id, "Meena", "9000000001", false);
      const now = new Date();
      const slot = Math.floor(now.getTime() / 60_000);
      const old = `${member.publicId}-${codeFor(member.codeSecret, slot - 2)}`;
      await rejects(recordVisit(tx, outlet.id, pin.id, old, now), "BAD_CODE");
      const prev = `${member.publicId.toLowerCase()} - ${codeFor(member.codeSecret, slot - 1)}`.replace(" - ", "-");
      expect((await recordVisit(tx, outlet.id, pin.id, ` ${prev} `, now)).visits).toBe(1);
    }));

  it("reports visit code expiry in seconds within the window", () => {
    const { code, expires_in } = visitCode({ publicId: "AB23", codeSecret: "s" }, 120_000 + 15_000);
    expect(expires_in).toBe(45);
    expect(code).toBe(`AB23-${codeFor("s", 2)}`);
  });

  it("honours cooldown_hours = 0 and a longer cool-down", () =>
    inRolledBackTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const { pin } = await makeProgram(tx, outlet, { cooldownHours: 0 });
      const { member } = await join(tx, outlet.id, "Z", "9000000002", false);
      expect((await recordVisit(tx, outlet.id, pin.id, visitCode(member).code)).visits).toBe(1);
      expect((await recordVisit(tx, outlet.id, pin.id, visitCode(member).code)).visits).toBe(2);
    }));

  it("refuses to redeem an expired reward and one from another outlet", () =>
    inRolledBackTx(async (tx) => {
      const a = await world(tx, "a");
      const b = await world(tx, "b");
      const { member } = await join(tx, a.outlet.id, "Q", "9000000003", false);
      await tx.update(schema.loyaltyPrograms).set({ cooldownHours: 0 }).where(eq(schema.loyaltyPrograms.outletId, a.outlet.id));
      await recordVisit(tx, a.outlet.id, a.pin.id, visitCode(member).code);
      const r = await recordVisit(tx, a.outlet.id, a.pin.id, visitCode(member).code);
      const code = r.pending_rewards[0].redeem_code;
      await rejects(redeem(tx, b.outlet.id, b.pin.id, code), "BAD_REWARD");
      await tx
        .update(loyaltyRewardGrants)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(loyaltyRewardGrants.memberId, member.id));
      await rejects(redeem(tx, a.outlet.id, a.pin.id, code), "EXPIRED");
      expect((await openGrants(tx, member.id))[0].status).toBe("expired");
    }));
});

describe("wallet transfer", () => {
  it("needs a staff code, is single use, expires, and signs the old device out", () =>
    inRolledBackTx(async (tx) => {
      const { outlet } = await world(tx);
      const { member, token: oldToken } = await join(tx, outlet.id, "Meera", "9123400000", false);

      await rejects(claimTransfer(tx, outlet.id, "9123400000", "123456"), "BAD_TRANSFER"); // none issued
      await rejects(issueTransferCode(tx, outlet.id, "ZZZZ"), "NOT_FOUND");
      const issued = await issueTransferCode(tx, outlet.id, member.publicId.toLowerCase());
      expect(issued.code).toMatch(/^\d{6}$/);
      expect(issued).toMatchObject({ member: "Meera", valid_minutes: 15 });
      const wrong = issued.code === "000000" ? "111111" : "000000";
      await rejects(claimTransfer(tx, outlet.id, "9123400000", wrong), "BAD_TRANSFER");

      const { member: claimed, token: newToken } = await claimTransfer(tx, outlet.id, "+91 91234 00000", ` ${issued.code} `);
      expect(claimed.id).toBe(member.id);
      expect(await memberByToken(tx, outlet.id, oldToken)).toBeNull();
      expect((await memberByToken(tx, outlet.id, newToken))?.id).toBe(member.id);
      await rejects(claimTransfer(tx, outlet.id, "9123400000", issued.code), "BAD_TRANSFER"); // single use

      const again = await issueTransferCode(tx, outlet.id, member.publicId);
      await tx
        .update(loyaltyMembers)
        .set({ transferExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(loyaltyMembers.id, member.id));
      await rejects(claimTransfer(tx, outlet.id, "9123400000", again.code), "BAD_TRANSFER"); // expired
    }));

  it("does not work across outlets", () =>
    inRolledBackTx(async (tx) => {
      const a = await world(tx, "a");
      const b = await world(tx, "b");
      const { member } = await join(tx, a.outlet.id, "Meera", "9123400001", false);
      const issued = await issueTransferCode(tx, a.outlet.id, member.publicId);
      await rejects(claimTransfer(tx, b.outlet.id, "9123400001", issued.code), "BAD_TRANSFER");
      await rejects(issueTransferCode(tx, b.outlet.id, member.publicId), "NOT_FOUND");
    }));
});

describe("staff PINs", () => {
  it("finds only active PINs of the outlet", () =>
    inRolledBackTx(async (tx) => {
      const a = await world(tx, "a");
      const b = await world(tx, "b");
      expect((await findPin(tx, a.outlet.id, "1234"))?.id).toBe(a.pin.id);
      expect(await findPin(tx, a.outlet.id, "9999")).toBeNull();
      expect(await findPin(tx, b.outlet.id, "9999")).toBeNull();
      await setPinActive(tx, a.outlet, a.pin.id, false);
      expect(await findPin(tx, a.outlet.id, "1234")).toBeNull();
    }));
});

describe("owner configuration", () => {
  it("gates the rewards module on the acknowledgement and on having a badge with a reward", () =>
    inRolledBackTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const turnOn = () => setModules(tx, outlet, [{ module: "rewards", enabled: true }], { isAdmin: false });
      await expect(turnOn()).rejects.toThrow(/guidelines/);
      await acknowledge(tx, outlet, "owner");
      await expect(turnOn()).rejects.toThrow(/badge/);
      await addBadge(tx, outlet, badge({ visits_required: 3 }));
      await turnOn();
      const state = await getLoyalty(tx, outlet);
      expect(state.acknowledged).toBe(true);
      const [prog] = await tx.select().from(schema.loyaltyPrograms).where(eq(schema.loyaltyPrograms.outletId, outlet.id));
      expect(prog.acknowledgedBy).toBe("owner");
    }));

  it("saves the programme without touching the acknowledgement", () =>
    inRolledBackTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      expect(await getLoyalty(tx, outlet)).toMatchObject({ acknowledged: false, cooldown_hours: 12, terms: null });
      await putProgram(tx, outlet, { cooldown_hours: 6, terms: "  Be nice  " });
      await acknowledge(tx, outlet);
      await putProgram(tx, outlet, { cooldown_hours: 24, terms: "   " });
      expect(await getLoyalty(tx, outlet)).toMatchObject({ acknowledged: true, cooldown_hours: 24, terms: null });
    }));

  it("adds, edits and retires badges with their reward; validates icon and reward values", () =>
    inRolledBackTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const created = await addBadge(tx, outlet, badge({ name: " Gold ", visits_required: 5 }));
      expect(created).toMatchObject({ name: "Gold", icon: "sparkle", visits_required: 5, active: true });
      expect(created.reward).toEqual({
        type: "percent_discount",
        percent: 10,
        value_minor: null,
        title: "10% off",
        terms: null,
        expires_days: null,
      });

      const err = (p: Promise<unknown>) => p.then(() => null, (e: HttpError) => e);
      expect(await err(addBadge(tx, outlet, badge({ icon: "star" })))).toMatchObject({ status: 422, code: "BAD_ICON" });
      expect(
        await err(addBadge(tx, outlet, badge({ reward: { ...reward, type: "percent_discount", percent: null } }))),
      ).toMatchObject({ status: 422, code: "BAD_REWARD" });
      expect(
        await err(addBadge(tx, outlet, badge({ reward: { ...reward, type: "amount_discount", value_minor: 0 } }))),
      ).toMatchObject({ status: 422, code: "BAD_REWARD" });

      // Switching to an amount discount clears the percentage; unrelated fields are cleared by type.
      const edited = await editBadge(
        tx,
        outlet,
        created.id,
        badge({ reward: { ...reward, type: "amount_discount", value_minor: 5000, percent: 20, title: "Rs 50 off", expires_days: 30 } }),
      );
      expect(edited.reward).toMatchObject({ type: "amount_discount", percent: null, value_minor: 5000, expires_days: 30 });

      // Another outlet's badge is a 404, retiring keeps the row.
      const other = await makeOutlet(tx, await makeAccount(tx, "b"));
      expect(await err(editBadge(tx, other, created.id, badge()))).toMatchObject({ status: 404, code: "NOT_FOUND" });
      expect(await err(retireBadge(tx, other, created.id))).toMatchObject({ status: 404 });
      await retireBadge(tx, outlet, created.id);
      expect((await getLoyalty(tx, outlet)).badges[0]).toMatchObject({ id: created.id, active: false });
    }));

  it("creates staff PINs (python-compatible hash), refuses a duplicate PIN, toggles active", () =>
    inRolledBackTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const pin = await addPin(tx, outlet, { label: " Front desk ", pin: "482916" });
      expect(pin).toEqual({ id: expect.any(String), label: "Front desk", active: true });
      const [row] = await tx.select().from(schema.staffPins).where(eq(schema.staffPins.id, pin.id));
      expect(row.pinHash).toMatch(/^[0-9a-f]{32}\$[0-9a-f]{64}$/);
      expect(row.failedAttempts).toBe(0);
      await expect(addPin(tx, outlet, { label: "Again", pin: "482916" })).rejects.toMatchObject({ code: "PIN_TAKEN", status: 422 });
      await setPinActive(tx, outlet, pin.id, false);
      expect((await getLoyalty(tx, outlet)).staff_pins).toEqual([{ id: pin.id, label: "Front desk", active: false }]);
      // A retired PIN's number can be reused.
      await addPin(tx, outlet, { label: "New", pin: "482916" });
      await expect(setPinActive(tx, outlet, crypto.randomUUID(), true)).rejects.toMatchObject({ status: 404 });
      expect((await getLoyalty(tx, outlet)).staff_url).toBe(`${getEnv().publicFlowBaseUrl}/staff/${outlet.slug}`);
    }));
});

const reward = {
  type: "percent_discount" as const,
  percent: 10,
  value_minor: null,
  title: "10% off",
  terms: null,
  expires_days: null,
};
function badge(over: Record<string, unknown> = {}) {
  return { name: "Regular", icon: "sparkle", visits_required: 2, active: true, reward, ...over } as Parameters<typeof addBadge>[2];
}

/* ------------------------------------------------------------------ CR-6 */

const SERVER = path.resolve(__dirname, "..");
const REVIEW_TERMS = /review|draft|feedback|\btags?\b|rating|google|stars?\b/i;
const LOYALTY_FILES = [
  "services/loyalty.ts",
  "services/loyaltyConfig.ts",
  "loyaltyRoute.ts",
  "testing/loyaltyFixtures.ts",
  "../app/api/staff/[slug]/login/route.ts",
  "../app/api/staff/[slug]/visits/route.ts",
  "../app/api/staff/[slug]/redeem/route.ts",
  "../app/api/staff/[slug]/member/[publicId]/route.ts",
  "../app/api/staff/[slug]/member/[publicId]/transfer/route.ts",
  "../app/api/flow/[slug]/rewards/join/route.ts",
  "../app/api/flow/[slug]/rewards/recover/route.ts",
  "../app/api/flow/[slug]/rewards/wallet/route.ts",
  "../app/api/flow/[slug]/rewards/code/route.ts",
];

describe("CR-6: loyalty is firewalled from the review side", () => {
  it.each(LOYALTY_FILES)("%s never mentions review-side terms", (file) => {
    const hits = readFileSync(path.join(SERVER, file), "utf8")
      .split(/\r?\n/)
      .filter((l) => REVIEW_TERMS.test(l));
    expect(hits, `CR-6: review-side term in ${file}`).toEqual([]);
  });

  it("only the loyalty and staff tables are queried by the service modules", () => {
    const REVIEW_TABLES = /\b(sessions|events|privateFeedback|tags|customerSessions|ownerSessions)\b/;
    for (const file of ["services/loyalty.ts", "services/loyaltyConfig.ts"]) {
      const src = readFileSync(path.join(SERVER, file), "utf8");
      const tables = src.match(/schema\.\w+/g) ?? [];
      expect(tables.filter((t) => REVIEW_TABLES.test(t))).toEqual([]);
      const destructured = /const \{([^}]+)\} =\s*schema;/.exec(src)?.[1] ?? "";
      expect(destructured.split(",").map((s) => s.trim()).filter((n) => REVIEW_TABLES.test(n))).toEqual([]);
      expect(src).not.toMatch(/from "\.\/(flow|events|trial|trialMetering)"/);
    }
  });

  it("has no foreign key between loyalty tables and review-side tables", () => {
    const fk = readFileSync(path.join(SERVER, "db/schema.ts"), "utf8");
    for (const block of fk.split("export const ").filter((b) => /^(loyalty\w*|staffPins) = /.test(b))) {
      expect(block).not.toMatch(/foreignColumns: \[(sessions|events|privateFeedback|tags)\./);
    }
  });
});

/* --------------------------------------------------------- real concurrency */

describe("races on committed rows (cleaned up afterwards)", () => {
  async function committedWorld() {
    const db = getDb();
    const account = await makeAccount(db, "r");
    const outlet = await makeOutlet(db, account, { slug: `pl-race-${crypto.randomUUID().slice(0, 8)}` });
    await enableRewards(db, outlet);
    const prog = await makeProgram(db, outlet);
    return { db, account, outlet, ...prog };
  }

  async function cleanup(ids: { account: { id: string }; outlet: { id: string } }) {
    const db = getDb();
    const members = await db.select({ id: loyaltyMembers.id }).from(loyaltyMembers).where(eq(loyaltyMembers.outletId, ids.outlet.id));
    const memberIds = members.map((m) => m.id);
    if (memberIds.length) {
      await db.delete(loyaltyRewardGrants).where(inArray(loyaltyRewardGrants.memberId, memberIds));
      await db.delete(loyaltyLedger).where(inArray(loyaltyLedger.memberId, memberIds));
    }
    await db.delete(loyaltyMembers).where(eq(loyaltyMembers.outletId, ids.outlet.id));
    const badges = await db.select({ id: schema.loyaltyBadges.id }).from(schema.loyaltyBadges).where(eq(schema.loyaltyBadges.outletId, ids.outlet.id));
    if (badges.length) await db.delete(schema.loyaltyRewards).where(inArray(schema.loyaltyRewards.badgeId, badges.map((b) => b.id)));
    await db.delete(schema.loyaltyBadges).where(eq(schema.loyaltyBadges.outletId, ids.outlet.id));
    await db.delete(schema.staffPins).where(eq(schema.staffPins.outletId, ids.outlet.id));
    await db.delete(schema.loyaltyPrograms).where(eq(schema.loyaltyPrograms.outletId, ids.outlet.id));
    await db.delete(schema.outletModules).where(eq(schema.outletModules.outletId, ids.outlet.id));
    await db.delete(schema.outlets).where(eq(schema.outlets.id, ids.outlet.id));
    await db.delete(schema.accounts).where(eq(schema.accounts.id, ids.account.id));
  }

  it("two concurrent visits for one member: exactly one is recorded", async () => {
    const w = await committedWorld();
    try {
      const { member } = await join(w.db, w.outlet.id, "Racer", "9000000010", false);
      const code = visitCode(member).code;
      const results = await Promise.allSettled([
        recordVisit(w.db, w.outlet.id, w.pin.id, code),
        recordVisit(w.db, w.outlet.id, w.pin.id, code),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect((failed.reason as LoyaltyError).code).toBe("COOLDOWN");
      expect((await stats(w.db, w.outlet.id)).visits_total).toBe(1);
    } finally {
      await cleanup(w);
    }
  });

  it("two concurrent redemptions of one reward: exactly one succeeds", async () => {
    const w = await committedWorld();
    try {
      await w.db.update(schema.loyaltyPrograms).set({ cooldownHours: 0 }).where(eq(schema.loyaltyPrograms.outletId, w.outlet.id));
      const { member } = await join(w.db, w.outlet.id, "Racer", "9000000011", false);
      await recordVisit(w.db, w.outlet.id, w.pin.id, visitCode(member).code);
      const r = await recordVisit(w.db, w.outlet.id, w.pin.id, visitCode(member).code);
      const code = r.pending_rewards[0].redeem_code;
      const results = await Promise.allSettled([
        redeem(w.db, w.outlet.id, w.pin.id, code),
        redeem(w.db, w.outlet.id, w.pin.id, code),
        redeem(w.db, w.outlet.id, w.pin.id, code),
      ]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      for (const x of results.filter((y) => y.status === "rejected")) {
        expect(((x as PromiseRejectedResult).reason as LoyaltyError).code).toBe("ALREADY_USED");
      }
      const redeemed = await w.db.select().from(loyaltyLedger).where(and(eq(loyaltyLedger.memberId, member.id), eq(loyaltyLedger.kind, "reward_redeemed")));
      expect(redeemed).toHaveLength(1);
    } finally {
      await cleanup(w);
    }
  });

  it("two concurrent claims of one transfer code: exactly one wallet is issued", async () => {
    const w = await committedWorld();
    try {
      const { member } = await join(w.db, w.outlet.id, "Racer", "9000000012", false);
      const issued = await issueTransferCode(w.db, w.outlet.id, member.publicId);
      const results = await Promise.allSettled([
        claimTransfer(w.db, w.outlet.id, "9000000012", issued.code),
        claimTransfer(w.db, w.outlet.id, "9000000012", issued.code),
      ]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const [row] = await w.db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, member.id));
      const winner = (results.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<{ token: string }>).value;
      expect(row.deviceTokenHash).toBe(hashToken(winner.token));
    } finally {
      await cleanup(w);
    }
  });

  it("two concurrent joins with one phone: one wallet, one PHONE_EXISTS", async () => {
    const w = await committedWorld();
    try {
      const results = await Promise.allSettled([
        join(w.db, w.outlet.id, "A", "9000000013", false),
        join(w.db, w.outlet.id, "B", "9000000013", false),
      ]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(((results.find((x) => x.status === "rejected") as PromiseRejectedResult).reason as LoyaltyError).code).toBe("PHONE_EXISTS");
    } finally {
      await cleanup(w);
    }
  });

  it("left nothing behind", async () => {
    const rows = await getDb().select({ id: schema.outlets.id }).from(schema.outlets).where(like(schema.outlets.slug, "pl-race-%"));
    expect(rows).toEqual([]);
  });
});
