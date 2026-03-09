# API Specification

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

---

## Conventions

- Base path `/api`. JSON request and response bodies.
- Timestamps ISO 8601 UTC.
- Money as **`amount_minor`** (integer, smallest currency unit) **plus
  `currency_code`** (ISO 4217). Never floats, never currency-implicit (FR-70).
- Errors: `{ "error": { "code": "...", "message": "..." } }`
- Auth: owner endpoints take a session cookie; admin endpoints separate auth;
  public endpoints unauthenticated.

| Group | Prefix | Auth |
|---|---|---|
| Public flow | `/api/flow` | None |
| Events | `/api/events` | None |
| Owner | `/api/app` | Owner session |
| Admin | `/api/admin` | Admin |
| Webhooks | `/api/webhooks` | Signature |

---

## 1. Public — customer flow

### `GET /r/{slug}`

Not an API route — the server-rendered landing page. Documented here because
it is the entry point.

- Resolves slug → outlet config (edge-cached).
- Emits `scan` (fire-and-forget, never blocks render).
- **Always resolves** — never a dead link or error (C-6, SRS-1.5). Serves the
  full flow when collecting, a neutral screen when `suspended`/`deactivated`
  (SRS-1.5a/b).
- Unknown slug → branded 404, no existence leak (SRS-1.4).
- `deactivated` outlet → neutral message screen, never an error (SRS-1.6).
- *(2026-09-30)* Routes by `outlets.hub_mode` and enabled module count: `direct`
  or a single module → that module directly; two or more → the hub
  ([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §1). The review flow lives at
  `/r/{slug}/review`; siblings are `/connect`, `/menu`, `/rewards`. All obey the
  same suspension rules (SRS-20.3).

---

### `GET /api/flow/{slug}/config`

Outlet configuration for the client flow.

**Response 200**
```json
{
  "outlet": {
    "id": "uuid",
    "business_name": "Smile Dental Care",
    "logo_url": "https://.../logo.svg",
    "vertical": "dental"
  },
  "tags": [
    { "id": "uuid", "label": "clean clinic", "sort_order": 1 },
    { "id": "uuid", "label": "painless treatment", "sort_order": 2 }
  ],
  "google_review_url": "https://search.google.com/local/writereview?placeid=..."
}
```

Notes:
- No billing state is returned. The client cannot condition behaviour on it.
- `tags[].phrase` is **not** exposed if assembly is server-side. If assembly is
  client-side, phrases are included — either is acceptable per
  [04-ARCHITECTURE.md](04-ARCHITECTURE.md) §6, but the vocabulary must remain
  CI-inspectable (SRS-17.3).

**Errors:** `404 OUTLET_NOT_FOUND`

---

### `POST /api/flow/{slug}/session`

Creates a session. Called on first interaction.

**Request**
```json
{ "session_id": "uuid", "device_hash": "string" }
```

**Response 201**
```json
{ "session_id": "uuid", "started_at": "2026-09-18T10:00:00Z" }
```

`session_id` is client-generated and anonymous (SRS-8.2). `device_hash` is used
solely for trial dedup (SRS-9.2, SRS-16.3).

---

### `POST /api/flow/{slug}/draft`

Assembles the draft from tag selections. Server-side assembly variant.

**Request**
```json
{ "session_id": "uuid", "tag_ids": ["uuid", "uuid"] }
```

**Response 200**
```json
{ "draft": "The clinic was clean and the treatment was painless." }
```

**Compliance (CR-1, CR-2):**
- Output substance maps 1:1 to `tag_ids`. Connective grammar only otherwise.
- **Empty `tag_ids` returns an empty or near-empty string.** This is asserted
  in test SRS-17.2.
- No stored review text participates in assembly.
- The client renders this in an **editable** field (CR-2). The API cannot
  enforce that; the UI test does.

---

### `POST /api/flow/{slug}/feedback`

Private feedback. Available at **all** ratings (CR-3).

**Request**
```json
{
  "session_id": "uuid",
  "rating": 2,
  "message": "Waiting time was long.",
  "contact": "9876543210"
}
```

**Response 201**
```json
{ "id": "uuid", "created_at": "2026-09-18T10:05:00Z" }
```

Behaviour:
- Triggers owner notification within 5 minutes (SRS-13.5).
- Rate-limited per session and per IP (SRS-7.6).
- **Submission does not suppress the Google link** for that session (CR-3,
  SRS-7.5). No response field instructs the client to hide it — by design.

**Errors:** `429 RATE_LIMITED`, `400 INVALID_SESSION`

---

### 1a. Hub and module endpoints *(added 2026-09-30 — sketch; finalise at build)*

Unauthenticated unless noted. Shapes are indicative; the authoritative model is
[22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §6.

| Endpoint | Release | Purpose |
|---|---|---|
| `GET /api/flow/{slug}/config` | v1.5 | **Extended:** adds `hub_mode` and `modules: [{ module, sort_order }]`. Still returns no billing state |
| `GET /api/flow/{slug}/connect` | v1.5 | Social links (`kind`, `url`) |
| `GET /api/flow/{slug}/menu` | v1.5 | Categories and items; prices as `amount_minor` + `currency_code` |
| `GET /api/flow/{slug}/rewards` | v2 | Badge and reward definitions for the outlet (no member data) |
| `POST /api/loyalty/wallet` | v2 | Create or resume a device wallet → `{ wallet_token }` |
| `GET /api/loyalty/wallet` | v2 | Progress, badges, rewards available — wallet-token auth |
| `POST /api/loyalty/wallet/code` | v2 | Rotating 6-digit visit code for the counter |
| `POST /api/staff/visit` | v2 | Staff PIN + customer code → records a visit |
| `POST /api/staff/redeem` | v2 | Staff PIN + reward code → burns it, single use |
| `/api/app/modules`, `/links`, `/menu`, `/loyalty/*` | v1.5 / v2 | Owner CRUD, owner session |
| `GET /api/app/services` · `POST /api/app/services/{id}/request` | v1.5 | Growth Services catalogue and request |
| `/api/admin/services/requests` | v1.5 | Admin pipeline (FR-115) |

**Firewall (CR-6):** `/api/loyalty/*` and `/api/staff/*` are a separate router
package. No handler there may read `sessions`, `events` or `private_feedback`, and
no review handler may read `loyalty_*`. Enforced by the import lint in SRS-21.6.

**New error codes:** `MODULE_DISABLED`, `STAFF_PIN_INVALID`, `VISIT_COOLDOWN`,
`REWARD_ALREADY_REDEEMED`, `WALLET_NOT_FOUND`.

---

## 2. Events

### `POST /api/events`

Accepts one or a batch. Called via `sendBeacon` where available so `handoff`
survives the redirect.

**Request**
```json
{
  "outlet_id": "uuid",
  "session_id": "uuid",
  "events": [
    { "type": "rating_selected", "payload": { "rating": 5 } },
    { "type": "tags_selected",   "payload": { "tag_ids": ["uuid"] } }
  ]
}
```

**Response 202** — `{ "accepted": 2 }`

Behaviour:
- `occurred_at` is **server-stamped**. Client timestamps are not trusted.
- Append-only. Never updates existing rows.
- Failure must never block the customer flow — the client buffers and retries
  (§5, [04-ARCHITECTURE.md](04-ARCHITECTURE.md)).
- `copy_tapped` triggers trial metering (see §2.1).
- Valid types are enumerated in [05-DATA-MODEL.md](05-DATA-MODEL.md) §5.
  Unknown types are rejected.

### 2.1 Trial metering side-effect

On `copy_tapped`:

1. Mark `sessions.completed = true`.
2. Dedup check on `device_hash` + phone within 24h (SRS-9.3).
3. If unique: `counted_for_trial = true`, increment `outlets.trial_flow_count`.
4. If `trial_flow_count >= 30` → `state = 'locked'`, fire template 3 once
   (guarded via `notifications`).
5. **The short URL keeps collecting** — trial-locking is dashboard-only
   (SRS-12.6). Collection stops only on `suspended`/`deactivated`.

---

## 3. Owner dashboard

All require an owner session. All are scoped server-side to the owner's own
outlet (SRS-15.6) — never by client-supplied outlet ID alone.

> **Revised 2026-09-18 (OD-16):** login is by **email + OTP delivered by email**,
> not phone + SMS. The phone number remains the account identity; only the login
> identifier and OTP channel changed.

### `POST /api/app/auth/otp/request`
```json
{ "email": "dr@smile.in" }
```
`202` — always, regardless of whether the address exists (no enumeration).
Rate-limited per email and per IP (SRS-15.2).

Sends one email containing **both** a 6-digit code and a single-use magic link
(SRS-10.1a). The code appears in the subject line so it is readable from the
notification shade.

### `POST /api/app/auth/otp/verify`
```json
{ "email": "dr@smile.in", "otp": "123456" }
```
`200` + session cookie. 6 digits, 10-minute expiry, max 5 attempts (SRS-10.2).
Session 30 days (SRS-10.3).

### `GET /api/app/auth/magic?token=...`

Magic-link equivalent of verify. Single-use, 10-minute expiry, same token
lifecycle as the numeric code. On success sets the session cookie and redirects
to `/app`.

Faster than the code on mobile — one tap instead of switching apps to copy —
which is the main thing SMS was buying
([14-OWNER-ACCESS.md](14-OWNER-ACCESS.md) §4.1).

### `GET /api/app/overview?range=30d`

**Response 200**
```json
{
  "state": "trial",
  "locked": false,
  "counters": { "scans": 143, "completed_flows": 28, "conversion_rate": 0.196 },
  "trial": { "flows_used": 28, "flows_limit": 30, "days_remaining": 12 },
  "google": {
    "baseline_rating": 4.3, "current_rating": 4.5,
    "baseline_review_count": 47, "current_review_count": 58,
    "last_polled_at": "2026-09-16T03:00:00Z"
  }
}
```

When `locked: true`, counters still return **real** values (FR-29, SRS-9.8) —
the paywall shows the owner what they are missing, not zeros.

### `GET /api/app/funnel?range=30d`
```json
{
  "steps": [
    { "step": "scan",        "sessions": 143, "drop_off": null },
    { "step": "flow_start",  "sessions": 118, "drop_off": 0.175 },
    { "step": "rating",      "sessions": 102, "drop_off": 0.136 },
    { "step": "tags",        "sessions": 84,  "drop_off": 0.176 },
    { "step": "draft",       "sessions": 71,  "drop_off": 0.155 },
    { "step": "copy",        "sessions": 28,  "drop_off": 0.606 },
    { "step": "handoff",     "sessions": 27,  "drop_off": 0.036 }
  ],
  "note": "No measurement exists beyond handoff."
}
```
The `note` is returned deliberately — the UI must surface the instrumentation
boundary rather than implying the funnel ends in published reviews (C-1).

### `GET /api/app/tags?range=30d`
```json
{
  "tags": [
    { "id": "uuid", "label": "friendly staff", "count": 52, "change": 0.12 },
    { "id": "uuid", "label": "on time",        "count": 41, "change": -0.05 }
  ]
}
```

### `GET /api/app/feedback?resolved=false&cursor=...`
```json
{
  "items": [
    {
      "id": "uuid", "rating": 2,
      "message": "Waiting time was long.",
      "contact": "9876543210",
      "resolved": false,
      "created_at": "2026-09-18T10:05:00Z"
    }
  ],
  "next_cursor": null
}
```

### `PATCH /api/app/feedback/{id}`
`{ "resolved": true }` → `200` with `resolved_at` set (FR-26).

### `GET /api/app/assets`
Print-ready downloads (FR-31).
```json
{
  "qr": { "svg": "https://.../qr.svg", "png": "https://.../qr-1024.png" },
  "receipt_footer": { "pdf": "https://..." },
  "handout_card":   { "pdf": "https://..." },
  "standee":        { "pdf": "https://..." }
}
```
Formats and print specs in [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md).

### `POST /api/app/billing/checkout`
```json
{ "plan": "monthly" }
```
**Response 200**
```json
{
  "provider": "razorpay",
  "mode": "mandate",
  "subscription_id": "sub_...",
  "checkout": { "key": "rzp_...", "amount_minor": 49900, "currency_code": "INR" },
  "fallback_available": true
}
```
`mode` is `mandate` for monthly, `one_time` for annual. If mandate creation
fails, the client retries with `{ "plan": "monthly", "mode": "one_time" }`
(C-4, SRS-12.3).

### `GET /api/app/billing/status`
```json
{
  "plan": "monthly", "status": "active",
  "mandate_status": "active",
  "current_period_end": "2026-10-18T00:00:00Z",
  "grace_until": null
}
```

---

## 3a. Public signup

Unauthenticated. Added 2026-09-18 (SRS-18).

### `GET /api/signup/places/search?q=&near=`

Business search for the signup form. Owner picks their own business.

```json
{
  "results": [
    {
      "place_id": "ChIJ...",
      "name": "Smile Dental Care",
      "address": "12 MG Road, Indore, MP 452001",
      "rating": 4.3,
      "review_count": 47
    }
  ]
}
```

Full address is returned deliberately — it is how the owner distinguishes their
clinic from a similarly named one, and it is what the founder re-checks at
approval (R-20).

### `POST /api/signup`

```json
{
  "business_name": "Smile Dental Care",
  "vertical": "dental",
  "owner_name": "Dr. A Sharma",
  "owner_phone": "+919876543210",
  "owner_email": "dr@smile.in",
  "place_id": "ChIJ...",
  "plan": "monthly",
  "placement_acknowledged": true
}
```

**Response 201**
```json
{
  "signup_id": "uuid",
  "checkout": { "provider": "razorpay", "mode": "mandate", "amount_minor": 49900, "currency_code": "INR" }
}
```

- `placement_acknowledged` must be `true` — the CR-4 checkbox (SRS-18.10)
- Duplicate email, phone, or Place ID → `409 DUPLICATE_BUSINESS` (SRS-18.5)
- The outlet is **not** created until payment succeeds

### `GET /api/signup/{signup_id}/status`

```json
{
  "state": "pending_approval",
  "submitted_at": "2026-09-18T10:00:00Z",
  "message": "Payment received. We're verifying your business details."
}
```

Polled by the post-payment status screen (SRS-18.8).

---

## 4. Admin

Founder-only, separate strong auth, not publicly linked (SRS-11.1, SRS-15.5).

### 4a. Approval queue

### `GET /api/admin/approvals`

```json
{
  "items": [
    {
      "outlet_id": "uuid",
      "business_name": "Smile Dental Care",
      "vertical": "dental",
      "owner": { "name": "Dr. A Sharma", "phone": "+91...", "email": "dr@smile.in" },
      "google_match": {
        "place_id": "ChIJ...",
        "name": "Smile Dental Care",
        "address": "12 MG Road, Indore, MP 452001",
        "rating": 4.3,
        "review_count": 47
      },
      "preview_url": "https://revyu.in/preview/uuid",
      "payment_status": "captured",
      "submitted_at": "2026-09-18T10:00:00Z",
      "age_hours": 3.5
    }
  ]
}
```

Sorted oldest first. `age_hours` over 24 raises an alert (SRS-19.9).

### `POST /api/admin/approvals/{outlet_id}/approve`

```json
{ "place_verified": true, "placement_confirmed": true, "notes": "Called, receipts confirmed" }
```

**Both flags must be `true`** (SRS-19.3). Generates slug + QR, renders print
assets, transitions to `trial`, sets `activated_at`, emails the owner.

**Response 200**
```json
{
  "state": "trial",
  "slug": "k7m2xq",
  "short_url": "https://revyu.in/r/k7m2xq",
  "activated_at": "2026-09-18T13:30:00Z"
}
```

### `POST /api/admin/approvals/{outlet_id}/request-info`

`{ "message": "Please confirm the clinic address — we found two matches." }`

Stays `pending_approval`, payment retained, owner emailed (SRS-19.6).

### `PATCH /api/admin/approvals/{outlet_id}/place`

`{ "place_id": "ChIJ..." }` — correct a wrong match before approving, without
owner action (SRS-19.8).

### `POST /api/admin/approvals/{outlet_id}/reject`

`{ "reason": "Could not verify business ownership", "refund": true }`

Sets `rejected`, records the reason, triggers refund (SRS-19.7). **No QR was
ever issued**, so nothing printed is invalidated.

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/outlets` | Create outlet (FR-33) |
| `GET /api/admin/places/search?q=&location=` | Place ID lookup (FR-34) |
| `POST /api/admin/outlets/{id}/validate-url` | Validate review URL before activation (FR-35) |
| `PUT /api/admin/outlets/{id}/tags` | Configure tag set (FR-36) |
| `POST /api/admin/outlets/{id}/activate` | Generate slug + QR, capture baseline (FR-37, FR-39) |
| `GET /api/admin/outlets/{id}/qr?format=svg\|png` | QR export (FR-38) |
| `PATCH /api/admin/outlets/{id}/state` | Manual state override, support (SRS-11.9) |

### `POST /api/admin/outlets/{id}/activate`

**Response 200**
```json
{
  "slug": "k7m2xq",
  "short_url": "https://revyu.in/r/k7m2xq",
  "qr": { "svg": "https://...", "png": "https://..." },
  "baseline": { "rating": 4.3, "review_count": 47 },
  "activated_at": "2026-09-18T10:00:00Z"
}
```
Preconditions: valid `google_review_url` (FR-35), at least one active tag,
`business_name` set. `activated_at` starts the 15-day trial clock (SRS-9.4).

---

## 5. Webhooks

### `POST /api/webhooks/razorpay`

**Signature-verified. All billing state changes originate here, never from a
client redirect** (SRS-12.8).

| Event | Action |
|---|---|
| `subscription.activated` | `status=active`, outlet → `active`, unlock dashboard |
| `subscription.charged` | Record payment, extend `current_period_end` |
| `payment.failed` | `status=past_due`, set `grace_until` (+7d), fire template 6 |
| `subscription.halted` | Grace expired → outlet **`suspended`, collection stops** (OD-18) |
| `subscription.cancelled` | `cancelled_at` set; access and collection to period end, then `deactivated` |
| `order.paid` | Annual or one-time fallback → `active`. **Reactivates collection** if previously suspended (SRS-12.9). |

Behaviour:
- Reject unverified signatures with `400`. Log and alert.
- **Idempotent** — providers retry. Dedup on `provider_payment_id`.
- Respond `200` fast; process asynchronously where possible.
- A webhook may flip the `collecting` flag and must invalidate the edge cache,
  but **must never make a valid slug fail to resolve** (C-6).

---

## 6. Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `OUTLET_NOT_FOUND` | 404 | Unknown slug or outlet |
| `INVALID_SESSION` | 400 | Session missing or expired |
| `RATE_LIMITED` | 429 | Throttled |
| `OTP_INVALID` | 400 | Wrong or expired OTP |
| `OTP_ATTEMPTS_EXCEEDED` | 429 | Max attempts reached |
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Session valid, outlet not owned |
| `DASHBOARD_LOCKED` | 402 | Trial threshold reached, payment required |
| `VALIDATION_FAILED` | 400 | Bad request body |
| `WEBHOOK_SIGNATURE_INVALID` | 400 | Verification failed |

> `402 DASHBOARD_LOCKED` applies **only** to `/api/app/*`. No public flow
> endpoint ever returns it, and `GET /r/{slug}` never returns an error for a
> valid slug in any state (C-6) — a suspended outlet serves the neutral screen
> with a `200`.

---

## 7. Rate limits

| Endpoint | Limit |
|---|---|
| `POST /api/flow/*/feedback` | 3 per session, 10 per IP per hour |
| `POST /api/events` | 100 per session per hour |
| `POST /api/app/auth/otp/request` | 3 per email per 15 min, 10 per IP per hour |
| `POST /api/app/auth/otp/verify` | 5 attempts per issued OTP |
| `GET /api/app/auth/magic` | Single-use token; 10 verification attempts per IP per hour |
| Admin | 1000 per hour |

`GET /r/{slug}` is **not** rate-limited per IP — a busy clinic's customers may
share a network, and blocking a scan is never acceptable.
