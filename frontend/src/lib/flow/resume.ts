/**
 * Where a customer was in the flow, kept in sessionStorage for the 30-minute resume
 * window (FR-19). Holds only what the customer themselves chose or wrote on this
 * device (rating, tag ids, their own draft); it never leaves the browser.
 */

const KEY_PREFIX = "revyu:flow:";
const RESUME_WINDOW_MS = 30 * 60 * 1000;

export interface SavedFlow {
  step: string;
  rating: number | null;
  tagIds: string[];
  draft: string;
  draftEdited: boolean;
}

interface Stored extends SavedFlow {
  sessionId: string;
  savedAt: number;
}

export function saveFlow(slug: string, sessionId: string, flow: SavedFlow) {
  try {
    const stored: Stored = { ...flow, sessionId, savedAt: Date.now() };
    window.sessionStorage.setItem(KEY_PREFIX + slug, JSON.stringify(stored));
  } catch {
    // storage unavailable: the flow still works, it just can't be resumed
  }
}

export function loadSavedFlow(slug: string, sessionId: string): SavedFlow | null {
  try {
    const raw = window.sessionStorage.getItem(KEY_PREFIX + slug);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (s.sessionId !== sessionId || Date.now() - s.savedAt > RESUME_WINDOW_MS) return null;
    if (typeof s.step !== "string" || !Array.isArray(s.tagIds)) return null;
    return { step: s.step, rating: s.rating, tagIds: s.tagIds, draft: s.draft ?? "", draftEdited: !!s.draftEdited };
  } catch {
    return null;
  }
}

export function clearSavedFlow(slug: string) {
  try {
    window.sessionStorage.removeItem(KEY_PREFIX + slug);
  } catch {
    // ignore
  }
}
