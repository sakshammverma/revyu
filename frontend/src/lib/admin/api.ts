import type { FlowConfig } from "@/lib/flow/api";
import { API_BASE } from "@/lib/api-base";
const TOKEN_KEY = "revyu:admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  const isFormData = init.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      // Never set Content-Type for FormData — the browser must set its own
      // multipart boundary, or the backend can't parse the upload.
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) {
    clearAdminToken();
  }
  return res;
}

export interface ApprovalQueueItem {
  outlet_id: string;
  business_name: string;
  vertical: string;
  owner: { name: string | null; phone: string; email: string };
  google_match: {
    place_id: string | null;
    name: string | null;
    address: string | null;
    rating: number | null;
    review_count: number | null;
  };
  preview_url: string;
  payment_status: string;
  submitted_at: string | null;
  age_hours: number;
}

export async function fetchApprovalQueue(): Promise<ApprovalQueueItem[]> {
  const res = await adminFetch("/api/admin/approvals");
  if (!res.ok) throw new Error(`queue fetch failed: ${res.status}`);
  const data = await res.json();
  return data.items;
}

/** SRS-19.3: both checks are explicit, never assumed. The caller passes what the founder ticked. */
export async function approveOutlet(
  outletId: string,
  checks: { place_verified: boolean; placement_confirmed: boolean },
  notes?: string
) {
  const res = await adminFetch(`/api/admin/approvals/${outletId}/approve`, {
    method: "POST",
    body: JSON.stringify({ ...checks, notes }),
  });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}

export async function rejectOutlet(outletId: string, reason: string) {
  const res = await adminFetch(`/api/admin/approvals/${outletId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason, refund: true }),
  });
  if (!res.ok) throw new Error(`reject failed: ${res.status}`);
}

export async function requestInfo(outletId: string, message: string) {
  const res = await adminFetch(`/api/admin/approvals/${outletId}/request-info`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`request-info failed: ${res.status}`);
}

// --- Outlet management (SRS-11, SRS-11.10-21, documents/13-MULTI-TENANT.md) ---

export interface OutletListItem {
  outlet_id: string;
  business_name: string;
  vertical: string;
  state: string;
  source: string;
  created_at: string;
}

export async function fetchOutlets(filters: {
  state?: string;
  vertical?: string;
  source?: string;
}): Promise<OutletListItem[]> {
  const params = new URLSearchParams();
  if (filters.state) params.set("state", filters.state);
  if (filters.vertical) params.set("vertical", filters.vertical);
  if (filters.source) params.set("source", filters.source);
  const res = await adminFetch(`/api/admin/outlets?${params.toString()}`);
  if (!res.ok) throw new Error(`outlets fetch failed: ${res.status}`);
  const data = await res.json();
  return data.items;
}

export async function fetchVerticals(): Promise<string[]> {
  const res = await adminFetch("/api/admin/outlets/verticals");
  if (!res.ok) throw new Error(`verticals fetch failed: ${res.status}`);
  const data = await res.json();
  return data.verticals;
}

export interface CreateOutletPayload {
  business_name: string;
  vertical: string;
  owner_phone: string;
  owner_email: string;
  owner_name?: string;
  google_maps_url?: string;
  place_id?: string;
}

export class AdminApiError extends Error {
  code: string;
  candidates?: { place_id: string; name: string; address: string }[];
  constructor(code: string, candidates?: { place_id: string; name: string; address: string }[]) {
    super(code);
    this.code = code;
    this.candidates = candidates;
  }
}

async function parseAdminError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const error = body?.detail?.error;
  throw new AdminApiError(error?.code ?? "UNKNOWN", error?.candidates);
}

export async function createOutlet(
  payload: CreateOutletPayload
): Promise<{ outlet_id: string; slug: string; state: string }> {
  const res = await adminFetch("/api/admin/outlets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseAdminError(res);
  return res.json();
}

export interface TagUpdateItem {
  id?: string;
  label: string;
  phrases: string[];
  sort_order: number;
  active: boolean;
}

export async function updateOutletTags(outletId: string, tags: TagUpdateItem[]): Promise<void> {
  const res = await adminFetch(`/api/admin/outlets/${outletId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) throw new Error(`update tags failed: ${res.status}`);
}

export async function activateOutlet(
  outletId: string
): Promise<{ slug: string; short_url: string; activated_at: string }> {
  const res = await adminFetch(`/api/admin/outlets/${outletId}/activate`, { method: "POST" });
  if (!res.ok) return parseAdminError(res);
  return res.json();
}

export interface BulkImportRowResult {
  row: number;
  outlet_id: string | null;
  slug: string | null;
  status: string;
  error: string | null;
}

export async function bulkImportOutlets(
  file: File
): Promise<{ created: number; failed: number; rows: BulkImportRowResult[] }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await adminFetch("/api/admin/outlets/bulk", { method: "POST", body: formData });
  if (!res.ok) throw new Error(`bulk import failed: ${res.status}`);
  return res.json();
}

// --- Approval preview (SRS-19.2) ---
// A pending signup has no real slug yet, so the founder previews it by id.

export async function fetchApprovalPreview(outletId: string): Promise<FlowConfig> {
  const res = await adminFetch(`/api/admin/approvals/${outletId}/preview`);
  if (!res.ok) throw new Error(`preview fetch failed: ${res.status}`);
  return res.json();
}


export interface ReferralRewardRow {
  id: string;
  referrer_email: string;
  referrer_name: string | null;
  referred_business: string;
  status: "pending" | "earned" | "applied" | "void";
  discount_percent: number;
  earned_at: string | null;
}

export async function listReferralRewards(): Promise<ReferralRewardRow[]> {
  const res = await adminFetch("/api/admin/referrals");
  if (!res.ok) throw new Error(`referrals ${res.status}`);
  return res.json();
}

export async function applyReferralReward(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/referrals/${id}/apply`, { method: "POST" });
  if (!res.ok) throw new Error(`apply ${res.status}`);
}


// --- Founder operations ---

export interface PendingSend {
  id: string;
  template: string;
  business_name: string | null;
  owner_name: string | null;
  to_phone: string;
  body: string;
  link: string;
  created_at: string;
}

export async function listPendingSends(): Promise<PendingSend[]> {
  const res = await adminFetch("/api/admin/pending-sends");
  if (!res.ok) throw new Error(`pending sends ${res.status}`);
  return res.json();
}

export async function resolvePendingSend(id: string, action: "sent" | "dismiss"): Promise<void> {
  const res = await adminFetch(`/api/admin/pending-sends/${id}/${action}`, { method: "POST" });
  if (!res.ok) throw new Error(`${action} ${res.status}`);
}

export interface OutletMetric {
  outlet_id: string;
  business_name: string;
  vertical: string;
  source: string;
  state: string;
  scans: number;
  completed: number;
  conversion: number | null;
}

export interface Cockpit {
  window_days: number;
  installs: number;
  by_source: Record<string, number>;
  cohort_scans: number;
  cohort_completed: number;
  cohort_conversion: number | null;
  median_conversion: number | null;
  median_sample: number;
  band: "stop" | "iterate" | "fix" | "push" | "unknown";
  band_label: string;
  tenth_install_at: string | null;
  decision_date: string | null;
  days_to_decision: number | null;
  trial_to_paid: number | null;
  trial_eligible: number;
  zero_scan: string[];
  outlets: OutletMetric[];
}

export async function fetchCockpit(): Promise<Cockpit> {
  const res = await adminFetch("/api/admin/metrics");
  if (!res.ok) throw new Error(`metrics ${res.status}`);
  return res.json();
}

export interface OutletDetail {
  id: string;
  business_name: string;
  slug: string;
  vertical: string;
  state: string;
  source: string;
  hub_mode: string;
  owner_name: string | null;
  owner_email: string;
  owner_phone: string;
  google_place_id: string | null;
  activated_at: string | null;
  trial_flow_count: number;
  scans_30d: number;
  completed_30d: number;
  tags: { id: string; label: string; phrases: string[]; sort_order: number; active: boolean }[];
  payments: { amount_minor: number; currency_code: string; status: string; created_at: string }[];
  notifications: { template: string; channel: string; status: string; created_at: string }[];
  snapshots: { rating: number | null; review_count: number | null; polled_at: string }[];
}

export async function fetchOutletDetail(id: string): Promise<OutletDetail> {
  const res = await adminFetch(`/api/admin/outlets/${id}/detail`);
  if (!res.ok) throw new Error(`detail ${res.status}`);
  return res.json();
}

export async function overrideOutletState(id: string, state: string, reason: string): Promise<void> {
  const res = await adminFetch(`/api/admin/outlets/${id}/state`, {
    method: "POST",
    body: JSON.stringify({ state, reason }),
  });
  if (!res.ok) throw new Error(`override ${res.status}`);
}
