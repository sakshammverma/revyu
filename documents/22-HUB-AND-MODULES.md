# Hub, Modules & Growth Services

**Product:** Revyu
**Version:** Draft v1 *(added 2026-09-30)*
**Status:** Proposed — defaults below are recommendations pending founder
confirmation (OD-24 – OD-29 in [11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md)).
**Owns:** FR-76 – FR-112, CR-6, SRS-20 – SRS-24

This document is authoritative for everything that happens **after the QR is
scanned** beyond the review flow itself, and for the paid services Revyu sells to
owners. The review flow is unchanged and remains governed by
[16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) and
[03-COMPLIANCE.md](03-COMPLIANCE.md).

---

## 0. Two meanings of "services" — read this first

The brief uses "services" twice. The docs keep them strictly apart:

| Name | Who it serves | What it is |
|---|---|---|
| **Menu / Services** (module 3) | The **customer**, after scanning | The *business's own* menu or service list — dishes, treatments, packages, prices. Owner-edited. |
| **Growth Services** (§7) | The **owner**, in the dashboard | What *Revyu sells*: website building, landing video, content pipeline, Instagram automation, WhatsApp automation. |

> **Assumption to confirm (OD-24):** this reading is inferred. If "services" was
> meant to be only one of the two, say which — the other is cheap to drop.

---

## 1. The hub

### 1.1 Concept

One QR, one URL (`/r/{slug}`), unchanged. What it resolves to depends on how many
modules the outlet has enabled.

```
  QR ──► /r/{slug}
            │
            ├─ 1 module enabled (review only) ─► review flow directly   ← v1 behaviour
            │
            └─ 2+ modules enabled ─► HUB
                                      ├─ 1  Review          ─► /r/{slug}/review
                                      ├─ 2  Connect         ─► /r/{slug}/connect
                                      ├─ 3  Menu / Services ─► /r/{slug}/menu
                                      └─ 4  Rewards         ─► /r/{slug}/rewards
```

**The printed QR never changes** whichever mode is active. Switching an outlet
between direct and hub mode is a config change, not a reprint. This matters: the
kill-metric cohort can run in direct mode and move to hub later with no
customer-visible break (§8).

### 1.2 Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-76 | `outlets.hub_mode` is `direct` or `menu`. `direct` routes `/r/{slug}` straight to the review flow | Must |
| FR-77 | Hub lists only modules the owner has enabled; a hub with fewer than two modules is never rendered (falls back to `direct`) | Must |
| FR-78 | Module registry is data, not code: adding a module is a registry row plus a route (same principle as FR-75) | Should |
| FR-79 | Default order: Review, Connect, Menu/Services, Rewards. Owner may disable and reorder | Must |
| FR-80 | Hub tiles are **neutral and equal** — no copy on any tile or on the hub that links one module to another (CR-6) | Must |
| FR-81 | Hub renders within the customer-flow budget: < 150KB, < 2.0s FCP on 3G (NFR-1/2) | Must |
| FR-82 | Hub emits `hub_viewed` and `module_selected {module}` | Must |
| FR-83 | In `suspended` / `deactivated`, the **entire hub** serves the neutral screen (SRS-1.5b extends to all modules) — see OD-28 for the loyalty-wallet exception | Must |
| FR-84 | Every module page has a one-tap route back to the hub | Should |
| FR-85 | Hub interactions never consume trial credits. Only `copy_tapped` does (FR-42) | Must |

### 1.3 SRS

- **SRS-20.1** `GET /r/{slug}` evaluates state, then `hub_mode`, then enabled
  module count, in that order.
- **SRS-20.2** The `scan` event still fires before render (SRS-1.7). A second
  event, `hub_viewed`, fires only when the hub actually renders.
- **SRS-20.3** Deep links `/r/{slug}/review` etc. resolve in every state and obey
  the same suspension rules as the root.
- **SRS-20.4** The review sub-flow at `/r/{slug}/review` is byte-for-byte the flow
  specified in SRS-2 – SRS-8. **No hub-level logic enters it.** SRS-17.1a–g
  (CR-3 tests) run against it unchanged, and additionally against the hub → review
  path.
- **SRS-20.5** `SRS-2.2` ("single prompt and single primary action") applies to the
  review landing only. The hub is a menu by design.

---

## 2. Module 1 — Review flow

Unchanged. Listed for completeness.

- Entered from the hub tile or directly (`direct` mode).
- CR-1 through CR-5 apply exactly as before.
- **The hub tile label is neutral:** *"Share your experience"* — never "Leave a
  review and win…", never a star-count prompt (CR-4 pressure-framing rule).

---

## 3. Module 2 — Social connects

Links out to the business's own presences.

| ID | Requirement | Priority |
|---|---|---|
| FR-86 | Owner configures links: Instagram, Facebook, YouTube, WhatsApp chat, website, Google Maps, phone | Must |
| FR-87 | WhatsApp is a `wa.me` click-to-chat link — the **customer** initiates. No message is sent by us (OD-15 holds) | Must |
| FR-88 | Links open in a new context; each click emits `link_clicked {kind}` | Must |
| FR-89 | Only links the owner has filled in are shown. Empty module is auto-disabled (FR-77) | Must |
| FR-90 | URL validation: scheme allowlist (`https`, `tel`), no redirects through our domain | Must |
| FR-91 | **No follow-to-unlock.** No reward, badge, or benefit is conditioned on following, liking or subscribing — platform policies and our firewall both forbid it (CR-6) | Must |

Storage: `outlet_links` (§6).

---

## 4. Module 3 — Menu / Services (customer-facing)

A simple, owner-edited catalogue. Label is vertical-aware ("Menu" for a café,
"Services" for a clinic) via the vertical config file (FR-75) — never hardcoded.

| ID | Requirement | Priority |
|---|---|---|
| FR-92 | Owner manages categories and items: name, description, price, optional photo, availability flag | Must |
| FR-93 | Price is `amount_minor` + `currency_code` (FR-70). "Price on request" is a valid state | Must |
| FR-94 | Customer view is a fast, read-only, categorised list; no cart, no ordering, no payment in this phase | Must |
| FR-95 | Photos resized and served < 40KB each at the list size; lazy-loaded (FR-81 budget) | Must |
| FR-96 | Item-level `menu_item_viewed` is **not** emitted in v1 — `menu_viewed` only. Avoids event volume for little insight | Should |
| FR-97 | Menu copy must carry no health or outcome claims the owner has not entered — we render, we do not write | Must |
| FR-98 | Bulk entry by CSV or photo-of-menu is deferred; v1 is manual entry | Won't (later) |

**Out of scope here:** online ordering, table booking, appointment booking.
Each is a different product; note as candidates in
[10-ROADMAP.md](10-ROADMAP.md) §4.

---

## 5. Module 4 — Loyalty badges & rewards

The largest addition, and the only one that touches a compliance rule.

### 5.1 What it is

The owner defines **badges** a returning customer earns, and **rewards** — a
discount, a freebie, or a free service — unlocked by badges. Examples:

| Badge | Earned by | Reward the owner attaches |
|---|---|---|
| Regular | 5 visits | 10% off next visit |
| Insider | 10 visits | Free add-on (e.g. free scaling, free dessert) |
| Champion | 20 visits | Free service worth up to an owner-set value |

### 5.2 The compliance firewall — CR-6

> **CR-5 is unchanged and absolute:** nothing is tied to leaving a review.
> Loyalty is permitted **only** because it is structurally separate from review
> collection. CR-6 is what keeps it separate.

**CR-6 — Loyalty is firewalled from reviews.**

1. **Earning is never review-based.** Badges are earned by visits or purchases
   confirmed at the point of service. No review, rating, tag selection, copy tap,
   Google click, social follow, or feedback submission can earn, accelerate, or
   unlock anything. The rule-builder UI offers no such trigger — the option does
   not exist.
2. **No cross-reference in copy.** Loyalty screens never mention reviews, ratings,
   Google, or stars. Review screens never mention badges, rewards, discounts, or
   loyalty. The hub shows them as sibling tiles with no connecting language.
3. **No data join.** `loyalty_members` holds no `session_id`. `sessions` and
   `events` hold no member ID. No query, dashboard, export, or report may join
   loyalty activity to review activity, per outlet or per customer.
4. **No owner-side correlation.** The owner dashboard does not show "members who
   reviewed", "review rate of loyal customers", or any equivalent. Aggregate
   outlet-level numbers are shown in separate panels.
5. **No follow-to-earn** (FR-91) and no reward for any engagement other than
   paying for the business's own goods or services.
6. **Owner-facing statement.** Owners are told once, in writing, at module
   activation: *"Rewards must never be offered for reviews. If you mention
   reviews alongside rewards in your own signage or staff scripts, that is
   outside our system and puts your Google profile at risk."*

**Residual risk, stated plainly (R-27):** a hub that shows *Review* and *Rewards*
side by side lets a customer, or Google, draw an association the firewall does
not remove. The mitigations are neutral tile copy, separate routes, no shared
identifiers, and the owner's ability to disable either module. **Obtain
policy/legal review on hub layout before launching loyalty** — it is the same
category of exposure as counter placement (R-25) and lands on the customer's
Google profile, not ours.

**CI enforcement (SRS-21.6):** a lint test fails the build if any file under
`loyalty/` imports from or references `review`, `draft`, `feedback`, `tags`,
`rating` or `google`, or vice versa; and a schema test fails if a foreign key
links the two table groups.

### 5.3 Customer identity — a boundary change

Loyalty needs to recognise a returning customer. That contradicts the current
boundary — *"No customer identity"* ([05-DATA-MODEL.md](05-DATA-MODEL.md) §1,
NFR-9, OD-15). **This is a real change, not a detail.**

Recommended default (OD-25):

| Tier | Identity | PII held |
|---|---|---|
| **Default** | Anonymous device wallet — random token in the browser | None |
| **Optional "save my badges"** | Phone number + OTP | Phone only, stored hashed for lookup; encrypted for display |

Consequences to accept knowingly:

- Device wallet is lost if the browser data clears — hence the optional phone save.
- A phone number makes Revyu a holder of customer PII (Indian data protection
  obligations apply: minimum collection, stated retention, deletion on request).
- **No messaging to members (OD-15 holds).** Phone is for recovery only. No
  reminders, offers, or marketing from us. Whether the *owner* may message
  members is a separate question (OD-29) and is **off** by default.
- The owner sees counts and a redemption log, **not** a phone-number export.

### 5.4 How a visit is recorded

Staff confirmation is what makes a visit real. Without it a customer could farm
badges.

```
Customer opens Rewards ──► "Show at counter" screen with a rotating 6-digit code
        │
        ▼
Staff enters the code in the staff view  (or scans it with their own phone)
        │
        ▼
Visit recorded ──► progress updates ──► badge awarded when threshold met
```

- Staff authenticate with a **staff PIN** set by the owner — not an owner login
  (owners will not hand over OTP access).
- One visit per member per owner-set cool-down (default 12h).
- Redemption: customer shows an unlocked reward; staff taps *Redeem* with the PIN;
  a one-time code is burned. Owner sees the redemption log.
- This is **staff supervision of a loyalty action, not of a review action** — CR-4
  (no staff observation of the review flow) is unaffected, and staff must never
  be present for or prompt the review flow as part of it.

### 5.5 Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-99 | Owner defines badges: name, icon from a fixed set, threshold (visits), and an attached reward | Must |
| FR-100 | Reward types: `percent_discount`, `amount_discount`, `freebie`, `free_service`; each with owner-written terms and optional expiry | Must |
| FR-101 | **No review-based trigger exists** anywhere in rule configuration (CR-6.1) | Must |
| FR-102 | Customer wallet: progress, badges earned, rewards available, rewards used | Must |
| FR-103 | Anonymous device wallet by default; optional phone + OTP save (OD-25) | Must |
| FR-104 | Staff PIN view: enter a customer's code to record a visit; redeem a reward | Must |
| FR-105 | Visit cool-down per member, owner-configurable, default 12h | Must |
| FR-106 | Redemption burns a single-use code; double redemption is impossible | Must |
| FR-107 | Owner sees: members, visits, badges awarded, rewards redeemed — outlet-level, separate from review panels (CR-6.4) | Must |
| FR-108 | Reward liability is the **owner's**: we record, we do not fund or guarantee a reward | Must |
| FR-109 | Member deletion on request removes the member and ledger rows | Must |
| FR-110 | Loyalty ledger is append-only; badge state is derived | Must |
| FR-111 | Owner must acknowledge the CR-6.6 statement before first activation | Must |
| FR-112 | Rewards visible in `suspended` state per OD-28 | Should |

---

## 6. Data model additions

Full column detail to be folded into [05-DATA-MODEL.md](05-DATA-MODEL.md) at build
time. All money is `amount_minor` + `currency_code` (FR-70).

```
outlets ──1:N── outlet_modules            (registry rows: which modules, order, enabled)
        ├─1:N── outlet_links              (social connects)
        ├─1:N── menu_categories ──1:N── menu_items
        │
        │   ── loyalty side: NO FK to sessions / events / private_feedback ──
        ├─1:N── loyalty_badges ──1:1── loyalty_rewards
        ├─1:N── loyalty_members ──1:N── loyalty_ledger ──► redemptions
        └─1:N── staff_pins
```

| Table | Key columns |
|---|---|
| `outlets` (add) | `hub_mode` (`direct`\|`menu`), default `direct` |
| `outlet_modules` | `outlet_id`, `module` (`review`\|`connect`\|`menu`\|`rewards`), `enabled`, `sort_order` |
| `outlet_links` | `outlet_id`, `kind`, `url`, `sort_order` |
| `menu_categories` | `outlet_id`, `name`, `sort_order` |
| `menu_items` | `category_id`, `name`, `description`, `amount_minor?`, `currency_code`, `price_on_request`, `photo_url?`, `available` |
| `loyalty_badges` | `outlet_id`, `name`, `icon`, `visits_required`, `sort_order` |
| `loyalty_rewards` | `badge_id`, `type`, `value_minor?`, `percent?`, `terms`, `expires_days?` |
| `loyalty_members` | `outlet_id`, `device_token_hash`, `phone_hash?`, `phone_enc?`, `created_at` — **no `session_id`** |
| `loyalty_ledger` | append-only: `member_id`, `kind` (`visit`\|`badge_awarded`\|`reward_redeemed`), `ref_id`, `staff_pin_id`, `created_at` |
| `staff_pins` | `outlet_id`, `label`, `pin_hash`, `active` |

**Events (shared `events` table, module-level only):**

| Type | Emitted when | Payload |
|---|---|---|
| `hub_viewed` | Hub renders | `{ modules: [...] }` |
| `module_selected` | A hub tile tapped | `{ module }` |
| `link_clicked` | A connect link tapped | `{ kind }` |
| `menu_viewed` | Menu page rendered | `{}` |
| `rewards_viewed` | Rewards page rendered | `{}` |

Loyalty actions (visits, awards, redemptions) live **only** in `loyalty_ledger`,
never in `events`. `rewards_viewed` carries a session ID like every event, but no
member ID — so it cannot be joined to a member (CR-6.3).

---

## 7. Growth Services — what Revyu sells to owners

Sold from the owner dashboard (a **Services** tab) and from the marketing site.
Distinct from the ₹499/mo subscription: **separate SKUs, separately priced**
(OD-27 — OD-6's flat price governs the core subscription only).

| # | Service | What the owner gets |
|---|---|---|
| S1 | **Website building** | A fast, mobile-first site for the business, fed by the same menu/services, links and hours as the hub. Revyu-hosted on a subdomain or the owner's domain. |
| S2 | **Landing video** | One produced video for the business, for the site and social. |
| S3 | **Content management pipeline** | Planned, approved, scheduled social content — the owner approves, we produce and schedule. |
| S4 | **Instagram automation** | Scheduled publishing; comment and DM auto-replies via the **official** Instagram API. |
| S5 | **WhatsApp automation** | Template-based messaging to the owner's **consented** contacts via the official WhatsApp Business Platform. |

### 7.1 Delivery model — concierge first

Nothing here is built as self-serve software initially.

| Phase | What exists | Fulfilment |
|---|---|---|
| **A — Lead capture** | Services tab, catalogue, "Request this" form, admin pipeline view | Founder quotes and delivers manually |
| **B — Productise the repeatable** | Content pipeline tool (S3), website generator from outlet data (S1) | Mixed: tooling plus human review |
| **C — Automation** | S4 and S5 as managed integrations | Per-client setup, platform approvals |

Phase A is a form, a table and an admin list — days, not weeks, and it tests
demand before anything heavy is built.

### 7.2 Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-113 | `service_catalog` is data: name, description, price model, deliverables, lead time. Adding a service is a row | Must |
| FR-114 | Owner can request a service; creates a `service_requests` row and notifies admin | Must |
| FR-115 | Admin pipeline: `requested → quoted → accepted → in_progress → delivered` (or `declined`/`cancelled`) | Must |
| FR-116 | Service pricing is per SKU, in `amount_minor` + `currency_code`; one-time and recurring both supported | Must |
| FR-117 | Payment reuses the `PaymentProvider` interface (FR-72) | Must |
| FR-118 | Third-party credentials (Instagram, WhatsApp) are encrypted at rest, scoped minimally, revocable by the owner in one tap | Must |
| FR-119 | Content pipeline states: `idea → drafting → pending_approval → approved → scheduled → published` (or `rejected`). **Nothing publishes without owner approval** | Must |
| FR-120 | Every automated send/post is logged and visible to the owner | Must |

### 7.3 Service guardrails (SG)

These extend — never relax — the CR rules.

| ID | Rule | Why |
|---|---|---|
| SG-1 | **Official APIs only.** Meta Graph / Instagram Messaging API and WhatsApp Business Platform via an approved BSP. No scraping, no unofficial libraries, no session automation | Same ban-risk reasoning as [10-ROADMAP.md](10-ROADMAP.md) §1.2 — and here the asset at risk is the *client's* account |
| SG-2 | **Consent and opt-out.** WhatsApp automation sends only to contacts with recorded opt-in, template-approved, with opt-out honoured | Platform rules and Indian messaging norms |
| SG-3 | **No review solicitation with an incentive** in any automated message or post, ever (CR-5) | Automation multiplies the exposure |
| SG-4 | **Review requests, if automated at all, go to everyone or no one** — never to a segment identified as satisfied (the OD-15 narrow rule) | CR-3 adjacency |
| SG-5 | **The content pipeline never produces reviews, testimonials, or "customer quotes"** attributed to anyone. Merchant-authored review-like content is CR-1's problem in another costume | CR-1 |
| SG-6 | **No purchased followers, engagement, or fake accounts** | Account and legal risk to the client |
| SG-7 | **No medical, financial, or outcome guarantees** in produced content (same claim limits as [03-COMPLIANCE.md](03-COMPLIANCE.md) sales constraints) | Regulated verticals |
| SG-8 | **Reward content follows CR-6.** A produced post may advertise the loyalty programme; it must not mention reviews in the same piece | CR-6.2 |

### 7.4 Consequences for earlier decisions

| Decision | Effect |
|---|---|
| **OD-9** (WhatsApp API deferred) | Holds for *Revyu's own* owner notifications. S5 is a separate, per-client use of the WhatsApp Business Platform and brings the BSP lead time (C-3) back — but only for clients who buy S5, and only at Phase C. It is **not** on the v1 critical path. |
| **OD-15** (no customer messaging) | Holds for **Revyu**: we never message a business's customers. S5 is the **owner** messaging their own consented contacts, using our tooling. The distinction is documented, not assumed. |
| **OD-6** (flat ₹499) | Holds for the subscription. Services are extra SKUs. |
| **NFR-9** (no customer PII) | Amended for loyalty only — OD-25. |

---

## 8. Measurement — what the hub does to the kill metric

The kill metric is *scan → completed flow*
([07-METRICS.md](07-METRICS.md) §2). A hub puts a choice between scan and review,
and people who scan for the menu were never going to review. **Left alone, the
hub makes the kill metric fall without the product getting worse.**

| Outlet mode | Kill metric | Also report |
|---|---|---|
| `direct` | `scan → copy_tapped` — **unchanged** | — |
| `menu` (hub) | `module_selected(review) → copy_tapped` | `scan → module_selected(review)` as **review take-rate** |

**Recommendation (OD-26):** the ten-install kill-metric cohort runs in **`direct`
mode**. The hub is a separate, later release. Because the QR is identical, moving
an outlet to hub mode later costs nothing — but mixing modes inside the validation
window would confound the one number the business is a bet on.

Review take-rate is a new metric with no baseline. Do not set a kill band on it
until there is data; treat it as a variable to optimise (tile order, tile copy).

---

## 9. Build plan

Aligned with [10-ROADMAP.md](10-ROADMAP.md) §2 (v1.5), §3 (v2) and the rule *no v2 work before
the kill-metric decision*.

| Release | Contents | When |
|---|---|---|
| **v1** | Unchanged build. **Schema reserves** `hub_mode` (default `direct`), `outlet_modules`, and module-aware routes (`/r/{slug}/review`) so nothing needs migrating later | Weeks 1–3 |
| **v1.5** | Hub UI, Connect, Menu/Services, Growth Services **Phase A** (catalogue + request form + admin pipeline) | During the 30-day validation window, **capped at ~1 week**; ships behind `hub_mode` so validation outlets stay on `direct` |
| **v2** | **Loyalty (module 4)** — after the kill-metric decision, after policy/legal review of hub layout (R-27) | Post-decision, slotted after review response drafting |
| **v2.5** | Growth Services **Phase B** — content pipeline, website generator | Once Phase A shows demand |
| **v3** | Growth Services **Phase C** — Instagram and WhatsApp automation; BSP and Meta app-review applications started at the Phase B → C gate, not before | After PMF |

Why loyalty waits: it is the only module that carries compliance exposure (R-27),
introduces customer PII (OD-25), and needs staff-side UI. None of that is worth
carrying while the core bet is unproven.

---

## 10. Acceptance criteria

1. With one module enabled, `/r/{slug}` serves the review flow directly and every
   SRS-17.1 test passes unchanged.
2. With two or more modules, the hub renders within budget, and hub → review
   passes SRS-17.1a–g.
3. Changing `hub_mode` never changes the slug or the QR.
4. `suspended` outlets serve the neutral screen on the hub and every module route.
5. **CR-6 tests:** lint and schema tests in SRS-21.6 pass; no loyalty table has an
   FK to a review table; no loyalty string contains a review term and vice versa.
6. A badge cannot be awarded without a staff-confirmed visit; a reward cannot be
   redeemed twice.
7. Menu prices render from `amount_minor` + `currency_code`; nothing is hardcoded
   to ₹.
8. No automated send, post or reply is possible without a logged opt-in (S5) or
   owner approval (S3).
