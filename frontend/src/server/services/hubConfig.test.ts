import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema } from "@/server/db";
import { inRolledBackTx, makeAccount, makeOutlet } from "@/server/testing/helpers";
import { resolveHub } from "./hub";
import {
  BadLinkError,
  HubConfigError,
  addCategory,
  addItem,
  deleteCategory,
  deleteItem,
  editItem,
  editorState,
  hubInsights,
  orderCategories,
  orderItems,
  ownHostsFrom,
  patchProfile,
  putLinks,
  renameCategory,
  requireOwnOutlet,
  roundRatio3,
  setAvailability,
  setHubMode,
  setModules,
} from "./hubConfig";

const { events, menuCategories, menuItems, outletLinks, outletModules, outletProfiles, outlets } = schema;
type Tx = Parameters<typeof makeAccount>[0];

const setup = async (db: Tx) => {
  const account = await makeAccount(db);
  return { account, outlet: await makeOutlet(db, account) };
};
const item = (over: Record<string, unknown> = {}) => ({
  name: "Scaling", price_on_request: false, dietary: [], available: true, ...over,
});
const code = (p: Promise<unknown>) => p.then(() => null, (e: HubConfigError) => `${e.status}:${e.code}`);

describe("hub modules (port of test_hub_loyalty hub resolution)", () => {
  it("needs two modules with content before the hub shows", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      await setHubMode(db, outlet, "menu");
      const live = (await db.select().from(outlets).where(eq(outlets.id, outlet.id)))[0];
      expect((await resolveHub(db, live)).mode).toBe("direct"); // only review

      // FR-89: enabling an empty module is refused.
      const both = [{ module: "review", enabled: true }, { module: "connect", enabled: true }];
      expect(await code(setModules(db, live, both))).toBe("409:MODULE_EMPTY");

      await db.insert(outletLinks).values({ id: crypto.randomUUID(), outletId: outlet.id, kind: "website", url: "https://example.com", sortOrder: 0, enabled: true });
      await setModules(db, live, both);
      const resolved = await resolveHub(db, live);
      expect(resolved.mode).toBe("hub");
      expect(resolved.modules.map((m) => m.key)).toEqual(["review", "connect"]);

      await setHubMode(db, outlet, "direct");
      const direct = (await db.select().from(outlets).where(eq(outlets.id, outlet.id)))[0];
      expect((await resolveHub(db, direct)).mode).toBe("direct");
    }));

  it("an unavailable module can be enabled by an admin only", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      const cat = await addCategory(db, outlet, "Cleaning");
      await addItem(db, outlet, item({ category_id: cat.id, price_on_request: true }));
      await setAvailability(db, outlet, "menu", false);
      const body = [{ module: "review", enabled: true }, { module: "menu", enabled: true }];
      expect(await code(setModules(db, outlet, body))).toBe("409:MODULE_UNAVAILABLE");
      await setModules(db, outlet, body, { isAdmin: true });
      const [menu] = await db.select().from(outletModules).where(eq(outletModules.module, "menu"));
      expect(menu.enabled).toBe(true);
    }));

  it("is all-or-nothing and rejects unknown modules; availability=false also disables", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      const before = await editorState(db, outlet);
      expect(
        await code(setModules(db, outlet, [{ module: "review", enabled: true }, { module: "connect", enabled: true }])),
      ).toBe("409:MODULE_EMPTY");
      expect(await code(setModules(db, outlet, [{ module: "bogus", enabled: true }]))).toBe("422:UNKNOWN_MODULE");
      expect((await editorState(db, outlet)).modules).toEqual(before.modules);
      expect(await code(setAvailability(db, outlet, "review", false))).toBe("422:UNKNOWN_MODULE");

      await db.insert(outletLinks).values({ id: crypto.randomUUID(), outletId: outlet.id, kind: "website", url: "https://example.com", sortOrder: 0, enabled: true });
      await setModules(db, outlet, [{ module: "connect", enabled: true }, { module: "review", enabled: true }]);
      const state = await editorState(db, outlet);
      expect(state.modules.map((m) => [m.key, m.enabled])).toEqual([["connect", true], ["review", true], ["menu", false], ["rewards", false]]);
      await setAvailability(db, outlet, "connect", false);
      const after = (await editorState(db, outlet)).modules.find((m) => m.key === "connect")!;
      expect([after.available, after.enabled]).toEqual([false, false]);
    }));
});

describe("editor state", () => {
  it("has the FastAPI shape and blocked reasons for disabled modules", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      const state = await editorState(db, outlet);
      expect(Object.keys(state)).toEqual(["slug", "hub_mode", "modules", "profile", "links", "google_maps_auto", "menu_label", "menu"]);
      expect(state.modules[0]).toEqual({ key: "review", label: "Share your experience", enabled: true, available: true, blocked_reason: null });
      expect(state.modules.find((m) => m.key === "rewards")!.blocked_reason).toBe("Read and accept the rewards guidelines first.");
      expect(state.profile).toEqual({ tagline: null, cover_image_url: null, address_line: null, locality: null, phone: null, hours: null });
      expect(state.google_maps_auto).toBe(false);
    }));
});

describe("profile", () => {
  it("only touches the fields sent, trims, and turns blanks into null", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      await patchProfile(db, outlet, { tagline: "  Smile  ", phone: "+91 99999 00000", hours: { mon: [["09:00", "20:00"]] } });
      await patchProfile(db, outlet, { phone: "   ", locality: " Indiranagar " });
      const [row] = await db.select().from(outletProfiles).where(eq(outletProfiles.outletId, outlet.id));
      expect([row.tagline, row.phone, row.locality, row.hours]).toEqual(["Smile", null, "Indiranagar", { mon: [["09:00", "20:00"]] }]);
      await patchProfile(db, outlet, { hours: null }); // explicit null clears
      const [cleared] = await db.select().from(outletProfiles).where(eq(outletProfiles.outletId, outlet.id));
      expect([cleared.hours, cleared.tagline]).toEqual([null, "Smile"]);
    }));

  it("an empty patch still creates the row", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      await patchProfile(db, outlet, {});
      expect(await db.select().from(outletProfiles).where(eq(outletProfiles.outletId, outlet.id))).toHaveLength(1);
    }));
});

describe("links", () => {
  it("normalises, orders and replaces the whole set", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      await putLinks(db, outlet, [
        { kind: "instagram", label: " IG ", url: "@mycafe", enabled: true },
        { kind: "phone", label: "", url: "tel:+91 98765-43210", enabled: false },
      ], []);
      let state = await editorState(db, outlet);
      expect(state.links.map((l) => ({ kind: l.kind, label: l.label, url: l.url, enabled: l.enabled }))).toEqual([
        { kind: "instagram", label: "IG", url: "https://instagram.com/mycafe", enabled: true },
        { kind: "phone", label: null, url: "tel:+919876543210", enabled: false },
      ]);
      await putLinks(db, outlet, [], []);
      state = await editorState(db, outlet);
      expect(state.links).toEqual([]);
    }));

  it("reports the failing row index and leaves existing links untouched", async () => {
    await inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      await putLinks(db, outlet, [{ kind: "website", url: "https://example.com", enabled: true }], []);
      const err = await putLinks(db, outlet, [
        { kind: "website", url: "https://ok.example.com", enabled: true },
        { kind: "instagram", url: "https://evil.com/x", enabled: true },
      ], []).catch((e) => e);
      expect(err).toBeInstanceOf(BadLinkError);
      expect([err.message, err.index]).toEqual(["That doesn't look like an Instagram link", 1]);
      const unknown = await putLinks(db, outlet, [{ kind: "tiktok", url: "x.com", enabled: true }], []).catch((e) => e);
      expect([unknown.message, unknown.index]).toEqual(["Unknown link type.", undefined]);
      expect((await editorState(db, outlet)).links.map((l) => l.url)).toEqual(["https://example.com"]);
    });
  });

  it("derives own hosts from the public base URL (never localhost)", () => {
    expect(ownHostsFrom("https://revyu.in")).toEqual(["revyu.in"]);
    expect(ownHostsFrom("https://app.revyu.in:8443/x")).toEqual(["app.revyu.in"]);
    expect(ownHostsFrom("http://localhost:3000")).toEqual([]);
  });
});

describe("menu", () => {
  it("categories: limit, rename, ownership, ordering, delete cascades to items", () =>
    inRolledBackTx(async (db) => {
      const { account, outlet } = await setup(db);
      const other = await makeOutlet(db, account);
      const a = await addCategory(db, outlet, "  Starters ");
      const b = await addCategory(db, outlet, "Mains");
      expect(a).toEqual({ id: a.id, name: "Starters", items: [] });
      await renameCategory(db, outlet, b.id, " Main course ");
      await orderCategories(db, outlet, [b.id, a.id]);
      expect((await editorState(db, outlet)).menu.map((c) => c.name)).toEqual(["Main course", "Starters"]);

      // Another outlet's category is invisible: 404, nothing changed.
      expect(await code(renameCategory(db, other, a.id, "Hijack"))).toBe("404:NOT_FOUND");
      expect(await code(orderCategories(db, outlet, [a.id, crypto.randomUUID()]))).toBe("404:NOT_FOUND");
      expect((await editorState(db, outlet)).menu.map((c) => c.name)).toEqual(["Main course", "Starters"]);

      await addItem(db, outlet, item({ category_id: a.id }));
      await deleteCategory(db, outlet, a.id);
      expect(await db.select().from(menuItems).where(eq(menuItems.categoryId, a.id))).toEqual([]);

      for (let i = 0; i < 39; i++) await db.insert(menuCategories).values({ id: crypto.randomUUID(), outletId: outlet.id, name: `c${i}`, sortOrder: i + 1 });
      expect(await code(addCategory(db, outlet, "one too many"))).toBe("422:LIMIT");
    }));

  it("items: field cleaning, price rules, dietary filter, move, order, delete", () =>
    inRolledBackTx(async (db) => {
      const { account, outlet } = await setup(db);
      const other = await makeOutlet(db, account);
      const c1 = await addCategory(db, outlet, "One");
      const c2 = await addCategory(db, outlet, "Two");
      expect(await code(addItem(db, outlet, item()))).toBe("422:NO_CATEGORY");
      expect(await code(addItem(db, other, item({ category_id: c1.id })))).toBe("404:NOT_FOUND");

      const first = await addItem(db, outlet, item({
        category_id: c1.id, name: " Root canal ", description: "  ", amount_minor: 500000, price_prefix: " from ",
        duration_min: 45, dietary: ["veg", "halal", "egg"], photo_url: "/uploads/x.webp",
      }));
      expect(first).toMatchObject({
        name: "Root canal", description: null, amount_minor: 500000, currency_code: "INR", price_on_request: false,
        price_prefix: "from", duration_min: 45, dietary: ["veg", "egg"], photo_url: "/uploads/x.webp", available: true,
      });
      const second = await addItem(db, outlet, item({ category_id: c1.id, name: "Scaling", amount_minor: 9, price_on_request: true }));
      expect(second.amount_minor).toBeNull(); // price on request wins

      await orderItems(db, outlet, [second.id, first.id]);
      expect((await editorState(db, outlet)).menu[0].items.map((i) => i.name)).toEqual(["Scaling", "Root canal"]);

      const moved = await editItem(db, outlet, first.id, item({ category_id: c2.id, name: "Root canal 2", available: false }));
      expect([moved.category_id, moved.name, moved.available]).toEqual([c2.id, "Root canal 2", false]);
      expect(await code(editItem(db, outlet, first.id, item({ category_id: (await addCategory(db, other, "x")).id })))).toBe("404:NOT_FOUND");
      expect(await code(editItem(db, other, first.id, item()))).toBe("404:NOT_FOUND");
      expect(await code(orderItems(db, outlet, [crypto.randomUUID()]))).toBe("404:NOT_FOUND");

      await deleteItem(db, outlet, first.id);
      expect(await code(deleteItem(db, outlet, first.id))).toBe("404:NOT_FOUND");
    }));
});

describe("ownership", () => {
  it("only the owning account reaches an outlet", () =>
    inRolledBackTx(async (db) => {
      const { account, outlet } = await setup(db);
      const stranger = await makeAccount(db, "b");
      expect((await requireOwnOutlet(db, account, outlet.id)).id).toBe(outlet.id);
      await expect(requireOwnOutlet(db, stranger, outlet.id)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
      await expect(requireOwnOutlet(db, account, crypto.randomUUID())).rejects.toMatchObject({ status: 403 });
    }));
});

describe("insights", () => {
  it("counts only customer-flow events inside the window and computes take rate", () =>
    inRolledBackTx(async (db) => {
      const { outlet } = await setup(db);
      const at = (days: number) => new Date(Date.now() - days * 86_400_000);
      const ev = (type: string, payload: unknown = null, when = at(0.5)) => ({ outletId: outlet.id, type, payload, occurredAt: when });
      await db.insert(events).values([
        ev("scan"), ev("scan"), ev("scan", null, at(40)),
        ev("hub_viewed"), ev("hub_viewed"), ev("hub_viewed"),
        ev("module_selected", { module: "review" }), ev("module_selected", { module: "menu" }), ev("module_selected"),
        ev("link_clicked", { kind: "website" }), ev("menu_viewed"), ev("rewards_viewed"), ev("rating_selected"),
      ]);
      expect(await hubInsights(db, outlet, 30)).toEqual({
        days: 30, scans: 2, hub_views: 3, modules: { review: 1, menu: 1, "?": 1 }, links: { website: 1 },
        menu_views: 1, rewards_views: 1, take_rate: 0.333,
      });
      expect((await hubInsights(db, outlet, 90)).scans).toBe(3);
      const quiet = await makeOutlet(db, await makeAccount(db, "q"));
      expect(await hubInsights(db, quiet, 30)).toMatchObject({ scans: 0, hub_views: 0, modules: {}, take_rate: null });
      expect((await hubInsights(db, outlet, 0)).scans).toBe(2); // clamped to 1 day for the window...
      expect((await hubInsights(db, outlet, 0)).days).toBe(0); // ...but echoed back as sent, like FastAPI
    }));

  it("rounds the take rate half-even like Python", () => {
    expect(roundRatio3(1, 3)).toBe(0.333);
    expect(roundRatio3(2, 3)).toBe(0.667);
    expect(roundRatio3(1, 16)).toBe(0.062); // python round(0.0625, 3)
    expect(roundRatio3(3, 16)).toBe(0.188); // python round(0.1875, 3)
    expect(roundRatio3(5, 5)).toBe(1);
  });
});
