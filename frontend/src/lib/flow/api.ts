import { API_BASE } from "@/lib/api-base";

export interface OutletConfig {
  id: string;
  business_name: string;
  logo_url: string | null;
  vertical: string;
  google_review_url: string | null;
}

export interface TagConfig {
  id: string;
  label: string;
  phrases: string[];
  sort_order: number;
}

export interface FlowConfig {
  collecting: boolean;
  /** Draft outlet or admin approval preview: full flow, nothing recorded. */
  preview?: boolean;
  /** Outlet language (BCP 47 primary tag), used for the page's lang attribute. */
  locale?: string;
  outlet: OutletConfig;
  tags: TagConfig[];
}

// A request on a stalled 4G link must fail in bounded time, or the button sits on "Sending…" forever.
const TIMEOUT_MS = 12_000;

export async function createSession(slug: string, sessionId: string, deviceHash: string) {
  return fetch(`${API_BASE}/api/flow/${slug}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, device_hash: deviceHash }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    // Never block the flow on a network failure (04-ARCHITECTURE.md §3.1).
  });
}

/**
 * ok: saved. session: the server doesn't know this session yet (the load-time
 * request failed), so create it and retry. limited: too many requests from this
 * network. failed: offline, timed out or a server error.
 */
export type FeedbackResult = "ok" | "session" | "limited" | "failed";

export async function submitFeedback(
  slug: string,
  body: { session_id: string; rating: number | null; message: string; contact?: string; feedback_id?: string }
): Promise<FeedbackResult> {
  try {
    const res = await fetch(`${API_BASE}/api/flow/${slug}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return "ok";
    if (res.status === 400) return "session";
    if (res.status === 429) return "limited";
    return "failed";
  } catch {
    return "failed";
  }
}
