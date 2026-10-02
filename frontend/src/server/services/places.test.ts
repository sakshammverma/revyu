import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AmbiguousPlaceError,
  buildReviewUrl,
  extractNameFromUrl,
  extractPlaceIdFromUrl,
  getPlaceSnapshot,
  isAllowedMapsUrl,
  resolvePlaceId,
  searchPlaces,
} from "./places";

afterEach(() => vi.unstubAllGlobals());

describe("local fake data (no API key, ENVIRONMENT=local)", () => {
  it("returns two stable fake places", async () => {
    const a = await searchPlaces("  Smile Dental ");
    const b = await searchPlaces("Smile Dental");
    expect(a).toHaveLength(2);
    expect(a[0].name).toBe("Smile Dental");
    expect(a[1].name).toBe("Smile Dental (Main Branch)");
    expect(a).toEqual(b);
    expect(a[0].place_id).toMatch(/^ChIJ_local_\d+$/);
  });

  it("defaults the query and snapshot", async () => {
    expect((await searchPlaces("  "))[0].name).toBe("Sample Business");
    expect(await getPlaceSnapshot("anything")).toEqual([4.9, 142]);
  });
});

describe("url helpers", () => {
  it("builds the public write-review link", () => {
    expect(buildReviewUrl("ChIJabc")).toBe("https://search.google.com/local/writereview?placeid=ChIJabc");
  });

  it("only allows https Google hosts (SSRF guard)", () => {
    expect(isAllowedMapsUrl("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isAllowedMapsUrl("https://www.google.com/maps/place/x")).toBe(true);
    expect(isAllowedMapsUrl("https://evil.google.com.attacker.io/x")).toBe(false);
    expect(isAllowedMapsUrl("http://maps.app.goo.gl/abc")).toBe(false);
    expect(isAllowedMapsUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedMapsUrl("not a url")).toBe(false);
  });

  it("extracts ids and names from canonical urls", () => {
    expect(extractPlaceIdFromUrl("https://www.google.com/maps?q=x&place_id=ChIJxyz&z=1")).toBe("ChIJxyz");
    expect(extractPlaceIdFromUrl("https://x/data=!1s0x3bae:0x1f2e!2")).toBe("0x3bae:0x1f2e");
    expect(extractPlaceIdFromUrl("https://x/nothing")).toBeNull();
    expect(extractNameFromUrl("https://www.google.com/maps/place/Smile+Dental+Care/@12.9,77.6")).toBe(
      "Smile Dental Care",
    );
  });
});

describe("resolvePlaceId", () => {
  it("passes raw ids through without any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await resolvePlaceId("ChIJabc123")).toBe("ChIJabc123");
    expect(await resolvePlaceId("someRawId")).toBe("someRawId");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to guess between several matches (SRS-11.12)", async () => {
    await expect(resolvePlaceId("Smile Dental Bengaluru")).rejects.toBeInstanceOf(AmbiguousPlaceError);
  });

  it("never fetches an off-Google host", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await resolvePlaceId("https://internal.example/place/Foo+Bar").catch(() => {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("follows a short link and reads the place_id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://www.google.com/maps?place_id=ChIJredirected" } }),
      ).mockResolvedValue(new Response("ok", { status: 200 })),
    );
    expect(await resolvePlaceId("https://maps.app.goo.gl/abc")).toBe("ChIJredirected");
  });
});
