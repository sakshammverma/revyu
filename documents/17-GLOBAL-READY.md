# Global & Multi-Vertical Readiness

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

The product serves **any business, in any country, in any vertical**. Nothing in
the architecture assumes dental clinics or India.

**Launch scope is narrower than build scope, deliberately** (§5).

---

## 1. Build global, launch narrow

| | Build scope | v1 launch scope |
|---|---|---|
| Vertical | Any | Dental |
| Country | Any | India |
| Currency | Any | INR |
| Language | Any | English |
| Payment | Pluggable | Razorpay |

**Why they differ:** the kill metric needs a tight sample. Ten dental clinics in
one city answers "does this work?" Ten businesses across five verticals and three
countries answers nothing — every bad number has five possible explanations.

**Why build global anyway:** the cost of *not* hardcoding is near zero if done
from the start, and enormous later. A `currency` column costs nothing today; a
migration across every price, invoice, and payment record costs weeks.

> **Rule: no vertical, country, currency, or language is ever hardcoded.**
> Every one is a data field with a v1 default.

---

## 2. What must not be hardcoded

### 2.1 Vertical

Already handled — vertical templates are config files
([13-MULTI-TENANT.md](13-MULTI-TENANT.md) §4.4). Adding one is a JSON file, not
a deployment.

```
verticals/
  dental.json      ← v1 launch
  physio.json      restaurant.json    salon.json
  gym.json         retail.json        coaching.json
  hotel.json       auto_service.json  ...
```

Each defines: display label, tag set (label + phrase per tag), customer-flow copy
variants, print asset defaults.

**Test:** adding a vertical requires one file and zero code changes.

### 2.2 Country

New field `outlets.country_code` (ISO 3166-1 alpha-2). Drives:

| Concern | Varies by country |
|---|---|
| Currency | INR, USD, EUR, GBP… |
| Payment provider | Razorpay (IN), Stripe (most others) |
| Tax | GST, VAT, sales tax — rates and invoice requirements |
| Phone format | E.164 storage is universal; display and validation are not |
| Date/number format | Locale-driven |
| Legal pages | Privacy and consumer-protection requirements vary |
| Google review URL | Same format globally ✅ |

### 2.3 Currency

**Store `currency_code` (ISO 4217) alongside every monetary amount.** Never
assume.

`payments.amount_paise` is renamed **`amount_minor`** — the smallest unit of
whatever currency applies (paise for INR, cents for USD). Integer always, never
floats.

```
amount_minor: 49900, currency_code: "INR"  → ₹499.00
amount_minor: 2900,  currency_code: "USD"  → $29.00
```

> This rename is the single highest-value change in this document. A column
> literally named `paise` is a hardcoded assumption that would surface in every
> query, invoice, and display the day a second currency appears.

### 2.4 Language

Two distinct concerns, often conflated:

| | Who reads it | v1 |
|---|---|---|
| **Interface language** | UI chrome, buttons, labels | English |
| **Review draft language** | The published review | English |

`outlets.locale` (BCP 47, e.g. `en-IN`, `hi-IN`, `de-DE`) drives both.

**Draft language is the harder problem** and matters more. A review published in
the wrong language is worse than useless — tag phrases and connective grammar are
per-locale, not translatable strings. Grammar rules differ (gender agreement,
word order), so this is per-locale content authoring, not string substitution.

**v1:** `en` only, but the tag phrase structure is locale-keyed from day one so
adding `hi` is content work, not a schema change.

### 2.5 Payment provider

Pluggable, same pattern as the notification adapter
([10-ROADMAP.md](10-ROADMAP.md) §1.3):

```
PaymentProvider (interface)
      ├─► RazorpayProvider   ← v1, India
      ├─► StripeProvider     ← later, most other countries
      └─► ...
```

Selected by `outlets.country_code`. Everything provider-specific — mandate
semantics, webhook shapes, refund flows — lives behind the interface.

**v1 builds the interface and one implementation.** Not two.

---

## 3. Schema changes

Additions to [05-DATA-MODEL.md](05-DATA-MODEL.md).

### `outlets`

| Column | Type | Default | Notes |
|---|---|---|---|
| `country_code` | text, not null | `'IN'` | ISO 3166-1 alpha-2 |
| `locale` | text, not null | `'en-IN'` | BCP 47. Drives UI and draft language. |
| `timezone` | text, not null | `'Asia/Kolkata'` | IANA. Digests, "today", hour-of-day analytics. |

### `accounts`

| Column | Type | Default | Notes |
|---|---|---|---|
| `currency_code` | text, not null | `'INR'` | ISO 4217. Billing currency. |
| `payment_provider` | text, not null | `'razorpay'` | Resolved from country |

### `payments`

| Change | From | To |
|---|---|---|
| Rename | `amount_paise` | **`amount_minor`** |
| Add | — | `currency_code` (ISO 4217, not null) |

### New: `plans`

Pricing is currently hardcoded at ₹499 / ₹4,499. That does not survive a second
country.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text | `monthly` \| `annual` |
| `country_code` | text | Which market |
| `currency_code` | text | ISO 4217 |
| `amount_minor` | integer | Price in smallest unit |
| `active` | boolean | |

Lets you price per market without a deploy — and India pricing is unlikely to be
right for the US or EU.

### `tags`

`phrase` becomes locale-keyed:

```json
{ "en": "the clinic was clean", "hi": "क्लिनिक साफ़ था" }
```

v1 populates `en` only. The structure prevents a migration later.

---

## 4. Vertical-neutral language

The docs and UI currently say "clinic", "patient", "dental". Product-facing
copy must generalise.

| Instead of | Use |
|---|---|
| Clinic | Business |
| Patient | Customer |
| Doctor / dentist | Owner, or staff |
| Visit | Visit *(fine — works across verticals)* |
| Treatment | *(vertical-specific — from the tag set)* |

**Applies to:** the customer flow, the owner dashboard, the marketing site,
emails, and the admin console.

**Does not apply to:** vertical tag sets and copy variants, which are supposed to
be specific. A dental flow may say "treatment"; the *platform* may not.

> Docs written dental-first ([01-PRD.md](01-PRD.md),
> [08-GTM.md](08-GTM.md)) stay dental-first — they describe the **launch**, and
> that is correct.

---

## 5. Launch sequence

Expansion order, gated on evidence rather than ambition.

| Stage | Scope | Gate to proceed |
|---|---|---|
| **1. v1** | Dental, India, English, INR | **Kill metric ≥5% over 10 installs** |
| 2 | +3 verticals, India | 3 named dental references |
| 3 | +Hindi and one regional language | Evidence language is a conversion factor |
| 4 | +1 English-speaking country | India proven, Stripe integrated |
| 5 | Broad international | Everything above working |

> **Do not skip stage 1.** Every later stage assumes the core mechanic works —
> that customers scan, complete the flow, and paste into Google. Nobody knows
> that yet. Expanding before knowing multiplies the cost of being wrong.

---

## 6. Cost of this readiness

| Work | Effort |
|---|---|
| Three columns on `outlets`, two on `accounts` | ~1h |
| `amount_paise` → `amount_minor` + currency | ~1h |
| `plans` table replacing hardcoded prices | ~2h |
| Payment provider interface (one impl) | ~2h |
| Locale-keyed tag phrases | ~1h |
| Vertical-neutral copy pass | ~2h |
| **Total** | **~1 day** |

Against the cost of retrofitting after real customers exist: weeks, plus
migrating live payment records.

**Explicitly not built in v1:** Stripe, multi-currency display, translated UI,
non-English drafts, tax handling beyond GST, timezone-aware scheduling beyond
storing the field.

---

## 7. Requirements

| ID | Requirement |
|---|---|
| FR-69 | `country_code`, `locale`, `timezone` on every outlet; no hardcoded defaults in logic |
| FR-70 | Every monetary amount stored as `amount_minor` + `currency_code` |
| FR-71 | Pricing lives in `plans`, per country and currency — never in code |
| FR-72 | Payment provider is an interface; Razorpay is one implementation |
| FR-73 | Tag phrases are locale-keyed |
| FR-74 | Platform-facing copy is vertical-neutral ("business", "customer") |
| FR-75 | Adding a vertical requires one config file and no code change |

**Test:** a sample outlet created with `country_code: 'US'`, `currency_code:
'USD'`, `locale: 'en-US'` must flow through the entire system — signup, QR,
customer flow, dashboard — without a hardcoded INR or India assumption
surfacing. Payment may fail (no Stripe in v1); nothing else may.
