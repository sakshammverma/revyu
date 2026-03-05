# Data Model

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18
**Database:** Postgres

---

## 1. Design notes

- **Multi-outlet ready from day one.** v1 enforces one outlet per account in
  application logic, but `outlets.account_id` makes chains a dashboard problem
  later, not a migration.
- **Events are append-only.** Never updated, never deleted before retention
  expiry. The funnel is derived from them; mutating them corrupts history.
- **No customer identity.** Session IDs are anonymous. The only customer
  personal data in the system is what someone voluntarily types into private
  feedback. *(Amended 2026-09-30, proposed OD-25: the v2 loyalty module adds
  `loyalty_members` — anonymous device token by default, optional hashed phone.
  It is firewalled from sessions, events and feedback by CR-6: no FK, no shared
  ID. See [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5–6.)*
- **No review text table exists, by design.** CR-1 prohibits it. A CI check
  fails the build if one appears (SRS-17.3). `tags.phrase` holds a short
  fragment mapping to one customer-selected attribute — not a review.

---

## 2. Entity overview

```
accounts ──1:N── outlets ──1:N── tags
                    │
                    ├──1:N── sessions ──1:N── events
                    │
                    ├──1:N── private_feedback
                    │
                    ├──1:N── place_snapshots
                    │
                    └──1:1── subscriptions ──1:N── payments
```

> **Additions, 2026-09-30.** `outlets.hub_mode`, `outlet_modules`,
> `outlet_links`, menu tables, loyalty tables, and services tables are specified
> in [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §6 and §7. `outlets.hub_mode`
> and `outlet_modules` belong in the **first migration** (reserved, default
> `direct`); the rest land with their release.

---

## 3. Tables

### 3.1 `accounts`

The billing entity. One per business owner.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_phone` | text, unique, not null | E.164. **Account identity** and WhatsApp/click-to-chat destination. |
| `owner_email` | text, **unique, not null** | **Login identifier and OTP destination** (OD-16). Also the primary notification channel. |
| `owner_name` | text | |
| `otp_channel` | text, not null, default `'email'` | `email` \| `sms`. Per-account, so SMS is a later adapter not an auth rewrite (SRS-10.1c). |
| `currency_code` | text, not null, default `'INR'` | ISO 4217. Billing currency. |
| `payment_provider` | text, not null, default `'razorpay'` | Resolved from outlet country ([17-GLOBAL-READY.md](17-GLOBAL-READY.md) §2.5) |
| `created_at` | timestamptz, not null | |
| `updated_at` | timestamptz, not null | |

**Indexes:** unique on `owner_phone`; **unique on `owner_email`**.

> **Changed 2026-09-18 (OD-16):** `owner_email` was optional; it is now required
> and unique because it is the login identifier. An account cannot exist without
> one — the owner would be unable to reach their dashboard. Capturing a working
> email is now mandatory at install ([08-GTM.md](08-GTM.md) §3.2).
>
> `owner_phone` is unchanged and still the account identity. Only the *login
> identifier* and *OTP channel* moved to email.

---

### 3.2 `outlets`

A single physical location. The unit of QR generation, metering, and billing.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK → accounts | |
| `slug` | text, unique, not null | 6–8 chars, URL-safe, non-sequential. The short URL. |
| `business_name` | text, not null | Displayed to the customer. |
| `vertical` | text, not null | Any configured vertical — config-driven, not an enum ([17-GLOBAL-READY.md](17-GLOBAL-READY.md) §2.1) |
| `country_code` | text, not null, default `'IN'` | ISO 3166-1 alpha-2. Drives payment provider, tax, formats. |
| `locale` | text, not null, default `'en-IN'` | BCP 47. Drives UI **and draft** language. |
| `timezone` | text, not null, default `'Asia/Kolkata'` | IANA. Digests, "today", hour-of-day analytics. |
| `logo_url` | text | |
| `google_place_id` | text | |
| `google_review_url` | text | Validated before activation (FR-35). |
| `state` | text, not null | See §4. |
| `source` | text, not null | `self_serve` \| `admin` \| `bulk_import`. Which path created it. |
| `submitted_at` | timestamptz | Self-serve signup completed. Starts the approval SLA. |
| `approved_at` | timestamptz | Founder approval. |
| `approved_by` | text | Admin identity, for audit. |
| `rejection_reason` | text | Shown to the owner if `rejected`. |
| `place_verified` | boolean, not null, default false | **Founder confirmed the Google match is correct** (R-20). |
| `placement` | text | `receipt` \| `card` \| `standee` \| `sticker`. Declared at approval; segments the metrics. |
| `placement_confirmed` | boolean, not null, default false | Owner named a placement and an owner for it (CR-4, OD-5). |
| `activated_at` | timestamptz | Starts the 15-day trial clock. |
| `trial_flow_count` | integer, not null, default 0 | Deduped completed flows. |
| `baseline_rating` | numeric(2,1) | Captured at activation (FR-39). |
| `baseline_review_count` | integer | Captured at activation. |
| `created_at` | timestamptz, not null | |
| `updated_at` | timestamptz, not null | |

**Indexes:** unique on `slug`; index on `account_id`; index on `state`.

> ⚠️ `state` is read by the short URL path **only to choose what to serve** —
> full flow vs. neutral screen (§4.1a, SRS-1.5a/b). Resolution itself never
> fails: a valid slug never returns a dead link or an error in any state (C-6).
> Dashboard access control reads `state` separately.

---

### 3.3 `tags`

The per-outlet chip vocabulary. Ordered, editable per outlet, seeded by vertical.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `outlet_id` | uuid FK → outlets | |
| `label` | jsonb, not null | Chip text per locale: `{"en": "friendly staff"}` |
| `phrases` | jsonb, not null | **≥4 variants per locale** for draft assembly: `{"en": ["the staff were friendly", "everyone was welcoming", …]}` (FR-57, FR-73) |
| `sort_order` | integer, not null | |
| `active` | boolean, not null, default true | |

**Indexes:** index on `(outlet_id, sort_order)`.

> **Compliance note (CR-1):** `phrase` is a fragment corresponding to exactly
> one attribute the customer explicitly selected. It is not review text and
> must never grow into a sentence expressing anything the customer did not
> choose. 6–10 tags per outlet, 12 maximum (SRS-4.5).

---

### 3.4 `sessions`

One customer's pass through the flow.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Anonymous. Generated client-side. |
| `outlet_id` | uuid FK → outlets | |
| `device_hash` | text | Fingerprint. Trial dedup only (SRS-9.2). |
| `rating` | smallint | 1–5. Null until selected. |
| `selected_tag_ids` | uuid[] | |
| `completed` | boolean, not null, default false | True when `copy_tapped` fires. |
| `counted_for_trial` | boolean, not null, default false | False if deduped. |
| `started_at` | timestamptz, not null | |
| `completed_at` | timestamptz | |

**Indexes:** index on `(outlet_id, started_at)`; index on
`(outlet_id, device_hash, started_at)` for dedup lookup.

> **Privacy (SRS-16.3):** `device_hash` exists solely for trial dedup. It is not
> linked to identity and is not used for cross-outlet tracking.

---

### 3.5 `events`

Append-only. The funnel is derived entirely from this table.

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `outlet_id` | uuid FK → outlets, not null | Denormalised for query speed. |
| `session_id` | uuid | Null for `scan` before session creation. |
| `type` | text, not null | See §5. |
| `payload` | jsonb | Rating value, tag IDs, etc. |
| `occurred_at` | timestamptz, not null | **Server-stamped.** Client time not trusted. |

**Indexes:** index on `(outlet_id, occurred_at)`; index on
`(outlet_id, type, occurred_at)`; index on `session_id`.

**Retention:** 24 months (NFR-10), pruned monthly.

---

### 3.6 `private_feedback`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `outlet_id` | uuid FK → outlets | |
| `session_id` | uuid FK → sessions | |
| `rating` | smallint | The rating given in the same session. |
| `message` | text, not null | |
| `contact` | text | Optional, customer-supplied. |
| `resolved` | boolean, not null, default false | |
| `resolved_at` | timestamptz | |
| `created_at` | timestamptz, not null | |

**Indexes:** index on `(outlet_id, created_at desc)`; index on
`(outlet_id, resolved)`.

> **Privacy (SRS-16.4):** `message` and `contact` may contain personal data.
> Retention must be stated in the privacy policy and deletion honoured on
> request.
>
> **Compliance (CR-3):** feedback is recorded at **all** ratings. The presence
> of a row here must never suppress the Google link for that session.

---

### 3.7 `place_snapshots`

Weekly Google Places poll. The before/after view (FR-24).

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `outlet_id` | uuid FK → outlets | |
| `rating` | numeric(2,1) | |
| `review_count` | integer | |
| `polled_at` | timestamptz, not null | |

**Indexes:** index on `(outlet_id, polled_at desc)`.

> **Never used for trial metering** (C-2, SRS-14.3). Review publication is not
> attributable per-customer. This table is a lagging business indicator only.

---

### 3.8 `subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK → accounts | |
| `plan` | text, not null | `monthly` \| `annual` |
| `status` | text, not null | See §4. |
| `razorpay_subscription_id` | text | Null for one-time annual. |
| `mandate_status` | text | `pending` \| `active` \| `failed` \| `not_applicable` |
| `current_period_end` | timestamptz | |
| `grace_until` | timestamptz | Set on payment failure (SRS-12.5). |
| `cancelled_at` | timestamptz | |
| `created_at` | timestamptz, not null | |

**Indexes:** index on `account_id`; index on `status`.

---

### 3.9 `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `subscription_id` | uuid FK → subscriptions | |
| `provider_payment_id` | text, unique | Provider-agnostic. Was `razorpay_payment_id`. |
| `amount_minor` | integer, not null | **Smallest currency unit** — paise for INR, cents for USD. Integer always, never floats. *(Renamed from `amount_paise` — see [17-GLOBAL-READY.md](17-GLOBAL-READY.md) §2.3.)* |
| `currency_code` | text, not null | ISO 4217. **Always stored beside the amount.** |
| `status` | text, not null | `created` \| `captured` \| `failed` \| `refunded` |
| `webhook_verified` | boolean, not null, default false | SRS-12.8 |
| `created_at` | timestamptz, not null | |

**Indexes:** unique on `provider_payment_id`; index on `subscription_id`.

---

### 3.9a `plans`

Pricing per market. **Never hardcode prices in application code** (FR-71).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text, not null | `monthly` \| `annual` |
| `country_code` | text, not null | Which market this price applies to |
| `currency_code` | text, not null | ISO 4217 |
| `amount_minor` | integer, not null | Smallest unit |
| `active` | boolean, not null, default true | |

**Indexes:** unique on `(code, country_code, active)` where active.

v1 seed:

| code | country | currency | amount_minor | displays as |
|---|---|---|---|---|
| `monthly` | IN | INR | 49900 | ₹499 |
| `annual` | IN | INR | 449900 | ₹4,499 |

> India pricing is unlikely to be right for other markets. A table makes
> repricing per country a data change rather than a deploy.

---

### 3.10 `notifications`

Delivery log. Debugging and duplicate prevention.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK → accounts | |
| `outlet_id` | uuid FK → outlets | Nullable. |
| `template` | text, not null | One of the six (SRS-13.2). |
| `channel` | text, not null | `whatsapp` \| `email` |
| `status` | text, not null | `queued` \| `sent` \| `delivered` \| `failed` |
| `error` | text | |
| `sent_at` | timestamptz | |

**Indexes:** index on `(account_id, sent_at desc)`; index on
`(outlet_id, template)` — used to ensure the trial-threshold message fires once.

---

## 4. State machines

### 4.1 `outlets.state`
<!-- ANCHOR: outlet-states -->


| State | Meaning | Customer flow | Dashboard |
|---|---|---|---|
| `draft` | Created by admin (bulk import / prospecting). Preview only, no QR issued. | 👁 preview | n/a |
| `pending_approval` | **Self-serve signup, paid, awaiting founder verification.** | ⏸ not yet | ⏳ "verifying" screen |
| `trial` | Active trial. | ✅ live | ✅ open |
| `locked` | Trial threshold hit, unpaid. | ✅ **live** | 🔒 locked |
| `active` | Paid. | ✅ live | ✅ open |
| `past_due` | Payment failed, in grace (7d). | ✅ live | ✅ open |
| `rejected` | Could not be verified. Refund issued. | ❌ never issued | 🔒 with explanation |
| `suspended` | **Grace expired, unpaid.** | ⏹ **neutral screen, collection stops** | 🔒 locked |
| `deactivated` | Cancelled or closed. | ⏹ **neutral screen, collection stops** | 🔒 locked |

```
                    ┌─ admin creates ─► draft ──approve/activate──┐
                    │                     │                       │
                    │                (preview only)               ▼
  self-serve signup ─► pending_approval ──approve──────────► trial ──threshold──► locked
       + payment            │                                  │                    │
                            └──reject──► rejected              └────pay─────────► active
                                         (refund)                                   │
                                                       past_due ◄─payment failed────┤
                                                       (7d grace)                   │
                                                          │                         │
                                                          ├──payment ok─────────────┘
                                                          │
                                                          └──grace expired──► suspended
                                                                                 │
                                                                    pay ─────────┘
                                                                    (reactivates)

   any live state ──cancel──► deactivated ──resubscribe──► active
```

> **`pending_approval` is the only state where a *paid* outlet is not live.**
> That is deliberate — it is the gate preventing a wrong Google Place ID from
> sending a clinic's patients to review a stranger's business (R-20), and it is
> where the placement conversation happens.
>
> **No QR is issued until approval.** Nothing is printed, so nothing breaks when
> an outlet is rejected.

### 4.1a Collection stops when payment stops
<!-- ANCHOR: collection-stops -->



> **Revised 2026-09-18.** The earlier design kept the customer flow fully live in
> every state including `deactivated`. That was wrong: a clinic could pay for two
> months, cancel, and keep collecting reviews indefinitely — auditing results
> manually on their own Google profile and never paying again. The service has no
> leverage if the core benefit survives cancellation.

| Payment state | Customer flow | Collection |
|---|---|---|
| `trial`, `active`, `past_due` | Full flow | ✅ Yes |
| `locked` (trial threshold, unpaid) | Full flow | ✅ **Yes — still collecting** |
| `suspended`, `deactivated` | Neutral screen | ❌ **Stops** |

**Two distinct gates, and they are not the same thing:**

- **`locked`** — trial threshold reached. The *dashboard* locks; collection
  continues. The owner is shown the numbers they are missing and asked to pay.
  This is a conversion mechanic and it depends on the QR still working.
- **`suspended` / `deactivated`** — the customer relationship ended. Collection
  stops.

**The neutral screen is not an error.** The QR resolves, shows the business name,
and displays a brief message — no broken link, no server error, no confusing
failure in a patient's hand. It simply does not collect. It can be reactivated
instantly on payment, and any printed material starts working again the moment
they pay.

**Grace before suspension:** `past_due` runs a 7-day grace period with the flow
fully live, so a failed UPI mandate does not kill a working clinic mid-week
(SRS-12.5). Suspension only follows a genuine, sustained non-payment.

> **The invariant that survives:** a valid slug **always resolves** — never a
> dead link, never an error, in any state (C-6, FR-52, SRS-1.5).
>
> **What changed:** resolution now serves either the full flow or a neutral
> screen depending on `collecting` state (FR-53). The guarantee is about never
> breaking, not about collecting forever.

### 4.2 `subscriptions.status`

`pending` → `active` → (`past_due` ⇄ `active`) → `cancelled` → `expired`

---

## 5. Event taxonomy

The funnel, in order. Each is one row in `events`.

| Type | Emitted when | Payload |
|---|---|---|
| `scan` | Short URL resolved, before render | `{ referrer }` |
| `flow_start` | First customer interaction on landing | `{}` |
| `rating_selected` | Star chosen | `{ rating }` |
| `tags_selected` | Advancing from the tag screen | `{ tag_ids }` |
| `draft_viewed` | Draft screen rendered | `{ tag_count }` |
| `draft_edited` | Customer modifies the draft text | `{ changed: true }` |
| `copy_tapped` | Copy action fires — **completes the flow** | `{ length }` |
| `handoff` | Immediately before redirect to Google | `{}` |
| `private_feedback_opened` | Private box opened | `{ rating }` |
| `private_feedback_submitted` | Private feedback sent | `{ rating }` |
| `flow_abandoned` | Derived, not emitted — session with no `copy_tapped` | — |
| `hub_viewed` | *(v1.5)* Hub renders — only when ≥2 modules enabled | `{ modules }` |
| `module_selected` | *(v1.5)* Hub tile tapped | `{ module }` |
| `link_clicked` | *(v1.5)* Social connect link tapped | `{ kind }` |
| `menu_viewed` | *(v1.5)* Menu/Services page rendered | `{}` |
| `rewards_viewed` | *(v2)* Rewards page rendered — no member ID, ever | `{}` |

**The instrumentation boundary:** `handoff` is the last observable event.
Sign-in, paste, and submit all occur on Google's UI (C-1). No event can exist
beyond this point, and any metric implying otherwise is false.

---

## 6. Derived metrics

Computed on read at v1 volume. Pre-aggregate past ~200 outlets.

| Metric | Derivation |
|---|---|
| **Scan → completed flow** (kill metric) | `count(copy_tapped distinct session) / count(scan)` |
| Step drop-off | Distinct sessions per event type, in funnel order |
| Tag frequency | Unnest `tags_selected.payload.tag_ids`, group, count |
| Rating distribution | Group `rating_selected.payload.rating` |
| Private feedback rate | `count(private_feedback_submitted) / count(copy_tapped)` |
| Review delta | Latest `place_snapshots.review_count` − `outlets.baseline_review_count` |
| Rating delta | Latest `place_snapshots.rating` − `outlets.baseline_rating` |

---

## 7. Tag seed sets by vertical

Seeded at outlet creation, editable per outlet (FR-36). Starting sets for the
launch vertical and expansion verticals.

**Dental** — launch vertical
`clean clinic` · `painless treatment` · `explained clearly` · `on time` ·
`friendly staff` · `fair pricing` · `modern equipment` · `good follow-up`

**Physiotherapy**
`clear guidance` · `felt better` · `patient therapist` · `on time` ·
`clean facility` · `good equipment` · `fair pricing` · `personalised plan`

**Gym**
`clean` · `good equipment` · `helpful trainers` · `not crowded` ·
`good hours` · `fair pricing` · `good atmosphere` · `changing rooms`

**Salon**
`skilled stylist` · `clean` · `friendly staff` · `on time` ·
`good products` · `fair pricing` · `relaxing` · `listened to me`

**Coaching**
`clear teaching` · `helpful faculty` · `good material` · `small batches` ·
`regular tests` · `fair fees` · `doubt solving` · `good results`

> These are **tags**, not reviews. Each maps to one attribute the customer
> selects. The corresponding `phrase` values are short fragments joined by
> neutral connectives at runtime (CR-1). No complete review sentence is ever
> stored.
