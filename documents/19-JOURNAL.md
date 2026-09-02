# Build Journal

**Product:** Revyu
**Started:** 2026-09-18

Running log of what happened, what was decided, and what was learned. Newest
entries at the top.

**Why this exists:**
1. Content raw material — you cannot reconstruct week 2 in week 10
2. Decision trail — *why* did we do that?
3. The learning record ([18-BUILD-TOGETHER.md](18-BUILD-TOGETHER.md))

---

## How to use this

**Log something whenever any of these happen** — 2 minutes, not an essay:

- A decision gets made (especially a reversal)
- Something breaks, or works better than expected
- A number arrives — first scan, first payment, a conversion rate
- A customer says something surprising
- You learn a concept that clicked
- You were wrong about something

**Format:**

```markdown
## YYYY-MM-DD — Short title

**What happened:** 1–3 sentences.
**Why it matters:** the insight, not the event.
**Numbers:** anything measurable.
**Content?:** 🎬 if this could be a reel — note the angle.
```

> **The `Content?` flag is the point.** Tag it in the moment. Trying to mine
> this file for content three months later produces nothing, because the
> emotional texture is gone and that is what makes content work.

---

## Metrics snapshot

Update weekly. This table alone is a content series.

| Week | Date | Installs | Scans | Completed | Conv. | Paying | MRR |
|---|---|---|---|---|---|---|---|
| 0 | 2026-09-18 | 0 | 0 | 0 | — | 0 | ₹0 |

---

## Milestones

Tick as they land. Each is a content moment.

- [ ] First line of code
- [ ] Database schema done
- [ ] Customer flow works end to end on a real phone
- [ ] **First QR printed on real thermal paper**
- [ ] First scan by someone who is not you
- [ ] First review actually published on Google
- [ ] First business signs up
- [ ] **First payment**
- [ ] 10 installs live
- [ ] **Kill-metric decision (day 30)**
- [ ] First churn
- [ ] ₹10,000 MRR

---

# Entries

## 2026-10-01 — The code exists. First hardening and revenue pass.

**What happened:** Audited the repo and found a working v1 skeleton, not "0 lines of code". Wrote [23-STATUS-AND-PLAN.md](23-STATUS-AND-PLAN.md), then built Phase 0 (safety), the billing path, an owner app shell, the Review Gap Report and the referral programme.

**Why it matters:** The audit found that anyone could burn a paying outlet's trial credits with unauthenticated events, and that the admin secret defaulted to a known string. Both are fixed and covered by tests. A locked owner previously had no way to pay; now they do.

**Decisions:** keep the current design; referral reward is 70% off the next bill once the referee pays; Pro tier parked; Business Profile service dropped.

**Numbers:** 20 backend tests, 0 customers.

**Content?:** 🎬 *"I audited my own startup's code and found anyone could switch off a customer's QR code."*

## 2026-09-30 — Scope grew: hub, loyalty, and five services

**What happened:** Asked to add loyalty badges (rewards, discounts, freebies), a
post-scan menu — **1 review, 2 social connects, 3 services/menu, 4 loyalty** — and
Growth Services: website building, landing video, content pipeline, Instagram and
WhatsApp automation. Wrote [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) and
threaded it through the existing docs.

**Why it matters:** Three things collided with existing rules, and each had to be
designed around rather than ignored:

1. **CR-5 (no incentives).** Loyalty rewards sit one tap from the review button.
   Permitted only behind a new **CR-6 firewall** — no shared trigger, copy,
   identifier or report. The residual layout risk (R-27) is real and needs
   policy/legal review before loyalty ships.
2. **The kill metric.** A menu between scan and review lowers scan → completed
   without the product getting worse. Validation cohort stays in `direct` mode;
   hub outlets get a separate take-rate metric.
3. **"No customer identity."** Loyalty needs to recognise returning customers.
   Proposed anonymous device wallet plus optional phone (OD-25) — a real boundary
   change, unconfirmed.

**Also spotted:** "services" meant two things (the business's menu vs. what Revyu
sells). Documented both, separated (OD-24).

**Numbers:** 1 new doc (22), 6 new proposed decisions (OD-24–29), 1 new
compliance rule, 6 new risks (R-27–R-32), 0 lines of code, 0 customers. Release
plan: v1 reserves schema only → v1.5 hub/connect/menu (~1 week cap) → v2 loyalty
→ v2.5/v3 services.

**Content?:** 🎬 *"I added a loyalty feature and had to write a compliance rule to
stop it becoming an illegal review incentive."* Angle: two features that are each
fine, dangerous when adjacent.

## 2026-09-18 — Every decision closed. Named it Revyu.

**What happened:** Resolved all 21 open decisions in one session. Name, colour,
font, pricing, trial mechanic, launch scope, draft assembly.

**Why it matters:** Three came out differently from the documented
recommendation, and two of those were me being talked out of my own position:

1. **Pricing.** I proposed tiers by niche and city. Reasoning that killed it:
   *every tier would have identical functionality*, so a public pricing page
   with three numbers invites "why am I in the expensive band?" Settled on one
   flat ₹499. The dynamic-pricing idea moved from pricing to **sales targeting**,
   which is where it actually belongs.
2. **Trial.** Was 30 flows or 45 days. Now **15 days → 10 review credits →
   collection stops.** The credit countdown adds urgency on top of unseen value.
3. **Launch scope.** All verticals, not dental-only. I argued for focus twice
   and lost; the costs (no concentrated reference base, noisier kill metric) are
   documented and accepted rather than ignored.

**Numbers:** 21 decisions, 0 placeholders left, ₹499/mo, 15-day trial.

**Content?:** 🎬 *"I wanted to charge different businesses different prices. Here's
why that's a terrible idea."* — the referral-network leak is the punchline. Two
dentists compare notes and your reference base is gone.

**Also:** 🎬 *"The pricing model I killed in 10 minutes."* Same story, faster cut.

---

## 2026-09-18 — Documentation complete, build not started

**What happened:** Finished 20 documents — PRD, SRS, data model, API spec,
compliance, GTM, risks. No code yet.

**Why it matters:** Three founder decisions got reversed during the writing, all
by thinking rather than building:

1. *"QR works forever even if they stop paying"* → wrong, a clinic could cancel
   and keep the benefit indefinitely. Now collection stops on suspension.
2. *"Take-home material only"* → relaxed to allow counter placement. Scan
   volume is the bigger risk.
3. Two proposals were rejected outright on compliance grounds (rating-gating,
   silent draft substitution) and replaced with versions that achieve the same
   goal defensibly.

**Numbers:** 20 docs, ~6,300 lines, 0 lines of code, 0 customers.

**Content?:** 🎬 *"I wrote 6,000 lines of documentation before a single line of
code. Here's what it caught."* — the three reversals are the substance. Angle:
planning is not procrastination when it changes the product.

**Also:** 🎬 *"My AI told me no."* The two rejected proposals are a genuinely
interesting story about building something you can defend.

---

## 2026-09-18 — The open question

**What happened:** Named the one thing this whole business is a bet on.

**Why it matters:** *Do customers actually scan these codes, and do they follow
through once they hit the paste step?* Nobody knows. Google does not let anyone
pre-fill a review, so the customer must copy, land on Google, sign in, and
paste. Estimated 40–60% drop at that step — and it is **unmeasurable**, because
it happens on Google's UI.

**Numbers:** Kill metric — scan → completed flow. Under 5% = stop.

**Content?:** 🎬 *"I wrote down the number that will kill my startup — before I
built it."* Strong hook: most founders never define failure in advance.
