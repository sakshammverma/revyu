"use client";

/**
 * Client fetchers for the in-shop sales demo (/api/marketing/*). Every call sends the
 * presenter's admin secret (kept for this tab only) or sales PIN (kept on this device) as a Bearer token.
 * A 401 means the stored secret no longer works, so it is cleared and the gate shows again.
 */
import { API_BASE } from "@/lib/api-base";
import {
  SALES_PIN_KEY,
  type PlaceSearchResult,
  type Prospect,
  type SalesKit,
  type SalesSearchResponse,
  type SalesRole,
  type SalesSession,
} from "@/lib/marketing/salesTypes";

export class SalesApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message || `sales api ${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

/**
 * The stored token: this tab's copy first (the admin secret lives only there), then the
 * device's (the field-agent PIN).
 */
export function readPin(): string {
  try {
    return sessionStorage.getItem(SALES_PIN_KEY) ?? localStorage.getItem(SALES_PIN_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Keeps a token the server accepted. The shared sales PIN stays on the device (an agent's
 * phone, all day); the founder's admin secret is the full /api/admin bearer, so it is kept
 * only for this tab (cleared when the tab closes), as the admin portal does.
 */
export function storePin(pin: string, role: SalesRole): void {
  try {
    if (role === "sales") {
      sessionStorage.removeItem(SALES_PIN_KEY);
      localStorage.setItem(SALES_PIN_KEY, pin);
    } else {
      localStorage.removeItem(SALES_PIN_KEY);
      sessionStorage.setItem(SALES_PIN_KEY, pin);
    }
  } catch {
    /* storage blocked: the PIN lives only for this page */
  }
}

export function clearPin(): void {
  try {
    sessionStorage.removeItem(SALES_PIN_KEY);
    localStorage.removeItem(SALES_PIN_KEY);
  } catch {
    /* nothing stored */
  }
}

async function get<T>(path: string, pin?: string): Promise<T> {
  const token = pin ?? readPin();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch {
    throw new SalesApiError(0, "NETWORK", "No connection");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.detail?.error;
    if (res.status === 401) clearPin();
    throw new SalesApiError(res.status, err?.code ?? "UNKNOWN", err?.message);
  }
  return (await res.json()) as T;
}

/** Checks a PIN (the given one, else the stored one) and returns who it unlocks. */
export function getSession(pin?: string): Promise<SalesSession> {
  return get<SalesSession>("/api/marketing/session", pin);
}

export async function searchShops(q: string): Promise<PlaceSearchResult[]> {
  const data = await get<SalesSearchResponse>(`/api/marketing/search?q=${encodeURIComponent(q)}`);
  return data.results;
}

export function getProspect(placeId: string): Promise<Prospect> {
  return get<Prospect>(`/api/marketing/prospect?place_id=${encodeURIComponent(placeId)}`);
}

export function getKit({ placeId, name, vertical }: { placeId: string; name: string; vertical: string }): Promise<SalesKit> {
  const qs = new URLSearchParams({ place_id: placeId, name, vertical });
  return get<SalesKit>(`/api/marketing/kit?${qs.toString()}`);
}
