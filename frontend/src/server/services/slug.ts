/** Port of backend/app/services/slug.py: 7 chars, URL-safe, non-sequential. */
import { randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";

const { outlets } = schema;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export async function generateUniqueSlug(db: DbLike, length = 7): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let candidate = "";
    for (let i = 0; i < length; i++) candidate += ALPHABET[randomInt(ALPHABET.length)];
    const [hit] = await db.select({ id: outlets.id }).from(outlets).where(eq(outlets.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  throw new Error("Could not generate a unique slug after 20 attempts");
}
