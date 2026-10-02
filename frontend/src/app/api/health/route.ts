import { sql } from "drizzle-orm";

import { getDb } from "@/server/db";

/** Liveness + database reachability, for uptime monitors (replaces FastAPI /health). */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", db: true });
  } catch {
    return Response.json({ status: "degraded", db: false }, { status: 503 });
  }
}
