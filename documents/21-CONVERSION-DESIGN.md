# Conversion Design — Marketing Site & Demo

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

How the marketing site makes a business owner understand the product, feel what
inaction costs, and pay. Research-backed, and it resolves one real problem with
the current colour plan.

---

## 1. The finding that changes the accent plan

> **Your CTA colour must contrast with your brand colour, not duplicate it.**
> If nav, logo, and chrome are indigo, an indigo CTA blends in and gets ignored.
> Standard CRO practice reserves the brand colour for secondary CTAs and text
> links.

Indigo `#4338CA` was chosen (OD-2) as the accent and it is right for *brand* —
blue reads as trust, reliability, authority, and roughly 42% of people associate
it with reliability. That matters here: the buyer's main hesitation is *"will
this hurt my Google profile?"*

**But indigo-on-indigo buttons will underperform.** We need a second colour for
primary action.

### 1.1 Recommended two-colour system

| Role | Colour | Why |
|---|---|---|
| **Brand / chrome / lines / mono labels** | Indigo `#4338CA` | Trust, reliability. The design-system accent (OD-2), unchanged. |
| **Primary CTA** | **Amber `#D97706`** | Carries red's energy without its anxiety. In B2B, orange reads as accessible and friendly; red can trigger anxiety in trust-sensitive categories and *reduce* conversion. |
| Secondary CTA / links | Indigo | Reinforces trust without demanding action |
| Urgency (trial expiry, credits) | **Red `#DC2626`, sparingly** | Genuine deadlines only. Never on the marketing site. |
| Positive delta (rating up) | Green `#15803D` | Data display only, never a CTA |

> **Why amber over red for the main CTA:** in high-consideration B2B purchases —
> healthcare, finance, software — red triggers anxiety rather than urgency. Your
> buyer is a clinic owner worried about their Google profile. Amber keeps the
> energy and drops the alarm.

> **Why not green:** green is the other common choice, but here it collides with
> the positive-delta colour in dashboard charts. One meaning per colour.

**Contrast check:** amber `#D97706` on paper `#F5F5EF` passes AA for large text
and UI components. Body copy stays ink `#282828`.

**This is a change to OD-2**, which named one accent. Recorded as OD-22.

---

## 2. The core psychological principle

> **Loss aversion:** the pain of losing is roughly twice as intense as the
> pleasure of an equivalent gain.

For this product the implication is direct:

| Weak (gain framing) | Strong (loss framing) |
|---|---|
| "Get more Google reviews" | "You're losing customers to the clinic with 180 reviews" |
| "Grow your reputation" | "47 reviews. Your competitor has 180." |
| "Start collecting reviews" | "Every week without this, the gap widens" |

**The reason inaction is the default:** as long as an owner thinks *"I can do
this next month,"* they have no reason to act. They are not saying no — they are
declining to decide. Making the cost of waiting visible is what converts.

### 2.1 Use it with restraint

Research is explicit that overusing loss aversion makes people anxious rather
than motivated, and anxiety in a trust-sensitive category suppresses conversion.

**The rule for this site:** state the loss **once**, with a real number, then
spend the rest of the page building confidence. Never stack fear.

---

## 3. The homepage demo — what it must actually do

You asked for something that makes an owner *understand the working* and *feel
why it matters*. Those are two different jobs, and the demo should do them in
sequence.

### 3.1 Structure: three acts on one scroll

```
ACT 1 — THE GAP          "Here's what you're losing"     ← loss aversion, once
ACT 2 — THE MECHANISM    "Here's how it works"           ← the interactive
ACT 3 — THE RETURN       "Here's what you get back"      ← endowment
```

### Act 1 — The gap (loss, stated once)

**Not** a generic hero. A **comparison the owner recognises as themselves.**

```
┌────────────────────────────────────────────────┐
│  [01] THE GAP                                  │  ← mono label, indigo
│                                                │
│  YOUR CLINIC              THE ONE NEARBY       │  ← h2, uppercase
│                                                │
│      47                       180              │  ← huge numerals
│    reviews                  reviews            │
│      4.3                      4.6              │
│                                                │
│  ─────────────────────────────────────         │  ← 1px line
│                                                │
│  Same work. Same prices.                       │
│  They just ask every customer. You don't.      │
└────────────────────────────────────────────────┘
```

Why it works: it is **specific, not abstract**, it attributes the gap to a
*process difference* rather than to quality (so it does not insult them), and it
names a loss that is already happening — not a hypothetical future one.

> **Best version:** if a visitor arrives from a pre-built link, populate this
> with **their real numbers** from the Places API. "You're at 47" lands
> immeasurably harder than a generic example. This is the same mechanic as the
> pre-built sales demo ([08-GTM.md](08-GTM.md) §3.1).

### Act 2 — The mechanism (the interactive)

A phone frame the visitor actually uses. **Customer flow only** — not the
dashboard, not the whole workflow. One thing, done convincingly.

```
   ┌─────────────────┐
   │  ┌───────────┐  │     ← phone frame, 1px indigo line, sharp corners
   │  │ Smile...  │  │
   │  │  ★★★★★    │  │     ← visitor taps these
   │  │           │  │
   │  │ [clean]   │  │     ← visitor taps chips
   │  │ [on time] │  │
   │  │           │  │
   │  │ "The..."  │  │     ← draft assembles LIVE as they tap
   │  └───────────┘  │
   └─────────────────┘
```

**The single most important detail: the draft must visibly assemble as they tap
a chip.** That is the entire proof. It shows the review comes from customer
input — which is the thing prospects doubt, and the thing that separates you
from tools that write fake reviews.

**Annotations around the frame** — mono labels on 1px leader lines, pointing at
each step. This is where the blueprint aesthetic earns its place: it reads as a
technical diagram of a mechanism, which is exactly what it is.

Beneath the frame, one honest line:

> *They copy this and paste it into Google. That step is real — Google doesn't
> let anyone pre-fill a review.*

Stating the limitation **increases** credibility with a cautious buyer, and it
pre-empts the objection.

### Act 3 — The return (endowment)

> Once people feel ownership of something they value it more — even when the
> ownership is only imagined. This is why free trials convert.

So: show them **their** dashboard, already populated.

```
┌────────────────────────────────────────────────┐
│  [03] YOUR DASHBOARD          ● LIVE           │
│                                                │
│  SCANS        COMPLETED       NEW REVIEWS      │
│   143            28               6            │  ← numbers tick up on scroll
│                                                │
│  RATING   4.3 ──────────────► 4.5              │  ← green delta
│                                                │
│  TOP TAGS                                      │
│  friendly staff    ████████████  52            │
│  on time           █████████     41            │
└────────────────────────────────────────────────┘
```

Then the trial framing — and **frame it as avoiding a loss, not getting a gift**:

> **15 days free. No card needed.**
> *You'll have your numbers before you decide anything.*

---

## 4. Page order and what each section does

| # | Section | Job | Emotion |
|---|---|---|---|
| 1 | The gap | Loss, once, with a number | Recognition, slight discomfort |
| 2 | Why it happens | "Your staff ask the customers they like" | Relief — it is not their fault |
| 3 | **The interactive** | Prove the mechanism | Curiosity → understanding |
| 4 | The paste step, stated | Pre-empt the objection | Trust |
| 5 | Your dashboard | Endowment | Ownership |
| 6 | **Compliance** | "We never hide the Google link" | Safety |
| 7 | Pricing | ₹499, one number, no tiers | Clarity |
| 8 | Trial CTA | Risk reversal | Low-stakes yes |

> **Section 6 is doing more work than it looks.** The buyer's real fear is not
> "will this work" — it is "will this get my Google profile banned." Most
> competitors gate reviews, and owners have heard the horror stories.
> Stating the five rules plainly is the highest-trust page on the site
> ([03-COMPLIANCE.md](03-COMPLIANCE.md)).

---

## 5. Where urgency belongs — and where it does not

| Surface | Urgency? |
|---|---|
| Marketing site | ❌ **None.** No countdowns, no fake scarcity, no "3 spots left." A cautious B2B buyer reads manufactured urgency as a scam signal. |
| Trial day 15 → credits | ✅ Real countdown — "7 review credits left" |
| Credits exhausted | ✅ **"Your review QR has stopped working"** |
| Weekly digest | ✅ Mild — "your competitor gained 4 reviews this week" |

**The urgency in this product is genuine**, which is why it is allowed to be
blunt at the trial boundary. Printed codes really do stop collecting
([05-DATA-MODEL.md](05-DATA-MODEL.md) §4.1a). Nothing on the marketing site is
genuine urgency, so nothing there gets it.

> Faking scarcity on the marketing page would undermine the exact thing the
> compliance page is buying you.

---

## 6. Copy principles

| Do | Don't |
|---|---|
| "47 reviews. They have 180." | "Grow your online reputation" |
| "Your staff ask the people they like" | "Automate review collection" |
| "One patient covers a year" | "Affordable pricing" |
| "We never hide the Google link" | "Compliant and safe" |
| Numbers, always | Adjectives |

**Never promise** a number of reviews, a rating improvement, or a ranking
improvement ([03-COMPLIANCE.md](03-COMPLIANCE.md) § Sales constraints). The loss
framing describes **their current situation**, which is factual — it never
promises a future outcome.

---

## 7. Mobile chrome — resolved

**Decision (OD-23):** full framing chrome on the marketing site and dashboard.
**Reduced chrome on the customer flow** — 4-line viewport frame only, no ruler
ticks, no crop marks.

**Why this deviates from the design system**, which says keep the chrome below
768px: the reference implementation renders **265 `.line` elements plus 36 crop
marks**. That is real DOM and real paint cost. The customer flow has a hard
budget of <150KB and <2.0s FCP on 3G (NFR-1, NFR-2) and is the surface the kill
metric depends on.

Identity is preserved by the frame, the type, and the sharp corners. The ticks
are decorative and they are the first thing to go when they compete with the one
number that decides whether the business exists.

---

## 8. Requirements

| ID | Requirement |
|---|---|
| FR-76 | Homepage follows the three-act structure: gap → mechanism → return |
| FR-77 | The interactive demo uses **real customer-flow components**, so it cannot drift from the shipped product |
| FR-78 | The draft visibly assembles as the visitor taps each chip |
| FR-79 | Loss framing appears **once**, in Act 1, with a concrete number |
| FR-80 | Amber `#D97706` for primary CTAs; indigo for brand, chrome, secondary |
| FR-81 | **No manufactured urgency anywhere on the marketing site** |
| FR-82 | The paste step is stated plainly on the homepage |
| FR-83 | Pre-built demo links populate Act 1 with the prospect's real Places data |
| FR-84 | Customer flow ships reduced chrome; marketing and dashboard ship full |

---

## Sources

- [Venture Harbour — Loss Aversion: 7 Ways to Boost Conversions](https://ventureharbour.com/loss-aversion-7-ways-to-use-it-to-boost-your-conversions-with-examples/)
- [Invesp — 13 Loss Aversion Marketing Tactics](https://www.invespcro.com/blog/13-loss-aversion-marketing-strategies-to-increase-conversions/)
- [ActiveCampaign — When Loss Aversion Works (and When It Doesn't)](https://www.activecampaign.com/blog/loss-aversion-marketing)
- [Lead Alchemists — Guide to Loss Aversion in Marketing](https://www.leadalchemists.com/marketing-psychology/loss-aversion/)
- [Azarian Growth Agency — Landing Page Psychology](https://azariangrowthagency.com/landing-page-psychology/)
- [WiserNotify — Best CTA Button Colors](https://wisernotify.com/blog/call-to-action-colors/)
- [EndeavorB2B — Color Psychology in B2B Marketing](https://www.endeavorb2b.com/blog/color-psychology-in-b2b-marketing/)
- [UseVisuals — Color Psychology for B2B: Trust vs. Urgency](https://usevisuals.com/blog/color-psychology-for-b2b)
- [Ritner Digital — What Conversion Data Says About Brand Colors](https://www.ritnerdigital.com/blog/what-the-conversion-data-actually-says-about-brand-colors)
