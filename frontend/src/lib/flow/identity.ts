/**
 * Anonymous session ID + device fingerprint. Trial dedup only (SRS-9.2,
 * SRS-16.3) — never linked to identity, never used for cross-outlet tracking.
 */

const SESSION_KEY_PREFIX = "revyu:session:";
const RESUME_WINDOW_MS = 30 * 60 * 1000; // FR-19 — resume within 30 minutes

export function getOrCreateSessionId(slug: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();

  const key = `${SESSION_KEY_PREFIX}${slug}`;
  const raw = window.sessionStorage.getItem(key);
  if (raw) {
    try {
      const { id, savedAt } = JSON.parse(raw);
      if (Date.now() - savedAt < RESUME_WINDOW_MS) return id;
    } catch {
      // fall through to a fresh session
    }
  }

  const id = crypto.randomUUID();
  window.sessionStorage.setItem(key, JSON.stringify({ id, savedAt: Date.now() }));
  return id;
}

/** A coarse, non-identifying fingerprint — good enough for 24h dedup, not
 * for tracking. Deliberately low-entropy. */
export function getDeviceHash(): string {
  if (typeof window === "undefined") return "server";
  const parts = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    hash = (hash * 31 + parts.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
