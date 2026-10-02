/** /api/admin/outlets/* (outlet management) and /api/admin/outlets/[id]/hub/* handlers, in rolled-back transactions. */
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { GET as getHub } from "@/app/api/admin/outlets/[outletId]/hub/route";
import { PUT as putAvailability } from "@/app/api/admin/outlets/[outletId]/hub/availability/route";
import { PUT as putModules } from "@/app/api/admin/outlets/[outletId]/hub/modules/route";
import { POST as acknowledge } from "@/app/api/admin/outlets/[outletId]/hub/loyalty/acknowledge/route";
import { GET as getLoyalty } from "@/app/api/admin/outlets/[outletId]/hub/loyalty/route";
import { POST as activate } from "@/app/api/admin/outlets/[outletId]/activate/route";
import { PUT as putTags } from "@/app/api/admin/outlets/[outletId]/tags/route";
import { POST as validateUrl } from "@/app/api/admin/outlets/[outletId]/validate-url/route";
import { POST as bulk } from "@/app/api/admin/outlets/bulk/route";
import { GET as listOutlets, POST as createOutlet } from "@/app/api/admin/outlets/route";
import { GET as verticals } from "@/app/api/admin/outlets/verticals/route";
import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { parseCsv } from "@/server/services/adminOutlets";
import { inRolledBackTx, makeAccount, makeOutlet, makeRequest, routeCtx } from "@/server/testing/helpers";

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

const auth = () => ({ authorization: `Bearer ${getEnv().adminSessionSecret}` });
const req = (path: string, method = "GET", body?: unknown) =>
  makeRequest(path, { method, body, headers: auth() });
const err = async (res: Response) => (await res.json()).detail.error;
const uid = () => crypto.randomUUID().replaceAll("-", "").slice(0, 8);

const createBody = (over: Record<string, unknown> = {}) => ({
  business_name: "Admin Test Clinic",
  vertical: "dental",
  owner_phone: `+91${uid()}`,
  owner_email: `adm-${uid()}@example.com`,
  place_id: `ChIJ_t_${uid()}`,
  ...over,
});

describe("auth and create", () => {
  it("401 without the admin bearer on every route", () =>
    inTx(async () => {
      const anon = (p: string, m = "GET") => makeRequest(p, { method: m });
      const ctx = routeCtx({ outletId: crypto.randomUUID() });
      for (const res of [
        await listOutlets(anon("/api/admin/outlets")),
        await verticals(anon("/api/admin/outlets/verticals")),
        await createOutlet(anon("/api/admin/outlets", "POST")),
        await bulk(anon("/api/admin/outlets/bulk", "POST")),
        await activate(anon("/x", "POST"), ctx),
        await putAvailability(anon("/x", "PUT"), ctx),
        await getHub(anon("/x"), ctx),
      ]) {
        expect([res.status, await err(res)]).toEqual([401, { code: "UNAUTHORIZED" }]);
      }
    }));

  it("creates a draft with seeded tags, reuses the account by phone, then activates", () =>
    inTx(async (tx) => {
      const body = createBody();
      const res = await createOutlet(req("/api/admin/outlets", "POST", body));
      expect(res.status).toBe(201);
      const out = await res.json();
      expect(Object.keys(out)).toEqual(["outlet_id", "slug", "state"]);
      expect(out.state).toBe("draft");
      expect(out.slug).toMatch(/^[a-z0-9]{7}$/);

      const [row] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, out.outlet_id));
      expect([row.source, row.placeVerified, row.googleReviewUrl]).toEqual([
        "admin",
        false,
        `https://search.google.com/local/writereview?placeid=${body.place_id}`,
      ]);
      const seeded = await tx.select().from(schema.tags).where(eq(schema.tags.outletId, out.outlet_id));
      expect(seeded.length).toBeGreaterThan(3);

      // same phone again: account reused (email of the second request ignored)
      const again = await createOutlet(
        req("/api/admin/outlets", "POST", { ...body, owner_email: "other@example.com", place_id: `ChIJ_t_${uid()}` }),
      );
      expect(again.status).toBe(201);
      const accts = await tx.select().from(schema.accounts).where(eq(schema.accounts.ownerPhone, body.owner_phone));
      expect(accts).toHaveLength(1);

      const list = await (await listOutlets(req("/api/admin/outlets?state=draft&source=admin"))).json();
      expect(list.items.some((i: { outlet_id: string }) => i.outlet_id === out.outlet_id)).toBe(true);
      expect(Object.keys(list.items[0])).toEqual(["outlet_id", "business_name", "vertical", "state", "source", "created_at"]);

      const act = await activate(req("/x", "POST"), routeCtx({ outletId: out.outlet_id }));
      expect(act.status).toBe(200);
      const a = await act.json();
      expect(a).toMatchObject({ slug: out.slug, short_url: `/r/${out.slug}`, baseline_rating: 4.9, baseline_review_count: 142 });
      expect(a.activated_at).toMatch(/\+00:00$/);
      const [after] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, out.outlet_id));
      expect([after.state, after.placeVerified, after.placementConfirmed]).toEqual(["trial", true, true]);
      const second = await activate(req("/x", "POST"), routeCtx({ outletId: out.outlet_id }));
      expect([second.status, await err(second)]).toEqual([
        400,
        { code: "VALIDATION_FAILED", message: "cannot activate from state trial" },
      ]);
    }));

  it("validation: place required, ambiguous maps query, bad email", () =>
    inTx(async () => {
      const noPlace = await createOutlet(req("/api/admin/outlets", "POST", createBody({ place_id: undefined })));
      expect([noPlace.status, await err(noPlace)]).toEqual([
        400,
        { code: "VALIDATION_FAILED", message: "place_id or google_maps_url required" },
      ]);

      const amb = await createOutlet(
        req("/api/admin/outlets", "POST", createBody({ place_id: undefined, google_maps_url: "some clinic bengaluru" })),
      );
      expect(amb.status).toBe(409);
      const e = await err(amb);
      expect(e.code).toBe("AMBIGUOUS_PLACE");
      expect(Object.keys(e.candidates[0])).toEqual(["place_id", "name", "address"]);

      const bad = await createOutlet(req("/api/admin/outlets", "POST", createBody({ owner_email: "nope" })));
      expect(bad.status).toBe(422);
    }));

  it("an existing email on a new phone is a 409, not a 500", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      const dup = await createOutlet(req("/api/admin/outlets", "POST", createBody({ owner_email: account.ownerEmail })));
      expect([dup.status, (await err(dup)).code]).toEqual([409, "DUPLICATE_BUSINESS"]);
    }));

  it("verticals lists the configured set", () =>
    inTx(async () => {
      const res = await verticals(req("/api/admin/outlets/verticals"));
      expect((await res.json()).verticals).toEqual(["coaching", "dental", "general", "gym", "physiotherapy", "salon"]);
    }));
});

describe("activation guards, validate-url, tags", () => {
  it("blocks placeholder emails, missing tags and unknown outlets", () =>
    inTx(async (tx) => {
      const account = await makeAccount(tx);
      await tx
        .update(schema.accounts)
        .set({ ownerEmail: `placeholder-${uid()}@revyu.pending` })
        .where(eq(schema.accounts.id, account.id));
      const outlet = await makeOutlet(tx, account, { state: "draft", slug: `d${uid()}` });
      const ctx = routeCtx({ outletId: outlet.id });
      const r1 = await activate(req("/x", "POST"), ctx);
      expect([r1.status, (await err(r1)).message]).toEqual([400, "a real owner_email is required before activation (SRS-11.21)"]);
      await tx
        .update(schema.accounts)
        .set({ ownerEmail: `real-${uid()}@example.com` })
        .where(eq(schema.accounts.id, account.id));
      const r2 = await activate(req("/x", "POST"), ctx);
      expect([r2.status, (await err(r2)).message]).toEqual([400, "at least one active tag required"]);
      const r3 = await activate(req("/x", "POST"), routeCtx({ outletId: crypto.randomUUID() }));
      expect([r3.status, await err(r3)]).toEqual([404, { code: "OUTLET_NOT_FOUND" }]);
      expect((await activate(req("/x", "POST"), routeCtx({ outletId: "nope" }))).status).toBe(422);
    }));

  it("validate-url stores only well-formed review URLs, and says valid for unknown outlets", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx), { state: "draft" });
      const ctx = routeCtx({ outletId: outlet.id });
      const bad = await validateUrl(req("/x", "POST", { google_review_url: "https://example.com" }), ctx);
      expect(await bad.json()).toEqual({ valid: false, reason: "URL does not match the expected Google review-write format" });
      const url = "https://search.google.com/local/writereview?placeid=ABC";
      expect(await (await validateUrl(req("/x", "POST", { google_review_url: url }), ctx)).json()).toEqual({
        valid: true,
        reason: null,
      });
      const [row] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, outlet.id));
      expect(row.googleReviewUrl).toBe(url);
      const ghost = await validateUrl(
        req("/x", "POST", { google_review_url: url }),
        routeCtx({ outletId: crypto.randomUUID() }),
      );
      expect((await ghost.json()).valid).toBe(true);
    }));

  it("tags: updates, creates and deactivates omitted tags (never deletes)", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx), { state: "draft" });
      const [a, b] = await tx
        .insert(schema.tags)
        .values([
          { id: crypto.randomUUID(), outletId: outlet.id, label: { en: "A" }, phrases: { en: ["a"] }, sortOrder: 0, active: true },
          { id: crypto.randomUUID(), outletId: outlet.id, label: { en: "B" }, phrases: { en: ["b"] }, sortOrder: 1, active: true },
        ])
        .returning();
      const ctx = routeCtx({ outletId: outlet.id });
      const res = await putTags(
        req("/x", "PUT", {
          tags: [
            { id: a.id, label: "A2", phrases: ["x", "y"], sort_order: 5 },
            { label: "New", phrases: ["n"], sort_order: 6, active: false },
          ],
        }),
        ctx,
      );
      expect(res.status).toBe(204);
      const rows = await tx.select().from(schema.tags).where(eq(schema.tags.outletId, outlet.id));
      expect(rows).toHaveLength(3);
      const by = (id: string) => rows.find((r) => r.id === id)!;
      expect([by(a.id).label, by(a.id).phrases, by(a.id).sortOrder, by(a.id).active]).toEqual([
        { en: "A2" },
        { en: ["x", "y"] },
        5,
        true,
      ]);
      expect(by(b.id).active).toBe(false);
      expect(rows.find((r) => r.id !== a.id && r.id !== b.id)).toMatchObject({ label: { en: "New" }, active: false });

      const missing = await putTags(req("/x", "PUT", { tags: [] }), routeCtx({ outletId: crypto.randomUUID() }));
      expect([missing.status, await err(missing)]).toEqual([404, { code: "OUTLET_NOT_FOUND" }]);
      expect((await putTags(req("/x", "PUT", { tags: [{ label: "x" }] }), ctx)).status).toBe(422);
    }));
});

describe("bulk import", () => {
  const upload = (csv: string) => {
    const form = new FormData();
    form.append("file", new File([csv], "outlets.csv", { type: "text/csv" }));
    return bulk(new Request("http://localhost:3000/api/admin/outlets/bulk", { method: "POST", headers: auth(), body: form }));
  };

  it("every row lands in draft or reports its own error; one failure never blocks the batch", () =>
    inTx(async (tx) => {
      const phone = `+91${uid()}`;
      const email = `bulk-${uid()}@example.com`;
      const csv =
        String.fromCharCode(0xfeff) +
        "business_name,vertical,owner_phone,owner_email,google_maps_url\r\n" +
        `"Clinic, One",dental,${phone},${email},ChIJ_bulk_${uid()}\r\n` +
        "\r\n" +
        `,dental,+91${uid()},,\r\n` +
        `Two,gym,+91${uid()},${email},\r\n` +
        `Three,salon,+91${uid()},,some salon bengaluru\r\n` +
        `Four,salon,+91${uid()},,\r\n`;
      const res = await upload(csv);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect([body.created, body.failed]).toEqual([2, 3]);
      expect(body.rows.map((r: { row: number; status: string; error: string | null }) => [r.row, r.status, r.error])).toEqual([
        [1, "draft", null],
        [2, "error", "MISSING_REQUIRED_FIELD"],
        [3, "error", "EMAIL_DUPLICATE"],
        [4, "error", "AMBIGUOUS_PLACE"],
        [5, "draft", null],
      ]);
      expect(Object.keys(body.rows[0])).toEqual(["row", "outlet_id", "slug", "status", "error"]);
      const [one] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, body.rows[0].outlet_id));
      expect([one.businessName, one.source, one.state]).toEqual(["Clinic, One", "bulk_import", "draft"]);
      const [four] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, body.rows[4].outlet_id));
      expect([four.googlePlaceId, four.googleReviewUrl]).toEqual([null, null]);
      const [acct] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, four.accountId));
      expect(acct.ownerEmail).toMatch(/^placeholder-[0-9a-f]{10}@revyu\.pending$/);
    }));

  it("422 when no file is sent", () =>
    inTx(async () => {
      const res = await bulk(makeRequest("/api/admin/outlets/bulk", { method: "POST", body: {}, headers: auth() }));
      expect(res.status).toBe(422);
    }));

  it("parseCsv handles quotes, escaped quotes, embedded newlines and blank lines", () => {
    expect(parseCsv('a,b\n"x ""q"" y","l1\nl2"\n\n,\n')).toEqual([["a", "b"], ['x "q" y', "l1\nl2"], ["", ""]]);
  });
});

describe("admin hub editor (same handlers as the owner's, admin differences)", () => {
  it("404 for unknown outlet, 422 malformed; GET works without an owner", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const ok = await getHub(req("/x"), routeCtx({ outletId: outlet.id }));
      expect(ok.status).toBe(200);
      expect((await ok.json()).origin).toBe(getEnv().publicFlowBaseUrl);
      const missing = await getHub(req("/x"), routeCtx({ outletId: crypto.randomUUID() }));
      expect([missing.status, await err(missing)]).toEqual([404, { code: "OUTLET_NOT_FOUND" }]);
      expect((await getHub(req("/x"), routeCtx({ outletId: "zzz" }))).status).toBe(422);
      expect((await getLoyalty(req("/x"), routeCtx({ outletId: outlet.id }))).status).toBe(200);
    }));

  it("availability gates owners, not admins; unavailable modules turn off; acknowledged_by is admin", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const ctx = routeCtx({ outletId: outlet.id });
      const put = (p: unknown) => putAvailability(req("/x", "PUT", p), ctx);
      expect((await put({ module: "rewards", available: false })).status).toBe(204);
      const rewards = async () =>
        (await tx.select().from(schema.outletModules).where(eq(schema.outletModules.outletId, outlet.id))).find(
          (m) => m.module === "rewards",
        )!;
      expect([(await rewards()).available, (await rewards()).enabled]).toEqual([false, false]);

      const bad = await put({ module: "review", available: false });
      expect([bad.status, (await err(bad)).code]).toEqual([422, "UNKNOWN_MODULE"]);
      expect((await put({ module: "nope", available: true })).status).toBe(422);
      expect((await put({ module: "rewards" })).status).toBe(422);

      // admin set_modules bypasses `available`; the content rule (FR-89) still applies
      const mods = (modules: unknown) => putModules(req("/x", "PUT", { modules }), ctx);
      const empty = await mods([
        { module: "review", enabled: true },
        { module: "rewards", enabled: true },
      ]);
      expect([empty.status, (await err(empty)).code]).toEqual([409, "MODULE_EMPTY"]);

      expect((await acknowledge(req("/x", "POST"), ctx)).status).toBe(204);
      const [prog] = await tx.select().from(schema.loyaltyPrograms).where(eq(schema.loyaltyPrograms.outletId, outlet.id));
      expect(prog.acknowledgedBy).toBe("admin");
    }));
});
