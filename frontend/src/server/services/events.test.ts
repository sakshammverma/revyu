import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema } from "@/server/db";
import { addEvent, inRolledBackTx, makeAccount, makeOutlet, makeSession } from "@/server/testing/helpers";
import { recordEvents, sanitizePayload } from "./events";

const { events, notifications, outlets, sessions } = schema;

describe("sanitizePayload (CR-1: no free text in events)", () => {
  it("drops long strings and nested objects, keeps counts and flags", () => {
    const clean = sanitizePayload({
      length: 42,
      changed: true,
      text: "x".repeat(65),
      nested: { review: "great" },
      tag_ids: ["a", "y".repeat(100)],
      keep: "short",
      nothing: null,
    });
    expect(clean).toEqual({ length: 42, changed: true, tag_ids: ["a"], keep: "short", nothing: null });
  });

  it("passes null and empty payloads through", () => {
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(undefined)).toBeNull();
    expect(sanitizePayload({})).toEqual({});
  });
});

describe("recordEvents", () => {
  it("returns 0 for an unknown outlet", () =>
    inRolledBackTx(async (db) => {
      const r = await recordEvents(db, {
        outletId: crypto.randomUUID(),
        sessionId: null,
        events: [{ type: "scan" }],
      });
      expect(r.accepted).toBe(0);
    }));

  it.each(["draft", "pending_payment", "pending_approval", "rejected"])(
    "records nothing for a %s outlet (SRS-11.17)",
    (state) =>
      inRolledBackTx(async (db) => {
        const outlet = await makeOutlet(db, await makeAccount(db), { state });
        const r = await recordEvents(db, { outletId: outlet.id, sessionId: null, events: [{ type: "scan" }] });
        expect(r.accepted).toBe(0);
        expect(await db.select().from(events).where(eq(events.outletId, outlet.id))).toHaveLength(0);
      }),
  );

  it("drops unknown event types without failing the batch", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const r = await recordEvents(db, {
        outletId: outlet.id,
        sessionId: null,
        events: [{ type: "scan" }, { type: "not_a_real_event" }, { type: "flow_start" }],
      });
      expect(r.accepted).toBe(2);
    }));

  it("sends the first_scan email only for the first scan", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const count = async () =>
        (
          await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.outletId, outlet.id), eq(notifications.template, "first_scan")))
        ).length;
      await recordEvents(db, { outletId: outlet.id, sessionId: null, events: [{ type: "scan" }] });
      expect(await count()).toBe(1);
      await recordEvents(db, { outletId: outlet.id, sessionId: null, events: [{ type: "scan" }] });
      expect(await count()).toBe(1);
    }));

  it("stores sanitised payloads only", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await recordEvents(db, {
        outletId: outlet.id,
        sessionId: null,
        events: [{ type: "draft_edited", payload: { length: 12, text: "z".repeat(200) } }],
      });
      const [row] = await db.select().from(events).where(eq(events.outletId, outlet.id));
      expect(row.payload).toEqual({ length: 12 });
    }));

  it("a bare copy_tapped earns no trial credit", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet, { ageSeconds: 60 }); // old enough, never rated
      await recordEvents(db, { outletId: outlet.id, sessionId: s.id, events: [{ type: "copy_tapped" }] });
      const [o] = await db.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(o.trialFlowCount).toBe(0);
    }));

  it("a rated, aged session's copy_tapped earns exactly one credit", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet, { ageSeconds: 30 });
      await addEvent(db, outlet, s.id, "rating_selected");
      await recordEvents(db, { outletId: outlet.id, sessionId: s.id, events: [{ type: "copy_tapped" }] });
      await recordEvents(db, { outletId: outlet.id, sessionId: s.id, events: [{ type: "copy_tapped" }] });
      const [o] = await db.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(o.trialFlowCount).toBe(1);
      const [row] = await db.select().from(sessions).where(eq(sessions.id, s.id));
      expect(row.completed).toBe(true);
      expect(row.countedForTrial).toBe(true);
    }));

  it("a session from another outlet never meters this one", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const outlet = await makeOutlet(db, account);
      const other = await makeOutlet(db, account);
      const s = await makeSession(db, other, { ageSeconds: 30 });
      await addEvent(db, other, s.id, "rating_selected");
      await recordEvents(db, { outletId: outlet.id, sessionId: s.id, events: [{ type: "copy_tapped" }] });
      const [o] = await db.select().from(outlets).where(eq(outlets.id, outlet.id));
      expect(o.trialFlowCount).toBe(0);
    }));
});
