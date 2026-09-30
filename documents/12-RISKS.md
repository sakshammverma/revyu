# Risk Register

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

Scored **Likelihood × Impact**, each Low / Medium / High.
🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## The three that actually matter

Before the detail: most of this register is routine. Three risks are genuinely
capable of ending the business, and all three are about **behaviour, not
technology**.

1. **R-1 — Customers don't scan.** The whole product is a bet on this.
2. **R-2 — Customers abandon at the paste step.** The unobservable half of the
   funnel.
3. **R-8 — Installs go dead.** The most likely reason validation fails without
   teaching anything.

Everything else is manageable.

---

## Product risks

### 🔴 R-1 — Customers do not scan the QR

**L: Medium · I: High**

The premise of the product. If scan rates are negligible, nothing downstream
matters.

**Mitigation:** this is precisely what the 30-day validation exists to test.
Receipt placement (the highest-frequency take-home surface) is the primary
lever. QR must be tested at 2cm on real thermal paper.

**Detection:** scan count per outlet, weekly.

**Trigger:** fewer than 5 scans per outlet per week at day 14 → the placement
or the ask is wrong, not the software.

---

### 🔴 R-2 — Customers abandon at the paste step

**L: High · I: High**

Estimated 40–60% loss after handoff. **Unobservable by construction** (C-1) —
we will never know the true number.

**Mitigation:** the interstitial sets expectation rather than hiding the paste
(FR-11). This is the first thing to A/B test once volume permits.

**Detection:** indirect only — the gap between completed flows and the Google
review count delta ([07-METRICS.md](07-METRICS.md) §4).

**Accepted:** this risk cannot be eliminated. It can only be reduced. Any vendor
claiming to remove it is doing something non-compliant.

---

### 🟠 R-3 — Draft quality is poor

**L: Medium · I: Medium**

Tag-assembled text may read robotic, which suppresses copying or produces
reviews that look templated in aggregate on the business's profile.

**Mitigation:** vary connective grammar; keep the draft editable (CR-2) and
measure the edit rate — high editing is a *healthy* signal. Review real outputs
weekly during validation.

**Watch for:** multiple reviews on one profile with visibly identical structure.
That is both a quality failure and a compliance exposure.

---

### 🟡 R-4 — Owner values the product only while review count climbs

**L: High · I: Medium**

Review collection has a natural ceiling. At 200 reviews and 4.7, the marginal
review matters less. Expect churn pressure around month 8.

**Mitigation:** v2 review response drafting is the designed answer
([10-ROADMAP.md](10-ROADMAP.md) §2.1). Staff attribution and the feedback SLA
loop give reasons to stay that are not review-count dependent.

**Detection:** churn timing, dashboard open rate decay.

---

## Compliance and platform risks

### 🔴 R-5 — Google policy changes or enforces against the pattern

**L: Low · I: High**

Even fully compliant QR-based review solicitation could be restricted.

**Mitigation:** CR-1 to CR-5 keep us on the defensible side of every current
rule. Practo and other platforms as secondary surfaces reduce single-platform
dependence. Monitor policy changes.

**Contingency:** if the pattern becomes prohibited, the private feedback and
operations-insight side of the product survives; the Google handoff does not.

---

### 🔴 R-6 — A customer's profile is affected and we are implicated

**L: Low · I: High**

The risk we are explicitly managing. Our commitment is that the owner's profile
is *safer* with us than without.

**Mitigation:** the five rules, enforced mechanically in CI (SRS-17), not merely
documented.

**Response plan:** [03-COMPLIANCE.md](03-COMPLIANCE.md) § If we get this wrong —
stop new installs, notify every active outlet same day, fix before resuming,
support reinstatement at our cost.

---

### 🟠 R-7 — Commercial pressure to add sentiment gating

**L: High · I: High**

An owner will ask to "only send the happy ones." A competitor will offer it.
Revenue will appear to depend on it.

**Mitigation:** CR-3 is not a product decision that can be traded. The answer is
no, and the reason is that it endangers *their* profile. This conversation is a
sales asset, not an obstacle ([08-GTM.md](08-GTM.md) §7).

**Enforcement:** SRS-17.1 fails the build if the handoff screen differs by
rating. The rule is defended by CI, not by memory.

---

## Distribution risks

### 🔴 R-8 — Installs go dead

**L: High · I: High**

The owner agrees, the QR is generated, and nobody ever hands it out. **This is
the most likely way validation fails while teaching nothing** — a zero that
reflects distribution failure gets read as product failure.

**Mitigation:** the qualification gate — receipt/card commitment, a named staff
member, printing confirmed. All three, or do not activate
([08-GTM.md](08-GTM.md) §3.2).

**Detection:** "outlets with zero scans after 7 days," target < 20%. Automated
alert at day 7.

**Response:** call the outlet. Diagnose whether it is placement, staff, or
printing. Do not let it silently contaminate the kill metric.

---

### 🟡 R-9 — Founder-led sales does not scale

**L: High · I: Medium**

A physical visit per prospect does not scale past a few dozen.

**Partially mitigated by [13-MULTI-TENANT.md](13-MULTI-TENANT.md):** bulk import
plus draft-preview mode drops per-outlet preparation from ~8 minutes to under 60
seconds. Fifty prospects can be prepared in under an hour, so the pre-build
motion stops being the bottleneck.

**Remaining constraint is the physical visit itself**, which is deliberate — the
qualification gate is a human conversation (R-8). Accepted for v1. Partner
channel is the remaining answer, still deferred. Self-serve signup shipped in v1
(SRS-18) and removes the founder from *acquisition*, though not from approval.

---

### 🟠 R-20 — Wrong Place ID attached to an outlet

**L: Medium · I: High**

New with bulk import ([13-MULTI-TENANT.md](13-MULTI-TENANT.md) §4.2). Resolving
50 clinics from Maps links at once makes a mismatch far likelier than
one-at-a-time entry — and a wrong Place ID sends a clinic's patients to write
reviews on **a stranger's business**.

Worst case: it is not detected for weeks, the reviews are unrecoverable, and the
error is ours.

**Now also arrives via self-serve signup** — an owner picking the wrong entry
from a search result list. This is why signup uses search-and-pick with full
addresses (SRS-18.3) rather than free-text entry.

**Mitigation:** ambiguous matches queued for manual resolution, never guessed
(SRS-11.12). Review URL validated before activation (FR-35). **`place_verified`
must be explicitly ticked by the founder before approval** (SRS-19.3) — this is
the primary control, and the main reason the approval gate exists.

**Detection:** confirm the resolved business name and full address against the
submission at approval. A baseline review count that looks wrong is a signal.

---

### 🟠 R-23 — The approval queue becomes the bottleneck

**L: Medium · I: High**

New with self-serve signup. A customer who has **paid and is waiting** is the
most fragile state in the system — every hour erodes the goodwill the purchase
created. If the queue sits for a day, they assume it is broken and ask for a
refund.

**Mitigation:** alert on any item over 24h (SRS-19.9). The status screen sets
expectations explicitly (SRS-18.8). Approval is two checks and a short call —
minutes, not hours, if actually done.

**Detection:** queue age, and refund requests citing delay.

**If this becomes chronic:** auto-approve where the Place match is unambiguous
and the owner ticked the placement acknowledgement, and reserve manual review
for ambiguous matches only. **Do not do this pre-emptively** — the gate is what
prevents R-20, and a wrong Place ID is unrecoverable in a way a slow queue is
not.

---

### 🟡 R-24 — Self-serve attracts unqualified installs

**L: High · I: Medium**

Founder-led installs had a qualification conversation. Self-serve does not —
anyone with a card can sign up, including businesses that will never hand the QR
out (R-8 at scale).

**Mitigation:** payment before approval filters the unserious. The CR-4
placement checkbox forces the rule to be read (SRS-18.10). The approval call
covers the receipt commitment and the named staff member.

**Detection:** zero-scan rate at 7 days, **segmented by `source`** — self-serve
versus founder-led. If self-serve installs are markedly deader, the signup form
needs more friction, not less.

> **This segmentation matters for the kill metric.** A blended conversion number
> mixing carefully qualified installs with self-serve walk-ups describes
> neither. Report them separately.

---

### 🟡 R-21 — Bulk import produces dead installs at scale

**L: Medium · I: Medium**

Importing 50 prospects makes it tempting to activate broadly and "see what
sticks" — which is precisely R-8 multiplied.

**Mitigation:** bulk activation is deliberately **not** built (SRS-11.18,
[13-MULTI-TENANT.md](13-MULTI-TENANT.md) §4.6). Preparation is bulk; activation
is one at a time and gated on the qualification conversation.

**This friction is intentional and must not be optimised away later.**

---

### 🟡 R-10 — Vertical scope creep

**L: Medium · I: Medium**

Taking a salon, a gym, and a coaching centre because they said yes — producing
ten installs across five verticals and no reference base anywhere.

**Mitigation:** OD-4. Dental only. A yes from another vertical is a follow-up
for month two, not an install today.

---

## Technical and operational risks

### 🟢 R-11 — WhatsApp BSP approval delays launch — *retired*

**L: Low · I: Low** *(was High · Medium)*

**Retired 2026-09-18 by OD-9.** WhatsApp Business API was removed from v1
entirely. Email is the primary channel; a click-to-chat queue in admin covers
high-value moments manually. The notification adapter makes the API a later
swap ([10-ROADMAP.md](10-ROADMAP.md) §1).

**Residual risk:** owners ignore email and the manual click-to-chat step is
skipped under load. Detection — trial-threshold message open rate and
trial → paid conversion. Trigger — revisit BSP at ~30 outlets.

> ⚠️ Unofficial WhatsApp automation libraries remain rejected. Ban risk on the
> number, which would be the primary owner channel.

---

### 🟠 R-22 — Owners cannot log in because OTP email lands in spam

**L: Medium · I: High**

New with OD-16. SMS has no spam folder; email does. An owner who cannot log in
never sees their numbers, never hits the paywall, and churns silently — and may
never tell you, because the tool "just didn't work."

**Mitigation:**
- SPF/DKIM/DMARC configured on the sending domain **before the first install**
  (SRS-10.1b) — the actual fix, not a nicety
- Magic link alongside the code, so one tap works from the notification shade
- "Check spam" hint on the login screen after ~60s
- Email verified on the spot at install — gate item 4
  ([08-GTM.md](08-GTM.md) §3.2)
- Owner's phone is on file, so the founder can always intervene manually

**Detection:** owner dashboard open rate (target >40%); any outlet with scans but
zero logins after 7 days.

**Escalation:** if this recurs, add SMS OTP — the `otp_channel` field
(SRS-10.1c) makes it an adapter swap, not a rewrite.

---

### 🟠 R-12 — UPI AutoPay mandate failures block conversion

**L: Medium · I: Medium**

Mandate creation fails at non-trivial rates, at the worst possible moment —
mid-conversion, after the owner has decided to pay.

**Mitigation:** one-time payment fallback for the first period, mandate retried
later (C-4, SRS-12.3). The fallback is mandatory, not optional.

**Detection:** mandate failure rate; checkout-start to payment-complete
conversion.

---

### 🟡 R-13 — QR fails to scan off thermal paper

**L: Medium · I: High**

A QR that will not scan off a real receipt makes the entire product zero.
Thermal print is low contrast; receipts crease, fold, and smudge.

**Mitigation:** high error correction; minimum 2cm; quiet zone preserved.
**Test on actual thermal paper with a cheap Android phone before shipping any
install.**

---

### 🟡 R-14 — Event loss corrupts the kill metric

**L: Low · I: High**

If events are lost, the only number that matters is wrong — and wrong in an
invisible direction.

**Mitigation:** `sendBeacon` for the handoff event; client buffering and retry;
server-stamped timestamps. Manual verification on a real device before the first
install.

**Detection:** funnel sanity checks — a step count exceeding the step above it
indicates loss or double-counting.

---

### 🟠 R-25 — Counter placement draws enforcement

**L: Low–Medium · I: High**

New with the OD-5 decision. Google's guidance discourages on-premises review
solicitation, where implicit pressure exists. Counter standees and stickers sit
on premises.

**Accepted deliberately** — scan volume is the primary risk to the business
(R-1), and counter placement materially increases it.

**Guardrails that remain:** no business-owned device handed to the customer, no
staff supervision, no pressure framing on the asset, no incentives (CR-5).

**Exposure lands on the customer's profile, not ours** — which is exactly why
the guardrails are not negotiable even though the placement rule relaxed.

**Detection:** any customer reporting review removal or profile warnings.
**Response:** if enforcement appears, revert to take-home only across all
outlets immediately and notify every active customer the same day
([03-COMPLIANCE.md](03-COMPLIANCE.md) § If we get this wrong).

---

### 🟡 R-26 — The neutral screen embarrasses a former customer

**L: Medium · I: Medium**

New with OD-18. A patient scans a printed receipt from a cancelled clinic and
reaches the inactive screen. Poorly worded, it makes the *clinic* look broken,
defunct, or delinquent.

**Mitigation:** the screen shows the business name and one neutral line, in the
same visual system as the live flow. Never "suspended", never "unpaid", never an
error state ([09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §2.2).

**Also a retention lever:** a former customer whose patients still scan a dead
code has a live reason to reactivate — and reactivation is instant with no
reprinting.

---

## Risks added 2026-09-30 — hub, loyalty, Growth Services

### 🔴 R-27 — Loyalty next to reviews reads as an incentive

**L: Medium · I: High**

The hub shows **Review** and **Rewards** as sibling tiles. CR-6 removes every
mechanical link (triggers, copy, identifiers, reports), but a customer — or
Google — can still draw the association from the layout alone. An owner may also
say it aloud at the counter ("scan, and collect your rewards").

**Mitigation:** neutral tile copy, separate routes, owner can disable either
module, written acknowledgement at activation (CR-6.6), CI firewall (SRS-21.6).
**Before launching loyalty: obtain policy/legal review of the hub layout.** The
exposure is on the customer's Google profile, same class as R-25.

**Fallback if review finds it too risky:** loyalty gets its own QR and its own
URL, not reachable from the review hub. Costs one extra printed asset; removes the
adjacency entirely.

**Detection:** any owner reporting review removal; any owner materials pairing
rewards with reviews.

---

### 🟠 R-28 — The hub dilutes the kill metric and the review flow

**L: High · I: High**

A menu between scan and review lowers scan → completed mechanically, and every
extra tile competes for the tap that matters. The one number the business is a
bet on becomes harder to read.

**Mitigation:** the validation cohort runs `direct` (OD-26); hub outlets use
`review chosen → completed` plus a separate take-rate; hub ships only in v1.5 and
behind a flag.

---

### 🟠 R-29 — Scope creep: four modules and five services before validation

**L: High · I: High**

The original plan's principle 5 is *no v2 work before the kill-metric decision*.
This expansion adds a hub, three new modules, and five sellable services — an
entire second product's worth of surface — on top of an unvalidated first.

**Mitigation:** hard caps. v1.5 is ~1 week and stops if it crowds out installs;
loyalty waits for the decision; Growth Services start as a form and a table
(Phase A) and are productised only on proven demand. **If installs stall, cut the
hub first.**

---

### 🟠 R-30 — Growth Services become an agency that eats the founder

**L: High · I: Medium**

Website building, video, content and automation are labour. Concierge delivery
does not scale, and each client has their own deadline. The subscription's
low-touch economics do not apply.

**Mitigation:** separate priced SKUs (OD-27) so labour is paid for; cap concurrent
engagements; Phase A is the demand test; productise only the repeated parts
(Phase B).

---

### 🟠 R-31 — Platform dependency and account risk for S4 / S5

**L: Medium · I: High**

Instagram and WhatsApp automation depend on Meta's API access, app review,
template approval and 24-hour messaging windows. A policy change or a flagged
account breaks a paid service **and harms the client's account**, not just ours.

**Mitigation:** official APIs only (SG-1), consent and opt-out (SG-2), no bought
engagement (SG-6), minimal credential scope with one-tap revoke (FR-118), and no
build until Phase C. Unofficial automation remains banned.

---

### 🟡 R-32 — Loyalty introduces customer PII

**L: Medium · I: Medium**

NFR-9 and OD-15 were built on *near-zero customer PII*. An optional phone number
ends that. Indian data-protection duties (minimum collection, retention,
deletion) and breach exposure now apply.

**Mitigation:** anonymous device wallet by default, phone optional, hashed lookup
and encrypted display, no owner export, deletion on request (FR-109), no messaging
to members (OD-29).

---

### 🟢 R-15 — Short URL goes down

**L: Low · I: High**

A printed QR is an asset we do not control. A dead code destroys the customer
relationship permanently.

**Mitigation:** edge caching, no billing-state dependency in the resolution path
(structural, not policy — C-6), dedicated uptime monitoring on `/r/{slug}`,
99.9% target.

---

### 🟢 R-16 — Google Places API cost or quota

**L: Low · I: Low**

Weekly polling at ten outlets is negligible. Revisit at scale.

---

## Business risks

### 🟠 R-17 — ₹499 is the wrong price

**L: Medium · I: Medium**

Possibly underpriced for dental (patient value ₹3,000–15,000+), signalling
"cheap utility" and inviting casual churn. Simultaneously, ₹2,000–2,500/yr
wholesale trains the channel at a third of direct.

**Mitigation:** OD-6 and OD-7. Launch at ₹499 for install velocity during
validation; revisit at 25 paying outlets. Defer the partner channel entirely.

---

### 🟡 R-18 — Trial threshold is mis-tuned

**L: Medium · I: Medium**

15 days may be too short for a low-traffic business to accumulate enough scans
to see review impact — reviews lag by days, so the paywall could arrive before
any visible proof. The 10 credits partly cover this, but a business getting 2
scans a week will burn them slowly and sit locked with little to show.

**Mitigation:** the 10 credits extend the window for low-traffic outlets by
design. Watch the gap between day-15 lock and first visible review-count
movement. Admin can extend a trial manually (SRS-11.9) for a business that is
clearly engaged but slow.

**Detection:** trial → paid conversion segmented by scan volume. If low-volume
outlets convert far worse, the trial is mis-tuned for them specifically.

---

### 🟢 R-19 — Competitor copies the compliant positioning

**L: Medium · I: Low**

Entirely possible and not especially damaging. The moat is execution and
references, not the idea. A competitor moving off gating is good for the market.

---

## Risk review cadence

| When | Review |
|---|---|
| Weekly during validation | R-1, R-2, R-8 — the three that matter |
| Day 7 per outlet | R-8 zero-scan alert |
| Day 30 | Full register + the kill-metric decision |
| Monthly post-launch | Full register |
| On any Google policy change | R-5, R-6, R-7 immediately |
