import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema } from "@/server/db";
import { HttpError } from "@/server/http";
import { inRolledBackTx, makeAccount, makeOutlet, makeSession } from "@/server/testing/helpers";
import {
  buildFlowConfig,
  createSession,
  findOutletBySlug,
  getFlowConfig,
  requireOutlet,
  submitFeedback,
} from "./flow";

const { notifications, privateFeedback, sessions, tags } = schema;

async function addTag(db: Parameters<typeof makeSession>[0], outletId: string, sortOrder: number, label: Record<string, string>) {
  await db.insert(tags).values({
    id: crypto.randomUUID(),
    outletId,
    label,
    phrases: Object.fromEntries(Object.entries(label).map(([k, v]) => [k, [`the ${v} was great`]])),
    sortOrder,
    active: true,
  });
}

describe("slug resolution", () => {
  it("is case-insensitive (SRS-1.1)", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { slug: "MiXeD-case-slug" });
      expect((await findOutletBySlug(db, "mixed-CASE-slug"))?.id).toBe(outlet.id);
    }));

  it("404s an unknown slug with no existence leak (SRS-1.4)", () =>
    inRolledBackTx(async (db) => {
      await expect(requireOutlet(db, "no-such-slug-xyz")).rejects.toMatchObject({
        status: 404,
        code: "OUTLET_NOT_FOUND",
      });
      expect(await getFlowConfig(db, "no-such-slug-xyz")).toBeNull();
    }));
});

describe("flow config", () => {
  it("serves the full flow and the Google link for a collecting outlet", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { state: "trial" });
      await addTag(db, outlet.id, 2, { en: "second" });
      await addTag(db, outlet.id, 1, { en: "first" });
      const cfg = await buildFlowConfig(db, outlet);
      expect(cfg.collecting).toBe(true);
      expect(cfg.preview).toBe(false);
      expect(cfg.outlet.google_review_url).toBe(outlet.googleReviewUrl);
      expect(cfg.tags.map((t) => t.label)).toEqual(["first", "second"]);
      expect(cfg.tags[0].phrases).toEqual(["the first was great"]);
    }));

  it.each(["trial", "locked", "active", "past_due"])("%s still collects", (state) =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { state });
      expect((await buildFlowConfig(db, outlet)).collecting).toBe(true);
    }),
  );

  it.each(["suspended", "deactivated", "pending_payment", "pending_approval", "rejected"])(
    "%s shows the neutral screen: no link, no tags",
    (state) =>
      inRolledBackTx(async (db) => {
        const outlet = await makeOutlet(db, await makeAccount(db), { state });
        await addTag(db, outlet.id, 1, { en: "x" });
        const cfg = await buildFlowConfig(db, outlet);
        expect(cfg.collecting).toBe(false);
        expect(cfg.preview).toBe(false);
        expect(cfg.outlet.google_review_url).toBeNull();
        expect(cfg.tags).toEqual([]);
      }),
  );

  it("previews a draft outlet fully without collecting (SRS-11.17)", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db), { state: "draft" });
      await addTag(db, outlet.id, 1, { en: "x" });
      const cfg = await buildFlowConfig(db, outlet);
      expect(cfg).toMatchObject({ collecting: false, preview: true });
      expect(cfg.outlet.google_review_url).toBe(outlet.googleReviewUrl);
      expect(cfg.tags).toHaveLength(1);
    }));

  it("falls back to the first locale when 'en' is missing", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await addTag(db, outlet.id, 1, { hi: "shandar" });
      expect((await buildFlowConfig(db, outlet)).tags[0].label).toBe("shandar");
    }));
});

describe("createSession", () => {
  it("is idempotent by session_id", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const id = crypto.randomUUID();
      const a = await createSession(db, outlet, { sessionId: id, deviceHash: "dev" });
      const b = await createSession(db, outlet, { sessionId: id, deviceHash: "dev" });
      expect(b).toEqual(a);
      expect(await db.select().from(sessions).where(eq(sessions.id, id))).toHaveLength(1);
    }));
});

describe("submitFeedback", () => {
  it("rejects a session from another outlet", () =>
    inRolledBackTx(async (db) => {
      const account = await makeAccount(db);
      const outlet = await makeOutlet(db, account);
      const other = await makeOutlet(db, account);
      const s = await makeSession(db, other);
      await expect(
        submitFeedback(db, outlet, { sessionId: s.id, rating: 3, message: "hi", contact: null }),
      ).rejects.toMatchObject({ status: 400, code: "INVALID_SESSION" });
    }));

  it("rejects an unknown session", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      await expect(
        submitFeedback(db, outlet, { sessionId: crypto.randomUUID(), rating: 3, message: "hi", contact: null }),
      ).rejects.toBeInstanceOf(HttpError);
    }));

  it("rejects a blank message", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet);
      await expect(
        submitFeedback(db, outlet, { sessionId: s.id, rating: 2, message: "   ", contact: null }),
      ).rejects.toMatchObject({ code: "EMPTY_MESSAGE" });
    }));

  it("stores trimmed feedback and notifies the owner", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet);
      const res = await submitFeedback(db, outlet, {
        sessionId: s.id,
        rating: 2,
        message: "  long wait  ",
        contact: "me@example.com",
      });
      const [row] = await db.select().from(privateFeedback).where(eq(privateFeedback.id, res.id));
      expect(row).toMatchObject({ message: "long wait", rating: 2, resolved: false, contact: "me@example.com" });
      const sent = await db.select().from(notifications).where(eq(notifications.outletId, outlet.id));
      expect(sent.map((n) => n.template)).toContain("private_feedback_received");
    }));

  it("returns no instruction to hide the Google link (CR-3)", () =>
    inRolledBackTx(async (db) => {
      const outlet = await makeOutlet(db, await makeAccount(db));
      const s = await makeSession(db, outlet);
      const res = await submitFeedback(db, outlet, { sessionId: s.id, rating: 1, message: "bad", contact: null });
      expect(Object.keys(res).sort()).toEqual(["created_at", "id"]);
      // And the config served afterwards still carries the link.
      expect((await buildFlowConfig(db, outlet)).outlet.google_review_url).toBe(outlet.googleReviewUrl);
    }));
});
