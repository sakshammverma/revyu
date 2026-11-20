/**
 * The in-shop sales demo (/marketing): signed try links, category mapping,
 * the PIN/admin gate with its failure-only lockout, and the four
 * /api/marketing/* routes on local fake Places data (no Google calls: the key
 * is blanked). Rolled-back transactions on the dev DB, real rate limits.
 */
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});
const envOverride = vi.hoisted(() => ({ salesDemoPin: "246810" }));
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return {
    ...actual,
    getEnv: () => ({
      ...actual.getEnv(),
      environment: "local",
      isLocal: true,
      disableRateLimits: false,
      adminSessionSecret: "test-admin-secret",
      salesDemoPin: envOverride.salesDemoPin,
      authSecret: "test-auth-secret-0123456789abcdef",
      googlePlacesApiKey: "",
    }),
  };
});

import { GET as getKit } from "@/app/api/marketing/kit/route";
import { GET as getProspect } from "@/app/api/marketing/prospect/route";
import { GET as getSearch } from "@/app/api/marketing/search/route";
import { GET as getSession } from "@/app/api/marketing/session/route";
import { TRY_TTL_SECONDS, type Prospect, type SalesKit } from "@/lib/marketing/salesTypes";
import { networkBucket, requireSales } from "@/server/auth/sales";
import type { DbLike } from "@/server/db";
import { HttpError } from "@/server/http";
import { inRolledBackTx, makeRequest } from "@/server/testing/helpers";
import { buildReport, buildReportDetailed } from "./gapReport";
import {
  mintSalesRef,
  mintTryToken,
  readTryToken,
  requestOrigin,
  SALES_REF_TTL_SECONDS,
  salesRefValid,
  verticalForPlaceType,
} from "./salesDemo";

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
      envOverride.salesDemoPin = "246810";
    }
  });

// A fresh client IP per test, so the per-IP lockout of one test can't leak into another.
const ip = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}-${crypto.randomUUID().slice(0, 6)}`;
const req = (path: string, token: string | null, from = ip()) =>
  makeRequest(path, {
    headers: { "x-real-ip": from, ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
  });

async function status(fn: () => Promise<unknown>): Promise<number | "ok"> {
  try {
    await fn();
    return "ok";
  } catch (err) {
    if (err instanceof HttpError) return err.status;
    throw err;
  }
}

describe("try token", () => {
  const now = Date.UTC(2026, 10, 20, 10, 0, 0);

  it("round-trips the name and category and expires after the TTL", () => {
    const { token, expiresAt } = mintTryToken({ name: "  Gupta  Sweets ", vertical: "bakery" }, now);
    expect(expiresAt.getTime()).toBe(now + TRY_TTL_SECONDS * 1000);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/);
    expect(readTryToken(token, now + 1000)).toEqual({ name: "Gupta Sweets", vertical: "bakery", expiresAt });
    expect(readTryToken(token, now + TRY_TTL_SECONDS * 1000)).toEqual({ expired: true });
  });

  it("rejects a tampered payload or signature, and garbage", () => {
    const { token } = mintTryToken({ name: "Gupta Sweets", vertical: "bakery" }, now);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ n: "Someone Else", v: "bakery", e: now / 1000 + 999 })).toString("base64url");
    expect(readTryToken(`${forged}.${sig}`, now)).toBeNull();
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(readTryToken(`${payload}.${flipped}`, now)).toBeNull();
    expect(readTryToken(`${payload}.${sig.slice(0, 21)}`, now)).toBeNull();
    for (const junk of ["", ".", "abc", "a.b.c", `${payload}`, `${payload}.${sig}.x`, "%%%.%%%%%%%%%%%%%%%%%%%%%%"]) {
      expect(readTryToken(junk, now)).toBeNull();
    }
  });

  it("trims long names to 60 characters and strips control characters", () => {
    const { token } = mintTryToken({ name: `Shop\u0000‮${"x".repeat(200)}`, vertical: "general" }, now);
    const read = readTryToken(token, now);
    expect(read && "name" in read ? read.name : null).toBe(`Shop ${"x".repeat(55)}`);
    expect(() => mintTryToken({ name: "\u0000 ", vertical: "general" }, now)).toThrow();
    expect(() => mintTryToken({ name: "Shop", vertical: "casino" }, now)).toThrow();
  });
});

describe("sales ref", () => {
  it("verifies only for its own place, untampered and before expiry", () => {
    const now = Date.UTC(2026, 10, 20);
    const ref = mintSalesRef("ChIJ_me", now);
    expect(salesRefValid(ref, "ChIJ_me", now)).toBe(true);
    expect(salesRefValid(ref, "ChIJ_me", now + (SALES_REF_TTL_SECONDS + 1) * 1000)).toBe(false);
    expect(salesRefValid(ref, "ChIJ_you", now)).toBe(false);
    const [e, sig] = ref.split(".");
    expect(salesRefValid(`${Number(e) + 100}.${sig}`, "ChIJ_me", now)).toBe(false);
    for (const bad of ["", "sales", `${e}.`, `${e}.${sig}x`]) expect(salesRefValid(bad, "ChIJ_me", now)).toBe(false);
  });
});

describe("verticalForPlaceType", () => {
  it.each([
    ["indian_restaurant", "restaurant"],
    ["dessert_shop", "bakery"],
    ["general_store", "grocery"],
    ["clothing_store", "retail"],
    ["cell_phone_store", "electronics"],
    ["drugstore", "pharmacy"],
    ["car_repair", "automotive"],
    ["barber_shop", "salon"],
    ["fitness_center", "gym"],
    ["school", "coaching"],
    ["dental_clinic", "dental"],
    ["chiropractor", "physiotherapy"],
  ])("%s -> %s", (type, vertical) => {
    expect(verticalForPlaceType(type, [])).toBe(vertical);
  });

  it("falls back through the type list, then to general", () => {
    expect(verticalForPlaceType(null, ["point_of_interest"])).toBe("general");
    expect(verticalForPlaceType("point_of_interest", ["establishment", "bakery", "store"])).toBe("bakery");
    expect(verticalForPlaceType("grocery_store", ["store"])).toBe("grocery");
  });
});

describe("requestOrigin", () => {
  it("uses forwarded headers, else the host, with http only for local hosts", () => {
    expect(requestOrigin(makeRequest("/x", { headers: { "x-forwarded-proto": "https", "x-forwarded-host": "abc.ngrok-free.app" } }))).toBe(
      "https://abc.ngrok-free.app",
    );
    expect(requestOrigin(makeRequest("/x"))).toBe("http://localhost:3000");
    expect(requestOrigin(makeRequest("/x", { headers: { host: "192.168.1.5:3000" } }))).toBe("http://192.168.1.5:3000");
  });
});

describe("requireSales", () => {
  it("accepts the admin secret and the sales PIN, rejects anything else", () =>
    inTx(async (tx) => {
      expect(await requireSales(req("/api/marketing/session", "test-admin-secret"), tx)).toBe("admin");
      expect(await requireSales(req("/api/marketing/session", "246810"), tx)).toBe("sales");
      expect(await status(() => requireSales(req("/api/marketing/session", "135790"), tx))).toBe(401);
      expect(await status(() => requireSales(req("/api/marketing/session", null), tx))).toBe(401);
      expect(await status(() => requireSales(req("/api/marketing/session", ""), tx))).toBe(401);
    }));

  it("rejects every PIN when SALES_DEMO_PIN is unset", () =>
    inTx(async (tx) => {
      envOverride.salesDemoPin = "";
      expect(await status(() => requireSales(req("/api/marketing/session", ""), tx))).toBe(401);
      expect(await status(() => requireSales(makeRequest("/x", { headers: { authorization: "Bearer " } }), tx))).toBe(401);
      expect(await requireSales(req("/api/marketing/session", "test-admin-secret"), tx)).toBe("admin");
    }));

  it("locks an IP out after 10 wrong PINs, even for the right one", () =>
    inTx(async (tx) => {
      const from = ip();
      for (let i = 0; i < 10; i++) {
        expect(await status(() => requireSales(req("/x", `wrong-${i}`, from), tx))).toBe(401);
      }
      expect(await status(() => requireSales(req("/x", "246810", from), tx))).toBe(429);
      // Another device is unaffected.
      expect(await requireSales(req("/x", "246810"), tx)).toBe("sales");
    }));

  it("buckets IPv6 callers by /64, so rotating addresses in one allocation shares the lockout", () =>
    inTx(async (tx) => {
      expect(networkBucket("198.51.100.7")).toBe("198.51.100.7");
      expect(networkBucket("2001:db8:aa:bb::1")).toBe("2001:db8:aa:bb::/64");
      expect(networkBucket("2001:0db8:00aa:00bb:1:2:3:4")).toBe("2001:db8:aa:bb::/64");
      expect(networkBucket("::ffff:192.0.2.1")).toBe("0:0:0:0::/64");
      const net = `2001:db8:${crypto.randomUUID().slice(0, 4)}:1`;
      for (let i = 0; i < 10; i++) {
        expect(await status(() => requireSales(req("/x", `wrong-${i}`, `${net}::${i + 1}`), tx))).toBe(401);
      }
      expect(await status(() => requireSales(req("/x", "246810", `${net}::ffff`), tx))).toBe(429);
    }));

  it("never counts the right PIN toward the lockout", () =>
    inTx(async (tx) => {
      const from = ip();
      for (let i = 0; i < 15; i++) expect(await requireSales(req("/x", "246810", from), tx)).toBe("sales");
      for (let i = 0; i < 10; i++) {
        expect(await status(() => requireSales(req("/x", `wrong-${i}`, from), tx))).toBe(401);
      }
      expect(await status(() => requireSales(req("/x", "246810", from), tx))).toBe(429);
    }));
});

describe("/api/marketing routes", () => {
  it("session answers the role, 401 without auth", () =>
    inTx(async () => {
      expect((await getSession(req("/api/marketing/session", null))).status).toBe(401);
      const res = await getSession(req("/api/marketing/session", "246810"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ role: "sales" });
    }));

  it("search validates q and returns fake results", () =>
    inTx(async () => {
      expect((await getSearch(req("/api/marketing/search?q=Gupta", null))).status).toBe(401);
      expect((await getSearch(req("/api/marketing/search?q=a", "246810"))).status).toBe(422);
      expect((await getSearch(req(`/api/marketing/search?q=${"a".repeat(201)}`, "246810"))).status).toBe(422);
      expect((await getSearch(req("/api/marketing/search", "246810"))).status).toBe(422);
      const res = await getSearch(req("/api/marketing/search?q=Gupta%20Sweets", "test-admin-secret"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: { place_id: string; name: string }[] };
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results[0].name).toBe("Gupta Sweets");
    }));

  it("prospect returns the report, shop details and a category", () =>
    inTx(async () => {
      expect((await getProspect(req("/api/marketing/prospect?place_id=ab", "246810"))).status).toBe(422);
      const res = await getProspect(req("/api/marketing/prospect?place_id=ChIJ_me", "246810"));
      expect(res.status).toBe(200);
      const p = (await res.json()) as Prospect;
      expect(p.place_id).toBe("ChIJ_me");
      expect(p.report.competitors).toHaveLength(3);
      expect(p.shop).toEqual({ type_label: "Store", address: "Indiranagar, Bengaluru", country_code: "IN" });
      expect(p.vertical).toBe("retail");
      expect(Number.isNaN(Date.parse(p.fetched_at))).toBe(false);
    }));

  it("kit builds try and sign-up links with QR codes", () =>
    inTx(async () => {
      const bad = ["place_id=ab&name=X&vertical=general", "place_id=ChIJ_me&name=&vertical=general", "place_id=ChIJ_me&name=X&vertical=casino"];
      for (const qs of bad) expect((await getKit(req(`/api/marketing/kit?${qs}`, "246810"))).status).toBe(422);
      expect((await getKit(req("/api/marketing/kit?place_id=ChIJ_me&name=X&vertical=general", null))).status).toBe(401);

      const res = await getKit(req("/api/marketing/kit?place_id=ChIJ_me&name=Gupta%20%26%20Sons&vertical=bakery", "246810"));
      expect(res.status).toBe(200);
      const kit = (await res.json()) as SalesKit;
      expect(kit.vertical).toBe("bakery");
      expect(kit.tags).toHaveLength(8);
      expect(kit.tags[0]).toEqual({ id: "bakery-0", label: expect.any(String) });
      expect(kit.try.url).toContain("http://localhost:3000/marketing/try/");
      expect(kit.try.qr.d.length).toBeGreaterThan(0);
      const token = kit.try.url.split("/marketing/try/")[1];
      expect(readTryToken(token)).toMatchObject({ name: "Gupta & Sons", vertical: "bakery" });
      for (const [plan, link] of Object.entries(kit.signup)) {
        const url = new URL(link.url);
        expect(url.pathname).toBe("/signup");
        const { src, ...rest } = Object.fromEntries(url.searchParams);
        expect(rest).toEqual({ place: "ChIJ_me", name: "Gupta & Sons", plan, type: "bakery" });
        // A signed ref bound to this place: the signup credits the deck only with it.
        expect(salesRefValid(src, "ChIJ_me")).toBe(true);
        expect(salesRefValid(src, "ChIJ_other")).toBe(false);
        expect(link.qr.d.length).toBeGreaterThan(0);
      }
      expect(kit.signup.annual.url).toContain("plan=annual");
    }));
});

describe("gap report details", () => {
  it("buildReport is unchanged and the detailed variant adds fake listing details", async () => {
    const plain = await buildReport("ChIJ_me");
    const { report, shop } = await buildReportDetailed("ChIJ_me");
    expect(report).toEqual(plain);
    expect(Object.keys(plain).sort()).toEqual(["business", "competitors", "group_size", "headline", "rank_by_reviews", "review_gap"]);
    expect(shop).toEqual({
      primary_type: "store",
      types: ["store", "point_of_interest", "establishment"],
      type_label: "Store",
      address: "Indiranagar, Bengaluru",
      country_code: "IN",
    });
  });
});
