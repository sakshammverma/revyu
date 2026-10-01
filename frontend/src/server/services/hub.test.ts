import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema } from "@/server/db";
import { inRolledBackTx, makeAccount, makeOutlet } from "@/server/testing/helpers";
import {
  activeLinks,
  ensureModules,
  getConnectPayload,
  getHubPayload,
  getMenuPayload,
  getRewardsPayload,
  googleMapsUrl,
  labelFor,
  openNow,
  resolveHub,
} from "./hub";

const { loyaltyBadges, loyaltyPrograms, loyaltyRewards, menuCategories, menuItems, outletLinks, outletModules, outletProfiles } =
  schema;

type Tx = Parameters<typeof makeAccount>[0];

async function enable(db: Tx, outletId: string, module: string) {
  await db.insert(outletModules).values({ id: crypto.randomUUID(), outletId, module, enabled: true, sortOrder: 9, available: true }).onConflictDoNothing();
}

async function addMenuItem(db: Tx, outletId: string) {
  const catId = crypto.randomUUID();
  await db.insert(menuCategories).values({ id: catId, outletId, name: "Cleaning", sortOrder: 0 });
  await db.insert(menuItems).values({
    id: crypto.randomUUID(),
    categoryId: catId,
    name: "Scale & polish",
    currencyCode: "INR",
    priceOnRequest: false,
    dietary: [],
    available: true,
    sortOrder: 0,
    amountMinor: 50000,
  });
}

describe("googleMapsUrl (matches Python urllib.parse.quote)", () => {
  it("escapes like Python", () => {
    expect(googleMapsUrl("Dr. Rao's Clinic & Co", "ChIJ abc")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Dr.%20Rao%27s%20Clinic%20%26%20Co&query_place_id=ChIJ%20abc",
    );
    expect(googleMapsUrl("A/B (x)!", null)).toBe("https://www.google.com/maps/search/?api=1&query=A/B%20%28x%29%21");
  });
});

describe("labels", () => {
  it("uses the vertical's menu label and neutral module labels (FR-75, FR-80)", () => {
    expect(labelFor("menu", "dental")).toBe("Services");
    expect(labelFor("menu", "general")).toBe("Products & services");
    expect(labelFor("menu", "unknown-vertical")).toBe("Services");
    expect(labelFor("review", "dental")).toBe("Share your experience");
  });
});

describe("openNow", () => {
  const hours = { mon: [["09:00", "20:00"]], tue: [] as string[][] };
  // 2026-10-05 is a Monday. 12:00 IST = 06:30 UTC.
  it("is open inside a window and reports when it closes", () => {
    expect(openNow({ hours }, "Asia/Kolkata", new Date("2026-10-05T06:30:00Z"))).toEqual({ open: true, until: "20:00" });
  });
  it("is closed outside the window and on empty days", () => {
    expect(openNow({ hours }, "Asia/Kolkata", new Date("2026-10-05T16:00:00Z"))).toEqual({ open: false, until: null });
    expect(openNow({ hours }, "Asia/Kolkata", new Date("2026-10-06T06:30:00Z"))).toEqual({ open: false, until: null });
  });
  it("uses the outlet's timezone, not the server's", () => {
    // 04:00 UTC Monday is still Sunday evening in New York.
    expect(openNow({ hours }, "America/New_York", new Date("2026-10-05T04:00:00Z"))).toEqual({ open: false, until: null });
  });
  it("is null without hours and never throws on a bad timezone", () => {
    expect(openNow({ hours: null }, "Asia/Kolkata")).toBeNull();
    expect(openNow(undefined, "Asia/Kolkata")).toBeNull();
    expect(openNow({ hours }, "Not/AZone")).toBeNull();
  });
});

describe("hub resolution (SRS-20.1, FR-77)", () => {
  it("seeds the four modules with only 'review' enabled, idempotently", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const rows = await ensureModules(db, outlet);
      expect(rows.map((r) => [r.module, r.enabled])).toEqual([
        ["review", true],
        ["connect", false],
        ["menu", false],
        ["rewards", false],
      ]);
      expect(await ensureModules(db, outlet)).toHaveLength(4);
    }));

  it("falls back to direct with fewer than two shown modules, even in menu mode", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { hubMode: "menu" });
      expect((await resolveHub(db, outlet)).mode).toBe("direct");
    }));

  it("stays direct in direct mode however many modules are enabled", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { hubMode: "direct" });
      await ensureModules(db, outlet);
      await addMenuItem(db, outlet.id);
      await db.update(outletModules).set({ enabled: true }).where(eqModule(outlet.id, "menu"));
      expect((await resolveHub(db, outlet)).mode).toBe("direct");
    }));

  it("becomes a hub when menu mode has two content-ready modules", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { hubMode: "menu" });
      await ensureModules(db, outlet);
      await addMenuItem(db, outlet.id);
      await db.update(outletModules).set({ enabled: true }).where(eqModule(outlet.id, "menu"));
      const hub = await resolveHub(db, outlet);
      expect(hub.mode).toBe("hub");
      expect(hub.modules.map((m) => m.key)).toEqual(["review", "menu"]);
    }));

  it("hides an enabled module that has no content", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { hubMode: "menu" });
      await ensureModules(db, outlet);
      await db.update(outletModules).set({ enabled: true }).where(eqModule(outlet.id, "menu"));
      expect((await resolveHub(db, outlet)).modules.map((m) => m.key)).toEqual(["review"]);
    }));
});

describe("public payloads", () => {
  it("serves a neutral payload for a suspended outlet for every module (FR-83)", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { state: "suspended" });
      expect(await getHubPayload(db, outlet)).toMatchObject({ collecting: false, mode: "direct", modules: [] });
      for (const get of [getConnectPayload, getMenuPayload, getRewardsPayload]) {
        const payload = await get(db, outlet);
        expect(payload.collecting).toBe(false);
        expect(Object.keys(payload).sort()).toEqual(["collecting", "outlet"]);
      }
    }));

  it("connect adds an automatic Google Maps row from the Places id", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { googlePlaceId: "PLACE1" });
      await db.insert(outletLinks).values({ id: crypto.randomUUID(), outletId: outlet.id, kind: "instagram", url: "https://instagram.com/x", sortOrder: 0, enabled: true });
      await db.insert(outletLinks).values({ id: crypto.randomUUID(), outletId: outlet.id, kind: "facebook", url: "https://facebook.com/x", sortOrder: 1, enabled: false });
      const links = await activeLinks(db, outlet);
      expect(links.map((l) => l.kind)).toEqual(["google_maps", "instagram"]);
      expect(links[0]).toMatchObject({ id: "auto-maps", auto: true });
    }));

  it("connect payload carries profile and open_now", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await db.insert(outletProfiles).values({ outletId: outlet.id, tagline: "Smile", phone: "+911234567890", hours: { mon: [["00:00", "23:59"]] } });
      const payload = await getConnectPayload(db, outlet);
      expect(payload).toMatchObject({ collecting: true, profile: { tagline: "Smile", phone: "+911234567890" } });
    }));

  it("menu payload returns categories with items in the python field shape", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await addMenuItem(db, outlet.id);
      const payload = await getMenuPayload(db, outlet);
      expect(payload).toMatchObject({ collecting: true, label: "Services" });
      const item = (payload as { categories: { items: Record<string, unknown>[] }[] }).categories[0].items[0];
      expect(Object.keys(item).sort()).toEqual(
        ["amount_minor", "available", "category_id", "currency_code", "description", "dietary", "duration_min", "id", "name", "photo_url", "price_on_request", "price_prefix"].sort(),
      );
      expect(item).toMatchObject({ name: "Scale & polish", amount_minor: 50000, dietary: [] });
    }));

  it("rewards payload lists active badges with their reward, and reports enabled", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await enable(db, outlet.id, "rewards");
      await db.insert(loyaltyPrograms).values({ outletId: outlet.id, cooldownHours: 12, terms: "Be nice" });
      const badgeId = crypto.randomUUID();
      await db.insert(loyaltyBadges).values({ id: badgeId, outletId: outlet.id, name: "Regular", icon: "star", visitsRequired: 5, sortOrder: 0, active: true });
      await db.insert(loyaltyRewards).values({ id: crypto.randomUUID(), badgeId, type: "percent", percent: 10, currencyCode: "INR", title: "10% off" });
      expect(await getRewardsPayload(db, outlet)).toMatchObject({
        collecting: true,
        enabled: true,
        terms: "Be nice",
        badges: [{ name: "Regular", visits_required: 5, reward_title: "10% off", reward_terms: null }],
      });
    }));
});

function eqModule(outletId: string, module: string) {
  return and(eq(outletModules.outletId, outletId), eq(outletModules.module, module));
}
