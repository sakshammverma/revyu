import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema, type DbLike } from "@/server/db";
import { addEvent, inRolledBackTx, makeAccount, makeOutlet, makeSession } from "@/server/testing/helpers";
import { isPlausibleCompletion } from "./events";
import { MAX_CREDITS_PER_HOUR, recordCompletedFlow } from "./trialMetering";

const { notifications, outlets, sessions } = schema;

async function reload(db: DbLike, id: string) {
  const [o] = await db.select().from(outlets).where(eq(outlets.id, id));
  return o;
}

async function emailCount(db: DbLike, outletId: string, template: string) {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.outletId, outletId), eq(notifications.template, template), eq(notifications.channel, "email")));
  return rows.length;
}

describe("plausible completion (a bare copy_tapped earns no credit)", () => {
  it("rejects a session that never rated", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet, { ageSeconds: 60 });
      expect(await isPlausibleCompletion(db, s)).toBe(false);
    }));

  it("rejects a rated but implausibly fresh session", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet, { ageSeconds: 1 });
      await addEvent(db, outlet, s.id, "rating_selected");
      expect(await isPlausibleCompletion(db, s)).toBe(false);
    }));

  it("accepts a rated, aged session", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet, { ageSeconds: 30 });
      await addEvent(db, outlet, s.id, "rating_selected");
      expect(await isPlausibleCompletion(db, s)).toBe(true);
    }));
});

describe("recordCompletedFlow", () => {
  it("stops credit burn at the hourly ceiling", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      for (let i = 0; i < MAX_CREDITS_PER_HOUR + 4; i++) {
        await recordCompletedFlow(db, outlet, await makeSession(db, outlet));
      }
      expect((await reload(db, outlet.id)).trialFlowCount).toBe(MAX_CREDITS_PER_HOUR);
    }));

  it("counts the same device once within 24h", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await recordCompletedFlow(db, outlet, await makeSession(db, outlet, { device: "dev-1" }));
      await recordCompletedFlow(db, outlet, await makeSession(db, outlet, { device: "dev-1" }));
      expect((await reload(db, outlet.id)).trialFlowCount).toBe(1);
    }));

  it("is idempotent: tapping copy twice is still one completed flow", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet);
      expect(await recordCompletedFlow(db, outlet, s)).toBe(true);
      expect(await recordCompletedFlow(db, outlet, s)).toBe(false);
      expect((await reload(db, outlet.id)).trialFlowCount).toBe(1);
    }));

  it("emails credit milestones once and suspends at ten", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), {
        state: "locked",
        trialFlowCount: 16, // 6 credits used since the lock
        lockedAtFlowCount: 10,
      });

      await recordCompletedFlow(db, outlet, await makeSession(db, outlet)); // 7 used, 3 left
      expect(await emailCount(db, outlet.id, "credits_low")).toBe(1);
      expect((await reload(db, outlet.id)).state).toBe("locked");
      await recordCompletedFlow(db, outlet, await makeSession(db, outlet)); // 8 used, 2 left
      expect(await emailCount(db, outlet.id, "credits_low")).toBe(1); // not re-sent

      // The hourly ceiling applies, so space the remaining completions out in time.
      await db
        .update(sessions)
        .set({ completedAt: new Date(Date.now() - 2 * 3600 * 1000) })
        .where(eq(sessions.outletId, outlet.id));
      await recordCompletedFlow(db, outlet, await makeSession(db, outlet)); // 9
      await recordCompletedFlow(db, outlet, await makeSession(db, outlet)); // 10 -> suspended

      expect((await reload(db, outlet.id)).state).toBe("suspended");
      expect(await emailCount(db, outlet.id, "collection_paused")).toBe(1);
    }));
});
