/**
 * Competitor Watch. Port of backend/app/services/competitors.py.
 *
 * An owner follows up to three nearby businesses. The weekly Places poll
 * records each one's public rating and review count. Only public Google data
 * is used; nothing reads whether a rival also uses Revyu, so it behaves
 * identically either way (product decision 2026-10-01).
 */
import { asc, desc, eq } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { getPlaceSnapshot, PlacesUnavailableError } from "@/server/services/places";

const { competitorSnapshots, competitorWatches, outlets, placeSnapshots } = schema;

export const MAX_WATCHES = 3;

export class WatchError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export interface Standing {
  name: string;
  rating: number | null;
  review_count: number | null;
  /** Reviews gained since the previous check; null = no history yet. */
  delta: number | null;
}

type Outlet = typeof outlets.$inferSelect;
type Watch = typeof competitorWatches.$inferSelect;

export async function getOutletFor(db: DbLike, accountId: string): Promise<Outlet> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.accountId, accountId)).limit(1);
  if (!outlet) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return outlet;
}

export async function takeSnapshot(db: DbLike, watch: Watch): Promise<boolean> {
  let rating: number | null;
  let count: number | null;
  try {
    [rating, count] = await getPlaceSnapshot(watch.placeId);
  } catch (err) {
    if (err instanceof PlacesUnavailableError) return false;
    throw err;
  }
  await db
    .insert(competitorSnapshots)
    .values({ watchId: watch.id, rating: rating === null ? null : String(rating), reviewCount: count });
  return true;
}

export async function addWatch(db: DbLike, outlet: Outlet, placeId: string, name: string): Promise<Watch> {
  if (placeId === outlet.googlePlaceId) throw new WatchError("CANNOT_WATCH_SELF");
  const existing = await db.select().from(competitorWatches).where(eq(competitorWatches.outletId, outlet.id));
  if (existing.some((w) => w.placeId === placeId)) throw new WatchError("ALREADY_WATCHING");
  if (existing.length >= MAX_WATCHES) throw new WatchError("LIMIT_REACHED");

  const [watch] = await db
    .insert(competitorWatches)
    .values({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      placeId,
      name: Array.from(name.trim()).slice(0, 120).join(""),
    })
    .returning();
  await takeSnapshot(db, watch); // baseline so the first delta is meaningful
  return watch;
}

/** counts: newest first. Gain between the two most recent known checks. */
export function delta(counts: (number | null)[]): number | null {
  const known = counts.filter((c): c is number => c !== null);
  return known.length < 2 ? null : known[0] - known[1];
}

const numOrNull = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export async function standings(db: DbLike, outlet: Outlet): Promise<{ me: Standing; rivals: [Watch, Standing][] }> {
  const mine = await db
    .select()
    .from(placeSnapshots)
    .where(eq(placeSnapshots.outletId, outlet.id))
    .orderBy(desc(placeSnapshots.polledAt))
    .limit(2);
  const myCounts: (number | null)[] = mine.map((s) => s.reviewCount);
  if (myCounts.length === 1 && outlet.baselineReviewCount !== null) myCounts.push(outlet.baselineReviewCount);
  const me: Standing = {
    name: outlet.businessName,
    rating: mine.length && mine[0].rating !== null ? Number(mine[0].rating) : numOrNull(outlet.baselineRating),
    review_count: mine.length ? mine[0].reviewCount : outlet.baselineReviewCount,
    delta: delta(myCounts),
  };

  const watches = await db
    .select()
    .from(competitorWatches)
    .where(eq(competitorWatches.outletId, outlet.id))
    .orderBy(asc(competitorWatches.createdAt));
  const rivals: [Watch, Standing][] = [];
  for (const watch of watches) {
    const snaps = await db
      .select()
      .from(competitorSnapshots)
      .where(eq(competitorSnapshots.watchId, watch.id))
      .orderBy(desc(competitorSnapshots.polledAt))
      .limit(2);
    rivals.push([
      watch,
      {
        name: watch.name,
        rating: snaps.length && snaps[0].rating !== null ? Number(snaps[0].rating) : null,
        review_count: snaps.length ? snaps[0].reviewCount : null,
        delta: delta(snaps.map((s) => s.reviewCount)),
      },
    ]);
  }
  return { me, rivals };
}

export function headline(me: Standing, rivals: Standing[]): string {
  if (!rivals.length) return "Follow up to three nearby businesses to see who is gaining reviews fastest.";
  const moving = rivals.filter((r) => r.delta !== null);
  if (me.delta === null || !moving.length) {
    return "We're collecting the first numbers. Check back after the next weekly update.";
  }
  // First maximum wins on ties, like Python's max().
  const top = moving.reduce((best, r) => ((r.delta ?? 0) > (best.delta ?? 0) ? r : best));
  const topDelta = top.delta ?? 0;
  if (me.delta > topDelta) return `You gained ${me.delta} reviews last week, more than anyone you follow.`;
  if (me.delta === topDelta) return `You and ${top.name} both gained ${me.delta} last week.`;
  return `${top.name} gained ${top.delta} reviews last week; you gained ${me.delta}.`;
}

export async function competitorsOut(db: DbLike, outlet: Outlet) {
  const { me, rivals } = await standings(db, outlet);
  return {
    limit: MAX_WATCHES,
    me: { id: null, name: me.name, rating: me.rating, review_count: me.review_count, delta: me.delta },
    competitors: rivals.map(([w, s]) => ({
      id: w.id,
      name: s.name,
      rating: s.rating,
      review_count: s.review_count,
      delta: s.delta,
    })),
    headline: headline(
      me,
      rivals.map(([, s]) => s),
    ),
  };
}

export async function removeWatch(db: DbLike, outlet: Outlet, watchId: string): Promise<void> {
  const [watch] = await db.select().from(competitorWatches).where(eq(competitorWatches.id, watchId)).limit(1);
  if (!watch || watch.outletId !== outlet.id) throw new HttpError(404, "NOT_FOUND"); // SRS-15.6
  await db.delete(competitorWatches).where(eq(competitorWatches.id, watchId));
}
