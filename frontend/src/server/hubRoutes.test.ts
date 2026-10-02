/**
 * Route handlers for /api/app/outlets/[outletId]/{hub,qr,print-assets} and
 * /uploads, run inside rolled-back transactions (pattern: testing/handlerPattern.test.ts).
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
// Keep upload tests off the disk: validate for real, store nothing.
vi.mock("@/server/services/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/storage")>();
  return {
    ...actual,
    saveImage: async (data: Uint8Array) => {
      await actual.reencode(data);
      return "/uploads/test-upload.webp";
    },
  };
});

import sharp from "sharp";

import { GET as getUpload } from "@/app/uploads/[...path]/route";
import { GET as getHub, PATCH as patchHub } from "@/app/api/app/outlets/[outletId]/hub/route";
import { GET as getInsights } from "@/app/api/app/outlets/[outletId]/hub/insights/route";
import { PUT as putLinks } from "@/app/api/app/outlets/[outletId]/hub/links/route";
import { POST as postCategory } from "@/app/api/app/outlets/[outletId]/hub/menu/categories/route";
import { DELETE as deleteCategory, PATCH as patchCategory } from "@/app/api/app/outlets/[outletId]/hub/menu/categories/[categoryId]/route";
import { PUT as putCategoryOrder } from "@/app/api/app/outlets/[outletId]/hub/menu/categories-order/route";
import { POST as postItem } from "@/app/api/app/outlets/[outletId]/hub/menu/items/route";
import { DELETE as deleteItem, PATCH as patchItem } from "@/app/api/app/outlets/[outletId]/hub/menu/items/[itemId]/route";
import { PUT as putItemOrder } from "@/app/api/app/outlets/[outletId]/hub/menu/items-order/route";
import { PUT as putModules } from "@/app/api/app/outlets/[outletId]/hub/modules/route";
import { PATCH as patchProfile } from "@/app/api/app/outlets/[outletId]/hub/profile/route";
import { POST as postUpload } from "@/app/api/app/outlets/[outletId]/hub/uploads/route";
import { GET as getPrintAsset } from "@/app/api/app/outlets/[outletId]/print-assets/[asset]/route";
import { GET as getQr } from "@/app/api/app/outlets/[outletId]/qr/route";
import { getEnv } from "@/server/env";
import type { DbLike } from "@/server/db";
import { inRolledBackTx, issueOwnerSession, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

async function world(tx: DbLike, outletOver: Parameters<typeof makeOutlet>[2] = {}) {
  const account = await makeAccount(tx);
  const outlet = await makeOutlet(tx, account, outletOver);
  const session = await issueOwnerSession(tx, account);
  const base = `/api/app/outlets/${outlet.id}`;
  const ctx = routeCtx({ outletId: outlet.id });
  return { account, outlet, session, base, ctx };
}

const errBody = async (res: Response) => (await res.json()).detail.error;

describe("auth and ownership (same order as FastAPI: 401, 422, 403)", () => {
  it("401 without a session, 403 for someone else's outlet, 422 for a malformed id", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const anon = await getHub(makeRequest(w.base + "/hub"), w.ctx);
      expect([anon.status, (await errBody(anon)).code]).toEqual([401, "UNAUTHORIZED"]);

      const stranger = await issueOwnerSession(tx, await makeAccount(tx, "b"));
      const denied = await getHub(makeRequest(w.base + "/hub", { session: stranger }), w.ctx);
      expect([denied.status, await errBody(denied)]).toEqual([403, { code: "FORBIDDEN" }]);
      // A write by the stranger must not land either.
      const write = await patchHub(makeRequest(w.base + "/hub", { method: "PATCH", body: { hub_mode: "menu" }, session: stranger }), w.ctx);
      expect(write.status).toBe(403);

      const bad = await getHub(makeRequest("/api/app/outlets/nope/hub", { session: w.session }), routeCtx({ outletId: "nope" }));
      expect(bad.status).toBe(422);
      const missing = await getHub(makeRequest(w.base + "/hub", { session: w.session }), routeCtx({ outletId: crypto.randomUUID() }));
      expect(missing.status).toBe(403);
    }));

  it("assets: 401, 403, and 404 for a pending outlet (SRS-18.7)", () =>
    inTx(async (tx) => {
      const w = await world(tx, { slug: "pending-abc123" });
      expect((await getQr(makeRequest(w.base + "/qr"), w.ctx)).status).toBe(401);
      const pending = await getQr(makeRequest(w.base + "/qr", { session: w.session }), w.ctx);
      expect([pending.status, await errBody(pending)]).toEqual([404, { code: "OUTLET_NOT_FOUND" }]);
      const other = await world(tx);
      expect((await getQr(makeRequest(w.base + "/qr", { session: other.session }), w.ctx)).status).toBe(403);
    }));
});

describe("editor and settings", () => {
  it("GET returns the editor state plus origin; PATCH switches hub_mode", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const res = await getHub(makeRequest(w.base + "/hub", { session: w.session }), w.ctx);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Object.keys(body)).toEqual([
        "slug", "hub_mode", "modules", "profile", "links", "google_maps_auto", "menu_label", "menu", "origin",
      ]);
      expect(body.origin).toBe(getEnv().publicFlowBaseUrl);
      expect(body.hub_mode).toBe("direct");

      const patch = await patchHub(makeRequest(w.base + "/hub", { method: "PATCH", body: { hub_mode: "menu" }, session: w.session }), w.ctx);
      expect(patch.status).toBe(204);
      expect(await patch.text()).toBe("");
      expect((await (await getHub(makeRequest(w.base + "/hub", { session: w.session }), w.ctx)).json()).hub_mode).toBe("menu");

      const invalid = await patchHub(makeRequest(w.base + "/hub", { method: "PATCH", body: { hub_mode: "grid" }, session: w.session }), w.ctx);
      expect([invalid.status, await errBody(invalid)]).toEqual([422, { code: "VALIDATION_ERROR" }]);
    }));

  it("modules: 204, and FR-89 refusals use the API error shape", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const put = (modules: unknown) =>
        putModules(makeRequest(w.base + "/hub/modules", { method: "PUT", body: { modules }, session: w.session }), w.ctx);
      const empty = await put([{ module: "review", enabled: true }, { module: "connect", enabled: true }]);
      expect([empty.status, await errBody(empty)]).toEqual([409, { code: "MODULE_EMPTY", message: "Add at least one link, phone number or address." }]);
      const unknown = await put([{ module: "zzz", enabled: true }]);
      expect([unknown.status, (await errBody(unknown)).code]).toEqual([422, "UNKNOWN_MODULE"]);
      expect((await put([{ module: "review", enabled: true }])).status).toBe(204);
      expect((await put(Array.from({ length: 11 }, () => ({ module: "review", enabled: true })))).status).toBe(422);
    }));

  it("profile and links: trims, normalises, and BAD_LINK carries the row index", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const prof = await patchProfile(
        makeRequest(w.base + "/hub/profile", { method: "PATCH", body: { tagline: " Hello ", phone: " " }, session: w.session }),
        w.ctx,
      );
      expect(prof.status).toBe(204);
      const badHours = await patchProfile(
        makeRequest(w.base + "/hub/profile", { method: "PATCH", body: { hours: { mon: [["09:00"]] } }, session: w.session }),
        w.ctx,
      );
      expect(badHours.status).toBe(422);

      const put = (links: unknown) =>
        putLinks(makeRequest(w.base + "/hub/links", { method: "PUT", body: { links }, session: w.session }), w.ctx);
      const bad = await put([{ kind: "website", url: "example.com" }, { kind: "instagram", url: "https://evil.com/x" }]);
      expect([bad.status, await errBody(bad)]).toEqual([
        422,
        { code: "BAD_LINK", message: "That doesn't look like an Instagram link", index: 1 },
      ]);
      const unknownKind = await put([{ kind: "tiktok", url: "https://tiktok.com/x" }]);
      expect(await errBody(unknownKind)).toEqual({ code: "BAD_LINK", message: "Unknown link type." });
      expect((await put([{ kind: "instagram", label: "IG", url: "@mycafe" }])).status).toBe(204);

      const state = await (await getHub(makeRequest(w.base + "/hub", { session: w.session }), w.ctx)).json();
      expect(state.profile.tagline).toBe("Hello");
      expect(state.profile.phone).toBeNull();
      expect(state.links).toMatchObject([{ kind: "instagram", label: "IG", url: "https://instagram.com/mycafe", enabled: true }]);
    }));
});

describe("menu", () => {
  it("category and item lifecycle with status codes matching FastAPI", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const s = w.session;
      const call = (fn: (r: Request, c: never) => Promise<Response>, p: string, method: string, body?: unknown, params?: Record<string, string>) =>
        fn(makeRequest(`${w.base}/hub/${p}`, { method, body, session: s }), routeCtx({ outletId: w.outlet.id, ...params }) as never);

      const c1 = await call(postCategory, "menu/categories", "POST", { name: " Cleaning " });
      expect(c1.status).toBe(201);
      const cat = await c1.json();
      expect(cat).toEqual({ id: cat.id, name: "Cleaning", items: [] });
      const c2 = await (await call(postCategory, "menu/categories", "POST", { name: "Whitening" })).json();
      expect((await call(postCategory, "menu/categories", "POST", { name: "   " })).status).toBe(422);

      expect((await call(patchCategory, `menu/categories/${cat.id}`, "PATCH", { name: "Cleanings" }, { categoryId: cat.id })).status).toBe(204);
      const missing = await call(patchCategory, "menu/categories/x", "PATCH", { name: "n" }, { categoryId: crypto.randomUUID() });
      expect([missing.status, await errBody(missing)]).toEqual([404, { code: "NOT_FOUND", message: "Category not found" }]);
      expect((await call(patchCategory, "menu/categories/x", "PATCH", { name: "n" }, { categoryId: "not-a-uuid" })).status).toBe(422);
      expect((await call(putCategoryOrder, "menu/categories-order", "PUT", { ids: [c2.id, cat.id] })).status).toBe(204);

      const noCat = await call(postItem, "menu/items", "POST", { name: "Scaling" });
      expect([noCat.status, await errBody(noCat)]).toEqual([422, { code: "NO_CATEGORY", message: "Choose a category." }]);
      const created = await call(postItem, "menu/items", "POST", { category_id: cat.id, name: "Scaling", amount_minor: 80000, dietary: ["veg", "x"] });
      expect(created.status).toBe(201);
      const it1 = await created.json();
      expect(it1).toMatchObject({ category_id: cat.id, name: "Scaling", amount_minor: 80000, currency_code: "INR", dietary: ["veg"], available: true });
      expect((await call(postItem, "menu/items", "POST", { category_id: cat.id, name: "x", amount_minor: -1 })).status).toBe(422);

      const edited = await call(patchItem, `menu/items/${it1.id}`, "PATCH", { category_id: c2.id, name: "Whitening kit", price_on_request: true, amount_minor: 5 }, { itemId: it1.id });
      expect(edited.status).toBe(200);
      expect(await edited.json()).toMatchObject({ category_id: c2.id, name: "Whitening kit", amount_minor: null, price_on_request: true });
      expect((await call(putItemOrder, "menu/items-order", "PUT", { ids: [it1.id] })).status).toBe(204);

      const state = await (await getHub(makeRequest(w.base + "/hub", { session: s }), w.ctx)).json();
      expect(state.menu.map((c: { name: string; items: unknown[] }) => [c.name, c.items.length])).toEqual([["Whitening", 1], ["Cleanings", 0]]);

      expect((await call(deleteItem, `menu/items/${it1.id}`, "DELETE", undefined, { itemId: it1.id })).status).toBe(204);
      expect((await call(deleteItem, `menu/items/${it1.id}`, "DELETE", undefined, { itemId: it1.id })).status).toBe(404);
      expect((await call(deleteCategory, `menu/categories/${cat.id}`, "DELETE", undefined, { categoryId: cat.id })).status).toBe(204);
    }));
});

describe("insights", () => {
  it("returns the Python payload and 422s a non-integer days", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const ok = await getInsights(makeRequest(w.base + "/hub/insights?days=7", { session: w.session }), w.ctx);
      expect(await ok.json()).toEqual({
        days: 7, scans: 0, hub_views: 0, modules: {}, links: {}, menu_views: 0, rewards_views: 0, take_rate: null,
      });
      const dflt = await getInsights(makeRequest(w.base + "/hub/insights", { session: w.session }), w.ctx);
      expect((await dflt.json()).days).toBe(30);
      const bad = await getInsights(makeRequest(w.base + "/hub/insights?days=abc", { session: w.session }), w.ctx);
      expect(bad.status).toBe(422);
    }));
});

describe("uploads", () => {
  const upload = (w: { base: string; session: string; ctx: ReturnType<typeof routeCtx<{ outletId: string }>> }, body: FormData | null) =>
    postUpload(
      new Request(new URL(w.base + "/hub/uploads", "http://localhost:3000"), {
        method: "POST",
        headers: { cookie: `session_token=${w.session}` },
        body,
      }),
      w.ctx,
    );

  it("201 {url} for an image, 422 BAD_IMAGE for junk, 422 without a file", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).png().toBuffer();
      const good = new FormData();
      good.set("file", new File([new Uint8Array(png)], "a.png", { type: "image/png" }));
      const ok = await upload(w, good);
      expect([ok.status, await ok.json()]).toEqual([201, { url: "/uploads/test-upload.webp" }]);

      const junk = new FormData();
      junk.set("file", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
      const bad = await upload(w, junk);
      expect([bad.status, await errBody(bad)]).toEqual([422, { code: "BAD_IMAGE", message: "That file isn't a readable image" }]);

      expect((await upload(w, new FormData())).status).toBe(422);
      expect((await upload(w, null)).status).toBe(422);
    }));
});

describe("QR and print assets", () => {
  it("serves PNG by default, SVG on ?format=svg, and the PDFs with attachment names", () =>
    inTx(async (tx) => {
      const w = await world(tx);
      const png = await getQr(makeRequest(w.base + "/qr", { session: w.session }), w.ctx);
      expect([png.status, png.headers.get("content-type")]).toEqual([200, "image/png"]);
      expect((await sharp(Buffer.from(await png.arrayBuffer())).metadata()).width).toBeGreaterThanOrEqual(1024);

      const svg = await getQr(makeRequest(w.base + "/qr?format=svg", { session: w.session }), w.ctx);
      expect(svg.headers.get("content-type")).toBe("image/svg+xml");
      expect(await svg.text()).toContain('id="qr-path"');

      const pdf = await getPrintAsset(
        makeRequest(w.base + "/print-assets/counter-standee", { session: w.session }),
        routeCtx({ outletId: w.outlet.id, asset: "counter-standee" }),
      );
      expect(pdf.headers.get("content-type")).toBe("application/pdf");
      expect(pdf.headers.get("content-disposition")).toBe(`attachment; filename="counter-standee-${w.outlet.slug}.pdf"`);
      expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");

      for (const asset of ["nope", "constructor", "__proto__"]) {
        const res = await getPrintAsset(
          makeRequest(`${w.base}/print-assets/${asset}`, { session: w.session }),
          routeCtx({ outletId: w.outlet.id, asset }),
        );
        expect([res.status, await errBody(res)]).toEqual([404, { code: "OUTLET_NOT_FOUND" }]);
      }
    }));
});

describe("GET /uploads/[...path] (local dev only)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "revyu-serve-"));
    await mkdir(path.join(tmp, "frontend"));
    await mkdir(path.join(tmp, "backend", "uploads"), { recursive: true });
    await writeFile(path.join(tmp, "backend", "uploads", "abc123.webp"), "webp-bytes");
    await writeFile(path.join(tmp, "backend", "uploads", "notes.txt"), "secret");
    await writeFile(path.join(tmp, "backend", "secret.webp"), "outside");
    vi.spyOn(process, "cwd").mockReturnValue(path.join(tmp, "frontend"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmp, { recursive: true, force: true });
  });
  const get = (...segments: string[]) => getUpload(makeRequest("/uploads/" + segments.join("/")), { params: Promise.resolve({ path: segments }) });

  it("serves an upload with its image type and long-lived caching", async () => {
    const res = await get("abc123.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toBe("webp-bytes");
  });

  it("404s traversal, non-images, hidden files, missing files and nested paths", async () => {
    for (const segs of [["..", "secret.webp"], ["%2e%2e", "secret.webp"], ["notes.txt"], [".env"], ["missing.webp"], ["sub", "abc123.webp"], ["a\\..\\secret.webp"], ["C:", "x.webp"], ["abc123.webp\0"]]) {
      expect((await get(...segs)).status, segs.join("/")).toBe(404);
    }
  });

  it("404s everything outside ENVIRONMENT=local", async () => {
    const env = getEnv();
    env.isLocal = false;
    try {
      expect((await get("abc123.webp")).status).toBe(404);
    } finally {
      env.isLocal = true;
    }
  });
});
