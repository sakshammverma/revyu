# Build Status, Pending Plan & Growth Ideas

**Product:** Revyu
**Date:** 2026-10-01
**Status:** Live. This is the audit of the code as it stands, plus the plan to finish it.

> The build journal ([19](19-JOURNAL.md)) and [00-README](00-README.md) still say
> "0 lines of code". That is out of date. A working v1 skeleton exists and covers
> most of the week 1–3 roadmap. This doc records what is really built, what is
> left, the order to finish it in, and new ideas that are **not already in
> docs 01–22**.

---

## 0. Progress since this audit (updated 2026-10-01)

Owner decisions: **keep the current blue/serif design** (recorded in CLAUDE.md; the brief's indigo/amber is superseded); referral = **70% off the referrer's next bill once the referred business pays**; Competitor Watch wanted; Pro tier **parked**; Business Profile service **dropped**.

| Item | Status |
|---|---|
| B1 credit-burn protection (believable-journey check, 6/hr/outlet cap, rate limits) | ✅ built + tested |
| B2 fail-fast production config, constant-time admin compare | ✅ built + tested |
| B3 CR-3: sticky Google + private-feedback bar at every step, neutral label | ✅ built (Playwright SRS-17.1 tests still to write) |
| B4 `hub_mode`, `outlet_modules` migration | ✅ migrated (`/r/{slug}/review` route still to do) |
| B5 `/r` error, not-found, loading pages; no dead Google button | ✅ built |
| B6 rate limits, input bounds, uniform OTP response | ✅ built |
| B7 hashed tokens, `secure` cookie, logout endpoint | ✅ built + tested |
| B8 honest email status (`skipped_no_provider`) | ✅ |
| B9 advisory lock per scheduled job | ✅ |
| B10 SSRF on Maps-link resolver (https + Google host allowlist, every redirect hop re-checked) | ✅ built + tested |
| R1 billing API + screen (pay to unlock) | ✅ built + tested |
| R2/R3 trial meter + locked conversion screen | ✅ built |
| R4 lifecycle emails: first scan, private feedback, day-10, lock, 3 credits left, paused, payment-failed day 3 and 6, zero-scan nudge | ✅ built + tested |
| R5 wa.me pending-sends admin queue (`/admin/pending-sends`) | ✅ built + tested |
| Design primitives, owner app shell, new pages (Overview, Feedback, Insights, QR, Billing, Refer, More) | ✅ built |
| N1 Review Gap Report (`/gap-report`) | ✅ built (needs a real Places key to show real competitors) |
| N2 Referral programme (link, ledger, admin apply) | ✅ built + tested |
| Founder metrics cockpit (`/admin/metrics`), explicit approval checkboxes, tag editor, outlet detail (`/admin/outlets/[id]/detail`), manual state override | ✅ built + tested |
| Playwright compliance tests (SRS-17.1 a-g at ratings 1-5, draft CR-1/CR-2) | ✅ 27 tests passing; Lighthouse budget still open |
| Competitor Watch (N8): follow up to 3, weekly check, digest line (`/app/competitors`) | ✅ built + tested |

Backend: 54 pytest tests passing. Frontend: `tsc` clean; 27 Playwright tests passing; new code lint-clean (pre-existing files still have lint errors).

---

## 1. What is built

### 1.1 Backend (FastAPI + SQLAlchemy + Alembic, `backend/`)

| Area | State | Where |
|---|---|---|
| Customer flow API: config, session, private feedback | ✅ Real | `api/flow.py` |
| Event ingest, CR-1 payload scrubbing, `copy_tapped` → trial metering | ✅ Real | `api/events.py`, `services/trial_metering.py` |
| Self-serve signup: Places search, create, confirm payment, status | ✅ Real | `api/signup.py` |
| Owner auth: email OTP + magic link, cookie session | ✅ Real | `api/auth.py`, `services/owner_auth.py` |
| Owner dashboard data: overview, funnel, tags, rating, feedback, resolve | ✅ Real | `api/dashboard.py` |
| QR (PNG/SVG, EC level H) + 4 print PDFs (receipt, card, standee, sticker) | ✅ Real | `api/assets.py`, `services/qr.py`, `services/print_assets.py` |
| Admin approval queue: preview, approve, request info, reject + refund | ✅ Real | `api/admin.py` |
| Admin outlets: create, validate URL, tags, activate, bulk CSV | ✅ Real | `api/admin_outlets.py` |
| Razorpay: mandate with trial-deferred first charge, one-time fallback, refund, HMAC webhooks | ✅ Real (mock provider used locally) | `services/payments/`, `api/webhooks.py` |
| Email notifications through Resend | ✅ Real (logs only when no key) | `services/notifications/` |
| Jobs: weekly Places poll, day-15 lock, weekly digest, event pruning, cancellation expiry | ✅ Real | `jobs/` |
| Global-ready schema: plans table, `amount_minor`, locale | ✅ | `models/`, 5 migrations |
| Five vertical templates: dental, physio, salon, gym, coaching | ✅ | `verticals/*.json` |

### 1.2 Frontend (Next 16 + React 19 + Tailwind 4, `frontend/`)

| Area | State |
|---|---|
| Marketing site: home, how-it-works, pricing, compliance, contact, legal pages | ✅ Static |
| 4-step signup wizard with Razorpay checkout, plus a status page that polls | ✅ Live |
| Customer flow `/r/[slug]`: landing → stars → tags → editable draft with disclosure → copy → Google handoff. Low-rating screen with private feedback and the Google option. Beacon events, preview mode, neutral screen, clipboard fallback | ✅ Live |
| Owner dashboard `/app`: overview, funnel, tags, rating, feedback inbox, assets panel. OTP + magic-link login | ✅ Live (single page) |
| Admin: approvals, outlets, preview | ✅ Live (token gate) |

### 1.3 What doesn't exist yet
- **Tests of any kind.** This includes the compliance tests SRS-17.x, which the spec calls "the compliance boundary".
- Any v1.5 or v2 feature: the hub, connects, menu, loyalty, reply drafting, staff attribution.

---

## 2. What is pending: the gap list

Severity: 🔴 blocks launch or risks a customer's Google profile · 🟠 blocks
revenue · 🟡 quality / UX · ⚪ hygiene.

### 2.1 🔴 Launch blockers

| # | Gap | Why it matters |
|---|---|---|
| B1 | **Anyone can use up an outlet's trial credits.** `/api/flow/*/session` and `/api/events` need no auth, and the outlet id is public. A script can post `copy_tapped` with random device hashes and suspend any outlet. | A competitor or bored teenager could kill a paying customer's QR |
| B2 | **Unsafe config defaults.** `ADMIN_SESSION_SECRET` defaults to `"change-me"`. `ENVIRONMENT` defaults to `local`, which silently turns on mock payments and fake Places data. | One missed env var in prod means an open admin console and free signups |
| B3 | **CR-3 gaps in the flow.** At 4–5★ the Google option is 3 screens away (tags → draft → handoff), and there is no private-feedback entry point at 4–5★ | Compliance is the product's promise. Re-check against 16-DRAFT-AND-ROUTING §2, then add a persistent "Skip to Google" and "Tell the owner privately" at every rating |
| B4 | **`hub_mode` and `outlet_modules` are missing**, and there is no `/r/{slug}/review` route. 05-DATA-MODEL says these belong in the *first* migration | Once QRs are printed, the URL structure is frozen. This is cheap now and very expensive later |
| B5 | **No error boundary on `/r/[slug]`.** Any API error crashes the page, the 404 is Next's default, and the Google button does nothing if the review URL is null | C-6: the customer flow must never fail |
| B6 | **No rate limiting** on signup, feedback, events or OTP per IP. OTP 429s reveal whether an email is registered. Input size is unbounded (feedback text, event batch, CSV) | Abuse and enumeration |
| B7 | **Weak session and token handling.** Cookie has no `secure`. OTP, magic and session tokens are stored in plaintext. Admin token compare is not constant-time | Standard hardening |
| B8 | **Email records `sent` when nothing was sent** (no API key) | Hides a broken notification pipeline in prod |
| B9 | **Scheduler runs in-process with no lock.** Two workers means duplicate digests and a duplicate day-15 lock | Owners get spammed and state can double-transition |
| B10 | **SSRF.** The admin Maps-link resolver follows any URL | Low exposure (admin only), easy fix |

### 2.2 🟠 Revenue path gaps (the money doesn't flow yet)

| # | Gap |
|---|---|
| R1 | **An owner who is locked or past-due has no way to pay.** `POST /api/app/billing/checkout` and `GET /billing/status` are not built, and there is no Billing screen |
| R2 | **The trial isn't visible.** `trial_flow_count` is fetched but never shown. There is no "X days / Y credits left" and no credit meter |
| R3 | **The locked state is a banner, not a conversion screen** (brief §2.3). It should show "42 scans and 6 new reviews waiting · 7 credits left · Unlock for ₹499" |
| R4 | **The highest-value notifications are never sent.** Templates exist for `trial_threshold`, `first_scan` and `private_feedback_received` but nothing calls them. There are no messages for 3-credits-left, lock or suspension (FR-46, SRS-9.7), and no 5-minute feedback alert (SRS-13.5) |
| R5 | **The wa.me "pending sends" queue** (roadmap §1.3) is kept in memory and has no admin UI |
| R6 | **No annual-plan upsell** anywhere after signup |

### 2.3 🟡 Product completeness

- **Dashboard:**
  - date range (hard-coded to 30d)
  - tag change period over period (FR-23)
  - "new Google reviews" from Places snapshots
  - a real Live/Locked/Paused badge (currently always "Live")
  - logout
  - settings: notification prefs, digest opt-out (SRS-13.3), logo upload (SRS-15.7)
- **Draft quality:** locality is never passed to the draft (FR-56), `logo_url` is never shown, and the thank-you step is missing.
- **Admin:**
  - explicit "place verified" and "placement confirmed" checkboxes (currently hard-coded `true`)
  - manual state override (SRS-11.9)
  - a 24h queue-age alert (SRS-19.9)
  - the tag editor UI (the API already exists)
  - outlet detail page, `/admin` home page and nav, logout
- **Founder analytics cockpit:** a per-outlet funnel with medians and a kill-metric tracker. 07-METRICS depends on it and nothing specifies it.
- **Weekly digest:** add the top tag, conversion and the Google review delta.
- **The zero-scan alert** only writes a log line. It should email the owner and put the outlet in an admin queue.

### 2.4 🟡 UI/UX debt

| # | Issue |
|---|---|
| U1 | **Two design systems.** The code uses blue `#397dff` with Lora, Newsreader and Plus Jakarta, and rounded corners. The brief (OD-2/3) says indigo `#4338CA`, amber CTA, Archivo + Geist Mono and sharp corners. `#4338CA` appears **0** times. On top of that, about 1,150 hard-coded hex classes vs about 385 token classes |
| U2 | **No component library.** Two unrelated `Button`s, no Input/Field/Card/Dialog/Toast/Tabs/Skeleton/EmptyState |
| U3 | **`.btn-primary` fails WCAG AA** (white on `#397dff` ≈ 3.8:1), and it is used everywhere |
| U4 | **The dashboard is one long page.** No app shell, no nav, no logout |
| U5 | **No toasts, no `aria-live` errors, silent failures.** Feedback resolve rolls back silently, the feedback form can double-submit, `alert()`/`prompt()` in admin |
| U6 | **Forms only check non-empty.** No email or phone format checks, no `autocomplete="one-time-code"`, no resend-code option |
| U7 | **Three font families load on `/r`.** This works against the 150KB / 2.0s budget (NFR-2) |
| U8 | **Admin and dashboard sit inside the `(marketing)` route group** |

### 2.5 ⚪ Marketing and doc hygiene

- **"No card required"** in `/signup` metadata contradicts the Razorpay mandate. This is a trust problem; fix it first.
- Stock landscape photos (Dolomites, Yosemite, ocean) are used for vertical slides. Showcase components mention an **NFC stand**, which contradicts "we don't ship hardware".
- The compliance page says "no visual de-emphasis" but the 1–3★ screen uses outline styling. Align the public wording with 16-DRAFT-AND-ROUTING.
- Legal pages are marked "not final legal copy".
- About 12 unused components and about 15 unused public assets. The three-act homepage components (`ActGap`/`ActMechanism`/`ActReturn`, FR-76) are built but not used.
- **Out-of-date docs:**
  - root CLAUDE.md says "empty repo"
  - the journal says 0 code
  - PRD, 17 and GTM §9 still say dental-only, which contradicts OD-4
  - 14 §7 says "no signup", which contradicts FR-40
  - 07 says "WhatsApp digest"

---

## 3. The plan for pending work

Estimates assume one developer. Phases 0–2 are the path to **ten live installs**. Phases 3–4 follow the existing roadmap and its gates.

### Phase 0: make it safe to launch (3–4 days) 🔴

1. **Config fail-fast.** Refuse to boot when `ENVIRONMENT != local` and any secret is a default, or payment/Places/email keys are missing. Remove the `"change-me"` defaults. Use `hmac.compare_digest` for the admin token.
2. **Protect credits and funnel integrity (B1):**
   - `POST /session` returns a short-lived signed session token. `/events` requires it.
   - Per-IP and per-outlet throttles on session creation.
   - Count `copy_tapped` as a credit only if the same session has `rating_selected` and `tags_selected`, and more than ~5s has passed since the scan.
   - Cap credits per outlet per hour and flag anomalies to admin.
3. **Rate limiting** (slowapi or middleware): OTP per IP and per email with a uniform response, plus signup, feedback and events. Add length and range validation to every schema.
4. **Hash tokens at rest** (SHA-256 for OTP, magic and session tokens). Set `secure=True` and `SameSite=Lax` on cookies. Add a logout endpoint that revokes the session.
5. **Reserve the hub (B4):** migration adding `outlets.hub_mode` (default `direct`) and `outlet_modules`, serve the flow at `/r/[slug]/review`, and have `/r/[slug]` route by mode. No UI.
6. **CR-3 fixes (B3)** on the customer flow, then **write the compliance tests first**:
   - Backend: pytest for draft CR-1 traceability, the empty draft at zero tags, trial-metering dedup and webhook idempotency.
   - Frontend: Playwright for SRS-17.1a–g on a 360×640 viewport.
   - Both run in CI (GitHub Actions).
7. **Flow resilience (B5):** `error.tsx`, `not-found.tsx` and `loading.tsx` for `/r`. Hide or replace the Google button when there is no URL. Add a feedback busy state with retry. Add the thank-you step.
8. **Notification truth (B8):** record `skipped_no_provider`. **Scheduler (B9):** a Postgres advisory lock per job, or move jobs to a single worker process.

**Exit:** a stranger's phone completes the flow on a printed QR, every step lands in `events`, the CI compliance suite is green, and a prod boot with a missing secret refuses to start.

### Phase 1: close the money loop (5–6 days) 🟠

1. **Billing API:** `GET /api/app/billing/status` (plan, state, days left, credits left, next charge) and `POST /api/app/billing/checkout` (reuse the signup checkout path).
2. **Billing screen:**
   - current plan
   - status pill
   - trial meter (days → credits)
   - payment history
   - "Switch to annual, save ₹1,489"
   - update payment method (a new mandate)
3. **Lock screen as a conversion page (R3):**
   - Blur the data but show the real counts.
   - One amber CTA and the UPI AutoPay logos.
   - A reassurance line: "Your QR code stays the same".
4. **The trial lifecycle, email + wa.me:**
   - day 1 "QR ready"
   - first scan
   - day 10 "5 days left"
   - day 15 "credits started"
   - 3 credits left
   - locked
   - suspended
   - payment failed (days 1, 3 and 6 of grace)
   - private feedback within 5 minutes
5. **Pending-sends queue (R5):** persist it in `notifications` with `channel=click_to_chat`, and add an admin page to tap through it.
6. **Admin essentials:**
   - explicit approval checkboxes
   - state override with reason
   - tag editor
   - outlet detail (timeline, events, payments)
   - a banner when the queue is older than 24h
7. **Founder cockpit `/admin/metrics`:**
   - per-outlet scan → copy conversion
   - median across outlets
   - kill-metric band (red <5%, amber 5–10%, green >20%)
   - days since the tenth install
   - trial → paid rate
   - zero-scan list

**Exit:** a trial owner is reminded, hits the lock, pays from the dashboard and is unlocked instantly without anyone touching it, and the founder sees the kill metric on one screen.

### Phase 2: design system and UX overhaul (6–8 days, can overlap Phase 1) 🟡

**Step 1: decided 2026-10-01: keep the shipped blue/serif look.** The accent was deepened slightly (`#397dff` to `#2f6df0`) so white button text passes AA contrast.

**Step 2: tokens.** Put all colour, space, radius, type and shadow values in `globals.css` via Tailwind v4 `@theme`. Add a lint rule (or a CI grep) that bans raw `[#hex]` classes outside the token file. Keep a customer-flow font budget: one variable font, subset, `display: swap`.

**Step 3: primitives** in `src/components/ui/`, one of each, all keyboard- and screen-reader-tested:

| Primitive | Notes |
|---|---|
| `Button` | primary (amber, AA), secondary, ghost, danger; loading and disabled states; 48px min on mobile |
| `Field` / `Input` / `Textarea` / `Select` / `Checkbox` | label, hint, error, `aria-describedby`, inline validation on blur |
| `Card`, `StatTile` (value + delta + sparkline), `Badge`/`StatusPill` | the pill maps each outlet state to one colour and label everywhere |
| `Dialog`, `Sheet` (mobile), `ConfirmDialog` | replaces `alert()`/`prompt()` |
| `Toast` provider | one place for success, error and undo (for example "Marked resolved · Undo") |
| `Skeleton`, `EmptyState`, `ErrorState` | every panel gets all three; no full-page spinners |
| `Tabs`, `SegmentedControl` (date range), `Table` (sortable, responsive → cards) | |

**Step 4: owner app shell** (move to an `(app)` route group).

```
┌──────────────┬───────────────────────────────────────────┐
│ Revyu        │ Dr. Mehta Dental   ● Live   [7d|30d|90d]  │
│              ├───────────────────────────────────────────┤
│ ◉ Overview   │  Trial: 9 days · 10 credits after  ▓▓▓░░  │
│ ○ Feedback 3 │  ┌────────┐┌────────┐┌────────┐┌────────┐ │
│ ○ Insights   │  │Scans   ││Complete││Conv.   ││Reviews │ │
│ ○ QR & Print │  │ 143 ▲12││  28 ▲4 ││19.6%   ││ 47→58  │ │
│ ○ Billing    │  └────────┘└────────┘└────────┘└────────┘ │
│ ○ Settings   │  Funnel ─────────────────── (boundary ┆)  │
│              │  Next best action: "Move the standee to   │
│ Help · Logout│   the payment counter — 0 scans in 3 days"│
└──────────────┴───────────────────────────────────────────┘
Mobile: bottom tab bar (Overview · Feedback · QR · More)
```

- **Overview:** KPI tiles with deltas, the funnel, and one "next best action" card driven by rules (zero scans → placement tip, low conversion → tag tip, feedback unresolved → inbox).
- **Feedback:** inbox with an open/resolved filter, age badges, one-tap "Call" or "WhatsApp" when the customer left contact details, and undo.
- **Insights:** tag frequency with change, rating distribution, time-of-day heatmap.
- **QR & Print:** a preview of each asset, a download for each, a "Print guide" with photos of good placement, and a "Test my QR" button that opens preview mode.
- **Billing:** see Phase 1.
- **Settings:** business profile, logo, notification channels, digest opt-out, sessions and logout.

**Step 5: customer flow polish** (the most important surface):
- a progress indicator (1/3, 2/3, 3/3)
- back navigation to change the rating
- outlet logo on the landing screen
- 360px-first layout, with the thumb zone reserved for the primary action
- haptic-style press states
- `prefers-reduced-motion`
- a Lighthouse CI budget: ≤150KB and FCP <2.0s on slow 3G

**Step 6: admin UX:** `/admin` home page (queue count, pending sends, cockpit), a nav sidebar, and a fixed 401 handler. Replace the per-page token gates with one layout guard.

**Step 7: accessibility pass:**
- `aria-live` on errors and toasts
- `aria-expanded` on menus
- `aria-hidden` on emoji icons
- visible focus rings
- axe-core in Playwright

**Step 8: marketing cleanup:**
- Replace stock landscapes with real outlet or mock-UI imagery.
- Use the real `StarRating`/`TagChips` components in the demos (FR-77).
- Wire in the three-act homepage and delete the unused components and assets.
- Fix "No card required" and the NFC mentions.

### Phase 3: v1.5 hub (≤1 week, after installs are live)

As specified in [22](22-HUB-AND-MODULES.md) §9 and roadmap §v1.5: hub tiles, social connects, manual menu, and Growth Services Phase A (catalogue + request form + admin pipeline). **Blocked by OD-24, OD-25 and OD-26.** Validation-cohort outlets stay on `direct`.

### Phase 4: v2 (only after the day-30 kill-metric decision)

The roadmap order is unchanged: review-reply drafting → loyalty (behind the CR-6 firewall and legal review) → staff attribution → SLA loop → digest → WhatsApp BSP.

---

## 4. New ideas: growth for owners and revenue for us

None of these appear in docs 01–22. Each was checked against CR-1 to CR-6 and SG-1 to SG-8. Ranked by **revenue impact ÷ effort**.

### 4.1 Acquisition: more outlets signing up

**N1. Free "Review Gap Report" lead magnet** · effort S · impact ★★★
A public page: type a business name, and Places search (already built) shows its rating, review count and review recency next to the top 3 nearby competitors in the same category. The report is emailed as a PDF, with a "Close the gap: start free trial" CTA and the signup pre-filled with the Place ID.
- *Why:* it turns the video's hook ("47 vs 180") into a personalised, self-serve sales tool that converts at 11pm without the founder.
- *Also:* the same generator produces **personalised leave-behinds for walk-ins** (GTM already plans leave-behinds; this automates them).
- *Compliance:* clean. It uses public Places data and makes no outcome promise.

**N2. Owner referral programme: "Give a month, get a month"** · effort S · impact ★★★
Each owner gets a referral link, and both sides get one free month when the referee pays. GTM §8 already relies on dentists referring dentists by hand at day 30; this systematises it, tracks it and rewards it. It lives in the dashboard ("Invite a colleague") and in the digest.
- *Compliance:* clean. It is an incentive for *owners to refer owners*, not for reviews.

**N3. Industry partner channel lite** · effort M · impact ★★
Commission links for dental-supply reps, CA firms, salon-product distributors and gym-equipment dealers, who already visit these businesses weekly. They get a 20% recurring commission for 12 months, tracked with a partner code. This is a lighter first step than the full agency tenancy (OD-7).

**N4. "Powered by Revyu" footer on the customer flow** · effort XS · impact ★
A small, tasteful link on the thank-you and neutral screens: "Own a business? Get your own review QR". Every scan becomes distribution.

### 4.2 Activation: more scans (the kill metric's biggest risk)

**N5. Digital-receipt placement integrations** · effort M · impact ★★★
The review link is automatically added to **every** digital invoice or appointment confirmation the business already sends: Razorpay/UPI payment receipts, clinic software, salon POS, Google Calendar confirmations. Because it goes to every customer, it is non-selective and fits the spirit of SG-4.
- *Needs:* a CR-4 amendment, since CR-4 currently says printed only. Add "automated, sent to all customers, never staff-triggered per person" as a permitted placement. Legal/policy review first.

**N6. Placement coach + scan heatmap** · effort S · impact ★★
- Each printed asset gets its own QR variant (`?p=receipt`, `?p=standee`), so the owner sees *which placement works*.
- The dashboard then recommends: "Your standee gets 4× the scans of your cards. Print 2 more."
- Zero-scan outlets get an automated "3 fixes" email with photos.
- *Why it matters:* this attacks the #1 business risk (scan volume) directly.

**N7. Installable owner PWA with push notifications** · effort S · impact ★★
Add a manifest and service worker to `/app`, and send web push for new private feedback, first scan and "credits low". This gives instant, free, automated alerts, which removes most of the pressure to get the WhatsApp BSP and makes the owner open the app daily, which drives retention.

### 4.3 Retention: owners keep paying past month 8

**N8. Competitor Watch** · effort S–M · impact ★★★
The owner picks up to 3 named nearby competitors. The weekly Places poll (already built) tracks them too: review count, rating and weekly velocity. The digest leads with "You +6 this week · Smile Care +2 · you're closing the gap".
- *Why it's different* from the v3 "benchmark reports" the roadmap calls weak: those are anonymous category medians. This is *your named rival*, which is emotional and checked weekly. It is the strongest retention hook available with data we already collect.

**N9. Local rank tracker ("Where do you show up?")** · effort M · impact ★★
Once a month, check the outlet's position in the Google local pack for 3 keywords ("dentist near me", "dentist in Andheri") from a grid of points, and chart it next to review count. This shows the link *reviews → ranking* with the owner's own data, without making an outcome claim. It needs a paid SERP API (about ₹2–5 per check), so it is a Pro feature (see N12).

**N10. Pause instead of cancel** · effort S · impact ★★
In the cancel flow, offer "Pause for 1–3 months at ₹99/mo. Your QR shows the neutral screen and your data is kept." Seasonal businesses (coaching institutes, tourist-area salons) pause rather than churn. Add a win-back email at day 30 and day 90 after cancelling.

**N11. Monthly "Proof of Value" report** · effort S · impact ★★
A branded one-page PDF on the 1st of each month:
- measured numbers only: scans, completed, Google review delta, rating trend, top praised tags, feedback resolved
- competitor position (N8)

Owners forward it to partners and staff, which gives the product visibility inside the business. It goes further than the "digest improvements" item: a separate, shareable artefact.

### 4.4 Expansion revenue: more ₹ per outlet

**N12. "Revyu Pro" at ₹999/mo** (after v2 exists) · effort — · impact ★★★
OD-6 killed tiers because every tier would have *identical functionality* and the price would differ only by who the business is. A feature tier avoids that problem. Base stays ₹499 (collection, dashboard, feedback). Pro adds:
- AI reply drafting
- Competitor Watch (N8)
- rank tracker (N9)
- staff attribution
- multiple QRs
- SLA inbox

**N13. Google Business Profile management as Growth Service S6** · effort S (service) · impact ★★★
A done-for-you GBP optimisation: categories, services, photos, hours, weekly Google Posts, and answers to Q&A.
- *Pricing:* ₹2,999 one-time audit + fix, or ₹1,499/mo managed.
- *Why:* it is the most natural upsell for someone who already cares about Google reviews, it needs no new tech in Phase A (fits the 22 §7 request pipeline), and it is high-margin.
- *Later:* the GBP API (needs Google approval) lets replies and posts publish directly instead of by copy-paste.

**N14. Review showcase widget + social cards** · effort M · impact ★★
- An embeddable "Google reviews" widget for the owner's website. It shows real Google reviews through the Places API with the required attribution, and carries "Powered by Revyu".
- Auto-generated Instagram and WhatsApp-status image cards from 5★ Google reviews, feeding Growth Service S3.
- Can be included in Pro or sold at ₹299/mo.
- *Compliance:* show only real, published reviews, verbatim, with attribution (SG-5). Never the drafts.

**N15. Premium print kit** · effort S (via a print-on-demand partner) · impact ★
An acrylic counter standee plus 200 laminated cards, shipped: ₹1,499 one-time, or free on the annual plan. Better materials mean more scans. It is printed placement only (CR-4), so it doesn't reverse "no hardware" in spirit, but it *is* a new physical SKU; decide explicitly.

**N16. Annual-plan conversion engine** · effort XS · impact ★★
Offer annual at the three moments of highest satisfaction: after the first 10 reviews, after the first private-feedback save, and at the 90-day mark ("Switch to annual, save ₹1,489, about 3 months free"). This improves cash flow and cuts churn mechanically.

### 4.5 Platform and operations

**N17. Multi-location self-serve** · effort M · impact ★★
Pulled forward from v3 as a *light* version: an owner adds a second outlet from Settings at the same ₹499, with a location switcher in the app shell. This is the cheapest path to ₹1,000+ accounts before full chain rollups.

**N18. Customer-flow A/B framework** · effort M · impact ★★ (for us)
Server-assigned variants (tag-chip order, CTA copy, landing text) with conversion measured per variant. **Never** vary Google availability (CR-3). This turns the kill metric from a single measurement into something you can raise with each experiment. Run it on non-cohort outlets only (OD-26 logic).

### 4.6 Ideas considered and dropped (so no one re-proposes them)

| Idea | Why not |
|---|---|
| SMS or WhatsApp review requests sent by Revyu to customers | OD-15 is a deliberate no-customer-messaging boundary, and owner-picked recipients breach SG-4 |
| "Review of the month" prize draw for customers | CR-5, an incentive |
| Filtering which reviews the widget shows by rating | Selective display can be allowed, but it cuts against our own "honest by design" story. Show the most recent ones instead |
| Reviews on Practo, JustDial or Zomato now | Already in v3; don't pull forward before the kill metric |

---

## 5. Recommended sequence at a glance

```
Week 1   Phase 0 — safety, CR-3 fixes, hub reservation, tests in CI
Week 2   Phase 1 — billing + lock screen + trial lifecycle + cockpit
Week 2–3 Phase 2 — design system, app shell, flow polish (parallel)
         + N1 Review Gap Report, N2 referral, N4 powered-by, N16 annual nudges
Week 4+  Installs (GTM §8). N6 placement coach, N7 PWA push.
         N13 GBP service offered manually (no build).
Day 30   Kill-metric decision
v2       Roadmap v2 + N8 Competitor Watch → N12 Pro tier (N9, N14)
```

## 6. Decisions needed from the owner

1. **Design direction:** keep the shipped blue/serif, or move to the brief's indigo/amber/Archivo? (Recommended: the brief.)
2. **CR-4 amendment for digital-receipt placement (N5):** get a policy/legal review before building.
3. **Pro tier (N12):** confirm it is compatible with the OD-6 reasoning.
4. **Physical print kit (N15):** yes or no to a physical SKU.
5. Still open from 11-OPEN-DECISIONS: **OD-24, OD-25, OD-26** (these block v1.5).
