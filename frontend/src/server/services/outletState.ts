/**
 * Outlet state -> what the short URL serves (documents/05-DATA-MODEL.md
 * section 4.1, ANCHOR: outlet-states / collection-stops). Single source of
 * truth for the `collecting` flag: every other module must call isCollecting,
 * never re-derive it from `state`.
 */

const COLLECTING_STATES = new Set(["trial", "locked", "active", "past_due"]);

/**
 * True if a scan should get the full flow; false for the neutral screen.
 * `locked` still collects (FR-45) - the dashboard locks, not the QR.
 */
export function isCollecting(state: string): boolean {
  return COLLECTING_STATES.has(state);
}

/** States in which an outlet records no events at all (SRS-11.17). */
export const NON_RECORDING_STATES: ReadonlySet<string> = new Set([
  "draft",
  "pending_payment",
  "pending_approval",
  "rejected",
]);
