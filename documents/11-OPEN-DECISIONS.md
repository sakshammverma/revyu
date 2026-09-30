# Open Decisions

**Product:** Revyu
**Version:** Live document
**Date:** 2026-09-18
**Owner:** Founder

Decisions required to unblock design and build. Ordered by urgency.
Update this file as decisions are made — record the decision and the date.

---

## Blocking design

### OD-1 — Product name ✅ RESOLVED — **Revyu**

Everything currently reads `Revyu`. One find-and-replace once decided.

**Needed for:** domain, wordmark, all copy, WhatsApp display name (which has its
own review lead time — see OD-9).

**Considerations:** must work spoken over a phone to a clinic owner; `.in` or
`.com` availability; not confusable with an existing review tool.

**Decided:** 2026-09-18 — see decision log

---

### OD-2 — Accent colour ✅ RESOLVED — **Indigo `#4338CA`**

The reference system uses `#FA3600`. Keeping it means reading as a clone of
heronaiapp.com.

**Recommendation:** diverge. This is the single cheapest way to establish
separate identity while keeping the entire rest of the system.

**Constraint:** must hold up as a 1px border, a small solid fill, an SVG stroke,
and mono text on `#F5F5EF` paper — five roles per the design system. Must also
pass WCAG AA as text on paper.

**Decided:** 2026-09-18 — see decision log

---

### OD-3 — Display font ✅ RESOLVED — **Archivo** (free, OFL)

The system specifies **BT Grotesk, which is commercial.** Either license it or
substitute.

| Option | Cost | Note |
|---|---|---|
| License BT Grotesk | Paid | Closest to the extracted system |
| Archivo | Free, OFL | Good grotesque, wide weight range |
| Inter Tight | Free, OFL | Safe, slightly generic |

Geist Mono is free (OFL) and stays either way — but **give it a real monospace
fallback**; the source system has none.

**Decided:** 2026-09-18 — see decision log

---

### OD-4 — Launch vertical ✅ RESOLVED — **all verticals**

The plan lists five verticals. The recommendation is **dental only** at launch,
expanding after three named references.

**Rationale:** highest patient value, most review-sensitive buyers, dense
referral networks, Practo as a second surface later. Launching into five
verticals with ten installs teaches nothing about any of them.

**Impact if unresolved:** tag seed sets, all marketing copy, and the reference
strategy all depend on this.

**Decided:** 2026-09-18 — see decision log

---

## Blocking build

### OD-5 — Standee: compliant or cut ✅ RESOLVED — keep

**Decision: keep the standee, and add a counter sticker.** Counter placement is
supported (founder decision, 2026-09-18). CR-4 rewritten accordingly.

**Guardrails retained:** no business-owned device (no tablet or kiosk handed to
the customer), no staff standing over them, no pressure framing on the asset
itself, no incentives (CR-5 unchanged).

**Risk accepted:** on-premises solicitation carries more exposure than take-home
material, and that exposure sits on the customer's Google profile. Accepted on
the basis that scan volume is the primary risk to the business (R-1) and counter
placement materially increases it. Take-home remains the recommended default.

**Decided:** 2026-09-18

---

### OD-6 — Pricing ✅ RESOLVED — **₹499/mo flat, no tiers**

Current: ₹499/mo, ₹4,499/yr across all verticals.

**The concern:** one new dental patient is worth ₹3,000–15,000+ lifetime.
₹499 signals "cheap utility," which invites churn on a whim rather than
considered renewal. Price against patient value, not against what feels
affordable.

**Proposal:** ₹999/mo for dental, physio, gyms. Hold ₹499 for salons and
coaching.

**Counter-argument:** at ten installs there is no pricing data, and a higher
price slows the validation that actually matters. Launching at ₹499 and raising
later for new customers is low-risk.

**Recommendation:** launch at ₹499 to maximise install velocity during
validation. Revisit at 25 paying outlets.

**Decided:** 2026-09-18 — see decision log

---

### OD-7 — Partner channel ✅ RESOLVED — **deferred**

Plan: agencies at ~₹2,000–2,500/year wholesale (~₹200/month) against ₹499
direct.

**The problem:** this trains a channel to value the product at a third of
direct price, and creates a leak — agencies reselling to businesses reachable
directly.

**Options:** raise wholesale to ~₹300/mo equivalent; restrict the channel to
segments not sold direct; or defer the channel entirely.

**Recommendation:** defer. Do not open the channel until ten direct installs
have produced conversion data. The pricing decision can wait until then.

**Decided:** 2026-09-18 — see decision log

---

### OD-8 — Draft assembly ✅ RESOLVED — **client-side**

Both are acceptable per [04-ARCHITECTURE.md](04-ARCHITECTURE.md) §6.

| | Server | Client |
|---|---|---|
| Latency | One round trip | Instant |
| Offline | Fails | Works |
| CI inspectability (SRS-17.3) | Easy | Requires the vocabulary stay inspectable |
| Bundle size | Smaller | Slightly larger |

**Recommendation:** client-side. The draft screen is where the worst drop-off is
expected; removing a round trip there is worth more than the marginal bundle
cost. Keep the tag phrase vocabulary in a single inspectable module so the CR-1
CI check still works.

**Decided:** 2026-09-18 — see decision log

---

## Lead-time dependent — start now regardless

### OD-9 — WhatsApp BSP provider ✅ RESOLVED — deferred to v2

**Decision: do not use WhatsApp Business API in v1.** Removed from the critical
path entirely ([10-ROADMAP.md](10-ROADMAP.md) §1).

v1 notification is owner-facing only — six message types to at most ten people.
Email covers it automatically at zero cost; a click-to-chat (`wa.me`) queue in
admin covers the high-value moments manually. Build one notification adapter
with pluggable backends so the API is a later swap, not a rewrite.

Revisit at ~30 active outlets, or if v1 data shows owners ignore email.

> ⚠️ Unofficial WhatsApp automation libraries remain rejected — ban risk on the
> number, which would be the primary owner-communication channel.

**Decided:** 2026-09-18

---

### OD-10 — Razorpay account and KYC 🟠 START EARLY

Also has lead time. Requires a published refund policy before going live.

**Decided:** 2026-09-18 — see decision log

---

## Product questions to resolve before build

### OD-11 — Dedup window ✅ RESOLVED — **24h**

Currently specified as 24 hours (SRS-9.3). Affects trial metering fairness.

Too short: a returning patient inflates the count and the trial ends early.
Too long: a genuinely new customer on a shared device is not counted.

**Recommendation:** keep 24h, make it configurable, revisit with real data.

**Decided:** 2026-09-18 — see decision log

---

### OD-12 — Tag count ✅ RESOLVED — **8 default**

Specified as 6–10 recommended, 12 maximum (SRS-4.5).

More tags produce richer drafts and better insight data; fewer reduce friction
at the step just before the expected worst drop-off.

**Recommendation:** start at 8 for dental. Treat as a conversion variable to
test once volume permits.

**Decided:** 2026-09-18 — see decision log

---

### OD-13 — Grace period ✅ RESOLVED — **7 days**

Specified as 7 days (SRS-12.5).

**Decided:** 2026-09-18 — see decision log

---

### OD-15 — Customer messaging ✅ RESOLVED — **none, owner-only**

**The boundary:** v1 messages **owners only**. The patient scans, completes,
leaves, and is never contacted. We do not even hold their number unless they
voluntarily type one into private feedback.

**Why this should stay the default:**

- A follow-up to a customer we know rated us highly is a second solicitation
  aimed at an identified-satisfied customer. That sits uncomfortably close to
  selective solicitation even when the first touch was ungated (CR-3 adjacency).
- Collecting patient phone numbers converts a product with near-zero PII
  exposure (NFR-9, SRS-16) into one holding a health-adjacent contact database
  under Indian data protection obligations.
- It adds a consent-capture step to a flow whose worst drop-off is already the
  step before it.

**The narrow defensible version**, if ever wanted: an unconditional
"thanks for visiting" with the review link, sent to **every** customer
regardless of rating, only where the business already holds consented contact
details, sent by the business rather than by us. Different product. Not v1.

**Recommendation:** record "no customer-facing messaging" as a deliberate
product boundary, not an omission. Revisit only with a specific consented-contact
use case.

**Decided:** 2026-09-18 — see decision log

---

### OD-16 — OTP delivery channel ✅ RESOLVED — email

**Decision: owner login is email address + OTP delivered by email.** SMS is a
post-revenue upgrade.

| Channel | Cost | Setup lead time | v1 |
|---|---|---|---|
| **Email** | Free within provider limits | None | ✅ **Chosen** |
| SMS | ~₹0.15–0.25/msg | **DLT registration — multi-day approval** | Later |
| WhatsApp | Free via API | BSP approval | Deferred (OD-9) |

**Rationale:** free within generous limits, no DLT paperwork, and consistent with
OD-9. At ~150 emails/month across all sources at ten outlets, this sits well
inside any free tier. The deciding factor is avoided lead time, not rupees.

**Consequences, applied across the docs:**

1. **`accounts.owner_email` becomes required and unique** — it is the login
   identifier. Was optional.
2. **Capturing a working email is mandatory at install.** Added to the
   qualification checklist ([08-GTM.md](08-GTM.md) §3.2). An owner without one
   cannot reach their dashboard.
3. **Magic link ships alongside the numeric code** — one tap on mobile instead
   of switching apps to copy. This is the main thing SMS was buying.
4. **SPF/DKIM/DMARC required before the first install.** Unauthenticated OTP
   mail lands in spam and login is functionally broken.
5. **`accounts.otp_channel` field defaults to `email`** so SMS is a later
   adapter, not an auth rewrite.

**The phone number is unchanged** — still the account identity, still unique,
still the WhatsApp destination. Only the login identifier and OTP channel moved.

**Revisit when:** owners report email problems, or revenue supports SMS cost and
DLT registration, or WhatsApp API arrives for other reasons (OTP over WhatsApp
is then free).

**Decided:** 2026-09-18

---

### OD-17 — AI review responses ✅ RESOLVED — **deferred**

v2 review response drafting ([10-ROADMAP.md](10-ROADMAP.md) §2.1) is currently
one paragraph of intent. Before building it needs: model choice, cost per outlet
per month, whether drafts generate automatically on new-review detection or
on-demand, and how "the owner's voice" is captured.

**Compliance note, already settled:** CR-1 prohibits us authoring the
*customer's* review — hence deterministic tag assembly, no model. It does **not**
apply to the merchant's own reply, where the owner is the legitimate author. An
LLM is appropriate there. The reply must remain editable before posting.

**Decision:** _deferred until after the kill-metric decision — do not spec v2
before v1 is validated_

---

### OD-14 — Multilingual ✅ RESOLVED — **deferred, English v1**

v1 is English-only. For a tier-2 city dental clinic, this may be a material
conversion factor — but it is an assumption, not a measurement.

**Recommendation:** ship English, add a language question to install
conversations, and let the funnel data decide. If the landing → rating drop-off
is unusually high, language is the first hypothesis.

**Decision:** _deferred to post-v1_

---

## Added 2026-09-30 — hub, loyalty, Growth Services

Six decisions raised by the hub/modules expansion
([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md)). Each carries a **recommended
default** the docs are already written against. They are **🟡 PROPOSED** — the
founder has not confirmed them. Confirm, or reverse, and log the outcome.

### OD-24 — Meaning of "services" 🟡 PROPOSED

Read as **two** things: the business's own *Menu/Services* shown to customers
(module 3), and Revyu's *Growth Services* sold to owners (§7). **Recommendation:**
keep both, strictly separated. **Confirm** this is what was meant.

### OD-25 — Customer identity for loyalty 🟡 PROPOSED

Loyalty needs to recognise returning customers, breaking *"no customer identity"*
(NFR-9). **Recommendation:** anonymous device wallet by default; optional phone +
OTP to "save my badges"; phone hashed/encrypted; no messaging to members; owner
sees counts, not a phone export. **Cost accepted:** Revyu becomes a holder of
customer PII and takes on data-protection obligations it does not have today.

### OD-26 — Kill-metric cohort runs in `direct` mode 🟡 PROPOSED

A hub adds a choice between scan and review and mechanically lowers
scan → completed. **Recommendation:** the ten-install validation cohort runs
without the hub; the hub ships as v1.5 behind `hub_mode`, and the QR is identical
so nothing is reprinted. Hub outlets use `review chosen → completed` plus a new
*review take-rate* metric with no kill band until data exists.

### OD-27 — Pricing of modules and services 🟡 PROPOSED

**Recommendation:** Connect, Menu and Loyalty are **included** in ₹499/mo (OD-6
stays flat, no tiers). Growth Services are **separate SKUs** priced per service,
one-time or recurring. Keeps the public subscription price simple while letting
services be quoted.

### OD-28 — Loyalty wallets when an outlet is suspended 🟡 PROPOSED

FR-83 makes a suspended outlet's QR fully neutral — but a customer may hold
earned badges. **Recommendation:** the neutral screen says rewards are
temporarily unavailable; balances are preserved and resume on reactivation; wallet
data is deleted after 180 days of deactivation. **Open:** whether customers should
see a stronger explanation, given it reads as the owner's fault (R-26).

### OD-29 — May owners message loyalty members? 🟡 PROPOSED — **no**

**Recommendation:** off. Owner messaging to members (even via their own WhatsApp
automation, S5) would need explicit opt-in captured separately from the wallet
and is a different product. Until decided, S5 may only message contacts the owner
already holds consent for, outside Revyu's loyalty data.

---

## Decision log

| ID | Decision | Date | Rationale |
|---|---|---|---|
| OD-9 | WhatsApp Business API deferred to v2. Email primary, click-to-chat queue for high-value moments, pluggable notification adapter. | 2026-09-18 | Owner-facing messaging only, ≤10 recipients. Removes a 1–3 week approval from the critical path at no meaningful capability cost. |
| OD-16 | Owner login is email + email OTP, with magic link. SMS deferred to post-revenue. `owner_email` now required and unique; phone remains account identity. | 2026-09-18 | Free within provider limits, no DLT registration. Avoided lead time, not cost, is the deciding factor. |
| OD-5 | Standee kept; counter sticker added. Counter placement supported. | 2026-09-18 | Founder decision. Scan volume is the primary business risk; guardrails on device and supervision retained. |
| OD-18 | **Collection stops on suspension/cancellation.** QR still resolves to a neutral screen; reactivation instant. | 2026-09-18 | Closed a revenue leak — a cancelled clinic could otherwise collect indefinitely and audit results manually. |
| OD-19 | **Low-rating routing:** private feedback primary, Google secondary — both full-width, above the fold, one tap. Seven mechanical tests (SRS-17.1a–g) enforce availability. | 2026-09-18 | Achieves the commercial goal — most upset patients choose private — without gating. Survives audit and feeds the resolution loop. |
| OD-20 | **Disclosed SEO drafting.** Drafts optimised (business name, locality, 2–4 sentences, varied) with a permanent visible disclosure line. | 2026-09-18 | Same output quality as the silent version; the one-line disclosure makes it defensible. Substance still traces to tags or factual record. |
| OD-1 | **Product name: Revyu.** | 2026-09-18 | Short, obvious meaning, easy over a phone, vertical-neutral, works globally. |
| OD-2 | **Accent: Indigo `#4338CA`.** | 2026-09-18 | Clearly distinct from the reference `#FA3600`. Strong contrast on `#F5F5EF`, passes WCAG AA, no error/warning connotation (important given the low-rating flow). |
| OD-3 | **Display font: Archivo** (free, OFL). Geist Mono retained with a real monospace fallback. | 2026-09-18 | BT Grotesk is commercial. Archivo is the closest free grotesque with a wide weight range. Zero licence cost or delay. |
| OD-4 | **All verticals at launch**, not dental-only. Founder outreach still leads with dental. | 2026-09-18 | Founder decision. Accepted costs: no concentrated reference base, noisier kill metric. Mitigated by per-vertical segmentation. |
| OD-6 | **₹499/mo, ₹4,499/yr — one flat price**, all verticals and cities. Tiered and dynamic pricing rejected. | 2026-09-18 | Identical functionality across tiers makes tiers unjustifiable publicly; hidden pricing breaks self-serve and leaks in referral networks. Intelligence goes to sales targeting instead. |
| OD-8 | **Draft assembly client-side.** Phrases ship in the outlet config fetched at scan. | 2026-09-18 | Removes a round-trip from the worst drop-off screen. Niche-specificity comes from per-outlet config; SEO quality is authored into the phrase bank, not computed. |
| OD-21 | **Trial: 15 days → 10 review credits → collection stops.** | 2026-09-18 | 15 days lets reviews actually appear on Google (they lag). The credit countdown adds urgency on top of unseen value. Suspension makes printed codes genuinely dead — the strongest honest retention lever. |
| OD-11 | Dedup window **24h**, configurable. | 2026-09-18 | Accepted recommendation. Reversible. |
| OD-12 | **8 tags** per outlet default. | 2026-09-18 | Accepted recommendation. Treat as a conversion variable to test later. |
| OD-13 | Payment-failure grace **7 days**. | 2026-09-18 | Accepted recommendation. |
| OD-14 | Multilingual **deferred**; English v1, structure is locale-keyed. | 2026-09-18 | Accepted recommendation. Add when funnel data suggests language is a factor. |
| OD-15 | **No customer-facing messaging.** Owner-facing only. | 2026-09-18 | Accepted recommendation. Adopted as a stated product boundary. |
| OD-17 | AI review responses **deferred** until after the kill-metric decision. | 2026-09-18 | Accepted recommendation. Do not spec v2 before v1 is validated. |
| OD-7 | Partner channel **deferred** entirely; wholesale price undecided. | 2026-09-18 | Accepted recommendation. Revisit after ten direct installs produce data. |
| OD-22 | **Two-colour system.** Indigo #4338CA stays brand/chrome/secondary; **amber #D97706 for primary CTAs.** Red #DC2626 reserved for genuine urgency only. | 2026-09-18 | CRO research: a CTA in the brand colour blends into the chrome and gets ignored. Red triggers anxiety in trust-sensitive B2B; amber keeps the energy without the alarm. Extends OD-2. |
| OD-24–29 | **Hub, loyalty, Growth Services — six proposals, awaiting confirmation.** See the section above. Docs written against the recommended defaults. | 2026-09-30 | Expansion request. Loyalty permitted only behind CR-6; kill-metric cohort kept hub-free (OD-26). |
| OD-23 | **Reduced framing chrome on the customer flow** — 4-line viewport frame only, no ruler ticks or crop marks. Full chrome on marketing and dashboard. | 2026-09-18 | Deviates from the design system deliberately. 265 line elements + 36 crop marks is real paint cost against a <150KB / <2s-on-3G budget on the surface the kill metric depends on. |

---

## Summary — what to unblock first

## ✅ OD-1 – OD-23 resolved — 2026-09-18

Nothing in OD-1 – OD-23 blocks design or build.

**OD-24 – OD-29 (2026-09-30) are proposed, not decided.** None blocks the v1
validation build. **OD-24, OD-25 and OD-26 should be confirmed before v1.5
work starts**; OD-25 and OD-28 must be settled before loyalty is built.

**Remaining action items (not decisions):**

1. **OD-10 — start Razorpay KYC.** The only real calendar dependency left.
2. **Verify the Google review URL on a real phone, signed out.** 10 minutes, and
   it retires the biggest technical unknown in the product.
3. **Register `revyu.in` / `revyu.com`** and configure SPF/DKIM/DMARC before the
   first install (login breaks without it).
4. **Source the wordmark and icon** — full lockup plus square icon, SVG
   ([09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §6.1).

All 21 decisions are logged below with dates and rationale. Anything revisited
gets a new row, not an edit.
