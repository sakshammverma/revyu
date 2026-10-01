import { API_BASE } from "@/lib/api-base";
import { getAdminToken } from "@/lib/admin/api";
import type { CheckoutInfo } from "@/lib/signup/api";

/* ------------------------------------------------------------------ types */

export interface OutletHead {
  id: string;
  name: string;
  logo_url: string | null;
  vertical: string;
  slug: string;
}

export interface ProfileData {
  tagline: string | null;
  cover_image_url: string | null;
  address_line: string | null;
  locality: string | null;
  phone: string | null;
  hours: Record<string, string[][]> | null;
}

export interface OpenNow {
  open: boolean;
  until: string | null;
}

export interface HubModule {
  key: "review" | "connect" | "menu" | "rewards";
  label: string;
  blurb: string;
  icon: string;
  route: string;
}

export interface HubPayload {
  collecting: boolean;
  outlet: OutletHead;
  mode: "hub" | "direct";
  modules: HubModule[];
  profile?: ProfileData;
  open_now?: OpenNow | null;
}

export interface LinkItem {
  id: string;
  kind: string;
  label: string | null;
  url: string;
  auto?: boolean;
}

export interface ConnectPayload {
  collecting: boolean;
  outlet: OutletHead;
  profile?: ProfileData;
  open_now?: OpenNow | null;
  links?: LinkItem[];
}

export interface MenuItemData {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  amount_minor: number | null;
  currency_code: string;
  price_on_request: boolean;
  price_prefix: string | null;
  duration_min: number | null;
  dietary: string[];
  photo_url: string | null;
  available: boolean;
}

export interface MenuCategoryData {
  id: string;
  name: string;
  items: MenuItemData[];
}

export interface MenuPayload {
  collecting: boolean;
  outlet: OutletHead;
  label?: string;
  categories?: MenuCategoryData[];
}

export interface RewardsInfo {
  collecting: boolean;
  outlet: OutletHead;
  enabled?: boolean;
  terms?: string | null;
  badges?: {
    name: string;
    icon: string;
    visits_required: number;
    reward_title: string | null;
    reward_terms: string | null;
  }[];
}

export interface Grant {
  id: string;
  title: string;
  terms: string | null;
  type: string;
  percent: number | null;
  value_minor: number | null;
  currency_code: string;
  redeem_code: string;
  expires_at: string | null;
  status: "available" | "used" | "expired";
}

export interface Wallet {
  member: { public_id: string; name: string };
  visits: number;
  next_badge: { name: string; visits_required: number; remaining: number } | null;
  badges: {
    id: string;
    name: string;
    icon: string;
    visits_required: number;
    earned: boolean;
    reward_title: string | null;
  }[];
  rewards: Grant[];
}

/* ---------------------------------------------------------------- errors */

export class HubApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return res.json();
  }
  const body = await res.json().catch(() => null);
  const err = body?.detail?.error;
  const raw = body?.detail;
  const message =
    err?.message ??
    (Array.isArray(raw) ? "Please check the highlighted fields." : null) ??
    "Something went wrong. Please try again.";
  throw new HubApiError(err?.code ?? "UNKNOWN", message, res.status);
}

/* ------------------------------------------------------ customer beacons */

export function beacon(outletId: string, type: string, payload?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ outlet_id: outletId, events: [{ type, payload: payload ?? {} }] });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE}/api/events`, new Blob([body], { type: "application/json" }));
    } else {
      fetch(`${API_BASE}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Instrumentation must never affect the customer.
  }
}

/* ---------------------------------------------------------------- wallet */

const walletKey = (slug: string) => `revyu:wallet:${slug}`;
export const getWalletToken = (slug: string) =>
  typeof window === "undefined" ? null : window.localStorage.getItem(walletKey(slug));
export const setWalletToken = (slug: string, token: string) =>
  window.localStorage.setItem(walletKey(slug), token);
export const clearWalletToken = (slug: string) => window.localStorage.removeItem(walletKey(slug));

async function walletFetch<T>(slug: string, part: string, init: RequestInit = {}): Promise<T> {
  const token = getWalletToken(slug);
  const res = await fetch(`${API_BASE}/api/flow/${slug}/rewards/${part}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Wallet-Token": token } : {}),
    },
  });
  return parse<T>(res);
}

export const joinRewards = async (slug: string, body: { name: string; phone: string; consent: boolean }) => {
  const out = await walletFetch<{ token: string; wallet: Wallet }>(slug, "join", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setWalletToken(slug, out.token);
  return out.wallet;
};
export const fetchWallet = (slug: string) => walletFetch<Wallet>(slug, "wallet");
export const fetchVisitCode = (slug: string) =>
  walletFetch<{ code: string; expires_in: number; qr_svg: string }>(slug, "code");
export const recoverWallet = async (slug: string, phone: string, code: string) => {
  const out = await walletFetch<{ token: string; wallet: Wallet }>(slug, "recover", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
  setWalletToken(slug, out.token);
  return out.wallet;
};
export const deleteWallet = async (slug: string) => {
  await walletFetch<void>(slug, "wallet", { method: "DELETE" });
  clearWalletToken(slug);
};

/* ----------------------------------------------------------------- staff */

const staffKey = (slug: string) => `revyu:staff:${slug}`;
export const getStaffToken = (slug: string) =>
  typeof window === "undefined" ? null : window.sessionStorage.getItem(staffKey(slug));
export const clearStaffToken = (slug: string) => window.sessionStorage.removeItem(staffKey(slug));

async function staffFetch<T>(slug: string, part: string, init: RequestInit = {}): Promise<T> {
  const token = getStaffToken(slug);
  const res = await fetch(`${API_BASE}/api/staff/${slug}/${part}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return parse<T>(res);
}

export interface VisitResult {
  member: { public_id: string; name: string };
  visits: number;
  badges_earned: string[];
  pending_rewards: Grant[];
}

export const staffLogin = async (slug: string, pin: string) => {
  const out = await staffFetch<{ token: string; label: string; outlet_name: string }>(slug, "login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  window.sessionStorage.setItem(staffKey(slug), out.token);
  return out;
};
export const staffVisit = (slug: string, code: string) =>
  staffFetch<VisitResult>(slug, "visits", { method: "POST", body: JSON.stringify({ code }) });
export const staffLookup = (slug: string, publicId: string) =>
  staffFetch<{ member: { public_id: string; name: string }; visits: number; pending_rewards: Grant[] }>(
    slug,
    `member/${encodeURIComponent(publicId)}`
  );
export const staffTransferCode = (slug: string, publicId: string) =>
  staffFetch<{ code: string; member: string; valid_minutes: number }>(
    slug,
    `member/${encodeURIComponent(publicId)}/transfer`,
    { method: "POST" }
  );
export const staffRedeem = (slug: string, redeem_code: string) =>
  staffFetch<{ title: string; member: string; public_id: string }>(slug, "redeem", {
    method: "POST",
    body: JSON.stringify({ redeem_code }),
  });

/* -------------------------------------------- owner/admin shared transport */

export type Transport = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

function body(b: unknown): { body?: BodyInit; headers: Record<string, string> } {
  if (b === undefined) return { headers: {} };
  if (b instanceof FormData) return { body: b, headers: {} };
  return { body: JSON.stringify(b), headers: { "Content-Type": "application/json" } };
}

/** Owner session (cookie). */
export const ownerTransport: Transport = async (method, path, b) => {
  const { body: payload, headers } = body(b);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    body: payload,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  return parse(res);
};

/** Founder admin token. */
export const adminTransport: Transport = async (method, path, b) => {
  const { body: payload, headers } = body(b);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    body: payload,
    headers: { ...headers, Authorization: `Bearer ${getAdminToken()}` },
    cache: "no-store",
  });
  return parse(res);
};

/* ----------------------------------------------------------- editor types */

export interface EditorModule {
  key: HubModule["key"];
  label: string;
  enabled: boolean;
  available: boolean;
  blocked_reason: string | null;
}

export interface EditorLink {
  id?: string;
  kind: string;
  label: string | null;
  url: string;
  enabled: boolean;
}

export interface EditorState {
  slug: string;
  origin: string;
  hub_mode: "direct" | "menu";
  modules: EditorModule[];
  profile: ProfileData;
  links: EditorLink[];
  google_maps_auto: boolean;
  menu_label: string;
  menu: MenuCategoryData[];
}

export interface ItemInput {
  category_id?: string;
  name: string;
  description: string | null;
  amount_minor: number | null;
  price_on_request: boolean;
  price_prefix: string | null;
  duration_min: number | null;
  dietary: string[];
  photo_url: string | null;
  available: boolean;
}

export interface BadgeInput {
  name: string;
  icon: string;
  visits_required: number;
  active: boolean;
  reward: {
    type: "percent_discount" | "amount_discount" | "freebie" | "free_service";
    percent: number | null;
    value_minor: number | null;
    title: string;
    terms: string | null;
    expires_days: number | null;
  };
}

export interface LoyaltyState {
  acknowledged: boolean;
  cooldown_hours: number;
  terms: string | null;
  icons: string[];
  badges: (BadgeInput & { id: string })[];
  staff_pins: { id: string; label: string; active: boolean }[];
  staff_url: string;
  stats: {
    members: number;
    visits_30d: number;
    visits_total: number;
    badges_awarded: number;
    rewards_issued: number;
    rewards_redeemed: number;
  };
}

export interface HubInsights {
  days: number;
  scans: number;
  hub_views: number;
  modules: Record<string, number>;
  links: Record<string, number>;
  menu_views: number;
  rewards_views: number;
  take_rate: number | null;
}

export interface MemberRow {
  id: string;
  public_id: string;
  name: string;
  phone: string;
  contact_consent: boolean;
  visits: number;
  last_visit: string | null;
  joined_at: string;
}

/** Everything the QR-page editor calls, for one outlet, over any transport. */
export function createHubApi(send: Transport, basePath: string) {
  const p = (s = "") => `${basePath}${s}`;
  return {
    state: () => send<EditorState>("GET", p()),
    setMode: (hub_mode: "direct" | "menu") => send<void>("PATCH", p(), { hub_mode }),
    setModules: (modules: { module: string; enabled: boolean }[]) =>
      send<void>("PUT", p("/modules"), { modules }),
    saveProfile: (profile: Partial<ProfileData>) => send<void>("PATCH", p("/profile"), profile),
    saveLinks: (links: EditorLink[]) =>
      send<void>("PUT", p("/links"), {
        links: links.map(({ kind, label, url, enabled }) => ({ kind, label, url, enabled })),
      }),
    addCategory: (name: string) => send<MenuCategoryData>("POST", p("/menu/categories"), { name }),
    renameCategory: (id: string, name: string) => send<void>("PATCH", p(`/menu/categories/${id}`), { name }),
    deleteCategory: (id: string) => send<void>("DELETE", p(`/menu/categories/${id}`)),
    addItem: (item: ItemInput) => send<MenuItemData>("POST", p("/menu/items"), item),
    editItem: (id: string, item: ItemInput) => send<MenuItemData>("PATCH", p(`/menu/items/${id}`), item),
    deleteItem: (id: string) => send<void>("DELETE", p(`/menu/items/${id}`)),
    upload: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await send<{ url: string }>("POST", p("/uploads"), fd)).url;
    },
    loyalty: () => send<LoyaltyState>("GET", p("/loyalty")),
    saveProgram: (cooldown_hours: number, terms: string | null) =>
      send<void>("PUT", p("/loyalty"), { cooldown_hours, terms }),
    acknowledge: () => send<void>("POST", p("/loyalty/acknowledge")),
    addBadge: (b: BadgeInput) => send("POST", p("/loyalty/badges"), b),
    editBadge: (id: string, b: BadgeInput) => send("PUT", p(`/loyalty/badges/${id}`), b),
    retireBadge: (id: string) => send<void>("DELETE", p(`/loyalty/badges/${id}`)),
    addPin: (label: string, pin: string) => send("POST", p("/loyalty/staff-pins"), { label, pin }),
    setPinActive: (id: string, active: boolean) =>
      send<void>("PATCH", p(`/loyalty/staff-pins/${id}?active=${active}`)),
    members: () => send<{ items: MemberRow[] }>("GET", p("/loyalty/members")),
    redemptions: () =>
      send<{ items: { title: string; member: string; public_id: string; redeemed_at: string }[] }>(
        "GET",
        p("/loyalty/redemptions")
      ),
    insights: (days = 30) => send<HubInsights>("GET", p(`/insights?days=${days}`)),
    setAvailability: (module: string, available: boolean) =>
      send<void>("PUT", p("/availability"), { module, available }),
  };
}
export type HubApi = ReturnType<typeof createHubApi>;

export const ownerHubApi = (outletId: string) =>
  createHubApi(ownerTransport, `/api/app/outlets/${outletId}/hub`);
export const adminHubApi = (outletId: string) =>
  createHubApi(adminTransport, `/api/admin/outlets/${outletId}/hub`);

/* ------------------------------------------------------- growth services */

export interface ServiceQuestion {
  key: string;
  label: string;
  type: "text" | "choice";
  options?: string[];
}

export interface Service {
  id: string;
  key: string;
  name: string;
  tagline: string;
  description_md: string;
  deliverables: string[];
  questions: ServiceQuestion[];
  lead_time_days: number | null;
  cover_image_url: string | null;
  active?: boolean;
  sort_order?: number;
}

export interface ServiceEvent {
  id: string;
  kind: "status_changed" | "message" | "note";
  body: string;
  actor: "owner" | "admin";
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  status: string;
  service_key: string;
  service_name: string;
  brief: string | null;
  answers: Record<string, string> | null;
  currency_code: string;
  quoted_amount_minor: number | null;
  paid?: boolean;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string;
  owner_email?: string;
  outlet_id?: string;
  events?: ServiceEvent[];
}

export interface PrintKitOrder {
  id: string;
  method: "deliver" | "self_print";
  fee_minor: number;
  currency_code: string;
  address: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  business_name?: string;
}

export interface PayResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export const growthApi = {
  services: () => ownerTransport<{ items: Service[] }>("GET", "/api/app/services"),
  requests: () => ownerTransport<{ items: ServiceRequest[] }>("GET", "/api/app/service-requests"),
  request: (id: string) => ownerTransport<ServiceRequest>("GET", `/api/app/service-requests/${id}`),
  create: (b: { service_key: string; brief: string | null; answers: Record<string, string> }) =>
    ownerTransport<ServiceRequest>("POST", "/api/app/service-requests", b),
  message: (id: string, text: string) =>
    ownerTransport<ServiceRequest>("POST", `/api/app/service-requests/${id}/messages`, { body: text }),
  accept: (id: string) => ownerTransport<ServiceRequest>("POST", `/api/app/service-requests/${id}/accept`),
  cancel: (id: string) => ownerTransport<ServiceRequest>("POST", `/api/app/service-requests/${id}/cancel`),
  payRequest: (id: string) => ownerTransport<CheckoutInfo>("POST", `/api/app/service-requests/${id}/pay`),
  confirmRequestPayment: (id: string, r: PayResult) =>
    ownerTransport<ServiceRequest>("POST", `/api/app/service-requests/${id}/pay/confirm`, r),
  payPrintKit: (id: string) => ownerTransport<CheckoutInfo>("POST", `/api/app/print-kit/${id}/pay`),
  confirmPrintKitPayment: (id: string, r: PayResult) =>
    ownerTransport<PrintKitOrder>("POST", `/api/app/print-kit/${id}/pay/confirm`, r),
  printKit: () =>
    ownerTransport<{ delivery_fee_minor: number; currency_code: string; orders: PrintKitOrder[] }>(
      "GET",
      "/api/app/print-kit"
    ),
  orderPrintKit: (b: { method: "deliver" | "self_print"; address?: string; phone?: string }) =>
    ownerTransport<PrintKitOrder>("POST", "/api/app/print-kit", b),
};

export const adminGrowthApi = {
  services: () => adminTransport<{ items: Service[] }>("GET", "/api/admin/services"),
  saveService: (id: string | null, b: Partial<Service>) =>
    id
      ? adminTransport<Service>("PUT", `/api/admin/services/${id}`, b)
      : adminTransport<Service>("POST", "/api/admin/services", b),
  requests: () => adminTransport<{ items: ServiceRequest[] }>("GET", "/api/admin/service-requests"),
  request: (id: string) => adminTransport<ServiceRequest>("GET", `/api/admin/service-requests/${id}`),
  update: (
    id: string,
    b: { status?: string; quoted_amount_minor?: number; due_at?: string; message?: string; note?: string }
  ) => adminTransport<ServiceRequest>("PATCH", `/api/admin/service-requests/${id}`, b),
  printKits: () => adminTransport<{ items: PrintKitOrder[] }>("GET", "/api/admin/print-kits"),
  setKitStatus: (id: string, status: string) =>
    adminTransport<void>("PATCH", `/api/admin/print-kits/${id}`, { status }),
};

/* --------------------------------------------------------------- helpers */

export function formatMoney(amountMinor: number, currency: string, locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}
