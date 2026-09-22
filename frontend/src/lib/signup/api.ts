import { API_BASE } from "@/lib/api-base";

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  review_count: number | null;
}

export interface SignupPayload {
  business_name: string;
  vertical: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  place_id: string;
  plan: string;
  placement_acknowledged: boolean;
  referral_code?: string;
}

export interface ApiError {
  code: string;
  message?: string;
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const res = await fetch(
    `${API_BASE}/api/signup/places/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new SignupApiError(body?.detail?.error ?? { code: "UNKNOWN" });
  }
  const data = await res.json();
  return data.results;
}

export class SignupApiError extends Error {
  code: string;
  constructor(error: ApiError) {
    super(error.message ?? error.code);
    this.code = error.code;
  }
}

export interface CheckoutInfo {
  provider: "razorpay" | "mock" | string;
  mode: "mandate" | "one_time" | "mock" | string;
  amount_minor: number;
  currency_code: string;
  key_id: string | null;
  subscription_id: string | null;
  order_id: string | null;
  trial_days: number;
  prefill: { name: string; email: string; contact: string } | null;
}

export async function submitSignup(
  payload: SignupPayload
): Promise<{ signup_id: string; checkout: CheckoutInfo }> {
  const res = await fetch(`${API_BASE}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new SignupApiError(body?.detail?.error ?? { code: "UNKNOWN" });
  }
  return res.json();
}

export async function confirmSignup(
  signupId: string,
  result: {
    razorpay_payment_id: string;
    razorpay_signature: string;
    razorpay_subscription_id?: string;
    razorpay_order_id?: string;
  }
): Promise<{ state: string; submitted_at: string | null; message: string }> {
  const res = await fetch(`${API_BASE}/api/signup/${signupId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new SignupApiError(body?.detail?.error ?? { code: "UNKNOWN" });
  }
  return res.json();
}

export async function fetchSignupStatus(signupId: string) {
  const res = await fetch(`${API_BASE}/api/signup/${signupId}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("status fetch failed");
  return res.json() as Promise<{ state: string; submitted_at: string | null; message: string }>;
}
