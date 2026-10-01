import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/server/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** What services accept: the shared client or a transaction (tests roll one back). */
export type DbLike = Pick<Db, "select" | "insert" | "update" | "delete" | "execute" | "transaction">;

const globalForDb = globalThis as unknown as { __revyuDb?: Db };

/**
 * One lazily-created client per server instance (kept across dev HMR reloads).
 * `prepare: false` keeps this compatible with Supabase's transaction pooler
 * (port 6543), which is what serverless deployments should point
 * DATABASE_POOL_URL at. `max` stays small because every Vercel instance has
 * its own pool.
 */
export function getDb(): Db {
  if (!globalForDb.__revyuDb) {
    const client = postgres(getEnv().databaseUrl, {
      prepare: false,
      max: getEnv().isLocal ? 5 : 3,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    globalForDb.__revyuDb = drizzle(client, { schema });
  }
  return globalForDb.__revyuDb;
}

export { schema };
