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
  outlet: OutletConfig;
  tags: TagConfig[];
}

export async function fetchFlowConfig(slug: string): Promise<FlowConfig | null> {
  const res = await fetch(`${API_BASE}/api/flow/${slug}/config`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`flow config failed: ${res.status}`);
  return res.json();
}

export async function createSession(slug: string, sessionId: string, deviceHash: string) {
  return fetch(`${API_BASE}/api/flow/${slug}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, device_hash: deviceHash }),
  }).catch(() => {
    // Never block the flow on a network failure (04-ARCHITECTURE.md §3.1).
  });
}

export async function submitFeedback(
  slug: string,
  body: { session_id: string; rating: number | null; message: string; contact?: string }
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/flow/${slug}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
