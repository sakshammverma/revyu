# Go-to-Market Plan

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

---

## 1. Position

> A QR on your receipt that helps happy patients write a Google review in their
> own words. Compliant by design — no gating, no incentives, no fake reviews.

**Against verbal asking:** staff forget, feel awkward, and ask only the patients
they already like. The QR asks everyone, every time, at zero social cost.

**Against competitors:** most review tools in this market sentiment-gate — happy
customers get the Google link, unhappy ones get diverted to a private form. This
is prohibited and actively enforced. Those businesses carry a risk they have not
been told about. We do not gate, and we say so publicly.

**The compliance page is a marketing page.**

---

## 2. Launch verticals — all business types

**Decided 2026-09-18 (OD-4): launch open to every vertical**, not dental-only.

Tag sets, flow copy, and print assets ship for all configured verticals from day
one ([13-MULTI-TENANT.md](13-MULTI-TENANT.md) §4.4).

### 2.1 Lead with dental anyway

Open to all ≠ approach at random. For **founder-led outreach**, dental is still
the best first door:

| Reason | Detail |
|---|---|
| Customer lifetime value | ₹3,000–15,000+ — ₹499/mo is trivially justified |
| Review sensitivity | Local pack ranking is a primary acquisition channel |
| Referral density | Dentists know dentists. References travel fast. |
| Second surface later | Practo exists for dental, arguably higher intent than Google |
| Homogeneous flow | Every clinic's journey ends the same way — at a receipt |

Self-serve accepts anyone. **Your own limited walk-in time goes to dental
first**, then physiotherapy, gyms, salons, coaching.

### 2.2 The cost of breadth, stated honestly

Two real consequences, accepted:

1. **No concentrated reference base.** Ten installs across six verticals means
   no vertical has three referenceable customers, so the "I work with three
   clinics near you" opener does not arrive as fast.
2. **A noisier kill metric.** Conversion varies by vertical — a restaurant bill
   and a dental receipt are different objects in a customer's hand. A blended
   number across verticals is harder to read.

**Mitigation:** segment the kill metric by vertical from day one
([07-METRICS.md](07-METRICS.md) §7). With ten installs no single vertical will be
statistically meaningful, so read the **direction**, not the decimal — and if one
vertical is clearly outperforming, concentrate there for the next ten.

---

## 3. Distribution

### 3.1 Direct, pre-built — the primary motion

Build the prospect's branded page **before** walking in.

Lead with *"I made this for your clinic"* rather than a pitch. Show the real
flow on a phone, with their name and logo already in it.

This converts because it inverts the usual dynamic: you are not asking for time
to explain a concept, you are showing a finished thing that already has their
name on it. Most competitors will not do this because it takes 20 minutes per
prospect.

**Pre-visit preparation, per prospect:**
- [ ] Place ID found, review URL validated
- [ ] Logo sourced from their profile or website
- [ ] Outlet created in `draft`, tag set seeded for dental
- [ ] Flow tested end-to-end on a real phone
- [ ] Current review count and rating noted (the opening line)

**Opening line:** *"You're at 47 reviews and 4.3. The clinic down the road is at
180. I built you something — can I show you on your phone?"*

### 3.1a Self-serve as a second channel

*Added 2026-09-18.* Owners can now sign up and pay on the website without you
([15-HOW-IT-WORKS.md](15-HOW-IT-WORKS.md) §4). The approval gate keeps the
safety checks.

This does **not** replace the direct motion — it complements it:

| | Direct, pre-built | Self-serve |
|---|---|---|
| Who | You walk in | Referrals, search, word of mouth |
| Qualification | Full conversation | Approval call only |
| Expected quality | Higher | Lower — watch it (R-24) |
| Scales | No | Yes |

**Direct remains the primary motion for the first ten installs.** Self-serve
exists so a referral from a satisfied dentist can convert at 11pm without
waiting for you — which is exactly how dental referral networks behave.

> Track zero-scan rate separately by source. If self-serve installs are
> noticeably deader, add friction to the signup form rather than removing the
> approval gate.

### 3.2 Qualified installs only

**An unqualified install is worse than no install.** It costs setup time and
messaging spend, and it poisons the kill metric with a zero that reflects
distribution failure rather than product failure.

**Qualification gate — all four required:**

1. Owner commits to a **specific placement** — receipt footer, handout cards, or
   a counter standee/sticker. All are supported (OD-5). What matters is that one
   is chosen and someone owns it. **Never a business-owned tablet or kiosk
   handed to the customer** (CR-4).
2. Owner names the **specific staff member** responsible for handing it over
3. Owner confirms they can print, or accepts our printed cards
4. **A working email address, verified on the spot** — it is the dashboard login
   (OD-16). Send the activation email and watch them open it before you leave.

If any of the four is missing, do not activate. Book a follow-up instead.

> Item 4 is new and easy to skip. **An owner without a working email cannot
> reach their dashboard**, which means they never see their numbers and never
> hit the paywall. Verify it in the room, not afterwards.

> Track "outlets with zero scans after 7 days" as the install-quality metric
> ([07-METRICS.md](07-METRICS.md) §6.2). Target < 20%. A high number means the
> qualification gate is being skipped.

### 3.3 Go deep in one vertical

**Three named references in one category removes the need to establish
credibility again.** The fourth dental prospect is a fundamentally easier
conversation than the first.

Ask every satisfied owner for a named referral at the 30-day mark, not before.

### 3.4 Partner channel — after direct proves out

Digital marketing agencies already serving clinics. White-labelled, wholesale
at ~₹2,000–2,500/year.

**Do not open this channel before ten direct installs are producing data.** An
agency reselling a product with unproven conversion damages both the agency
relationship and the reference base.

> ⚠️ **Pricing tension to resolve:** ₹2,000–2,500/year wholesale is roughly
> ₹200/month against ₹499 direct. That trains a channel to value the product at
> a third of direct price, and creates a leak if agencies resell to businesses
> we would otherwise reach directly. See
> [11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md) OD-7.

---

## 4. Pricing

| Plan | Price | Notes |
|---|---|---|
| Monthly | **₹499/mo** | UPI AutoPay mandate |
| Annual | **₹4,499/yr** | Displayed against ₹5,988 monthly equivalent — 30% saving |

**Why monthly exists:** trust is the bottleneck, not capital. A clinic owner
will not commit a year to an unproven vendor. Monthly removes the objection;
annual captures those already convinced.

**Why the annual discount is shown explicitly:** it makes monthly feel like the
cautious choice rather than the cheap one, and it anchors the annual as value
rather than commitment.

### 4.1 One flat price — why not tiers

**Decided 2026-09-18 (OD-6): ₹499/mo, ₹4,499/yr, flat for every vertical,
city, and business size.**

Tiered and dynamic pricing were both considered and rejected:

| Considered | Why not |
|---|---|
| Tiers by niche / city | **Every tier would offer identical functionality.** SaaS tiers normally differ by features or usage; ours would not, so a pricing page showing three numbers for one product invites "why am I in the expensive band?" |
| Hidden per-business pricing | Incompatible with self-serve — a visitor must see a price before paying. And it gets discovered: two dentists in one city compare notes, and in a dense referral network that destroys the reference base. |
| Inferring ability to pay from review count | Weak signal. A clinic with 500 reviews may be high-volume low-margin; one with 30 may be a boutique implant specialist. Wrong often, and confidently. |

**Where the intelligence goes instead:** score prospects on likely fit and
ability to pay, and use it to decide **who to approach, what to say, and whether
to push annual** — not what to charge. Same insight, no fairness problem, and it
makes limited founder time far more valuable.

**Admin can still discount a specific deal** — but as a visible discount from a
published price, not a secret number.

### 4.2 Modules and Growth Services — how they are priced *(added 2026-09-30, OD-27 proposed)*

| Offering | Price treatment |
|---|---|
| Review flow, Connect, Menu/Services, Loyalty | **Included** in ₹499/mo. Same functionality for everyone — the flat-price logic above still holds |
| **Growth Services** — website building, landing video, content management pipeline, Instagram automation, WhatsApp automation | **Separate SKUs**, priced per service, one-time or recurring. Shown in the dashboard Services tab |

Growth Services are labour-backed, so they are the one place where differing
prices are legitimate: a site for a 3-page clinic and a 20-item restaurant are
different jobs. Quote per request; publish a "from" price on the catalogue rather
than hiding it.

**Sales obligation:** never pitch loyalty and reviews as one idea. "Rewards for
reviews" is prohibited (CR-5); the pitch is *"a loyalty programme for returning
customers"*, separately, and staff scripts must keep it that way (CR-6).
Growth Services are an **upsell after the subscription is live** — not part of
the first-visit pitch, which stays focused on the one question v1 exists to
answer.

---

## 5. Trial mechanics as a sales tool

The trial design is a conversion mechanic, not a giveaway.

**15 free days → 10 review credits → collection stops.** *(OD-21)*

**Stage 1, days 1–15:** everything open. Long enough to print, distribute, and
see the first reviews appear on Google — which lags by days.

**Stage 2, 10 credits:** the dashboard locks but the QR **keeps collecting** for
10 more completed flows. The owner sees:

> *"42 scans and 6 new reviews waiting. 7 review credits left."*

Two pressures at once — value they cannot see, and a countdown. Better than
either alone.

**Stage 3, credits exhausted:** collection stops. The QR resolves to a neutral
screen. The owner is told plainly:

> *"Your review QR has stopped working. Printed codes in your customers' hands
> are no longer collecting reviews."*

**This is the strongest lever in the product, and it is honest** — those printed
codes genuinely are dead until they pay. Reactivation is one payment, same code,
no reprinting.

> **It depends on placement.** A business that only used a counter standee can
> just remove it. One that printed 5,000 receipt footers cannot. **Push
> take-home placement first at install** (§3.2) — it is better for scan volume
> *and* it is what makes this lever real.

> **Distinguish this from suspension.** Trial-locked keeps collecting; it is a
> conversion mechanic. A customer who **cancels or stops paying** has collection
> switched off after a 7-day grace, with the QR resolving to a neutral screen
> (OD-18). Otherwise a clinic could pay for two months, cancel, and keep the
> benefit indefinitely — auditing results on their own Google profile.
> Reactivation is instant and reuses the printed code.

**Why completed flows and not published reviews:** publication is not
measurable through any API (C-2). Metering on something unverifiable would make
the trigger arbitrary and disputable.

---

## 6. Sales assets needed

| Asset | Purpose | Status |
|---|---|---|
| Pre-built demo page per prospect | The entire opening | Process, not artifact |
| Phone with the flow loaded | Live demonstration | — |
| One-page leave-behind | Post-visit reminder | To design |
| Printed sample handout card | Shows the physical artifact | To design |
| Compliance one-pager | The differentiator, in writing | To write |
| Three dental references | Removes credibility work | After 30 days |

---

## 7. Objection handling

| Objection | Response |
|---|---|
| *"We already ask patients verbally"* | Staff ask the patients they like, when they remember. This asks everyone, every time, and shows you the drop-off. |
| *"Can you make sure only happy patients review us?"* | No — that is review gating, it is prohibited and enforced, and the penalty lands on your profile, not ours. Every patient sees the link. What we *do* is put the private feedback box right in front of an unhappy patient, so most of them tell you instead of Google. That works better than hiding anything. |
| *"Will this guarantee more reviews?"* | No guarantees. We show you scans, completions, and your review count over time. You decide after 15 days with real numbers. |
| *"Patients won't bother"* | That is exactly what the trial answers. It costs nothing to find out, and the QR keeps working either way. |
| *"Why do they have to paste?"* | Google accepts no pre-filled text — nobody can change that. We make the paste expected rather than a surprise, which is where most tools lose people. |
| *"₹499 is expensive"* | One new patient covers a year. |
| *"Send me details"* | Show the phone now. Details after. |

> The gating objection is the important one. **The answer is always no**, and
> the reason is that it endangers *their* profile. That conversation is a sales
> asset ([03-COMPLIANCE.md](03-COMPLIANCE.md) CR-3).

---

## 8. First 30 days — the plan

| Week | Goal |
|---|---|
| 1 | Build 15 pre-built demo pages. Walk in to 15 dental clinics. |
| 2 | Activate 10 qualified installs. Instrumentation verified live before first scan. |
| 3 | Daily funnel review. Call any outlet with zero scans at day 7. |
| 4 | Trial thresholds begin firing. Watch trial → paid. |
| **Day 30** | **Kill-metric decision: go / iterate / stop.** |

**Target:** 10 qualified installs, ≥ 5% scan → completed flow conversion, at
least 3 outlets past the trial threshold.

---

## 9. What we are not doing in v1

| Not doing | Why |
|---|---|
| Paid ads | Cannot target single-outlet clinic owners efficiently at this budget |
| Content marketing / SEO | Too slow for a 30-day validation window |
| Cold email | Low response from this buyer; they live in WhatsApp |
| Marketplace listings | No demand exists yet |
| Multi-vertical launch | Dilutes the reference base and teaches nothing |
| Partner channel | Deferred until direct proves out (§3.4) |
| Selling Growth Services / loyalty / the hub | Not in the validation pitch. v1.5 and later ([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §9); pitching them now muddies the one thing being tested |

Direct, pre-built, one vertical. Everything else is a distraction from the
question the product exists to answer.
