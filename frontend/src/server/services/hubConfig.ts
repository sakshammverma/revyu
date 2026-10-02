/**
 * Owner-side QR-page (hub) configuration: the write half of
 * backend/app/services/hub_config.py plus the editor payload and the hub
 * insights query from backend/app/api/hub_config.py. The read half lives in
 * hub.ts. Loyalty endpoints are not here (phase 6).
 *
 * Callers pass a `db` that is the shared client or a transaction, so every
 * function is testable inside a rolled-back transaction.
 */
import { and, asc, count, eq, gte, inArray } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import type { Account } from "@/server/auth/owner";
import type { Outlet } from "./flow";
import { contentReason, ensureModules, itemDict, labelFor, loadProfile, menuTree, MODULES, profileDict } from "./hub";
import { LINK_KINDS, LinkError, normalizeLink } from "./links";

const { events, menuCategories, menuItems, outletLinks, outletModules, outletProfiles, outlets } = schema;

const MODULE_KEYS = new Set(MODULES.map((m) => m.key));

export class HubConfigError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

/** Becomes `{detail:{error:{code,message}}}` through handler(). */
export const toHttpError = (e: HubConfigError) => new HttpError(e.status, e.code, e.message);

/** An invalid link carries the row index so the editor can point at it. */
export class BadLinkError extends Error {
  constructor(
    message: string,
    public index?: number,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------- ownership */

/** SRS-15.6: an owner only ever reaches their own outlet. */
export async function requireOwnOutlet(db: DbLike, owner: Pick<Account, "id">, outletId: string): Promise<Outlet> {
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet || outlet.accountId !== owner.id) throw new HttpError(403, "FORBIDDEN");
  return outlet;
}

async function ownedCategory(db: DbLike, outlet: Pick<Outlet, "id">, categoryId: string) {
  const [cat] = await db.select().from(menuCategories).where(eq(menuCategories.id, categoryId)).limit(1);
  if (!cat || cat.outletId !== outlet.id) throw new HubConfigError("NOT_FOUND", "Category not found", 404);
  return cat;
}

async function ownedItem(db: DbLike, outlet: Pick<Outlet, "id">, itemId: string) {
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, itemId)).limit(1);
  if (!item) throw new HubConfigError("NOT_FOUND", "Item not found", 404);
  await ownedCategory(db, outlet, item.categoryId);
  return item;
}

/* ---------------------------------------------------------- editor state */

export async function editorState(db: DbLike, outlet: Outlet) {
  const [profile, links, moduleRows, menu] = await Promise.all([
    loadProfile(db, outlet.id),
    db.select().from(outletLinks).where(eq(outletLinks.outletId, outlet.id)).orderBy(asc(outletLinks.sortOrder)),
    ensureModules(db, outlet),
    menuTree(db, outlet, { onlyAvailable: false }),
  ]);
  const modules = [];
  for (const row of moduleRows) {
    if (!MODULE_KEYS.has(row.module)) continue;
    modules.push({
      key: row.module,
      label: labelFor(row.module, outlet.vertical),
      enabled: row.enabled,
      available: row.available,
      blocked_reason: row.enabled ? null : await contentReason(db, outlet, row.module),
    });
  }
  return {
    slug: outlet.slug,
    hub_mode: outlet.hubMode,
    modules,
    profile: profileDict(profile),
    links: links.map((l) => ({ id: l.id, kind: l.kind, label: l.label, url: l.url, enabled: l.enabled })),
    google_maps_auto: Boolean(outlet.googlePlaceId),
    menu_label: labelFor("menu", outlet.vertical),
    menu,
  };
}

export async function setHubMode(db: DbLike, outlet: Pick<Outlet, "id">, mode: "direct" | "menu") {
  await db.update(outlets).set({ hubMode: mode, updatedAt: new Date() }).where(eq(outlets.id, outlet.id));
}

/* --------------------------------------------------------------- modules */

export async function setModules(
  db: DbLike,
  outlet: Outlet,
  items: { module: string; enabled: boolean }[],
  opts: { isAdmin?: boolean } = {},
) {
  const rows = new Map((await ensureModules(db, outlet)).map((m) => [m.module, { ...m }]));
  const dirty = new Set<string>();
  // All-or-nothing: validate against an in-memory copy, then write. FR-89:
  // an empty module cannot be switched on; owners cannot enable an unavailable one.
  for (const [order, item] of items.entries()) {
    const row = rows.get(item.module);
    if (!MODULE_KEYS.has(item.module) || !row) {
      throw new HubConfigError("UNKNOWN_MODULE", `Unknown module ${item.module}`, 422);
    }
    if (item.enabled && !row.enabled) {
      if (!row.available && !opts.isAdmin) {
        throw new HubConfigError("MODULE_UNAVAILABLE", "This module isn't available for your page yet.");
      }
      const reason = await contentReason(db, outlet, item.module);
      if (reason) throw new HubConfigError("MODULE_EMPTY", reason);
    }
    if (row.enabled !== item.enabled || row.sortOrder !== order) dirty.add(item.module);
    row.enabled = item.enabled;
    row.sortOrder = order;
  }
  if (dirty.size === 0) return;
  await db.transaction(async (tx) => {
    await Promise.all(
      [...dirty].map((key) => {
        const row = rows.get(key)!;
        return tx
          .update(outletModules)
          .set({ enabled: row.enabled, sortOrder: row.sortOrder })
          .where(eq(outletModules.id, row.id));
      }),
    );
  });
}

/** Admin-only (phase 7 route); lives here so the owner and admin paths share one rule set. */
export async function setAvailability(db: DbLike, outlet: Outlet, module: string, available: boolean) {
  const row = (await ensureModules(db, outlet)).find((m) => m.module === module);
  if (!row || module === "review") throw new HubConfigError("UNKNOWN_MODULE", "Unknown module", 422);
  await db
    .update(outletModules)
    .set(available ? { available } : { available, enabled: false })
    .where(eq(outletModules.id, row.id));
}

/* --------------------------------------------------------------- profile */

export interface ProfilePatch {
  tagline?: string | null;
  cover_image_url?: string | null;
  address_line?: string | null;
  locality?: string | null;
  phone?: string | null;
  hours?: Record<string, string[][]> | null;
}

/** Only fields present in the body are touched (pydantic exclude_unset); blank strings become null. */
export async function patchProfile(db: DbLike, outlet: Pick<Outlet, "id">, body: ProfilePatch) {
  const clean = (v: string | null | undefined) => (typeof v === "string" ? v.trim() || null : v);
  const set: Partial<typeof outletProfiles.$inferInsert> = {};
  if (body.tagline !== undefined) set.tagline = clean(body.tagline);
  if (body.cover_image_url !== undefined) set.coverImageUrl = clean(body.cover_image_url);
  if (body.address_line !== undefined) set.addressLine = clean(body.address_line);
  if (body.locality !== undefined) set.locality = clean(body.locality);
  if (body.phone !== undefined) set.phone = clean(body.phone);
  if (body.hours !== undefined) set.hours = body.hours;
  const updatedAt = new Date();
  await db
    .insert(outletProfiles)
    .values({ outletId: outlet.id, ...set, updatedAt })
    .onConflictDoUpdate({ target: outletProfiles.outletId, set: { ...set, updatedAt } });
}

/* ----------------------------------------------------------------- links */

/** Hosts a link may not point at: our own public host (never localhost). */
export function ownHostsFrom(publicFlowBaseUrl: string): string[] {
  const host = publicFlowBaseUrl.split("//").pop()!.split("/")[0].split(":")[0];
  return host && host !== "localhost" ? [host] : [];
}

export async function putLinks(
  db: DbLike,
  outlet: Pick<Outlet, "id">,
  links: { kind: string; label?: string | null; url: string; enabled: boolean }[],
  ownHosts: readonly string[],
) {
  const clean: (typeof outletLinks.$inferInsert)[] = [];
  for (const [i, link] of links.entries()) {
    if (!(LINK_KINDS as readonly string[]).includes(link.kind)) throw new BadLinkError("Unknown link type.");
    let url: string;
    try {
      url = normalizeLink(link.kind, link.url, { ownHosts });
    } catch (e) {
      if (e instanceof LinkError) throw new BadLinkError(e.message, i);
      throw e;
    }
    clean.push({
      id: crypto.randomUUID(),
      outletId: outlet.id,
      kind: link.kind,
      label: (link.label ?? "").trim() || null,
      url,
      sortOrder: i,
      enabled: link.enabled,
    });
  }
  await db.transaction(async (tx) => {
    await tx.delete(outletLinks).where(eq(outletLinks.outletId, outlet.id));
    if (clean.length > 0) await tx.insert(outletLinks).values(clean);
  });
}

/* ------------------------------------------------------------------ menu */

export const DIETARY = ["veg", "non_veg", "vegan", "egg"] as const;
const MAX_CATEGORIES = 40;

export interface ItemInput {
  category_id?: string | null;
  name: string;
  description?: string | null;
  amount_minor?: number | null;
  price_on_request: boolean;
  price_prefix?: string | null;
  duration_min?: number | null;
  dietary: string[];
  photo_url?: string | null;
  available: boolean;
}

export async function addCategory(db: DbLike, outlet: Pick<Outlet, "id">, name: string) {
  const [{ n }] = await db.select({ n: count() }).from(menuCategories).where(eq(menuCategories.outletId, outlet.id));
  if (n >= MAX_CATEGORIES) throw new HubConfigError("LIMIT", "Too many categories.", 422);
  const [cat] = await db
    .insert(menuCategories)
    .values({ id: crypto.randomUUID(), outletId: outlet.id, name: name.trim(), sortOrder: n })
    .returning();
  return { id: cat.id, name: cat.name, items: [] as never[] };
}

export async function renameCategory(db: DbLike, outlet: Pick<Outlet, "id">, categoryId: string, name: string) {
  const cat = await ownedCategory(db, outlet, categoryId);
  await db.update(menuCategories).set({ name: name.trim() }).where(eq(menuCategories.id, cat.id));
}

export async function deleteCategory(db: DbLike, outlet: Pick<Outlet, "id">, categoryId: string) {
  const cat = await ownedCategory(db, outlet, categoryId);
  await db.transaction(async (tx) => {
    await tx.delete(menuItems).where(eq(menuItems.categoryId, cat.id));
    await tx.delete(menuCategories).where(eq(menuCategories.id, cat.id));
  });
}

/** Position i in `ids` becomes sort_order i; a repeated id keeps its last position. */
function lastPositions(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, i]));
}

export async function orderCategories(db: DbLike, outlet: Pick<Outlet, "id">, ids: string[]) {
  const positions = lastPositions(ids);
  if (positions.size === 0) return;
  const found = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.outletId, outlet.id), inArray(menuCategories.id, [...positions.keys()])));
  if (found.length !== positions.size) throw new HubConfigError("NOT_FOUND", "Category not found", 404);
  await db.transaction(async (tx) => {
    await Promise.all(
      [...positions].map(([id, order]) =>
        tx.update(menuCategories).set({ sortOrder: order }).where(eq(menuCategories.id, id)),
      ),
    );
  });
}

function itemFields(body: ItemInput) {
  return {
    name: body.name.trim(),
    description: (body.description ?? "").trim() || null,
    priceOnRequest: body.price_on_request,
    amountMinor: body.price_on_request ? null : (body.amount_minor ?? null),
    pricePrefix: (body.price_prefix ?? "").trim() || null,
    durationMin: body.duration_min ?? null,
    dietary: body.dietary.filter((d) => (DIETARY as readonly string[]).includes(d)),
    photoUrl: body.photo_url ?? null,
    available: body.available,
  };
}

export async function addItem(db: DbLike, outlet: Pick<Outlet, "id">, body: ItemInput) {
  if (!body.category_id) throw new HubConfigError("NO_CATEGORY", "Choose a category.", 422);
  const cat = await ownedCategory(db, outlet, body.category_id);
  const [{ n }] = await db.select({ n: count() }).from(menuItems).where(eq(menuItems.categoryId, cat.id));
  const [item] = await db
    .insert(menuItems)
    .values({ id: crypto.randomUUID(), categoryId: cat.id, sortOrder: n, currencyCode: "INR", ...itemFields(body) })
    .returning();
  return itemDict(item);
}

export async function editItem(db: DbLike, outlet: Pick<Outlet, "id">, itemId: string, body: ItemInput) {
  const item = await ownedItem(db, outlet, itemId);
  let categoryId = item.categoryId;
  if (body.category_id && body.category_id !== item.categoryId) {
    categoryId = (await ownedCategory(db, outlet, body.category_id)).id;
  }
  const [updated] = await db
    .update(menuItems)
    .set({ categoryId, ...itemFields(body) })
    .where(eq(menuItems.id, item.id))
    .returning();
  return itemDict(updated);
}

export async function deleteItem(db: DbLike, outlet: Pick<Outlet, "id">, itemId: string) {
  const item = await ownedItem(db, outlet, itemId);
  await db.delete(menuItems).where(eq(menuItems.id, item.id));
}

export async function orderItems(db: DbLike, outlet: Pick<Outlet, "id">, ids: string[]) {
  const positions = lastPositions(ids);
  if (positions.size === 0) return;
  const found = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .where(and(eq(menuCategories.outletId, outlet.id), inArray(menuItems.id, [...positions.keys()])));
  if (found.length !== positions.size) throw new HubConfigError("NOT_FOUND", "Item not found", 404);
  await db.transaction(async (tx) => {
    await Promise.all(
      [...positions].map(([id, order]) => tx.update(menuItems).set({ sortOrder: order }).where(eq(menuItems.id, id))),
    );
  });
}

/* -------------------------------------------------------------- insights */

const INSIGHT_EVENTS = ["scan", "hub_viewed", "module_selected", "link_clicked", "menu_viewed", "rewards_viewed"];

/** Python round(a/b, 3): exact, ties to even. */
export function roundRatio3(a: number, b: number): number {
  const num = a * 1000;
  let q = Math.floor(num / b);
  const twice = 2 * (num - q * b);
  if (twice > b || (twice === b && q % 2 === 1)) q += 1;
  return q / 1000;
}

/**
 * Hub and Connect activity (customer-flow events only), kept apart from
 * rewards numbers on purpose (CR-6.4).
 */
export async function hubInsights(db: DbLike, outlet: Pick<Outlet, "id">, days: number, now: Date = new Date()) {
  const since = new Date(now.getTime() - Math.max(1, Math.min(days, 365)) * 86_400_000);
  const rows = await db
    .select({ type: events.type, payload: events.payload })
    .from(events)
    .where(and(eq(events.outletId, outlet.id), gte(events.occurredAt, since), inArray(events.type, INSIGHT_EVENTS)));
  const byType: Record<string, number> = {};
  const modules: Record<string, number> = {};
  const links: Record<string, number> = {};
  const bump = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
  for (const { type, payload } of rows) {
    bump(byType, type);
    const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    if (type === "module_selected") bump(modules, String(p.module ?? "?"));
    if (type === "link_clicked") bump(links, String(p.kind ?? "?"));
  }
  const hubViews = byType.hub_viewed ?? 0;
  return {
    days,
    scans: byType.scan ?? 0,
    hub_views: hubViews,
    modules,
    links,
    menu_views: byType.menu_viewed ?? 0,
    rewards_views: byType.rewards_viewed ?? 0,
    take_rate: hubViews ? roundRatio3(modules.review ?? 0, hubViews) : null,
  };
}
