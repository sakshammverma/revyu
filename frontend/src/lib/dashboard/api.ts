// Same-origin, proxied by next.config.ts rewrites so the session cookie
// works without cross-site SameSite restrictions.
const API_BASE = "";

function withCreds(init: RequestInit = {}): RequestInit {
  return { ...init, credentials: "include" };
}

export class DashboardApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, withCreds({ cache: "no-store" }));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new DashboardApiError(body?.detail?.error?.code ?? "UNKNOWN", res.status);
  }
  return res.json();
}

export async function requestOtp(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/app/auth/otp/request`, withCreds({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new DashboardApiError(body?.detail?.error?.code ?? "UNKNOWN", res.status);
  }
}

export async function verifyOtp(email: string, code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/app/auth/otp/verify`, withCreds({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  }));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new DashboardApiError(body?.detail?.error?.code ?? "UNKNOWN", res.status);
  }
}

export interface MyOutlet {
  outlet_id: string;
  business_name: string;
  state: string;
  collecting: boolean;
}

export interface Overview {
  outlet_id: string;
  business_name: string;
  state: string;
  scans: number;
  completed_flows: number;
  conversion_rate: number;
  trial_flow_count: number;
  dashboard_locked: boolean;
}

export interface FunnelStep {
  step: string;
  count: number;
  drop_off_pct: number | null;
}

export interface Funnel {
  steps: FunnelStep[];
  note: string;
}

export interface TagFrequency {
  tags: { label: string; count: number }[];
}

export interface RatingInfo {
  baseline_rating: number | null;
  baseline_review_count: number | null;
  current_rating: number | null;
  current_review_count: number | null;
  polled_at: string | null;
}

export interface FeedbackItem {
  id: string;
  rating: number | null;
  message: string;
  contact: string | null;
  resolved: boolean;
  created_at: string;
}

export const getMyOutlet = () => get<MyOutlet>("/api/app/outlets/mine");
export const getOverview = (outletId: string) => get<Overview>(`/api/app/outlets/${outletId}/overview`);
export const getFunnel = (outletId: string, range = "30d") =>
  get<Funnel>(`/api/app/outlets/${outletId}/funnel?range=${range}`);
export const getTagFrequency = (outletId: string, range = "30d") =>
  get<TagFrequency>(`/api/app/outlets/${outletId}/tags?range=${range}`);
export const getRating = (outletId: string) => get<RatingInfo>(`/api/app/outlets/${outletId}/rating`);
export const getFeedbackInbox = (outletId: string) =>
  get<{ items: FeedbackItem[] }>(`/api/app/outlets/${outletId}/feedback`);

export async function resolveFeedback(feedbackId: string, resolved: boolean): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/app/feedback/${feedbackId}`,
    withCreds({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    })
  );
  if (!res.ok) throw new DashboardApiError("UNKNOWN", res.status);
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    `${API_BASE}${path}`,
    withCreds({
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new DashboardApiError(b?.detail?.error?.code ?? "UNKNOWN", res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const logout = () => send<void>("POST", "/api/app/auth/logout");

// ── Billing ────────────────────────────────────────────────────────────────
export interface PlanOption {
  code: string;
  amount_minor: number;
  currency_code: string;
}

export interface BillingStatus {
  outlet_id: string;
  state: string;
  subscription_status: string | null;
  plan: string | null;
  current_period_end: string | null;
  trial_days_left: number | null;
  credits_left: number | null;
  scans_waiting: number;
  can_pay: boolean;
  plans: PlanOption[];
  annual_saving_minor: number;
  payments: { amount_minor: number; currency_code: string; status: string; created_at: string }[];
  referral_discounts_earned: number;
}

export interface CheckoutInfo {
  provider: string;
  mode: string;
  amount_minor: number;
  currency_code: string;
  key_id: string | null;
  subscription_id: string | null;
  order_id: string | null;
  trial_days: number;
  prefill: { name: string; email: string; contact: string };
}

export const getBillingStatus = () => get<BillingStatus>("/api/app/billing/status");
export const createBillingCheckout = (plan: string) =>
  send<{ checkout: CheckoutInfo; subscription_id: string }>("POST", "/api/app/billing/checkout", { plan });
export const confirmBilling = (body: {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string | null;
  razorpay_order_id?: string | null;
}) => send<BillingStatus>("POST", "/api/app/billing/confirm", body);

// ── Referrals ──────────────────────────────────────────────────────────────
export interface ReferralOverview {
  code: string;
  link: string;
  discount_percent: number;
  pending: number;
  earned: number;
  applied: number;
  referrals: { business_name: string; status: string; created_at: string }[];
}

export const getReferrals = () => get<ReferralOverview>("/api/app/referrals");

// ── Competitor Watch ───────────────────────────────────────────────────────
export interface Standing {
  id: string | null;
  name: string;
  rating: number | null;
  review_count: number | null;
  /** Reviews gained since the previous weekly check; null until there are two checks. */
  delta: number | null;
}

export interface CompetitorsView {
  limit: number;
  me: Standing;
  competitors: Standing[];
  headline: string;
}

export const getCompetitors = () => get<CompetitorsView>("/api/app/competitors");
export const addCompetitor = (place_id: string, name: string) =>
  send<CompetitorsView>("POST", "/api/app/competitors", { place_id, name });
export const removeCompetitor = (id: string) => send<CompetitorsView>("DELETE", `/api/app/competitors/${id}`);
