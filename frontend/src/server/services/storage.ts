/**
 * Image uploads: re-encoded to WebP (strips EXIF/GPS, bounds size). Port of
 * backend/app/services/storage.py with two backends:
 *
 *  - Supabase Storage (public bucket `outlet-media`) whenever the project URL
 *    and service-role key are configured; the returned value is the public URL.
 *  - Local disk (`../backend/uploads`, served by app/uploads/[...path]) ONLY
 *    when ENVIRONMENT=local and the keys are absent, so dev works offline and
 *    files written by FastAPI keep resolving. The returned value is `/uploads/x`.
 *
 * Callers only store the returned string; nothing depends on where it lives.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { getEnv } from "@/server/env";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_SIDE = 1000;
export const BUCKET = "outlet-media";

/** Formats a phone camera / browser can plausibly upload. Notably not SVG (scriptable). */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "tiff", "heif", "avif"]);

export class ImageError extends Error {}

/** Same directory FastAPI writes to (backend/uploads), relative to the frontend cwd. */
export function localUploadDir(): string {
  return path.resolve(process.cwd(), "..", "backend", "uploads");
}

/**
 * Validate by content (sharp sniffs magic bytes; the client's file name and
 * content-type are ignored), then normalise: honour EXIF orientation, fit
 * inside 1000x1000 without enlarging, WebP q78. Output carries no metadata.
 */
export async function reencode(data: Uint8Array): Promise<Buffer> {
  if (data.byteLength > MAX_BYTES) throw new ImageError("Image is larger than 5MB");
  try {
    const input = sharp(data, { failOn: "error" });
    const meta = await input.metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new Error("unsupported format");
    return await input
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
  } catch {
    throw new ImageError("That file isn't a readable image");
  }
}

async function uploadToSupabase(name: string, body: Buffer): Promise<string> {
  const { supabaseUrl, supabaseServiceRoleKey } = getEnv();
  const headers = { Authorization: `Bearer ${supabaseServiceRoleKey}`, apikey: supabaseServiceRoleKey };
  const put = () =>
    fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST",
      headers: { ...headers, "content-type": "image/webp", "cache-control": "max-age=31536000", "x-upsert": "false" },
      body: new Uint8Array(body),
    });

  let res = await put();
  if (res.status === 400 || res.status === 404) {
    // First upload on a fresh project: create the public bucket, then retry once.
    const created = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (created.ok || created.status === 409) res = await put();
  }
  if (!res.ok) throw new Error(`Supabase Storage upload failed (${res.status})`);
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${name}`;
}

/** Re-encode and store; returns the URL (or `/uploads/...` path in local mode) to save. */
export async function saveImage(data: Uint8Array): Promise<string> {
  const webp = await reencode(data);
  const name = `${randomUUID().replace(/-/g, "")}.webp`;
  const env = getEnv();
  if (env.supabaseUrl && env.supabaseServiceRoleKey) return uploadToSupabase(name, webp);
  if (!env.isLocal) throw new Error("Supabase Storage is not configured");
  const dir = localUploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), webp);
  return `/uploads/${name}`;
}
