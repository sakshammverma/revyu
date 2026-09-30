# Hub, Loyalty & Growth Services — Build Plan

**Product:** Revyu
**Date:** 2026-10-01
**Status:** Plan. Implements [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) (the *what*)
against the code as it stands in [23-STATUS-AND-PLAN.md](23-STATUS-AND-PLAN.md) (the *where*).
If this doc and 22 disagree on a rule, **22 wins**. This doc adds build detail only.

---

## Decisions (founder, 2026-10-01) and build status

| # | Decision | Effect in the build |
|---|---|---|
| D1 | No legal-review gate; **loyalty stays on** | `available` defaults true for every module, for every outlet. Admin can still switch a module off per outlet. The CR-6 firewall (no review trigger, separate tables, lint tests) stays |
| D2 | Loyalty **collects customer name + phone, shown to the owner** (notifications later) | `loyalty_members` holds `name`, `phone`, `contact_consent`. Owner sees a member table. Still no `session_id` and no join to review data. **Amends OD-25** (was: anonymous device wallet by default, no owner phone export). No messaging is built |
| D3 | **No public price** for Growth Services | The catalogue has no price column. Every request is quoted; the owner sees the amount only on their own quote |
| D4 | **Print kit:** deliver to the shop for ₹199, or self-print | `print_kit_orders` + card on the QR & Print page + admin list. The fee is recorded, not charged online yet |

**Built:**
- Migrations `d4b8f1a2c6e0` (hub, menu, loyalty, services, print kit) and `f6d2b8a4c1e7` (payments, wallet transfer).
- Customer routes: hub, connect, menu, rewards. Staff counter at `/staff/{slug}` with typed-code entry and camera QR scan (Chrome/Android, typed fallback elsewhere).
- Wallet: name + phone join, QR on the counter code, **staff-issued transfer code** to move a wallet to a new phone (replaces SMS OTP for now).
- QR-page editor (owner `/app/hub`, admin `/admin/outlets/{id}`) with live preview; hub/Connect activity panel on Insights.
- Growth Services: catalogue, request, quote, **accept and pay online**, admin board with quote builder, print kit list. Print kit ₹199 can be **paid online** or settled by phone.
- Payments reuse `PaymentProvider.create_order`; the amount always comes from our records and the signature must verify.
- Tests: 54 backend (incl. CR-6 lint + schema test, payments, transfer, insights) and 42 Playwright on a 360px phone (hub, editor, staff flow, axe contrast, plus the existing compliance specs).

**Not built:** SMS/phone-OTP wallet recovery (needs an SMS vendor and DLT approval); Razorpay webhook for one-time orders (payment is confirmed client-side with a verified signature, so an abandoned browser tab after paying needs a manual mark-paid); owner notifications to members; Growth Services phase B/C tooling (website generator, content pipeline, Instagram and WhatsApp automation) and the Lighthouse budget check.

---

## 0. What this request settles, and what it changes

| Item | Effect |
|---|---|
| **OD-24** (two meanings of "services") | **Confirmed.** Menu/Services = the business's own catalogue, shown to customers. Growth Services = what Revyu sells owners: website building, landing video, content pipeline, Instagram automation, WhatsApp automation. |
| **Loyalty timing** | The request asks for loyalty now. Doc 22 §9 put it in v2, after the kill-metric decision. **This plan builds it now, but lets you switch it on per outlet** (§3.4). The validation cohort stays on `direct` mode (OD-26), so the kill metric is unaffected. |
| **"Configurable in the admin dashboard"** | Read as **both** surfaces. The owner edits their own QR page in `/app`. Revyu admin edits any outlet's QR page in `/admin` (concierge setup), and also owns the service catalogue and module availability. One editor, two mounts (§5). |
| **"Clean UI like the website"** | Resolves doc 23 §6 decision 1: **keep the shipped website system** (tokens in `globals.css`: `--accent #397dff`, Lora display, Plus Jakarta body, 16px card radii, `--shadow-rest`/`--shadow-elevated`). Two fixes: button fill moves to `--accent-hover #2f68db` (≈5.1:1 with white, passes AA; `#397dff` fails at ≈3.8:1), and the brand facts in INDEX §3 get updated to match. |
| **Google Maps connect** | Part of Connect. Filled in automatically from `outlets.google_place_id`; the owner can override it. |

---

## 1. What the customer sees after scanning

```
QR ──► /r/{slug}
         │  state check first: suspended/deactivated → neutral screen (FR-83)
         │  then hub_mode + number of enabled modules
         │
         ├─ direct, or fewer than 2 modules ──► review flow (unchanged)
         │
         └─ menu + 2 or more modules ──► HUB
               ┌─────────────────────────────────┐
               │  [logo]  Dr. Mehta Dental       │
               │  Andheri West · Open until 8pm  │
               ├────────────────┬────────────────┤
               │  ✎             │  ◎             │
               │  Share your    │  Connect       │
               │  experience    │  with us       │
               ├────────────────┼────────────────┤
               │  ☰             │  ◆             │
               │  Services      │  Rewards       │
               │  (or "Menu")   │                │
               └────────────────┴────────────────┘
                     Powered by Revyu
```

- The tiles are **the same size and weight, and their copy is neutral** (FR-80, CR-6.2). None of them links one module to another.
- Every module page has a sticky "← Dr. Mehta Dental" bar back to the hub (FR-84).
- The hub is server-rendered. The only client JS is the event beacon, which keeps it inside the 150KB / 2.0s FCP budget (FR-81).

---

## 2. Data model

A new migration `d4…_hub_modules_loyalty_services`. Money always uses `amount_minor` + `currency_code`.

### 2.1 Hub and profile (`app/models/hub.py`)

Move `OutletModule` here from `models/referral.py`. It sits there now by accident.

| Table | Columns | Notes |
|---|---|---|
| `outlet_modules` *(exists)* | add `available bool default true` | `enabled` is the **owner's** switch. `available` is the **admin's** switch: loyalty ships `available=false` until legal review (R-27) |
| `outlet_profiles` (1:1) | `outlet_id` PK, `tagline`, `cover_image_url`, `address_line`, `locality`, `phone`, `hours jsonb` (`{mon:[["09:00","20:00"]],…}`), `updated_at` | Feeds the hub header, "Open now", Connect, and the future website generator (S1) |
| `outlet_links` | `id`, `outlet_id`, `kind` (`instagram`\|`facebook`\|`youtube`\|`whatsapp`\|`website`\|`google_maps`\|`phone`\|`email`\|`custom`), `label?`, `url`, `sort_order`, `enabled` | Validated per `kind` (§3.2) |
| `menu_categories` | `id`, `outlet_id`, `name`, `sort_order` | |
| `menu_items` | `id`, `category_id`, `name`, `description`, `amount_minor?`, `currency_code`, `price_on_request`, `price_prefix?` ("from"), `duration_min?` (services), `dietary text[]` (`veg`, `non_veg`, `vegan`…), `photo_url?`, `available`, `sort_order` | `dietary` and `duration_min` are shown depending on the vertical config |

### 2.2 Loyalty (`app/models/loyalty.py`): no FK to any review table (CR-6.3)

| Table | Columns | Notes |
|---|---|---|
| `loyalty_programs` (1:1 outlet) | `outlet_id`, `cooldown_hours` (default 12), `terms`, `acknowledged_at`, `acknowledged_by` | `acknowledged_at` must be set before the module can be enabled (FR-111) |
| `loyalty_badges` | `id`, `outlet_id`, `name`, `icon` (fixed set), `visits_required`, `repeat bool`, `sort_order`, `active` | `repeat=true` works as a stamp card ("every 5th visit") |
| `loyalty_rewards` | `id`, `badge_id` (1:1), `type` (`percent_discount`\|`amount_discount`\|`freebie`\|`free_service`), `percent?`, `value_minor?`, `currency_code`, `title`, `terms`, `expires_days?` | |
| `loyalty_members` | `id`, `outlet_id`, `public_id` (short, e.g. `A7F3`), `device_token_hash`, `phone_hash?`, `phone_enc?`, `created_at`, `deleted_at?` | **No `session_id`**, ever |
| `loyalty_ledger` | append-only: `id`, `member_id`, `kind` (`visit`\|`badge_awarded`\|`reward_issued`\|`reward_redeemed`\|`reward_expired`), `ref_id?`, `staff_pin_id?`, `created_at` | Progress is **derived** from the ledger (FR-110) |
| `loyalty_reward_grants` | `id`, `member_id`, `reward_id`, `redeem_code` (unique), `issued_at`, `expires_at?`, `redeemed_at?`, `redeemed_by_pin_id?` | **Added to doc 22 §6.** One row per issued reward. A conditional `UPDATE … WHERE redeemed_at IS NULL` makes double redemption impossible (FR-106) |
| `staff_pins` | `id`, `outlet_id`, `label` ("Front desk"), `pin_hash` (argon2/bcrypt), `active`, `failed_attempts`, `locked_until?` | |

### 2.3 Growth Services (`app/models/growth.py`)

| Table | Columns |
|---|---|
| `service_catalog` | `id`, `key` (`website`\|`landing_video`\|`content_pipeline`\|`instagram_automation`\|`whatsapp_automation`\|…), `name`, `tagline`, `description_md`, `deliverables jsonb[]`, `price_model` (`one_time`\|`monthly`\|`quote`), `amount_minor?`, `currency_code`, `lead_time_days?`, `cover_image_url?`, `active`, `sort_order` |
| `service_requests` | `id`, `account_id`, `outlet_id`, `service_id`, `status` (`requested → quoted → accepted → in_progress → delivered`, or `declined`/`cancelled`), `brief`, `answers jsonb`, `quoted_amount_minor?`, `payment_order_id?`, `assignee?`, `due_at?`, `created_at`, `updated_at` |
| `service_request_events` | `id`, `request_id`, `kind` (`status_changed`\|`note`\|`message_to_owner`\|`file`), `body`, `actor` (`owner`\|`admin`), `created_at`. Gives both sides a shared timeline |

A seed file, `seeds/service_catalog.py`, adds the five services. Prices are placeholders the admin edits.

### 2.4 Events (the shared `events` table)

Add the following to the allowlist in `api/events.py`: `hub_viewed`, `module_selected {module}`, `link_clicked {kind}`, `menu_viewed`, `rewards_viewed`. **None of them consume trial credits** (FR-85). Loyalty actions are written only to `loyalty_ledger`.

---

## 3. Backend

### 3.1 Layout

```
app/
  hub/registry.py              module registry as data: key, default order, vertical-aware label,
                               "has content?" check (FR-78)
  services/hub_config.py       ONE read/write layer, used by the owner and admin routers
  services/storage.py          upload → Pillow re-encode to WebP (strips EXIF), 3 sizes
                               (thumb 160, list 480, full 1200); local disk in dev, S3/R2 in prod
  loyalty/                     own package: the CR-6 lint boundary (SRS-21.6)
    service.py                 record_visit, award_badges, issue_grant, redeem
    codes.py                   rotating visit codes, redeem codes
  api/
    hub_public.py              GET /api/flow/{slug}/hub | /connect | /menu
    loyalty_public.py          POST /api/loyalty/{slug}/wallet, GET /wallet, GET /wallet/code
    staff.py                   POST /api/staff/{slug}/login, /visits, /redeem, GET /member/{code}
    hub_config.py              two routers over hub_config service:
                                 /api/app/outlets/{id}/hub/...    (owner session)
                                 /api/admin/outlets/{id}/hub/...  (admin token)
    growth.py                  owner: GET /api/app/services, POST/GET /api/app/service-requests
    admin_growth.py            admin: catalog CRUD, request pipeline, quote → payment link
```

### 3.2 Config endpoints (the same shape for owner and admin)

| Method + path (under `…/outlets/{id}/hub`) | Purpose |
|---|---|
| `GET /` | Everything the editor needs in one call: mode, modules, profile, links, menu, loyalty config, plus a "setup checklist" |
| `PATCH /` | `hub_mode` |
| `PUT /modules` | Enabled flags and order. Returns 409 when enabling a module that has no content, or loyalty without acknowledgement |
| `PATCH /profile` | Tagline, address, hours, phone, cover |
| `PUT /links` | Replace the whole list (small list, simple). Rules: `https` only, except `tel:` for phone. `whatsapp` is normalised to `https://wa.me/<digits>`. `google_maps` defaults to `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<place_id>`. Instagram/Facebook/YouTube hosts must match the kind |
| `POST/PATCH/DELETE /menu/categories[/{id}]`, `/menu/items[/{id}]`, `PUT /menu/order` | Menu CRUD and reordering |
| `POST /uploads` | Image upload (≤5MB in, re-encoded). Returns URLs |
| `GET/PUT /loyalty`, `/loyalty/badges…`, `/loyalty/staff-pins…`, `POST /loyalty/acknowledge` | Loyalty setup |
| `GET /loyalty/stats`, `/loyalty/redemptions` | Outlet-level counts and the redemption log (CR-6.4) |

Admin-only: `PUT /api/admin/outlets/{id}/hub/availability` sets the `available` flag per module.

### 3.3 Loyalty mechanics

```
Customer (Rewards page)                 Staff (/staff/{slug}, PIN session)
────────────────────────                ───────────────────────────────────
first open → POST /wallet
  ← device_token (kept in localStorage,
     server stores only sha256)
"Show at counter" → GET /wallet/code
  ← 6-digit code, 60s TTL, plus a QR     enter code / scan QR → POST /visits
                                           checks: code valid, cool-down passed
                                           ledger += visit
                                           threshold crossed? → badge_awarded
                                             → reward_issued (grant + redeem_code)
wallet refreshes: "4/5 → Regular ✓"      ← "Visit recorded · Member A7F3 · 1 reward ready"
tap reward → shows redeem code          "Redeem" → POST /redeem {redeem_code}
                                           conditional UPDATE burns it → ledger += reward_redeemed
```

- **Visit code:** an HMAC over (member secret, 60s window), accepting the current and previous window. It is short-lived, so a screenshot can't be reused.
- **Staff PIN:** 4–6 digits. Staff session lasts 8h, is httpOnly, and is scoped to one outlet. After 5 failures the PIN locks for 15 minutes. IP rate limits apply on top.
- **Phone "save my badges"** (OD-25) comes in a later phase (L2). It needs an SMS OTP provider (MSG91 or Twilio), which is a new vendor with a DLT template approval in India. Until then, a wallet can be moved to another device with a one-time **transfer code** shown on screen. This needs no PII.
- **Deletion (FR-109):** "Delete my wallet" in the wallet menu deletes the member, the ledger and the grants.

### 3.4 Guardrails enforced in code, not just policy

- `tests/test_cr6_boundary.py` fails if any module under `app/loyalty/` or `components/rewards/` imports or contains `review|draft|feedback|tag|rating|google` (and the reverse). A schema test fails if any FK joins the two table groups (SRS-21.6).
- The rewards builder has **no trigger picker**. Visits are the only earning rule, so a review-based rule can't be built (FR-101).
- Loyalty `available=false` is the default for every outlet. Admin turns it on per outlet once the hub layout has had legal review (R-27).

---

## 4. Customer-facing frontend (`/r/[slug]/…`)

**Before coding:** `frontend/AGENTS.md` warns that this Next 16 has breaking changes. Read `node_modules/next/dist/docs/` for route params, `error.tsx`, and caching before writing routes.

```
src/app/r/[slug]/
  page.tsx            resolve: neutral | review (direct) | <Hub/>
  review/page.tsx     today's CustomerFlow, moved as-is (SRS-20.4, the B4 gap in doc 23)
  connect/page.tsx
  menu/page.tsx
  rewards/page.tsx    the only client-heavy module; code-split
  error.tsx  not-found.tsx  loading.tsx   (the B5 gap in doc 23)
src/app/staff/[slug]/page.tsx             staff console, outside /r so /r stays light
src/components/hub/     HubHeader, HubTile, ModuleTopBar, OpenNowBadge
src/components/connect/ LinkRow, DirectionsCard, SaveContactButton (vCard)
src/components/menu/    CategoryChips (scroll-spy), MenuItemRow, ItemSheet, PriceText (Intl.NumberFormat)
src/components/rewards/ WalletCard, ProgressRing, BadgeShelf, CounterCode, RewardTicket
```

**UX notes per screen:**

- **Hub:** a 2×2 grid at 360px (1 column if 3 tiles, with the last one full width), tiles at least 120px tall, the whole card tappable, a press state, and `prefers-reduced-motion` respected. The header shows the logo, name, locality, and an "Open now · until 8pm" line computed from `hours` in the outlet's timezone.
- **Connect:** a "Get directions" card at the top (address, then opens Google Maps). Below it, large 56px rows with brand icons (Call, WhatsApp, Instagram…). At the bottom, "Save contact" downloads a vCard, which is useful for clinics and salons. Each tap fires a `link_clicked` beacon. There is no follow-to-unlock anywhere (FR-91).
- **Menu / Services:** sticky category chips that follow scroll position. Search appears when there are more than 20 items. Rows show the name, a 2-line description, the price (or "Price on request", or "from ₹X"), a lazy 480px WebP thumbnail and dietary dots. Unavailable items are greyed and marked. Tapping a row opens a bottom sheet with the full photo. The label is "Menu" or "Services" depending on the vertical JSON.
- **Rewards:**
  - A wallet card with the business name, current badge, and a progress ring ("3 of 5 visits to Regular").
  - A primary "Show at counter" button opens a full-screen code: large digits, a QR, and a countdown bar that refreshes itself. Screen brightness hint: "Turn up brightness".
  - Below: a badge shelf (earned / locked), and available and used rewards shown as tickets with terms and expiry.
  - Nothing on this page mentions reviews (CR-6.2).
- **Staff console:** a PIN pad, then one large numeric keypad "Enter customer code" plus a "Scan" button (camera via `BarcodeDetector` where supported, otherwise keypad only). The result card shows a big ✓ with the member's short ID, visit progress and available rewards, each with a "Redeem" button. Errors are specific: "Code expired, ask them to refresh" or "Already visited today". Designed for a tablet on the counter.

---

## 5. Owner dashboard and admin: one editor, two mounts

### 5.1 Prerequisites (doc 23 Phase 2, steps 3–4)

Nothing below is buildable cleanly without these:

- `src/components/ui/`: Button, Field/Input/Textarea/Select/Switch, Card, StatTile, StatusPill, Dialog, Sheet, ConfirmDialog, Toast, Skeleton, EmptyState, ErrorState, Tabs, SegmentedControl, SortableList (`@dnd-kit/sortable`, with keyboard move-up/down for a11y).
- Move `/app` into an `(app)` route group and `/admin` into an `(admin)` route group (URLs unchanged), each with a layout shell. This fixes U4/U8.

### 5.2 Owner app shell (the website look, extended)

```
┌───────────────┬───────────────────────────────────────────────┐
│ Revyu         │ Dr. Mehta Dental   ● Live                     │
│               ├───────────────────────────────────────────────┤
│ ◉ Overview    │                                               │
│ ○ Feedback  3 │                                               │
│ ○ Insights    │                                               │
│ ─ QR page ─── │                                               │
│ ○ Setup       │   (page)                                      │
│ ○ Connect     │                                               │
│ ○ Menu        │                                               │
│ ○ Rewards     │                                               │
│ ─────────────│                                               │
│ ○ QR & Print  │                                               │
│ ○ Grow ✦      │   ← Growth Services                           │
│ ○ Billing     │                                               │
│ ○ Settings    │                                               │
└───────────────┴───────────────────────────────────────────────┘
Mobile: bottom tabs — Overview · Feedback · QR page · Grow · More
```

### 5.3 The QR page editor (`components/hub-editor/`)

The editor takes an `api` adapter prop (`ownerHubApi` | `adminHubApi(outletId)`), so the same components mount at `/app/hub/*` and `/admin/outlets/[id]/hub/*`.

```
┌──────────────────────────────────────────┬──────────────────┐
│ QR page · Setup            3 of 4 ready  │   ┌──────────┐   │
│                                          │   │ live     │   │
│ When customers scan:                     │   │ phone    │   │
│ [ Go straight to review | Show my page ] │   │ preview  │   │
│                                          │   │ (iframe  │   │
│ Modules                        drag ⋮⋮   │   │ ?preview │   │
│ ⋮⋮ Share your experience   ● on          │   │ =1)      │   │
│ ⋮⋮ Connect with us         ● on  Edit →  │   │          │   │
│ ⋮⋮ Services                ○ off Add items│  └──────────┘   │
│ ⋮⋮ Rewards   🔒 Ask Revyu to enable      │   [Open on phone]│
└──────────────────────────────────────────┴──────────────────┘
```

- **Live preview** on the right: an iframe of `/r/{slug}?preview=1` that reloads after each save. The existing preview mode already records no events (SRS-11.17). On mobile it becomes a "Preview" button that opens a Sheet.
- **Setup checklist:** each module shows what it is missing ("Add at least 1 link"). You cannot enable a module with no content (FR-89). The API returns a reason, and the UI shows it in place of the toggle.
- **Saving:** toggles and reordering save immediately with an undo toast. Forms (profile, item sheet, badge sheet) save on an explicit button with inline validation. There is a dirty-state guard when leaving.
- **Connect editor:** a pick-a-platform grid, then one field per platform with a prefix hint (`instagram.com/` [handle]). The Google Maps row is pre-filled from Places and marked "From your Google profile". Rows can be reordered.
- **Menu editor:** categories as sortable sections, items as rows. "Add item" opens a Sheet with name, description, price or "on request", photo drop-zone with a crop preview, dietary chips and an availability switch. There is an "Available today" quick toggle on each row. CSV import comes later (FR-98).
- **Rewards editor:**
  - First visit: a one-time acknowledgement card with the CR-6.6 text. Enabling is blocked until it is ticked.
  - Then a **tier ladder**: Regular → Insider → Champion as cards, each with visits, an icon, and the reward (type segmented control, value, terms, expiry).
  - Also: staff PINs (label, set PIN, deactivate), the cool-down setting, and a stats strip (members, visits in 30d, rewards issued/redeemed) plus the redemption log.
  - All of this lives on **its own page**. Nothing crosses into the review panels (CR-6.4).
- **Insights additions:** a Hub panel (views, module split) and a Connect panel (clicks by kind), shown separately from the review funnel. For hub outlets, the funnel is based on `module_selected(review)` (doc 22 §8).

### 5.4 Growth Services: owner side (`/app/grow`)

- A catalogue grid of service cards: cover, name, tagline, "From ₹X" or "Custom quote", and lead time.
- A card opens a detail page with a description, a deliverables checklist, an FAQ, and a **"Request this"** button.
- The request form is a short, service-specific questionnaire held in `answers jsonb`. For example, website: "Do you have a domain?"; video: "Shoot on-site or stock?". It ends with "What should we know?".
- After submitting, the owner gets a request page with a status timeline (Requested → Quoted → …). A **Quote** card appears with "Accept & pay", which uses the `PaymentProvider` payment link. Messages from Revyu arrive in the same thread.
- A dashboard nudge card appears only when relevant. For example, a website nudge shows when the menu is filled in and no website link exists. At most one nudge is shown, and it can be dismissed.

### 5.5 Admin additions

- **`/admin/outlets/[id]`**, the outlet detail page (already listed as a gap in doc 23), has tabs: Profile · QR page (the shared editor) · Tags · Module availability · Service requests · Timeline.
- **`/admin/services/catalog`**: CRUD table for the catalogue. Editing uses a Sheet with a Markdown description, a deliverables list, price model and amount, cover upload, an active switch and drag ordering.
- **`/admin/services/requests`**: a **kanban** by status (drag moves cards between columns), filters by service and age, and an "overdue" chip. The request drawer holds the brief and answers, a quote builder that sends a payment link, internal notes versus messages to the owner, and a due date.
- Every new request emails the admin through the existing `notifications` service.

---

## 6. Later phases of Growth Services (after demand shows up)

| Service | Phase B/C build (doc 22 §7.1) |
|---|---|
| S1 Website | A generator that builds `/{slug}` or a custom domain from `outlet_profiles` + menu + links + hours. Owners get templates, a colour and a hero image. ISR pages. |
| S2 Landing video | Stays a service, with no product surface beyond delivery. Deliverables are uploaded to the request thread. |
| S3 Content pipeline | `content_items`: `idea → drafting → pending_approval → approved → scheduled → published`. Owner approval inbox with a calendar view. **Nothing publishes without approval** (FR-119). |
| S4 Instagram | Meta Graph API (official only, SG-1). OAuth connect, encrypted tokens, scheduled publish, comment/DM auto-reply rules. Every action is logged (FR-120). |
| S5 WhatsApp | WhatsApp Business Platform via a BSP. Contacts only with recorded opt-in, template messages, opt-out handling (SG-2). **Never uses loyalty member data** (OD-29). |

---

## 7. Delivery sequence (one developer)

| Phase | Contents | Est. | Exit check |
|---|---|---|---|
| **H0 Foundations** | `/r/[slug]/review` split plus `error`/`not-found`/`loading`; `ui/` primitives; `(app)` and `(admin)` shells with nav; `storage.py`; `hub/registry.py` + `hub_config` service; migration for `outlet_profiles` and `available` | 4–5 d | Existing flow passes unchanged at both `/r/x` and `/r/x/review`; dashboard runs in the new shell |
| **H1 Hub + Connect + Menu** | Tables, public + config APIs, customer pages, editor with live preview (owner + admin mounts), events, Insights panels | 6–7 d | An owner builds a page with 3 modules from a phone in under 10 minutes; the hub hits <150KB/<2s on throttled 3G |
| **H2 Growth Services A** | Catalogue seed, `/app/grow`, request flow, admin catalogue + kanban, quote → payment link, emails | 3–4 d | Request → quote → pay → delivered works end-to-end with the mock payment provider |
| **H3 Loyalty L1** | Loyalty package + tables, wallet, visit codes, staff console, rewards editor, acknowledgement, stats and log, CR-6 tests | 7–9 d | Criteria 5–6 in doc 22 §10 pass; a staff member records a visit in under 10 seconds |
| **H4 Hardening** | Playwright: hub → review passes SRS-17.1a–g, every module and suspended state. axe-core, Lighthouse CI budget, rate limits on the new public endpoints | 2–3 d | CI green |
| **L2 (optional)** | Phone save for wallets through an SMS provider | 2–3 d | Needs OD-25 confirmed and the DLT template approved |

**Total ≈ 4–5 weeks.** H0 overlaps with doc 23 Phase 2, so do them together, not twice. Doc 23 Phase 0 (security: rate limiting, token hashing, config fail-fast) should still land first, because the new public endpoints (wallet, staff PIN) depend on the same rate limiter.

---

## 8. Open questions for the founder

1. **Rewards on the same hub as Review.** Legal/policy review of the hub layout before any real outlet enables Rewards (R-27)? The plan assumes yes and gates it with the admin `available` flag.
2. **Phone save for wallets:** now (L2, adds an SMS vendor and customer PII) or later? The plan assumes later, with transfer codes in the meantime.
3. **Growth Services prices:** show public "From ₹X", or "Custom quote" only? The catalogue supports both per service.
4. **Who sets up the QR page for new outlets:** owner self-serve, Revyu concierge, or both? The plan supports both. Concierge is the likely default for the first outlets.
