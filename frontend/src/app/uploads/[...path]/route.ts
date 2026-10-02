/**
 * Local-dev image serving for uploads written to ../backend/uploads (by this
 * app or by FastAPI). Hosted deployments store images in Supabase Storage, so
 * outside ENVIRONMENT=local this is a plain 404. Takes precedence over the
 * `/uploads/:path*` fallback rewrite to FastAPI in next.config.ts.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getEnv } from "@/server/env";
import { localUploadDir } from "@/server/services/storage";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!getEnv().isLocal) return notFound();
  const segments = (await params).path;
  // Only flat file names: no traversal, separators, drive letters or hidden files.
  if (!segments.every((s) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s) && s !== ".." )) return notFound();
  const type = TYPES[path.extname(segments[segments.length - 1]).toLowerCase()];
  if (!type) return notFound();
  const root = localUploadDir();
  const file = path.resolve(root, ...segments);
  if (!file.startsWith(root + path.sep)) return notFound();
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
