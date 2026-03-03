# Software Requirements Specification

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18
**Standard:** Adapted from IEEE 830

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for Revyu v1. It is
the build reference. Where it conflicts with [01-PRD.md](01-PRD.md), the PRD
governs intent and this document governs implementation detail. Where either
conflicts with [03-COMPLIANCE.md](03-COMPLIANCE.md), compliance governs
absolutely.

### 1.2 Scope

v1 delivers: a mobile-web customer review flow, an owner dashboard, a
founder-operated admin console, trial metering, and self-serve billing.

**Build scope is global; launch scope is not.** The system supports any vertical,
country, currency, and locale as data ([17-GLOBAL-READY.md](17-GLOBAL-READY.md)).
v1 launches India / English / INR / Razorpay across **all verticals** (OD-4). Nothing may be hardcoded
to those values (FR-69 – FR-75).

Explicitly out of scope for v1: review response drafting, staff attribution,
multi-outlet, non-Google platforms, fully unattended activation (the approval
gate stays — §3.4a), native apps, multilingual support, **and (2026-09-30) the
hub, social connects, menu, loyalty and Growth Services** — these are v1.5 / v2+
([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §9). v1 only **reserves** the
schema and routes.

### 1.3 Definitions

| Term | Definition |
|---|---|
| **Outlet** | A single physical business location. The unit of billing and QR generation. In v1, one outlet per account. |
| **Owner** | The paying account holder. |
| **Customer** | The business's patron who scans the QR. Not an account holder. |
| **Session** | One customer's pass through the flow, identified by an anonymous session ID. |
| **Completed flow** | Session reaching stars + tags + copy tap. The unit of trial metering. |
| **Handoff** | Redirect from our flow to the Google review URL. |
| **Draft** | Review text assembled at runtime from tag selections. |
| **Place ID** | Google's stable identifier for a business location. |

### 1.4 References

- [01-PRD.md](01-PRD.md) — product intent, FR/NFR IDs
- [03-COMPLIANCE.md](03-COMPLIANCE.md) — CR-1..CR-5
- [05-DATA-MODEL.md](05-DATA-MODEL.md) — schema
- [06-API-SPEC.md](06-API-SPEC.md) — endpoints
- `D:\design\design-system.md` — visual system

---

## 2. Overall description

### 2.1 Product perspective

A standalone web application. Three surfaces sharing one backend and database:

```
  QR (printed)
      │
      ▼
  Short URL ──► Customer Flow (public, mobile web, no auth)
                     │  events
                     ▼
              ┌─────────────┐      ┌──────────────┐
              │   Backend   │◄────►│   Postgres   │
              └─────────────┘      └──────────────┘
                 │    │    │
                 │    │    └──► Google Places API  (rating/review polling)
                 │    └───────► Email provider     (owner notifications)
                 └────────────► Razorpay           (billing, mandates)
                     ▲
          ┌──────────┴──────────┐
          │                     │
   Owner Dashboard        Admin Console
   (OTP auth)             (founder only)
```

### 2.2 User classes

| Class | Auth | Frequency | Technical skill |
|---|---|---|---|
| Customer | None | Once | Any. Assume none. |
| Owner | Email + OTP | Weekly | WhatsApp-native, low desktop use |
| Admin (founder) | Strong auth | Daily | Full |

### 2.3 Operating environment

**Customer:** Android Chrome and iOS Safari, last 2 major versions. 360px
minimum viewport. Must function on 3G. Must function with clipboard API
unavailable.

**Owner:** Same mobile browsers; desktop supported but not optimised for.

**Server:** FastAPI (Python), managed Postgres. Frontend: Next.js.

### 2.4 Constraints

| ID | Constraint |
|---|---|
| C-1 | Google's review form accepts **no** prefilled rating or text. The paste step is unavoidable. |
| C-2 | Review publication is **not** verifiable per-customer through any available API. |
| C-3 | ~~WhatsApp BSP lead time~~ — **removed from v1** (OD-9). Email covers all owner notification. Razorpay KYC is the only remaining calendar dependency. |
| C-4 | UPI AutoPay mandate creation has non-trivial failure rates. A one-time payment fallback is mandatory. |
| C-5 | Compliance rules CR-1..CR-6 are inviolable. *(CR-6 added 2026-09-30.)* |
| C-6 | The customer flow must never **break** — no dead links, no errors. It resolves in every state. *(Revised 2026-09-18: collection **stops** in `suspended`/`deactivated`; the URL still resolves to a neutral screen. See [05-DATA-MODEL.md](05-DATA-MODEL.md) §4.1a.)* |

### 2.5 Assumptions and dependencies

- Owner has an existing, claimed Google Business Profile
- Owner has a working email address (login identifier, OD-16)
- Owner can print, or have printed, receipt footers or handout cards
- Third-party availability: Google Places API, email provider, Razorpay

---

## 3. Functional requirements

### 3.1 Short URL resolution

**SRS-1.1** Each outlet is assigned a unique short slug, 6–8 characters,
URL-safe, non-sequential, case-insensitive on lookup.

**SRS-1.2** `GET /r/{slug}` resolves to the customer flow landing screen.

**SRS-1.3** Resolution latency must be < 200ms at p95 (NFR-3).

**SRS-1.4** An unknown slug returns a branded 404 that does not leak whether
the slug ever existed.

**SRS-1.5** Resolution **must** succeed in every outlet state — it never returns
a dead link or a server error (C-6). *Revised 2026-09-18:* what it resolves *to*
depends on state.

**SRS-1.5a** In `trial`, `active`, `past_due`, and `locked`, resolution serves
the full customer flow and collection continues.

**SRS-1.5b** In `suspended` and `deactivated`, resolution serves a **neutral
screen** showing the business name and a brief message. **No rating, no tags, no
draft, no Google handoff.** Collection stops
([05-DATA-MODEL.md](05-DATA-MODEL.md) §4.1a).

**SRS-1.5c** The neutral screen must not read as an error or as the business's
fault. It is a quiet dead-end, not a failure.

**SRS-1.5d** Reactivation on payment is **immediate** — previously printed QRs
resume working with no reissue and no new slug.

**SRS-1.6** `scan` events are still recorded in `suspended`/`deactivated` so the
owner can be shown what they are missing on reactivation.

**SRS-1.7** Each resolution emits a `scan` event before rendering.

### 3.2 Customer flow — screens

Screen order: Landing → Rating → Tags → Draft → Handoff → Thank You.
Private feedback is reachable from Draft and Handoff.

> **Revised 2026-09-30 — the hub.** In `hub_mode = menu` with two or more modules,
> a hub precedes this sequence; the sequence below is the **review module** and is
> unchanged. In `direct` mode (the default, and the kill-metric validation
> cohort) it is entered straight from the QR. Hub, Connect, Menu and Rewards are
> specified in [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) (SRS-20 – SRS-24).
> SRS-2.2 below governs the review landing only.

#### SRS-2 Landing

- **SRS-2.1** Displays outlet business name and logo.
- **SRS-2.2** Displays a single prompt and a single primary action.
- **SRS-2.3** Renders meaningfully without JavaScript (NFR-5).
- **SRS-2.4** First contentful paint < 2.0s on 3G (NFR-1).
- **SRS-2.5** Emits `flow_start` on first interaction.

#### SRS-3 Rating

- **SRS-3.1** Presents a 1–5 star control. Touch targets ≥ 44×44px.
- **SRS-3.2** Selection is required to advance.
- **SRS-3.3** Selection is changeable before advancing.
- **SRS-3.4** Emits `rating_selected` with the value.
- **SRS-3.5** **No branching on the value.** All ratings follow one path (CR-3).

#### SRS-4 Tags

- **SRS-4.1** Displays the outlet's configured tag set as chips.
- **SRS-4.2** Multi-select. Zero selections permitted.
- **SRS-4.3** Tag set is identical for all ratings — no rating-conditional tags (CR-3).
- **SRS-4.4** Emits `tags_selected` with the selected tag IDs.
- **SRS-4.5** Tag count per outlet: 6–10 recommended, 12 maximum.

#### SRS-5 Draft

- **SRS-5.1** Draft is assembled at runtime from selected tag IDs only (CR-1).
- **SRS-5.2** Assembly uses neutral connective grammar; all substance maps 1:1
  to selected tags.
- **SRS-5.3** Zero tags selected produces an empty or near-empty draft (CR-1 test).
- **SRS-5.4** Draft renders in an **editable** text area, editable by default,
  not behind any interaction (CR-2).
- **SRS-5.4a** A **disclosure line is permanently visible** adjacent to the
  draft, at every rating: *"We've written this from what you selected. Edit
  anything — it's your review."* Not a tooltip, not behind an icon, not below
  the fold (FR-59).
- **SRS-5.4b** Drafts are SEO-optimised — business name, locality where natural,
  2–4 sentences, varied structure — with all substance tracing to a selected tag
  or the outlet's factual record (FR-56, FR-62).
- **SRS-5.4c** ≥4 phrasing variants per tag, ≥6 opening templates, rotated on
  session ID so identical tag sets do not produce identical text (FR-57, FR-58).
- **SRS-5.5** The customer may clear the draft entirely and still proceed.
- **SRS-5.6** No stored review text exists in database, config, or code (CR-1).
- **SRS-5.7** Primary action is "Copy". Emits `draft_viewed` on render.
- **SRS-5.8** Copy action writes to clipboard and shows unmistakable confirmation.
- **SRS-5.9** If the clipboard API is unavailable, fall back to a
  select-all-on-tap field with manual copy instruction (FR-16).
- **SRS-5.10** Emits `copy_tapped`. **This event completes the flow** for trial
  metering (FR-42).
- **SRS-5.11** A private feedback entry point is present on this screen, for all ratings.

#### SRS-6 Handoff

- **SRS-6.1** An interstitial states that the next screen is Google and that
  the customer should paste (FR-11, C-1).
- **SRS-6.2** Redirects to the outlet's stored Google review URL.
- **SRS-6.3** *(revised 2026-09-18)* The Google option is **present and fully
  available** at every rating 1–5. At 1–3 stars it is styled secondary to
  private feedback; availability, size, contrast, and tap-count are identical at
  all ratings (CR-3, SRS-17.1a–g,
  [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) §2.3).
- **SRS-6.4** Emits `handoff` immediately before redirect.
- **SRS-6.5** A private feedback entry point is present here too, for all ratings,
  in addition to — never instead of — the Google link (CR-3).
- **SRS-6.6** No instrumentation exists beyond this point. Anything after the
  redirect is unobservable (C-1).

#### SRS-7 Private feedback

- **SRS-7.1** Reachable by all customers at all ratings (CR-3).
- **SRS-7.2** Free-text field, optional contact field.
- **SRS-7.3** Submission stores the message and delivers to the owner via
  WhatsApp and email (FR-14).
- **SRS-7.4** Emits `private_feedback_submitted`.
- **SRS-7.5** Submitting private feedback **does not** suppress or hide the
  Google link (CR-3).
- **SRS-7.6** Rate-limited per session and per IP to prevent abuse.

#### SRS-8 Cross-cutting flow behaviour

- **SRS-8.1** Every transition emits an event carrying outlet ID, session ID,
  step name, and timestamp (FR-15).
- **SRS-8.2** Session ID is anonymous, generated client-side, not linked to identity.
- **SRS-8.3** Back navigation preserves prior selections (FR-18).
- **SRS-8.4** Session state survives reload within 30 minutes (FR-19, Could).
- **SRS-8.5** Total first-load transfer < 150KB (NFR-2).
- **SRS-8.6** Honors `prefers-reduced-motion` (NFR-11).
- **SRS-8.7** WCAG 2.1 AA on all customer screens (NFR-12).

### 3.3 Trial metering
<!-- ANCHOR: trial-metering -->


**SRS-9.1** A completed flow is recorded when `copy_tapped` fires (FR-42).

**SRS-9.2** Deduplication by device fingerprint and, where present, phone
number (FR-43). A repeat within the dedup window does not increment the counter.

**SRS-9.3** Dedup window: 24 hours. Configurable.

**SRS-9.4** *(Revised 2026-09-18 — OD-21.)* The trial has **two stages**:

**Stage 1 — 15 free days from activation.** Unlimited completed flows, dashboard
fully open.

**Stage 2 — 10 review credits.** At day 15 the **dashboard locks** but collection
continues for **10 more completed flows**. The owner sees a countdown
("7 review credits left") in the lock screen and in emails.

**Stage 3 — collection stops.** When the 10 credits are consumed, the outlet
transitions to `suspended`: dashboard locked and the QR serves the neutral
screen (SRS-1.5b).

```
activation ──15 days──► dashboard locks, 10 credits remain
                             │
                             ├── pays ──────────► active
                             │
                             └── 10 credits used ──► suspended
                                                    (QR stops collecting)
```

**SRS-9.4a** Credits decrement only on **deduped** completed flows
(SRS-9.2) — a repeat device within the dedup window does not consume one.

**SRS-9.4b** Remaining credit count is exposed in the dashboard lock screen, the
owner's email, and `GET /api/app/overview`.

**SRS-9.5** Published reviews are never a trigger (FR-44, C-2).

**SRS-9.6** At day 15: outlet state → `locked`. Dashboard locks. **Short URL and
customer flow remain live and keep collecting, for 10 more completed flows**
(FR-45). When credits reach zero → `suspended`.

> Do not confuse `locked` with `suspended`. `locked` is dashboard-only with
> collection continuing on credits — the accumulating unseen results plus a
> visible countdown are the conversion mechanic. `suspended` stops collection
> (SRS-1.5b, OD-18).

**SRS-9.7** Stage transitions each fire one owner notification (FR-46):

| Trigger | Message |
|---|---|
| Day 15 — dashboard locks | Accumulated numbers + "10 review credits left" + payment link |
| 3 credits remaining | Countdown warning |
| Credits exhausted → `suspended` | **"Your review QR has stopped working"** + payment link |

**SRS-9.7a** After suspension, the owner is reminded that **printed codes in
customers' hands are no longer collecting** — by email and as a persistent
dashboard banner. Reactivation is one payment and requires no reprinting
(SRS-12.9).

> This is the strongest retention lever in the product. A business that printed
> the QR on receipts, bags, or thank-you cards has physical assets already
> distributed. "Those are dead until you pay" is concrete in a way a locked
> dashboard is not — and it is **true**, not manufactured urgency.
>
> It also depends on placement: a business that only ever used a counter standee
> can just remove it. One that printed 5,000 receipt footers cannot. This is why
> take-home placement is pushed first at install
> ([08-GTM.md](08-GTM.md) §3.2).

**SRS-9.8** The locked dashboard displays true accumulated counts behind the
paywall — scans, completed flows, private feedback count (FR-29).

### 3.4 Owner dashboard

**SRS-10.1** Authentication is **email address + OTP delivered by email**. No
password (FR-20). *(Revised 2026-09-18, OD-16 — was phone + SMS OTP. The phone
number remains the account identity and notification destination; only the login
identifier and OTP channel changed.)*

**SRS-10.1a** The OTP email contains both a 6-digit code and a single-use magic
link with identical token lifecycle. Either completes login.

**SRS-10.1b** The sending domain must have SPF, DKIM, and DMARC configured
before the first install. Unauthenticated OTP mail lands in spam and login is
functionally broken.

**SRS-10.1c** The OTP channel is a per-account field defaulting to `email`, so
SMS can be added later as an adapter rather than an auth rewrite.

**SRS-10.2** OTP: 6 digits, 10-minute expiry, max 5 attempts, rate-limited per
email address.

**SRS-10.3** Session duration 30 days, revocable.

**SRS-10.4** Headline counters: scans, completed flows, conversion rate (FR-21).

**SRS-10.5** Funnel view with absolute count and drop-off percentage at each
step: scan → flow_start → rating → tags → draft → copy → handoff (FR-22).

**SRS-10.6** Tag frequency with period-over-period change (FR-23).

**SRS-10.7** Google rating and review count, baseline vs. current (FR-24),
sourced from the weekly Places poll.

**SRS-10.8** Private feedback inbox, reverse chronological (FR-25), with
resolve + timestamp (FR-26).

**SRS-10.9** Date range filter: 7d / 30d / all (FR-27).

**SRS-10.10** Print asset downloads: receipt footer, handout card, standee
(FR-31). Formats per [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md).

**SRS-10.11** Mobile-first layout (NFR-8).

**SRS-10.12** Locked state per SRS-9.8, with a single unlock action.

### 3.4a Self-serve signup and approval

*Added 2026-09-18. Owners sign up and pay on the website; the founder approves
before activation.*

#### SRS-18 Public signup

- **SRS-18.1** Public signup form at `/signup`, no authentication required.
- **SRS-18.2** Collects: business name, vertical, owner name, owner phone,
  **owner email (login identifier, unique)**.
- **SRS-18.3** Business selection is by **search-and-pick against Google
  Places**, not free text. The owner picks their own business from results
  showing name and full address.
- **SRS-18.4** The resolved Place ID is stored but **flagged unverified**
  (`place_verified = false`) until founder confirmation.
- **SRS-18.5** Duplicate detection on email, phone, and Place ID. An existing
  Place ID blocks signup and directs the owner to support.
- **SRS-18.6** Payment is taken **at signup**, before approval (FR-40b).
- **SRS-18.7** On payment success the outlet is created in `pending_approval`
  with `source = 'self_serve'`. **No slug or QR is generated yet.**
- **SRS-18.8** The owner sees a clear status screen: payment received,
  verification in progress, expected timeframe.
- **SRS-18.9** The owner may log in while pending and sees the same status
  screen in place of the dashboard.
- **SRS-18.10** Signup requires explicit acknowledgement of the receipt/card
  placement rule (CR-4) as a checkbox with the rule stated in full.

#### SRS-19 Approval queue

- **SRS-19.1** Admin queue lists all `pending_approval` outlets, oldest first,
  with age since `submitted_at`.
- **SRS-19.2** Each entry shows: submitted details, the matched Google business
  (name, full address, current rating, review count), a working preview link to
  the customer flow, and payment status.
- **SRS-19.3** Approval requires **both** checks recorded explicitly:
  `place_verified` and `placement_confirmed` (FR-40d).
- **SRS-19.4** Approval sets `approved_at` / `approved_by`, generates slug and
  QR, renders print assets, transitions to `trial`, and sets `activated_at`
  (SRS-9.4).
- **SRS-19.5** Approval emails the owner their QR, print assets, and dashboard
  link (FR-40e).
- **SRS-19.6** **"Needs info"** returns the outlet to the owner with a message;
  the outlet stays `pending_approval` and payment is retained.
- **SRS-19.7** **Rejection** sets `rejected`, records `rejection_reason`, and
  triggers a refund (FR-40g).
- **SRS-19.8** Admin may correct the Place ID before approving without
  requiring owner action.
- **SRS-19.9** Queue age over 24h raises an admin alert. A paid customer waiting
  is the most fragile state in the system.

> **Why payment precedes approval:** it filters out unserious signups before
> founder time is spent, and an owner who has paid is materially more likely to
> take the placement conversation seriously. The trade-off is that rejections
> require refunds (SRS-19.7) — acceptable, and rare if the form is clear.

---

### 3.5 Admin console

**SRS-11.1** Founder-only, behind strong authentication, not publicly linked.

**SRS-11.2** Create outlet: business name, vertical, logo upload, owner phone,
**owner email (required — it is the login identifier, OD-16)** (FR-33).

**SRS-11.3** Google Place ID lookup by name + location (FR-34).

**SRS-11.4** The generated review URL is validated before the outlet may be
activated (FR-35).

**SRS-11.5** Tag set defaults by vertical, editable per outlet (FR-36, FR-5).

**SRS-11.6** Generate unique slug and QR on activation (FR-37).

**SRS-11.7** QR export as SVG and PNG ≥ 1024px (FR-38).

**SRS-11.8** Record baseline Google rating and review count at activation (FR-39).

**SRS-11.9** Manual override of outlet state, for support.

### 3.6 Billing

**SRS-12.1** Plans are read from the `plans` table by `(code, country_code)` —
**never hardcoded** (FR-71). v1 seed: ₹499/month, ₹4,499/year for India, annual
displayed against the monthly equivalent (FR-48, FR-49).

**SRS-12.1a** All monetary values are stored and transmitted as `amount_minor`
(integer, smallest currency unit) plus `currency_code` (ISO 4217). Never floats,
never currency-implicit (FR-70).

**SRS-12.2** Payment is provided through a **`PaymentProvider` interface**
selected by `outlets.country_code`. v1 implements Razorpay only (India, UPI
AutoPay mandate). Provider-specific mandate semantics, webhook shapes, and
refund flows live behind the interface (FR-72).

**SRS-12.3** On mandate creation failure, offer a one-time payment for the
first period and retry the mandate later (FR-50, C-4).

**SRS-12.4** Successful payment unlocks the dashboard immediately (FR-47).

**SRS-12.5** Failed recurring charge: retry per gateway schedule, notify the
owner, apply a **7-day grace period with the customer flow fully live**, then
transition to `suspended` (FR-51).

**SRS-12.6** Trial-threshold locking (`locked`) affects the dashboard only —
collection continues. This is the conversion mechanic and depends on the QR
working (SRS-9.6).

**SRS-12.7** Cancellation: dashboard and collection both continue to period end,
then `deactivated` — collection stops, the URL resolves to the neutral screen
(SRS-1.5b).

**SRS-12.9** Reactivation from `suspended` or `deactivated` restores full
collection immediately on payment, reusing the existing slug and QR. Printed
material must never need reissuing.

**SRS-12.8** All payment state changes are driven by verified webhooks, never
by client redirect alone.

### 3.7 Notifications

**SRS-13.1** All owner WhatsApp messages use pre-approved templates (C-3).

**SRS-13.2** Templates required for v1:
  1. Outlet activated — QR ready
  2. First scan received
  3. Trial threshold reached — includes numbers and payment link
  4. Private feedback received
  5. Weekly digest
  6. Payment failed

**SRS-13.3** Weekly digest: scans, completed flows, conversion, top tag, rating
change (FR-28). Opt-out honoured.

**SRS-13.4** Email is the fallback channel when WhatsApp delivery fails, and the
primary channel until BSP approval completes (C-3).

**SRS-13.5** Private feedback notification is delivered within 5 minutes of
submission.

### 3.8 Google Places polling

**SRS-14.1** Weekly poll per active outlet for rating and review count.

**SRS-14.2** Results stored as a time series for the before/after view (FR-24).

**SRS-14.3** Polling is **not** used for trial metering (SRS-9.5, C-2).

**SRS-14.4** Poll failures are retried and do not surface as owner-facing errors.

---

## 4. Non-functional requirements

Restated from the PRD with acceptance criteria.

| ID | Requirement | Acceptance |
|---|---|---|
| NFR-1 | Customer flow FCP on 3G | < 2.0s, Lighthouse throttled |
| NFR-2 | First-load transfer | < 150KB total |
| NFR-3 | Redirect latency | < 200ms p95 |
| NFR-4 | Customer flow availability | 99.9% monthly |
| NFR-5 | Landing without JS | Renders name, logo, prompt |
| NFR-6 | Browser support | Android Chrome, iOS Safari, last 2 major |
| NFR-7 | Minimum viewport | 360px, no horizontal scroll |
| NFR-8 | Dashboard on mobile | Fully usable at 360px |
| NFR-9 | Customer PII | None stored except voluntary private feedback |
| NFR-10 | Event retention | 24 months |
| NFR-11 | Reduced motion | Honored on all surfaces |
| NFR-12 | Accessibility | WCAG 2.1 AA, customer flow |

### 4.1 Security

- **SRS-15.1** All traffic over HTTPS. HSTS enabled.
- **SRS-15.2** OTP endpoints rate-limited per email address and per IP.
- **SRS-15.3** Private feedback submission rate-limited per session and IP.
- **SRS-15.4** Razorpay webhooks signature-verified.
- **SRS-15.5** Admin console behind separate strong auth, not linked publicly.
- **SRS-15.6** Owners can access only their own outlet's data. Enforced
  server-side, not by UI.
- **SRS-15.7** Logo uploads: type and size validated, served from a separate origin.
- **SRS-15.8** No secrets in client bundles.

### 4.2 Privacy

- **SRS-16.1** No customer accounts, no cross-outlet tracking.
- **SRS-16.2** Session IDs anonymous and not linked to identity.
- **SRS-16.3** Device fingerprinting used solely for trial dedup (SRS-9.2),
  retained no longer than the dedup window plus audit need.
- **SRS-16.4** Private feedback may contain personal data — retention stated,
  deletion honoured on request.
- **SRS-16.5** Published privacy policy, terms, and refund policy before launch.

### 4.3 Compliance enforcement
<!-- ANCHOR: compliance-tests -->


Mechanical enforcement of CR-1..CR-5.

- **SRS-17.6** *(added 2026-09-30)* **CR-6 tests** — defined as SRS-21.6 in
  [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5.2: import lint across the
  loyalty/review boundary, schema test forbidding FKs between the two table
  groups, and a copy scan for review terms in loyalty strings and vice versa.
  SRS-17.1a–g also run against the hub → review path (SRS-20.4).

- **SRS-17.1** *(replaced 2026-09-18 — hierarchy now varies by rating; see
  [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) §2.7)* At every rating 1–5,
  tests assert the Google option is: **(a)** present, **(b)** above the fold at
  360×640, **(c)** ≥44×44px, **(d)** ≥4.5:1 contrast, **(e)** exactly one tap
  from the handoff, **(f)** still present after private feedback submission, and
  **(g)** labelled from an approved neutral string set (CR-3).

> These seven assertions are the compliance boundary between "private feedback
> presented first" and review gating. If the low-rating screen later drifts
> toward burying the Google option, these are what must fail CI.
- **SRS-17.2** A test asserts zero tags selected produces an empty or
  near-empty draft (CR-1).
- **SRS-17.3** A CI check fails the build if a review-text content table, seed
  file, or fixture is introduced (CR-1).
- **SRS-17.4** Code review rejects any rating-conditional branch in the handoff
  path (CR-3).
- **SRS-17.5** Each enforcement point carries a code comment citing its CR ID.

---

## 5. Acceptance criteria for v1

v1 ships when all of the following hold:

1. A customer can scan a printed QR and complete the full flow on a mid-range
   Android phone over 3G.
2. Every step emits an event, and the funnel renders correctly in the dashboard.
3. All five compliance tests (SRS-17) pass in CI.
4. Trial metering triggers correctly at day 15 and after 10 further credits.
5. The dashboard locks at threshold while the short URL continues to resolve.
6. An owner can pay and unlock with zero founder involvement.
7. WhatsApp templates are approved and sending, or email fallback is live.
8. Print assets generate at production print quality.
9. Ten qualified installs are ready to activate.
