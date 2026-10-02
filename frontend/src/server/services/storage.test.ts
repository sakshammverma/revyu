import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  value: { isLocal: true, supabaseUrl: "", supabaseServiceRoleKey: "" } as Record<string, unknown>,
}));
vi.mock("@/server/env", () => ({ getEnv: () => envState.value }));

import { BUCKET, ImageError, MAX_BYTES, reencode, saveImage } from "./storage";

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } } })
    .png()
    .toBuffer();

describe("reencode", () => {
  it("fits inside 1000x1000, never enlarges, outputs WebP", async () => {
    const big = await sharp(await reencode(await png(2400, 1200))).metadata();
    expect([big.format, big.width, big.height]).toEqual(["webp", 1000, 500]);
    const small = await sharp(await reencode(await png(120, 80))).metadata();
    expect([small.width, small.height]).toEqual([120, 80]);
  });

  it("keeps transparency", async () => {
    const meta = await sharp(await reencode(await png(50, 50))).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it("applies EXIF orientation and strips metadata (GPS never survives)", async () => {
    const jpeg = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#fff" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).orientation).toBe(6);
    const out = await sharp(await reencode(jpeg)).metadata();
    expect([out.width, out.height]).toEqual([100, 200]); // rotated upright
    expect(out.exif).toBeUndefined();
  });

  it("rejects non-images, SVG, empty and oversize input by content", async () => {
    const bad = "That file isn't a readable image";
    await expect(reencode(Buffer.from("definitely not an image"))).rejects.toThrow(bad);
    await expect(reencode(new Uint8Array())).rejects.toThrow(bad);
    await expect(reencode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>'))).rejects.toThrow(bad);
    await expect(reencode(new Uint8Array(MAX_BYTES + 1))).rejects.toThrow("Image is larger than 5MB");
    await expect(reencode(new Uint8Array(MAX_BYTES + 1))).rejects.toBeInstanceOf(ImageError);
  });
});

describe("saveImage, local mode", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "revyu-up-"));
    vi.spyOn(process, "cwd").mockReturnValue(path.join(tmp, "frontend"));
    envState.value = { isLocal: true, supabaseUrl: "", supabaseServiceRoleKey: "" };
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmp, { recursive: true, force: true });
  });

  it("writes ../backend/uploads/<hex>.webp and returns /uploads/<hex>.webp", async () => {
    const url = await saveImage(await png(30, 30));
    expect(url).toMatch(/^\/uploads\/[0-9a-f]{32}\.webp$/);
    const files = await readdir(path.join(tmp, "backend", "uploads"));
    expect(files).toEqual([url.split("/").pop()]);
    expect((await sharp(await readFile(path.join(tmp, "backend", "uploads", files[0]))).metadata()).format).toBe("webp");
  });

  it("refuses to write to disk outside local mode", async () => {
    envState.value = { isLocal: false, supabaseUrl: "", supabaseServiceRoleKey: "" };
    await expect(saveImage(await png(10, 10))).rejects.toThrow("not configured");
  });
});

describe("saveImage, Supabase Storage", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    envState.value = { isLocal: false, supabaseUrl: "https://abc.supabase.co", supabaseServiceRoleKey: "service-key" };
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uploads the WebP to the public bucket and returns its public URL", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const url = await saveImage(await png(40, 40));
    expect(url).toMatch(new RegExp(`^https://abc\\.supabase\\.co/storage/v1/object/public/${BUCKET}/[0-9a-f]{32}\\.webp$`));
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe(`https://abc.supabase.co/storage/v1/object/${BUCKET}/${url.split("/").pop()}`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer service-key", apikey: "service-key", "content-type": "image/webp" });
    expect((await sharp(init.body).metadata()).format).toBe("webp");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates the bucket once on a fresh project, then retries", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":"Bucket not found"}', { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await saveImage(await png(20, 20));
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining(`/object/${BUCKET}/`),
      "https://abc.supabase.co/storage/v1/bucket",
      expect.stringContaining(`/object/${BUCKET}/`),
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ id: BUCKET, name: BUCKET, public: true });
  });

  it("throws (without leaking the key) when Storage keeps failing", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const err = await saveImage(await png(20, 20)).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Supabase Storage upload failed (500)");
  });

  it("never reaches Storage for an invalid image", async () => {
    await expect(saveImage(Buffer.from("junk"))).rejects.toBeInstanceOf(ImageError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
