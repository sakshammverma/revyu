/**
 * Event beacon client. Buffers and retries; losing an event is preferable to
 * blocking a customer (04-ARCHITECTURE.md §5). Uses sendBeacon where
 * available so `handoff` survives the redirect.
 */

import { API_BASE } from "@/lib/api-base";
const STORAGE_KEY = "revyu:pending-events:v2";
const MAX_BUFFERED = 50;

export type EventType =
  | "scan"
  | "flow_start"
  | "rating_selected"
  | "tags_selected"
  | "draft_viewed"
  | "draft_edited"
  | "copy_tapped"
  | "handoff"
  | "private_feedback_opened"
  | "private_feedback_submitted";

interface QueuedEvent {
  type: EventType;
  payload?: Record<string, unknown>;
}

interface EventContext {
  outletId: string;
  sessionId: string;
}

function sendBatch(ctx: EventContext, events: QueuedEvent[]): boolean {
  const body = JSON.stringify({
    outlet_id: ctx.outletId,
    session_id: ctx.sessionId,
    events,
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    const ok = navigator.sendBeacon(`${API_BASE}/api/events`, blob);
    if (ok) return true;
  }

  fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => bufferForRetry(ctx, events));

  return true;
}

// Each buffered entry keeps the outlet and session it belongs to, so a retry
// from another outlet's page never files events under the wrong business.
type Buffered = EventContext & { events: QueuedEvent[] };

function readBuffer(): Buffered[] {
  const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  return Array.isArray(parsed) ? parsed : [];
}

function bufferForRetry(ctx: EventContext, events: QueuedEvent[]) {
  if (typeof window === "undefined") return;
  try {
    const next = [...readBuffer(), { outletId: ctx.outletId, sessionId: ctx.sessionId, events }].slice(-MAX_BUFFERED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only — never throw from telemetry.
  }
}

export function track(ctx: EventContext, type: EventType, payload?: Record<string, unknown>) {
  try {
    sendBatch(ctx, [{ type, payload }]);
  } catch {
    // Event loss is acceptable; blocking the customer is not.
  }
}

/** Retry anything buffered from a previous failed send. Call once on mount. */
export function retryBuffered() {
  if (typeof window === "undefined") return;
  try {
    const entries = readBuffer();
    if (entries.length === 0) return;
    window.localStorage.removeItem(STORAGE_KEY);
    for (const e of entries) {
      if (e && typeof e.outletId === "string" && Array.isArray(e.events) && e.events.length) {
        sendBatch({ outletId: e.outletId, sessionId: e.sessionId }, e.events);
      }
    }
  } catch {
    // Ignore — best-effort retry only.
  }
}
