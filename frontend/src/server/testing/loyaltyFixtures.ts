/** Loyalty test fixtures (port of _program() in backend/tests/test_hub_loyalty.py). */
import { type DbLike, schema } from "@/server/db";
import { hashPin } from "@/server/services/loyalty";

const { loyaltyBadges, loyaltyPrograms, loyaltyRewards, outletModules, staffPins } = schema;

/** Programme (acknowledged), one badge at 2 visits with a 10% reward, and a staff PIN. */
export async function makeProgram(
  db: DbLike,
  outlet: { id: string },
  opts: { pin?: string; cooldownHours?: number; acknowledged?: boolean; expiresDays?: number | null } = {},
) {
  await db.insert(loyaltyPrograms).values({
    outletId: outlet.id,
    cooldownHours: opts.cooldownHours ?? 12,
    acknowledgedAt: opts.acknowledged === false ? null : new Date(),
    acknowledgedBy: opts.acknowledged === false ? null : "owner",
  });
  const [badge] = await db
    .insert(loyaltyBadges)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      name: "Regular",
      icon: "sparkle",
      visitsRequired: 2,
      sortOrder: 0,
      active: true,
    })
    .returning();
  await db.insert(loyaltyRewards).values({
    id: crypto.randomUUID(),
    badgeId: badge.id,
    type: "percent_discount",
    percent: 10,
    currencyCode: "INR",
    title: "10% off",
    expiresDays: opts.expiresDays === undefined ? 30 : opts.expiresDays,
  });
  const [pin] = await db
    .insert(staffPins)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      label: "Desk",
      pinHash: await hashPin(opts.pin ?? "1234"),
      active: true,
      failedAttempts: 0,
    })
    .returning();
  return { badge, pin };
}

/** Turn the Rewards module on for the outlet (what the owner does once the programme is acknowledged). */
export async function enableRewards(db: DbLike, outlet: { id: string }, over: { enabled?: boolean; available?: boolean } = {}) {
  await db
    .insert(outletModules)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      module: "rewards",
      enabled: over.enabled ?? true,
      sortOrder: 3,
      available: over.available ?? true,
    })
    .onConflictDoNothing();
}
