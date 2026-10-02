/**
 * Customer-facing hub, Connect, Menu and Rewards read models. Port of
 * backend/app/api/hub_public.py plus the read half of
 * backend/app/services/hub_config.py and backend/app/hub/registry.py.
 *
 * Suspended/deactivated outlets serve a neutral payload for every module
 * (FR-83). Nothing here touches review-side tables.
 */
import { and, asc, count, eq, inArray } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { menuLabel } from "@/server/verticals";
import { isCollecting } from "./outletState";
import type { Outlet } from "./flow";

const {
  loyaltyBadges,
  loyaltyPrograms,
  loyaltyRewards,
  menuCategories,
  menuItems,
  outletLinks,
  outletModules,
  outletProfiles,
} = schema;

/* ------------------------------------------------------------ registry */

interface ModuleDef {
  key: string;
  label: string;
  blurb: string;
  icon: string;
  route: string; // path suffix under /r/{slug}
}

/**
 * Module registry as data (FR-78). Default order is the hub order (FR-79).
 * Tile labels are deliberately neutral (FR-80): none refers to another module.
 */
export const MODULES: readonly ModuleDef[] = [
  { key: "review", label: "Share your experience", blurb: "Tell us how it went", icon: "pencil", route: "review" },
  { key: "connect", label: "Connect with us", blurb: "Directions, social and contact", icon: "link", route: "connect" },
  { key: "menu", label: "Services", blurb: "What we offer", icon: "menu", route: "menu" },
  { key: "rewards", label: "Rewards", blurb: "Badges and offers for regulars", icon: "badge", route: "rewards" },
];
const MODULE_BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export function labelFor(key: string, vertical: string): string {
  return key === "menu" ? menuLabel(vertical) : (MODULE_BY_KEY.get(key)?.label ?? key);
}

/* --------------------------------------------------------------- links */

/** Python urllib.parse.quote(): leaves "/" and "~" alone, escapes !*'() too. */
function pyQuote(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, "/");
}

export function googleMapsUrl(businessName: string, placeId: string | null): string {
  let url = `https://www.google.com/maps/search/?api=1&query=${pyQuote(businessName)}`;
  if (placeId) url += `&query_place_id=${pyQuote(placeId)}`;
  return url;
}

/* ------------------------------------------------------------- modules */

type ModuleRow = typeof outletModules.$inferSelect;

export async function ensureModules(db: DbLike, outlet: Pick<Outlet, "id">): Promise<ModuleRow[]> {
  const existing = await db.select().from(outletModules).where(eq(outletModules.outletId, outlet.id));
  const have = new Set(existing.map((m) => m.module));
  const missing = MODULES.map((mod, i) => ({ mod, i })).filter(({ mod }) => !have.has(mod.key));
  if (missing.length > 0) {
    // uq_outlet_modules_outlet_module makes concurrent first visits safe.
    await db
      .insert(outletModules)
      .values(
        missing.map(({ mod, i }) => ({
          id: crypto.randomUUID(),
          outletId: outlet.id,
          module: mod.key,
          enabled: mod.key === "review",
          sortOrder: i,
          available: true,
        })),
      )
      .onConflictDoNothing();
    const rows = await db.select().from(outletModules).where(eq(outletModules.outletId, outlet.id));
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return existing.sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface LinkItem {
  id: string;
  kind: string;
  label: string | null;
  url: string;
  auto?: boolean;
}

/** Owner links plus an automatic Google Maps row from the Places id. */
export async function activeLinks(db: DbLike, outlet: Outlet): Promise<LinkItem[]> {
  const links = await db
    .select()
    .from(outletLinks)
    .where(and(eq(outletLinks.outletId, outlet.id), eq(outletLinks.enabled, true)))
    .orderBy(asc(outletLinks.sortOrder));
  const out: LinkItem[] = links.map((l) => ({ id: l.id, kind: l.kind, label: l.label, url: l.url }));
  if (outlet.googlePlaceId && !out.some((l) => l.kind === "google_maps")) {
    out.unshift({
      id: "auto-maps",
      kind: "google_maps",
      label: null,
      url: googleMapsUrl(outlet.businessName, outlet.googlePlaceId),
      auto: true,
    });
  }
  return out;
}

/** null when the module has enough content to be shown; else why not (FR-89). */
export async function contentReason(db: DbLike, outlet: Outlet, key: string): Promise<string | null> {
  switch (key) {
    case "review":
      return null;
    case "connect": {
      const [profile] = await db.select().from(outletProfiles).where(eq(outletProfiles.outletId, outlet.id)).limit(1);
      if ((await activeLinks(db, outlet)).length > 0 || profile?.phone || profile?.addressLine) return null;
      return "Add at least one link, phone number or address.";
    }
    case "menu": {
      const [row] = await db
        .select({ n: count() })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(and(eq(menuCategories.outletId, outlet.id), eq(menuItems.available, true)));
      return row.n > 0 ? null : "Add at least one item.";
    }
    case "rewards": {
      const [prog] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.outletId, outlet.id)).limit(1);
      if (!prog || prog.acknowledgedAt === null) return "Read and accept the rewards guidelines first.";
      const [row] = await db
        .select({ n: count() })
        .from(loyaltyBadges)
        .innerJoin(loyaltyRewards, eq(loyaltyRewards.badgeId, loyaltyBadges.id))
        .where(and(eq(loyaltyBadges.outletId, outlet.id), eq(loyaltyBadges.active, true)));
      return row.n > 0 ? null : "Create at least one badge with a reward.";
    }
    default:
      return "Unknown module.";
  }
}

export interface ResolvedHub {
  mode: "hub" | "direct";
  modules: { key: string; label: string; blurb: string; icon: string; route: string }[];
}

/**
 * SRS-20.1: hub_mode, then enabled-module count. Fewer than two shown modules
 * always falls back to the review flow (FR-77).
 */
export async function resolveHub(db: DbLike, outlet: Outlet): Promise<ResolvedHub> {
  const shown: ResolvedHub["modules"] = [];
  for (const row of await ensureModules(db, outlet)) {
    if (!(row.enabled && row.available)) continue;
    const mod = MODULE_BY_KEY.get(row.module);
    if (!mod) continue;
    if ((await contentReason(db, outlet, row.module)) !== null) continue;
    shown.push({ key: mod.key, label: labelFor(mod.key, outlet.vertical), blurb: mod.blurb, icon: mod.icon, route: mod.route });
  }
  return { mode: outlet.hubMode === "menu" && shown.length >= 2 ? "hub" : "direct", modules: shown };
}

/* ------------------------------------------------------------- profile */

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Profile = typeof outletProfiles.$inferSelect;

export interface OpenNow {
  open: boolean;
  until: string | null;
}

/** Hours are {"mon": [["09:00","20:00"]], ...}; a missing/empty day is closed. */
export function openNow(
  profile: Pick<Profile, "hours"> | undefined,
  timeZone: string,
  now: Date = new Date(),
): OpenNow | null {
  const hours = profile?.hours as Record<string, string[][]> | null | undefined;
  if (!hours || Object.keys(hours).length === 0) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return null; // a bad tz string must never break the page
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday").slice(0, 3).toLowerCase();
  if (!DAYS.includes(day as (typeof DAYS)[number])) return null;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  for (const [start, end] of hours[day] ?? []) {
    const s = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
    const e = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
    if (s <= minutes && minutes < e) return { open: true, until: end };
  }
  return { open: false, until: null };
}

export function profileDict(p: Profile | undefined) {
  return {
    tagline: p?.tagline ?? null,
    cover_image_url: p?.coverImageUrl ?? null,
    address_line: p?.addressLine ?? null,
    locality: p?.locality ?? null,
    phone: p?.phone ?? null,
    hours: (p?.hours as Record<string, string[][]> | null | undefined) ?? null,
  };
}

export async function loadProfile(db: DbLike, outletId: string): Promise<Profile | undefined> {
  const [profile] = await db.select().from(outletProfiles).where(eq(outletProfiles.outletId, outletId)).limit(1);
  return profile;
}

/* ---------------------------------------------------------------- menu */

type MenuItemRow = typeof menuItems.$inferSelect;

export function itemDict(i: MenuItemRow) {
  return {
    id: i.id,
    category_id: i.categoryId,
    name: i.name,
    description: i.description,
    amount_minor: i.amountMinor,
    currency_code: i.currencyCode,
    price_on_request: i.priceOnRequest,
    price_prefix: i.pricePrefix,
    duration_min: i.durationMin,
    dietary: i.dietary ?? [],
    photo_url: i.photoUrl,
    available: i.available,
  };
}

export async function menuTree(db: DbLike, outlet: Pick<Outlet, "id">, opts: { onlyAvailable: boolean }) {
  const cats = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.outletId, outlet.id))
    .orderBy(asc(menuCategories.sortOrder));
  if (cats.length === 0) return [];
  const items = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.categoryId, cats.map((c) => c.id)))
    .orderBy(asc(menuItems.sortOrder));
  const tree = [];
  for (const c of cats) {
    const its = items.filter((i) => i.categoryId === c.id && (i.available || !opts.onlyAvailable));
    if (opts.onlyAvailable && its.length === 0) continue;
    tree.push({ id: c.id, name: c.name, items: its.map(itemDict) });
  }
  return tree;
}

/* ------------------------------------------------------ public payloads */

/** A draft outlet is previewable; otherwise only collecting outlets are live. */
function isLive(outlet: Outlet): boolean {
  return isCollecting(outlet.state) || outlet.state === "draft";
}

function header(outlet: Outlet) {
  return { id: outlet.id, name: outlet.businessName, logo_url: outlet.logoUrl, vertical: outlet.vertical, slug: outlet.slug };
}

export async function getHubPayload(db: DbLike, outlet: Outlet) {
  if (!isLive(outlet)) return { collecting: false, outlet: header(outlet), mode: "direct" as const, modules: [] };
  const resolved = await resolveHub(db, outlet);
  const profile = await loadProfile(db, outlet.id);
  return {
    collecting: true,
    outlet: header(outlet),
    mode: resolved.mode,
    modules: resolved.modules,
    profile: profileDict(profile),
    open_now: openNow(profile, outlet.timezone),
  };
}

export async function getConnectPayload(db: DbLike, outlet: Outlet) {
  if (!isLive(outlet)) return { collecting: false, outlet: header(outlet) };
  const profile = await loadProfile(db, outlet.id);
  return {
    collecting: true,
    outlet: header(outlet),
    profile: profileDict(profile),
    open_now: openNow(profile, outlet.timezone),
    links: await activeLinks(db, outlet),
  };
}

export async function getMenuPayload(db: DbLike, outlet: Outlet) {
  if (!isLive(outlet)) return { collecting: false, outlet: header(outlet) };
  return {
    collecting: true,
    outlet: header(outlet),
    label: labelFor("menu", outlet.vertical),
    categories: await menuTree(db, outlet, { onlyAvailable: false }),
  };
}

export async function getRewardsPayload(db: DbLike, outlet: Outlet) {
  if (!isLive(outlet)) return { collecting: false, outlet: header(outlet) };
  const badges = await db
    .select()
    .from(loyaltyBadges)
    .where(and(eq(loyaltyBadges.outletId, outlet.id), eq(loyaltyBadges.active, true)))
    .orderBy(asc(loyaltyBadges.visitsRequired));
  const rewards = new Map(
    badges.length
      ? (
          await db
            .select()
            .from(loyaltyRewards)
            .where(inArray(loyaltyRewards.badgeId, badges.map((b) => b.id)))
        ).map((r) => [r.badgeId, r])
      : [],
  );
  const [prog] = await db.select().from(loyaltyPrograms).where(eq(loyaltyPrograms.outletId, outlet.id)).limit(1);
  const [moduleRow] = await db
    .select()
    .from(outletModules)
    .where(and(eq(outletModules.outletId, outlet.id), eq(outletModules.module, "rewards")))
    .limit(1);
  return {
    collecting: true,
    outlet: header(outlet),
    enabled: Boolean(moduleRow?.enabled && moduleRow.available),
    terms: prog?.terms ?? null,
    badges: badges.map((b) => ({
      name: b.name,
      icon: b.icon,
      visits_required: b.visitsRequired,
      reward_title: rewards.get(b.id)?.title ?? null,
      reward_terms: rewards.get(b.id)?.terms ?? null,
    })),
  };
}
