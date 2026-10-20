/**
 * Anonymous session ID + device fingerprint. Trial dedup only (SRS-9.2,
 * SRS-16.3) — never linked to identity, never used for cross-outlet tracking.
 */

const SESSION_KEY_PREFIX = "revyu:session:";
const RESUME_WINDOW_MS = 30 * 60 * 1000; // FR-19 — resume within 30 minutes

/** crypto.randomUUID needs Chrome 92+ and a secure context; old WebViews opened by QR scanner apps lack it. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// sessionStorage throws in some WebViews and with storage disabled; fall back to memory for the page's life.
const memory = new Map<string, string>();

export function getOrCreateSessionId(slug: string): string {
  if (typeof window === "undefined") return newId();

  const key = `${SESSION_KEY_PREFIX}${slug}`;
  let raw: string | null = memory.get(key) ?? null;
  try {
    raw = window.sessionStorage.getItem(key) ?? raw;
  } catch {
    // keep the in-memory value
  }
  if (raw) {
    try {
      const { id, savedAt } = JSON.parse(raw);
      if (Date.now() - savedAt < RESUME_WINDOW_MS) return id;
    } catch {
      // fall through to a fresh session
    }
  }

  const id = newId();
  const value = JSON.stringify({ id, savedAt: Date.now() });
  memory.set(key, value);
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // memory only
  }
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
