import { sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

/** Liveness + database reachability, for uptime monitors (replaces FastAPI /health). */
export async function GET() {
  // A bad production config throws before any query runs; log why (variable names stay in
  // the logs, never in this public response) so "db: false" isn't a dead end.
  try {
    getEnv();
  } catch (e) {
    console.error("health: invalid configuration:", e instanceof Error ? e.message : e);
    return Response.json({ status: "degraded", config: false, db: false }, { status: 503 });
  }
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", config: true, db: true });
  } catch (e) {
    console.error("health: database unreachable:", e instanceof Error ? e.message : e);
    return Response.json({ status: "degraded", config: true, db: false }, { status: 503 });
  }
}
