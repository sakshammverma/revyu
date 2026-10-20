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

/**
 * States whose owner dashboard is behind the paywall (SRS-9.6, FR-51). The
 * overview's counts stay visible as the teaser (SRS-9.8); every detailed view
 * is refused on the server, not just blurred in the browser.
 */
export const DASHBOARD_LOCKED_STATES: ReadonlySet<string> = new Set(["locked", "suspended"]);

/** States in which an outlet records no events at all (SRS-11.17). */
export const NON_RECORDING_STATES: ReadonlySet<string> = new Set([
  "draft",
  "pending_payment",
  "pending_approval",
  "rejected",
]);
