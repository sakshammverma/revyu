/**
 * Owner-side loyalty setup: programme, badges + rewards, staff PINs. Port of
 * the /loyalty half of backend/app/api/hub_config.py. Same CR-6 rule as
 * loyalty.ts: loyalty tables only, nothing from the customer-facing side.
 */
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { HttpError } from "@/server/http";
import { findPin, hashPin, ICONS, stats } from "./loyalty";

const { loyaltyBadges, loyaltyPrograms, loyaltyRewards, staffPins } = schema;

type OutletRef = { id: string; slug: string };

/** Pydantic accepts blank-after-trim names and stores ""; a blank label is never useful, so reject it. */
const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.trim().length > 0);

export const programBody = z.object({
  cooldown_hours: z.number().int().min(0).max(720),
  terms: z.string().max(1000).nullish(),
});

export const rewardIn = z.object({
  type: z.enum(["percent_discount", "amount_discount", "freebie", "free_service"]),
  percent: z.number().int().min(1).max(100).nullish(),
  value_minor: z.number().int().min(0).max(100_000_000).nullish(),
  title: text(120),
  terms: z.string().max(400).nullish(),
  expires_days: z.number().int().min(1).max(730).nullish(),
});

export const badgeBody = z.object({
  name: text(60),
  // FastAPI's default was an icon that its own allow-list rejects; default to the first valid one.
  icon: z.string().default("sparkle"),
  visits_required: z.number().int().min(1).max(1000),
  active: z.boolean().default(true),
  reward: rewardIn,
});

export const pinBody = z.object({
  label: text(60),
  pin: z.string().regex(/^\d{4,6}$/),
});

export type BadgeInput = z.infer<typeof badgeBody>;

const unprocessable = (code: string, message: string) => new HttpError(422, code, message);
const notFound = () => new HttpError(404, "NOT_FOUND");

type BadgeRow = typeof loyaltyBadges.$inferSelect;

async function badgeDict(db: DbLike, b: BadgeRow) {
  const [r] = await db.select().from(loyaltyRewards).where(eq(loyaltyRewards.badgeId, b.id)).limit(1);
  return {
    id: b.id,
    name: b.name,
    icon: b.icon,
    visits_required: b.visitsRequired,
    active: b.active,
    reward: r
      ? {
          type: r.type,
          percent: r.percent,
          value_minor: r.valueMinor,
          title: r.title,
          terms: r.terms,
          expires_days: r.expiresDays,
        }
      : null,
  };
}

export async function getLoyalty(db: DbLike, outlet: OutletRef) {
  const [prog] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.outletId, outlet.id)).limit(1);
  const badges = await db
    .select()
    .from(loyaltyBadges)
    .where(eq(loyaltyBadges.outletId, outlet.id))
    .orderBy(asc(loyaltyBadges.visitsRequired), asc(loyaltyBadges.id));
  const pins = await db.select().from(staffPins).where(eq(staffPins.outletId, outlet.id));
  const dicts = [];
  for (const b of badges) dicts.push(await badgeDict(db, b));
  return {
    acknowledged: Boolean(prog?.acknowledgedAt),
    cooldown_hours: prog?.cooldownHours ?? 12,
    terms: prog?.terms ?? null,
    icons: [...ICONS],
    badges: dicts,
    staff_pins: pins.map((p) => ({ id: p.id, label: p.label, active: p.active })),
    staff_url: `${getEnv().publicFlowBaseUrl}/staff/${outlet.slug}`,
    stats: await stats(db, outlet.id),
  };
}

export async function putProgram(db: DbLike, outlet: OutletRef, body: z.infer<typeof programBody>) {
  const terms = (body.terms ?? "").trim() || null;
  await db
    .insert(loyaltyPrograms)
    .values({ outletId: outlet.id, cooldownHours: body.cooldown_hours, terms })
    .onConflictDoUpdate({ target: loyaltyPrograms.outletId, set: { cooldownHours: body.cooldown_hours, terms } });
}

/** The owner confirms the programme rules (FR-100); rewards cannot go live before this. */
export async function acknowledge(db: DbLike, outlet: OutletRef, by: "owner" | "admin" = "owner", now = new Date()) {
  await db
    .insert(loyaltyPrograms)
    .values({ outletId: outlet.id, cooldownHours: 12, acknowledgedAt: now, acknowledgedBy: by })
    .onConflictDoUpdate({ target: loyaltyPrograms.outletId, set: { acknowledgedAt: now, acknowledgedBy: by } });
}

async function saveBadge(db: DbLike, badgeId: string, outletId: string, sortOrder: number | null, body: BadgeInput) {
  if (!(ICONS as readonly string[]).includes(body.icon)) throw unprocessable("BAD_ICON", "Unknown icon.");
  const r = body.reward;
  if (r.type === "percent_discount" && !r.percent) throw unprocessable("BAD_REWARD", "Enter a discount percentage.");
  if (r.type === "amount_discount" && !r.value_minor) throw unprocessable("BAD_REWARD", "Enter a discount amount.");

  return db.transaction(async (tx) => {
    const fields = {
      name: body.name.trim(),
      icon: body.icon,
      visitsRequired: body.visits_required,
      active: body.active,
    };
    if (sortOrder === null) {
      await tx.update(loyaltyBadges).set(fields).where(eq(loyaltyBadges.id, badgeId));
    } else {
      await tx.insert(loyaltyBadges).values({ id: badgeId, outletId, sortOrder, ...fields });
    }
    const rewardFields = {
      type: r.type,
      title: r.title.trim(),
      terms: r.terms ?? null,
      percent: r.type === "percent_discount" ? (r.percent ?? null) : null,
      valueMinor: r.type === "amount_discount" ? (r.value_minor ?? null) : null,
      expiresDays: r.expires_days ?? null,
    };
    await tx
      .insert(loyaltyRewards)
      .values({ id: crypto.randomUUID(), badgeId, currencyCode: "INR", ...rewardFields })
      .onConflictDoUpdate({ target: loyaltyRewards.badgeId, set: rewardFields });
    const [badge] = await tx.select().from(loyaltyBadges).where(eq(loyaltyBadges.id, badgeId)).limit(1);
    return badgeDict(tx, badge);
  });
}

export async function addBadge(db: DbLike, outlet: OutletRef, body: BadgeInput) {
  const [row] = await db.select({ n: count() }).from(loyaltyBadges).where(eq(loyaltyBadges.outletId, outlet.id));
  return saveBadge(db, crypto.randomUUID(), outlet.id, row?.n ?? 0, body);
}

async function ownBadge(db: DbLike, outlet: OutletRef, badgeId: string) {
  const [badge] = await db.select().from(loyaltyBadges).where(eq(loyaltyBadges.id, badgeId)).limit(1);
  if (!badge || badge.outletId !== outlet.id) throw notFound();
  return badge;
}

export async function editBadge(db: DbLike, outlet: OutletRef, badgeId: string, body: BadgeInput) {
  await ownBadge(db, outlet, badgeId);
  return saveBadge(db, badgeId, outlet.id, null, body);
}

/** Earned history must survive: retire instead of deleting. */
export async function retireBadge(db: DbLike, outlet: OutletRef, badgeId: string) {
  await ownBadge(db, outlet, badgeId);
  await db.update(loyaltyBadges).set({ active: false }).where(eq(loyaltyBadges.id, badgeId));
}

export async function addPin(db: DbLike, outlet: OutletRef, body: z.infer<typeof pinBody>) {
  if ((await findPin(db, outlet.id, body.pin)) !== null) throw unprocessable("PIN_TAKEN", "Choose a different PIN.");
  const [pin] = await db
    .insert(staffPins)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      label: body.label.trim(),
      pinHash: await hashPin(body.pin),
      active: true,
      failedAttempts: 0,
    })
    .returning();
  return { id: pin.id, label: pin.label, active: true };
}

export async function setPinActive(db: DbLike, outlet: OutletRef, pinId: string, active: boolean) {
  const updated = await db
    .update(staffPins)
    .set({ active })
    .where(and(eq(staffPins.id, pinId), eq(staffPins.outletId, outlet.id)))
    .returning({ id: staffPins.id });
  if (updated.length === 0) throw notFound();
}
