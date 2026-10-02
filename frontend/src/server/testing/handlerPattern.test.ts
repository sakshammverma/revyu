/**
 * Reference pattern for testing a route handler without leaving rows behind.
 * The handler calls getDb(); inside `inTx` we point getDb() at the
 * rolled-back transaction, and outside it at the real client. Copy the
 * hoisted holder + vi.mock + inTx block into any test file that calls handlers.
 */
import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();
  return { ...actual, getDb: () => (holder.db ?? actual.getDb()) as ReturnType<typeof actual.getDb> };
});

import { GET as getConfig } from "@/app/api/flow/[slug]/config/route";
import { POST as postSession } from "@/app/api/flow/[slug]/session/route";
import { getDb, type DbLike } from "@/server/db";
import { findOutletBySlug } from "@/server/services/flow";
import { inRolledBackTx, makeAccount, makeOutlet, makeRequest, routeCtx } from "./helpers";

const inTx = (fn: (tx: DbLike) => Promise<void>) =>
  inRolledBackTx(async (tx) => {
    holder.db = tx;
    try {
      await fn(tx);
    } finally {
      holder.db = null;
    }
  });

describe("route handlers inside a rolled-back transaction", () => {
  it("GET sees rows created in the transaction", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx), { slug: "pattern-test-slug" });
      const res = await getConfig(makeRequest("/api/flow/pattern-test-slug/config"), routeCtx({ slug: outlet.slug }));
      expect(res.status).toBe(200);
      expect((await res.json()).outlet.id).toBe(outlet.id);
    }));

  it("POST writes happen inside the transaction", () =>
    inTx(async (tx) => {
      const outlet = await makeOutlet(tx, await makeAccount(tx));
      const res = await postSession(
        makeRequest(`/api/flow/${outlet.slug}/session`, { body: { session_id: crypto.randomUUID() } }),
        routeCtx({ slug: outlet.slug }),
      );
      expect(res.status).toBe(201);
    }));

  it("nothing from the earlier tests was committed", async () => {
    expect(await findOutletBySlug(getDb(), "pattern-test-slug")).toBeNull();
  });
});
