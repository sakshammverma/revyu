# Product Requirements Document

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18
**Status:** Pre-build

---

## 1. Summary

Revyu is a QR-code based review collection tool for single-outlet small
businesses. The platform serves **any vertical in any country**
([17-GLOBAL-READY.md](17-GLOBAL-READY.md)); **this document describes the v1
launch, which is deliberately narrower — dental clinics in India.** A customer scans a code on their receipt or a take-home
card, rates their visit, selects tags describing it, and is handed a draft
review assembled from their own input which they copy and paste into Google.

The product exists to answer one question: **do customers actually scan these
codes, and do they follow through once they hit the paste step?**

Everything in v1 is built to measure that. Features that do not serve that
measurement are deferred.

---

## 2. Problem

Small businesses in India whose growth depends on local search ranking have no
reliable way to convert satisfied customers into Google reviews.

The observed failure modes:

- **Asking verbally doesn't scale.** Staff forget, feel awkward, or ask only
  the customers they already like.
- **The blank box is the wall.** A customer willing to leave a review opens
  Google, sees an empty text field, cannot think of what to write, and leaves.
  Willingness is not the bottleneck — articulation is.
- **Existing tools are non-compliant.** Most review tools in this market
  sentiment-gate: happy customers get the Google link, unhappy ones get a
  private form. This is explicitly prohibited and actively enforced. Businesses
  using these tools carry a risk they have not been told about.

The business impact is concrete: for a dental clinic, physio, or salon, local
pack ranking is a primary acquisition channel, and review count and recency are
significant ranking inputs.

---

## 3. Target user

### 3.1 Primary buyer — the Owner

**Launch vertical: dental clinics.** Single-outlet, owner-operated.

| Attribute | Detail |
|---|---|
| Role | Practice owner, usually the practising dentist |
| Business size | 1–3 chairs, 2–8 staff |
| New customer value | ₹3,000–15,000+ lifetime |
| Current review count | Typically 15–80 |
| Tech comfort | WhatsApp-native. Uses a smartphone for everything. Will not learn a desktop dashboard. |
| Buying behaviour | Decides alone. No procurement. Trusts demonstrated results and peer references over pitches. |
| Price sensitivity | Low in absolute terms, high in trust terms. ₹499/mo is trivial against patient value; the hesitation is "will this actually do anything." |

**Why dental first:** highest patient lifetime value, most review-sensitive
buyers, dense referral networks between practitioners, and Practo exists as a
second review surface later.

**Expansion verticals** (post three dental references): physiotherapy, gyms,
salons, coaching centres.

### 3.2 Secondary user — Staff

Front-desk or reception. Hands over the receipt or card. Their cooperation is
mandatory — an install where nobody hands out the QR produces zero scans. This
is a distribution problem, not a product problem, but the product should make
their part trivially easy (see FR-31, print assets).

### 3.3 End user — the Customer

The patron who scans. Not an account holder. Never registers, never logs in,
never returns. Mobile web only. May be on a slow connection. May abandon at any
step, and the product must record where.

---

## 4. Goals and non-goals

### 4.1 Goals (v1)

- **G1.** Measure scan → completed flow conversion with per-step instrumentation.
- **G2.** Produce authentic, customer-authored review drafts without violating
  any Google policy.
- **G3.** Route dissatisfied customers to the owner privately, *without*
  withholding the public review option from them.
- **G4.** Give the owner proof of value in a channel they actually read (WhatsApp).
- **G5.** Convert trial to paid self-serve, with no founder intervention.

### 4.2 Non-goals (v1)

- ❌ Multi-outlet / chain support
- ❌ Review response drafting *(planned v2 — the churn answer)*
- ❌ Platforms other than Google *(Practo planned v2 for dental)*
- ❌ Native mobile app — mobile web only, permanently
- ❌ Customer accounts or login of any kind
- ❌ Any attempt to verify or confirm that a review was actually published
- ❌ Reward, incentive, discount, or loyalty mechanics **tied to reviews** *(prohibited — CR-5).* *(Revised 2026-09-30: an owner-run loyalty module is planned for v2, firewalled from review collection by CR-6 — [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5.)*
- ❌ Hub, social connects, menu, loyalty, and Growth Services in the **v1 validation build** — schema and routes are reserved, UI ships in v1.5 / v2 ([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §9)
- ❌ English-only is acceptable for v1; multilingual deferred

---

## 5. Product principles

1. **The QR never breaks — but it does stop.** A printed code in a patient's
   hand must always resolve; a dead link or error is never acceptable. But
   **collection stops when payment stops** (FR-53). During the trial and while
   trial-locked, collection continues — that is the conversion mechanic. After
   sustained non-payment or cancellation, the URL resolves to a neutral screen
   and collects nothing. Reactivation is instant and reuses the printed code.
2. **Compliance is a feature, not a constraint.** We sell against gating
   competitors. The compliance page is a marketing page.
3. **The paste step is honest.** It cannot be engineered away. We design for it
   being expected rather than hiding it and losing people at the surprise.
4. **Measure the drop-off, not the success.** Any step without instrumentation
   is a step we cannot improve.
5. **The owner lives in WhatsApp.** Anything important reaches them there.
   The dashboard is where they go to look deeper, not to be notified.

---

## 6. Functional requirements

### 6.1 Customer flow

Mobile web. No install. No login. Must work on a mid-range Android phone over 3G.

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Scanning the QR resolves a short URL to the outlet's branded landing screen | Must |
| FR-2 | Landing screen shows business name, logo, and a single clear prompt | Must |
| FR-3 | Customer selects a star rating, 1–5 | Must |
| FR-4 | Customer selects zero or more tag chips from the outlet's configured set | Must |
| FR-5 | Tag set is vertical-specific and admin-configurable per outlet | Must |
| FR-6 | A draft review is assembled **from the customer's own tag selections only** | Must |
| FR-7 | Draft is fully editable in a free-text field before copying | Must |
| FR-8 | No pre-written review library exists anywhere in the system (see CR-1) | Must |
| FR-9 | "Copy" action copies draft to clipboard and confirms visibly | Must |
| FR-10 | After copy, customer is handed off to the outlet's Google review URL | Must |
| FR-11 | An interstitial sets expectation that they must paste into Google | Must |
| FR-12 | **Every rating sees the Google link.** No branching on sentiment (CR-3) | Must |
| FR-13 | A private feedback text box is offered to all ratings, in addition to — never instead of — the Google link | Must |
| FR-14 | Private feedback submission delivers to the owner via WhatsApp and email | Must |
| FR-15 | Every step transition emits an analytics event with outlet and session ID | Must |
| FR-16 | Flow degrades gracefully if clipboard API unavailable (manual select fallback) | Must |
| FR-17 | Flow is usable one-handed, thumb-reachable, on a 360px viewport | Must |
| FR-18 | Back navigation preserves prior selections | Should |
| FR-19 | Session resumes if the customer returns within 30 minutes | Could |

### 6.2 Owner dashboard

Mobile-first. The owner will open this on a phone.

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | Owner logs in via **email + OTP delivered by email** (no password). Phone remains the account identity. *(Revised OD-16)* | Must |
| FR-21 | Headline counters: scans, completed flows, conversion rate | Must |
| FR-22 | Step-by-step funnel with drop-off shown per step | Must |
| FR-23 | Tag frequency, with change over time | Must |
| FR-24 | Google rating and review count, before vs. current | Must |
| FR-25 | Private feedback inbox, reverse chronological | Must |
| FR-26 | Private feedback items can be marked resolved, with timestamp | Should |
| FR-27 | Date range filter: 7d / 30d / all | Should |
| FR-28 | Weekly WhatsApp digest of key numbers, opt-out available | Must |
| FR-29 | Paywall-locked state shows real accumulated numbers behind the lock | Must |
| FR-30 | Self-serve unlock via payment, no founder involvement | Must |
| FR-31 | Print-ready downloads: receipt footer, handout card, standee | Must |
| FR-32 | Staff attribution via multiple QRs per outlet | Won't (v2) |

### 6.3 Admin and onboarding

**Revised 2026-09-18.** Owners sign up and pay themselves on the website;
the founder approves before activation. Bulk import and manual creation remain
available for the pre-built prospecting motion ([08-GTM.md](08-GTM.md) §3.1).

| ID | Requirement | Priority |
|---|---|---|
| FR-33 | Create outlet: business name, vertical, logo upload | Must |
| FR-34 | Google Place ID lookup by business name and location | Must |
| FR-35 | Generated Google review URL is validated before activation | Must |
| FR-36 | Tag set defaults by vertical, editable per outlet | Must |
| FR-37 | Generate unique QR and short URL per outlet | Must |
| FR-38 | QR downloadable as SVG and high-resolution PNG | Must |
| FR-39 | Record baseline Google rating and review count at activation | Must |
| FR-40 | **Owner self-serve signup with manual approval gate** *(revised 2026-09-18 — was Won't/v2)* | Must |
| FR-40a | Public signup form: business details, owner details, business search/selection | Must |
| FR-40b | Payment is taken at signup, before approval | Must |
| FR-40c | Signup creates the outlet in `pending_approval`, never live | Must |
| FR-40d | Admin approval queue: verify Google match, confirm placement, approve or request info | Must |
| FR-40e | Approval activates the outlet and emails the QR and print assets | Must |
| FR-40f | Owner sees clear "verifying your details" status while pending | Must |
| FR-40g | Refund path if an outlet is rejected or cannot be verified | Must |

### 6.4 Trial, billing, lifecycle

| ID | Requirement | Priority |
|---|---|---|
| FR-41 | Trial: **15 free days, then 10 review credits, then collection stops** *(revised OD-21)* | Must |
| FR-42 | Completed flow = stars + tags + copy tapped | Must |
| FR-43 | Completed flows deduped by device and phone | Must |
| FR-44 | Published reviews are **never** used as a trial trigger (unmeasurable) | Must |
| FR-45 | At trial threshold: dashboard locks, **QR stays live and collection continues** | Must |
| FR-46 | Threshold fires an automated WhatsApp with real numbers and a payment link | Must |
| FR-47 | Payment unlocks the dashboard immediately | Must |
| FR-48 | Monthly ₹499 via UPI AutoPay mandate | Must |
| FR-49 | Annual ₹4,499, shown against ₹5,988 monthly equivalent | Must |
| FR-50 | One-time payment fallback if mandate setup fails | Must |
| FR-51 | Failed recurring payment: retry, notify, grace period before re-lock | Must |
| FR-52 | Customer flow URL always resolves — never a dead link or error | Must |
| FR-53 | **Collection stops on `suspended` / `deactivated`** — URL resolves to a neutral screen *(revised 2026-09-18)* | Must |
| FR-54 | 7-day grace period with the flow fully live before suspension | Must |
| FR-55 | Reactivation on payment is immediate; existing QRs resume, no reissue | Must |

### 6.5 Global readiness

Full detail in [17-GLOBAL-READY.md](17-GLOBAL-READY.md). These prevent India and
dental assumptions from being baked in.

| ID | Requirement | Priority |
|---|---|---|
| FR-69 | `country_code`, `locale`, `timezone` on every outlet; no hardcoded defaults in logic | Must |
| FR-70 | Every monetary amount stored as `amount_minor` + `currency_code` | Must |
| FR-71 | Pricing lives in the `plans` table, per country and currency — never in code | Must |
| FR-72 | Payment provider is an interface; Razorpay is one implementation | Must |
| FR-73 | Tag labels and phrases are locale-keyed | Must |
| FR-74 | Platform-facing copy is vertical-neutral ("business", "customer") | Must |
| FR-75 | Adding a vertical requires one config file and no code change | Must |

*(FR-56 – FR-68 cover draft generation and low-rating routing — see
[16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md).)*

### 6.6 Hub, modules and Growth Services *(added 2026-09-30)*

After the scan, an outlet with two or more modules enabled shows a **hub**:
**1 Review flow · 2 Social connects · 3 Menu/Services · 4 Loyalty badges.** With
only the review module enabled the QR goes straight to the review flow, exactly
as v1. Separately, Revyu sells **Growth Services** to owners — website building,
landing video, content management pipeline, Instagram automation, WhatsApp
automation.

| Range | Topic | Authoritative in |
|---|---|---|
| FR-76 – FR-85 | Hub and module routing | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §1 |
| FR-86 – FR-91 | Social connects | §3 |
| FR-92 – FR-98 | Menu / Services (customer-facing) | §4 |
| FR-99 – FR-112 | Loyalty badges and rewards | §5 |
| FR-113 – FR-120 | Growth Services (owner-facing) | §7 |

Compliance: **CR-6** (loyalty firewalled from reviews) and service guardrails
**SG-1 – SG-8**. The topic doc is authoritative; this section is a pointer.

---

## 7. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Customer flow first contentful paint on 3G | < 2.0s |
| NFR-2 | Customer flow total transfer, first load | < 150KB |
| NFR-3 | Short URL redirect latency, p95 | < 200ms |
| NFR-4 | Customer flow availability | 99.9% |
| NFR-5 | Customer flow works without JS for the landing screen | Graceful |
| NFR-6 | Supports Android Chrome, iOS Safari, last 2 major versions | Must |
| NFR-7 | Minimum viewport | 360px |
| NFR-8 | Dashboard usable on mobile | Must |
| NFR-9 | No customer PII stored beyond what is submitted in private feedback | Must |
| NFR-10 | Analytics events retained 24 months | Should |
| NFR-11 | Honors `prefers-reduced-motion` | Must |
| NFR-12 | WCAG 2.1 AA on the customer flow | Should |

---

## 8. Compliance requirements

These are load-bearing. Full rationale and enforcement context in
[03-COMPLIANCE.md](03-COMPLIANCE.md). Summarised here because they are product
requirements, not legal footnotes.

| ID | Rule |
|---|---|
| CR-1 | No pre-written review library. Draft substance derives from customer tag input plus the outlet's factual record (name, vertical, locality). |
| CR-2 | Draft is always editable, and **its generation is disclosed** to the customer (FR-59). |
| CR-3 | No sentiment gating. Every rating can reach Google — same screen, one tap, above the fold. Visual hierarchy may vary; availability may not (SRS-17.1a–g). |
| CR-4 | Printed material — receipts, cards, **or counter standees/stickers** *(revised OD-5)*. Never a business-owned tablet or kiosk handed to the customer; no staff supervision. |
| CR-5 | No rewards or incentives tied to leaving a review, of any kind, at any rating. |
| CR-6 | *(added 2026-09-30)* Loyalty shares no trigger, copy, identifier or report with review collection. Earning is by visit/purchase only. See [03-COMPLIANCE.md](03-COMPLIANCE.md). |

Any feature request conflicting with CR-1 through CR-6 is rejected without
escalation. This is not a product decision that can be traded against revenue —
the exposure sits on the *customer's* Google Business Profile.

---

## 9. Success metrics

**Primary — the kill metric**

> **Scan → completed flow conversion.**
> Under 5%: the product does not work; stop.
> 5–20%: iterate on the flow.
> Over 20%: push hard on distribution.

**Secondary — the number the owner actually judges us on**

> **Google review count delta per outlet**, polled weekly via Places API.
> Noisy and not attributable per-customer, but this is what the owner sees.
> We must see it before they do.

> ⚠️ Note the gap: the primary metric ends at the copy tap. Everything after
> that — sign-in, paste, submit — happens on Google's UI where we have no
> instrumentation. Estimated loss at that stage is substantial. Both metrics
> are required; neither alone tells the truth.

**Supporting**

| Metric | Target (v1) |
|---|---|
| Qualified installs in first 30 days | 10 |
| Trial → paid conversion | > 30% |
| Private feedback rate | 5–15% of completed flows |
| Owner weekly dashboard open rate | > 40% |
| Time from install to first scan | < 72h |

**Kill criteria — write this down now, before emotional investment:**
10 qualified installs, 30 days, measured on scan → completed flow. If the
number is under 5%, the product does not work and no feature will save it.

---

## 10. Scope boundary for v1

**In:** customer flow, owner dashboard, admin onboarding, trial metering,
self-serve billing, print assets, WhatsApp notifications, weekly digest.

**Out:** review response drafting, staff attribution, multi-outlet, non-Google
platforms, fully unattended activation (approval gate stays), multilingual,
missed-call fallback,
benchmark reports.

*(Revised 2026-09-30.)* **v1.5**, during the validation window and capped at
~1 week: hub UI, social connects, menu/services, Growth Services catalogue and
request form. Outlets in the kill-metric cohort stay in `direct` mode (no hub) so
the metric is not confounded ([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §8).

The v2 shortlist in priority order — review response drafting, **loyalty
badges**, staff attribution, negative-feedback SLA loop — is documented in
[10-ROADMAP.md](10-ROADMAP.md). Review response drafting is the retention
answer and should not slip far.

---

## 11. Open decisions

Blocking items are tracked in [11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md).
Summary of what blocks design and build today:

- Product name
- Accent colour (must diverge from the reference system's `#FA3600`)
- Display font licence (BT Grotesk is commercial)
- Whether to introduce a ₹999/mo tier for high-value verticals
- Confirmation of dental as the single launch vertical
