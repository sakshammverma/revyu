import { getDb, type Db } from "@/server/db";
import { handler } from "@/server/http";
import { requireOutlet, type Outlet } from "@/server/services/flow";

export type SlugContext = { params: Promise<{ slug: string }> };

/** A public GET that resolves the outlet from /[slug]/ and returns JSON (404 if unknown). */
export function slugGet<T>(build: (db: Db, outlet: Outlet) => Promise<T>) {
  return handler(async (_request: Request, { params }: SlugContext) => {
    const { slug } = await params;
    const db = getDb();
    return Response.json(await build(db, await requireOutlet(db, slug)));
  });
}
