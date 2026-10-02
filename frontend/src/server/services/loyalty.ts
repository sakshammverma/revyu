/**
 * Loyalty engine. Port of backend/app/loyalty/service.py. Earning is by
 * staff-confirmed visits only; there is no other trigger and none can be
 * configured (FR-101). Badge state is derived from the append-only ledger
 * (FR-110).
 *
 * CR-6: this module touches only loyalty_* and staff_pins tables and never
 * imports anything from the customer-facing side (enforced by loyalty.test.ts).
 *
 * Interoperability with rows written by FastAPI: PIN hashes are
 * "<salt hex>$<scrypt hex>" (N=2^14, r=8, p=1, 32 bytes), staff tokens are
 * "<outlet>.<pin>.<exp>.<hmac-sha256 hex>" keyed by AUTH_SECRET, wallet tokens
 * are stored as sha256 hex, visit codes are HMAC-SHA256 over the 60 s window.
 */
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, max } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { pyIso } from "./pyDate";

const { loyaltyBadges, loyaltyLedger, loyaltyMembers, loyaltyPrograms, loyaltyRewardGrants, loyaltyRewards, staffPins } =
  schema;

export type Member = typeof loyaltyMembers.$inferSelect;
export type StaffPinRow = typeof staffPins.$inferSelect;

export const CODE_WINDOW_SECONDS = 60;
export const ICONS = ["sparkle", "heart", "crown", "gift", "flame", "gem", "leaf", "bolt"] as const;
export const REWARD_TYPES = ["percent_discount", "amount_discount", "freebie", "free_service"] as const;
export const TRANSFER_MINUTES = 15;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export class LoyaltyError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** compare_digest for strings: equal length required, then constant-time compare. */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const randomFrom = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/* ---------------------------------------------------------------- PINs */

const SCRYPT = { N: 2 ** 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function scryptHex(pin: string, salt: Buffer): Promise<string> {
  return new Promise((resolve, reject) =>
    scrypt(Buffer.from(pin, "utf8"), salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key.toString("hex")))),
  );
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}$${await scryptHex(pin, salt)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 2 || !/^(?:[0-9a-fA-F]{2})*$/.test(parts[0])) return false;
  return safeEqual(await scryptHex(pin, Buffer.from(parts[0], "hex")), parts[1]);
}

/** The active PIN that matches, or null. Every active PIN is checked (no early timing signal on which one). */
export async function findPin(db: DbLike, outletId: string, pin: string): Promise<StaffPinRow | null> {
  const rows = await db
    .select()
    .from(staffPins)
    .where(and(eq(staffPins.outletId, outletId), eq(staffPins.active, true)));
  let found: StaffPinRow | null = null;
  for (const row of rows) {
    if ((await verifyPin(pin, row.pinHash)) && found === null) found = row;
  }
  return found;
}

function signingKey(): string {
  const { authSecret, isLocal } = getEnv();
  if (!isLocal && (authSecret === "" || authSecret === "change-me" || authSecret.length < 24)) {
    throw new Error("AUTH_SECRET must be set to a random value of 24+ characters");
  }
  return authSecret;
}

const sign = (payload: string) => createHmac("sha256", signingKey()).update(payload).digest("hex");

export function makeStaffToken(outletId: string, pinId: string, hours = 8, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + hours * 3600;
  const payload = `${outletId}.${pinId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readStaffToken(token: string, nowMs = Date.now()): { outletId: string; pinId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [outletId, pinId, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${outletId}.${pinId}.${exp}`))) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < nowMs / 1000) return null;
  if (!UUID_RE.test(outletId) || !UUID_RE.test(pinId)) return null;
  return { outletId: outletId.toLowerCase(), pinId: pinId.toLowerCase() };
}

/* ---------------------------------------------------------------- codes */

const windowOf = (nowMs: number, offset = 0) => Math.floor(nowMs / 1000 / CODE_WINDOW_SECONDS) + offset;

export function codeFor(secret: string, window: number): string {
  const mac = createHmac("sha256", secret).update(String(window)).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

/** What the customer shows at the counter: MEMBERID-123456, valid ~60-120s. */
export function visitCode(member: Pick<Member, "publicId" | "codeSecret">, nowMs = Date.now()) {
  return {
    code: `${member.publicId}-${codeFor(member.codeSecret, windowOf(nowMs))}`,
    expires_in: CODE_WINDOW_SECONDS - (Math.floor(nowMs / 1000) % CODE_WINDOW_SECONDS),
  };
}

async function newPublicId(db: DbLike, outletId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const pid = randomFrom(4);
    const [taken] = await db
      .select({ id: loyaltyMembers.id })
      .from(loyaltyMembers)
      .where(and(eq(loyaltyMembers.outletId, outletId), eq(loyaltyMembers.publicId, pid)))
      .limit(1);
    if (!taken) return pid;
  }
  throw new LoyaltyError("ID_EXHAUSTED", "Could not allocate a member id");
}

/* -------------------------------------------------------------- members */

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) digits = "91" + digits; // launch market default; international numbers pass through
  if (digits.length < 8 || digits.length > 15) throw new LoyaltyError("BAD_PHONE", "Enter a valid phone number");
  return digits;
}

const newDeviceToken = () => randomBytes(24).toString("base64url");

export async function join(
  db: DbLike,
  outletId: string,
  rawName: string,
  phone: string,
  consent: boolean,
): Promise<{ member: Member; token: string }> {
  const name = rawName.trim();
  const nameLength = [...name].length;
  if (nameLength < 1 || nameLength > 80) throw new LoyaltyError("BAD_NAME", "Enter your name");
  const normalized = normalizePhone(phone);
  const [existing] = await db
    .select({ id: loyaltyMembers.id })
    .from(loyaltyMembers)
    .where(
      and(
        eq(loyaltyMembers.outletId, outletId),
        eq(loyaltyMembers.phone, normalized),
        isNull(loyaltyMembers.deletedAt),
      ),
    )
    .limit(1);
  if (existing) {
    // No OTP yet (planned), so a phone number alone must not hand over a wallet.
    throw new LoyaltyError(
      "PHONE_EXISTS",
      "This number already has a wallet on another device. Ask the staff for a transfer code.",
    );
  }
  const token = newDeviceToken();
  const [member] = await db
    .insert(loyaltyMembers)
    .values({
      id: crypto.randomUUID(),
      outletId,
      publicId: await newPublicId(db, outletId),
      name,
      phone: normalized,
      deviceTokenHash: hashToken(token),
      codeSecret: randomBytes(16).toString("hex"),
      contactConsent: consent,
    })
    .onConflictDoNothing()
    .returning();
  // The unique (outlet, phone) index caught a concurrent join.
  if (!member) throw new LoyaltyError("PHONE_EXISTS", "This number already has a wallet.");
  return { member, token };
}

export async function findMemberByRef(db: DbLike, outletId: string, publicId: string): Promise<Member | null> {
  const [member] = await db
    .select()
    .from(loyaltyMembers)
    .where(
      and(
        eq(loyaltyMembers.outletId, outletId),
        eq(loyaltyMembers.publicId, publicId.trim().toUpperCase()),
        isNull(loyaltyMembers.deletedAt),
      ),
    )
    .limit(1);
  return member ?? null;
}

/** Staff-issued one-time code to move a wallet to a new phone; staff see the member in person. */
export async function issueTransferCode(db: DbLike, outletId: string, publicId: string, now = new Date()) {
  const member = await findMemberByRef(db, outletId, publicId);
  if (!member) throw new LoyaltyError("NOT_FOUND", "No such member.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db
    .update(loyaltyMembers)
    .set({
      transferHash: hashToken(`${member.id}:${code}`),
      transferExpiresAt: new Date(now.getTime() + TRANSFER_MINUTES * 60_000),
    })
    .where(eq(loyaltyMembers.id, member.id));
  return { code, member: member.name, valid_minutes: TRANSFER_MINUTES };
}

export async function claimTransfer(
  db: DbLike,
  outletId: string,
  phone: string,
  code: string,
  now = new Date(),
): Promise<{ member: Member; token: string }> {
  const bad = () =>
    new LoyaltyError("BAD_TRANSFER", "That code isn't valid or has expired. Ask the staff for a new one.");
  const [member] = await db
    .select()
    .from(loyaltyMembers)
    .where(
      and(
        eq(loyaltyMembers.outletId, outletId),
        eq(loyaltyMembers.phone, normalizePhone(phone)),
        isNull(loyaltyMembers.deletedAt),
      ),
    )
    .limit(1);
  const expires = member?.transferExpiresAt ?? null;
  const good =
    member !== undefined &&
    member.transferHash !== null &&
    expires !== null &&
    expires > now &&
    safeEqual(member.transferHash, hashToken(`${member.id}:${code.trim()}`));
  if (!good) throw bad();

  const token = newDeviceToken();
  // Atomic claim: only one concurrent request can consume the code, and the old device is signed out.
  const [claimed] = await db
    .update(loyaltyMembers)
    .set({ deviceTokenHash: hashToken(token), transferHash: null, transferExpiresAt: null })
    .where(
      and(
        eq(loyaltyMembers.id, member.id),
        eq(loyaltyMembers.transferHash, member.transferHash!),
        gt(loyaltyMembers.transferExpiresAt, now),
      ),
    )
    .returning();
  if (!claimed) throw bad();
  return { member: claimed, token };
}

export async function memberByToken(db: DbLike, outletId: string, token: string): Promise<Member | null> {
  const [member] = await db
    .select()
    .from(loyaltyMembers)
    .where(
      and(
        eq(loyaltyMembers.outletId, outletId),
        eq(loyaltyMembers.deviceTokenHash, hashToken(token)),
        isNull(loyaltyMembers.deletedAt),
      ),
    )
    .limit(1);
  return member ?? null;
}

/** FR-109: remove the member and every ledger/grant row. */
export async function deleteMember(db: DbLike, member: Pick<Member, "id">): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(loyaltyRewardGrants).where(eq(loyaltyRewardGrants.memberId, member.id));
    await tx.delete(loyaltyLedger).where(eq(loyaltyLedger.memberId, member.id));
    await tx.delete(loyaltyMembers).where(eq(loyaltyMembers.id, member.id));
  });
}

/* ------------------------------------------------------ visits & rewards */

/** The programme row, created with defaults on first use. */
async function ensureProgram(db: DbLike, outletId: string) {
  await db.insert(loyaltyPrograms).values({ outletId, cooldownHours: 12 }).onConflictDoNothing();
  const [prog] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.outletId, outletId)).limit(1);
  return prog;
}

export async function visitCount(db: DbLike, memberId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(loyaltyLedger)
    .where(and(eq(loyaltyLedger.memberId, memberId), eq(loyaltyLedger.kind, "visit")));
  return row?.n ?? 0;
}

export interface Grant {
  id: string;
  title: string;
  terms: string | null;
  type: string;
  percent: number | null;
  value_minor: number | null;
  currency_code: string;
  redeem_code: string;
  expires_at: string | null;
  status: "used" | "expired" | "available";
}

export async function openGrants(db: DbLike, memberId: string, now = new Date()): Promise<Grant[]> {
  const rows = await db
    .select({ grant: loyaltyRewardGrants, reward: loyaltyRewards })
    .from(loyaltyRewardGrants)
    .innerJoin(loyaltyRewards, eq(loyaltyRewards.id, loyaltyRewardGrants.rewardId))
    .where(eq(loyaltyRewardGrants.memberId, memberId))
    .orderBy(desc(loyaltyRewardGrants.issuedAt));
  return rows.map(({ grant, reward }) => {
    const expires = grant.expiresAt;
    return {
      id: grant.id,
      title: reward.title,
      terms: reward.terms,
      type: reward.type,
      percent: reward.percent,
      value_minor: reward.valueMinor,
      currency_code: reward.currencyCode,
      redeem_code: grant.redeemCode,
      expires_at: expires ? pyIso(expires) : null,
      status: grant.redeemedAt ? "used" : expires && expires < now ? "expired" : "available",
    };
  });
}

export async function recordVisit(db: DbLike, outletId: string, pinId: string, combined: string, now = new Date()) {
  const parts = combined.trim().toUpperCase().replaceAll(" ", "").split("-");
  const badCode = () => new LoyaltyError("BAD_CODE", "Code not recognised or expired. Ask them to refresh.");
  if (parts.length !== 2) throw new LoyaltyError("BAD_CODE", "Enter the code like A7F3-123456");
  const [publicId, code] = parts;

  const { member, total, earned } = await db.transaction(async (tx) => {
    // The row lock serialises concurrent visits for one member, so the cool-down cannot be raced.
    const [locked] = await tx
      .select()
      .from(loyaltyMembers)
      .where(
        and(
          eq(loyaltyMembers.outletId, outletId),
          eq(loyaltyMembers.publicId, publicId),
          isNull(loyaltyMembers.deletedAt),
        ),
      )
      .limit(1)
      .for("update");
    const valid =
      locked !== undefined &&
      [0, -1].some((o) => safeEqual(code, codeFor(locked.codeSecret, windowOf(now.getTime(), o))));
    if (!valid) throw badCode();
    const member = locked;
    const earned: string[] = [];

    const prog = await ensureProgram(tx, outletId);
    const [last] = await tx
      .select({ at: max(loyaltyLedger.createdAt) })
      .from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.memberId, member.id), eq(loyaltyLedger.kind, "visit")));
    if (last?.at && now.getTime() - last.at.getTime() < prog.cooldownHours * 3_600_000) {
      throw new LoyaltyError("COOLDOWN", "Visit already recorded recently.");
    }

    await tx
      .insert(loyaltyLedger)
      .values({ id: crypto.randomUUID(), memberId: member.id, kind: "visit", staffPinId: pinId });
    const total = await visitCount(tx, member.id);

    const badges = await tx
      .select()
      .from(loyaltyBadges)
      .where(
        and(
          eq(loyaltyBadges.outletId, outletId),
          eq(loyaltyBadges.active, true),
          lte(loyaltyBadges.visitsRequired, total),
        ),
      )
      .orderBy(asc(loyaltyBadges.visitsRequired));
    for (const badge of badges) {
      const [already] = await tx
        .select({ id: loyaltyLedger.id })
        .from(loyaltyLedger)
        .where(
          and(
            eq(loyaltyLedger.memberId, member.id),
            eq(loyaltyLedger.kind, "badge_awarded"),
            eq(loyaltyLedger.refId, badge.id),
          ),
        )
        .limit(1);
      if (already) continue;
      await tx.insert(loyaltyLedger).values({
        id: crypto.randomUUID(),
        memberId: member.id,
        kind: "badge_awarded",
        refId: badge.id,
        staffPinId: pinId,
      });
      earned.push(badge.name);
      const [reward] = await tx.select().from(loyaltyRewards).where(eq(loyaltyRewards.badgeId, badge.id)).limit(1);
      if (!reward) continue;
      for (let attempt = 0; attempt < 5; attempt++) {
        const [grant] = await tx
          .insert(loyaltyRewardGrants)
          .values({
            id: crypto.randomUUID(),
            memberId: member.id,
            rewardId: reward.id,
            redeemCode: randomFrom(8),
            expiresAt: reward.expiresDays ? new Date(now.getTime() + reward.expiresDays * 86_400_000) : null,
          })
          .onConflictDoNothing()
          .returning();
        if (!grant) continue; // redeem code collision: draw another
        await tx
          .insert(loyaltyLedger)
          .values({ id: crypto.randomUUID(), memberId: member.id, kind: "reward_issued", refId: grant.id });
        break;
      }
    }
    return { member, total, earned };
  });

  const grants = await openGrants(db, member.id, now);
  return {
    member: { public_id: member.publicId, name: member.name },
    visits: total,
    badges_earned: earned,
    rewards_ready: grants.filter((g) => g.status === "available").map((g) => g.title),
    pending_rewards: grants,
  };
}

export async function redeem(db: DbLike, outletId: string, pinId: string, redeemCode: string, now = new Date()) {
  const code = redeemCode.trim().toUpperCase();
  const [row] = await db
    .select({ grant: loyaltyRewardGrants, reward: loyaltyRewards, member: loyaltyMembers })
    .from(loyaltyRewardGrants)
    .innerJoin(loyaltyRewards, eq(loyaltyRewards.id, loyaltyRewardGrants.rewardId))
    .innerJoin(loyaltyMembers, eq(loyaltyMembers.id, loyaltyRewardGrants.memberId))
    .where(and(eq(loyaltyRewardGrants.redeemCode, code), eq(loyaltyMembers.outletId, outletId)))
    .limit(1);
  if (!row) throw new LoyaltyError("BAD_REWARD", "Reward code not found");
  const { grant, reward, member } = row;
  if (grant.expiresAt && grant.expiresAt < now) throw new LoyaltyError("EXPIRED", "This reward has expired");
  await db.transaction(async (tx) => {
    // Single conditional UPDATE: double redemption is impossible (FR-106).
    const burned = await tx
      .update(loyaltyRewardGrants)
      .set({ redeemedAt: now, redeemedByPinId: pinId })
      .where(and(eq(loyaltyRewardGrants.id, grant.id), isNull(loyaltyRewardGrants.redeemedAt)))
      .returning({ id: loyaltyRewardGrants.id });
    if (burned.length !== 1) throw new LoyaltyError("ALREADY_USED", "This reward was already redeemed");
    await tx.insert(loyaltyLedger).values({
      id: crypto.randomUUID(),
      memberId: member.id,
      kind: "reward_redeemed",
      refId: grant.id,
      staffPinId: pinId,
    });
  });
  return { title: reward.title, member: member.name, public_id: member.publicId };
}

/* ---------------------------------------------------------- wallet view */

export async function wallet(db: DbLike, member: Pick<Member, "id" | "publicId" | "name">, outletId: string) {
  const total = await visitCount(db, member.id);
  const badges = await db
    .select()
    .from(loyaltyBadges)
    .where(and(eq(loyaltyBadges.outletId, outletId), eq(loyaltyBadges.active, true)))
    .orderBy(asc(loyaltyBadges.visitsRequired), asc(loyaltyBadges.id));
  const earnedRows = await db
    .select({ ref: loyaltyLedger.refId })
    .from(loyaltyLedger)
    .where(and(eq(loyaltyLedger.memberId, member.id), eq(loyaltyLedger.kind, "badge_awarded")));
  const earnedIds = new Set(earnedRows.map((r) => r.ref));
  const rewardRows = badges.length
    ? await db
        .select()
        .from(loyaltyRewards)
        .where(
          inArray(
            loyaltyRewards.badgeId,
            badges.map((b) => b.id),
          ),
        )
    : [];
  const rewards = new Map(rewardRows.map((r) => [r.badgeId, r] as const));
  const next = badges.find((b) => !earnedIds.has(b.id) && b.visitsRequired > total);
  return {
    member: { public_id: member.publicId, name: member.name },
    visits: total,
    next_badge: next
      ? { name: next.name, visits_required: next.visitsRequired, remaining: next.visitsRequired - total }
      : null,
    badges: badges.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      visits_required: b.visitsRequired,
      earned: earnedIds.has(b.id),
      reward_title: rewards.get(b.id)?.title ?? null,
    })),
    rewards: await openGrants(db, member.id),
  };
}

/* ---------------------------------------------------------- owner stats */

export async function stats(db: DbLike, outletId: string, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const memberIds = db.select({ id: loyaltyMembers.id }).from(loyaltyMembers).where(eq(loyaltyMembers.outletId, outletId));
  const tally = async (kind: string, recent = false) => {
    const [row] = await db
      .select({ n: count() })
      .from(loyaltyLedger)
      .where(
        and(
          inArray(loyaltyLedger.memberId, memberIds),
          eq(loyaltyLedger.kind, kind),
          recent ? gte(loyaltyLedger.createdAt, since) : undefined,
        ),
      );
    return row?.n ?? 0;
  };
  const [members] = await db
    .select({ n: count() })
    .from(loyaltyMembers)
    .where(and(eq(loyaltyMembers.outletId, outletId), isNull(loyaltyMembers.deletedAt)));
  return {
    members: members?.n ?? 0,
    visits_30d: await tally("visit", true),
    visits_total: await tally("visit"),
    badges_awarded: await tally("badge_awarded"),
    rewards_issued: await tally("reward_issued"),
    rewards_redeemed: await tally("reward_redeemed"),
  };
}

/** Owner-facing member list: name, phone, visits (decision 2026-10-01). */
export async function memberRows(db: DbLike, outletId: string, limit = 500) {
  const rows = await db
    .select()
    .from(loyaltyMembers)
    .where(and(eq(loyaltyMembers.outletId, outletId), isNull(loyaltyMembers.deletedAt)))
    .orderBy(desc(loyaltyMembers.createdAt))
    .limit(limit);
  const visits = rows.length
    ? await db
        .select({ memberId: loyaltyLedger.memberId, n: count(), last: max(loyaltyLedger.createdAt) })
        .from(loyaltyLedger)
        .where(
          and(
            inArray(
              loyaltyLedger.memberId,
              rows.map((m) => m.id),
            ),
            eq(loyaltyLedger.kind, "visit"),
          ),
        )
        .groupBy(loyaltyLedger.memberId)
    : [];
  const byMember = new Map(visits.map((v) => [v.memberId, v]));
  return rows.map((m) => {
    const v = byMember.get(m.id);
    return {
      id: m.id,
      public_id: m.publicId,
      name: m.name,
      phone: m.phone,
      contact_consent: m.contactConsent,
      visits: v?.n ?? 0,
      last_visit: v?.last ? pyIso(v.last) : null,
      joined_at: pyIso(m.createdAt),
    };
  });
}

export async function redemptionLog(db: DbLike, outletId: string, limit = 100) {
  const rows = await db
    .select({ grant: loyaltyRewardGrants, reward: loyaltyRewards, member: loyaltyMembers })
    .from(loyaltyRewardGrants)
    .innerJoin(loyaltyRewards, eq(loyaltyRewards.id, loyaltyRewardGrants.rewardId))
    .innerJoin(loyaltyMembers, eq(loyaltyMembers.id, loyaltyRewardGrants.memberId))
    .where(and(eq(loyaltyMembers.outletId, outletId), isNotNull(loyaltyRewardGrants.redeemedAt)))
    .orderBy(desc(loyaltyRewardGrants.redeemedAt))
    .limit(limit);
  return rows.map(({ grant, reward, member }) => ({
    title: reward.title,
    member: member.name,
    public_id: member.publicId,
    redeemed_at: pyIso(grant.redeemedAt!),
  }));
}
