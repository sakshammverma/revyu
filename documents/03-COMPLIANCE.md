# Compliance Policy

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18
**Audience:** Everyone. Engineering, design, sales, support. No exceptions.

---

## Why this document exists

The risk we are managing is not ours. It sits on the **customer's Google
Business Profile**.

A business that uses a non-compliant review tool can have reviews stripped,
its profile suspended, or the profile removed from local search results. The
business owner typically does not know the tool caused it. They lose their
primary acquisition channel and have little recourse.

We take on paying customers in a category where most competing tools are
non-compliant. That is our sales advantage and our obligation.

**No revenue justifies violating these rules.** A feature request that
conflicts with CR-1 through CR-6 is rejected without escalation.

---

## The six rules

*(Five review rules, CR-1 – CR-5, plus CR-6 added 2026-09-30 for loyalty.)*

### CR-1 — No pre-written review library

**Rule:** The system contains no stored, pre-authored review text. Not as
seeds, not as examples, not as "inspiration," not as fallback copy, not in a
database table, not in a config file, not in code.

**Why:** Google prohibits merchants from requesting or directing specific
review content. Supplying text the customer did not author makes the merchant
the author of record.

**Implementation:** Draft text is assembled at runtime from the customer's tag
selections plus neutral connective grammar. The connective scaffolding — words
like "and," "the," "was" — is not review content and is permitted. The
substance must map 1:1 to what the customer selected.

**Test:** If a customer selects zero tags, the draft must be empty or near-empty.
If the draft contains a substantive claim the customer did not select, the rule
is broken.

---

### CR-2 — The draft is always editable

> **Resolved 2026-09-18.** *Silent* SEO substitution was proposed, then replaced
> with **disclosed** SEO drafting, which is what ships
> ([16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) Part 1).
>
> Drafts are genuinely optimised — business name, locality, natural phrasing,
> 2–4 sentences, varied structure — **and the patient is told so** in a
> permanently visible line: *"We've written this from what you selected. Edit
> anything — it's your review."*
>
> The disclosure costs one line of UI and makes the feature defensible: the
> patient knows what they are publishing under their own name and can change it.
> Substance must still trace to a selected tag or the business's factual record
> (FR-62).

**Rule:** The assembled draft appears in a free-text field the customer can
modify or clear entirely before copying.

**Why:** Keeps the customer the author, in control, and able to correct
anything the assembler got wrong. Combined with CR-1, this is what makes the
output authentic rather than merchant-supplied.

**Implementation:** Never a read-only display. Never copy-on-behalf without the
customer having had the opportunity to edit. The edit field is the default
state of that screen, not an "advanced" option behind a tap.

---

### CR-3 — No sentiment gating

> **Resolved 2026-09-18.** A rating-threshold gate was proposed — Google link
> only above 3 stars, applied silently per-outlet. **Not implemented**: the
> enforcement penalty falls on the *customer's* profile, and running it silently
> removes their ability to weigh that risk.
>
> **What ships instead** ([16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md)
> Part 2): at 1–3 stars, private feedback is the primary action and Google is
> secondary — both fully visible, both one tap, on the same screen. Most upset
> patients choose to tell the owner directly, which achieves the commercial goal
> without hiding anything, and feeds the resolution loop
> ([10-ROADMAP.md](10-ROADMAP.md) §2.3).

**Rule:** Every customer sees the Google review link, at every rating, one star
through five. There is no branch, no condition, no threshold, no delay, and no
visual de-emphasis based on rating.

**Why:** This is the rule most competing tools break, and it is actively
enforced. Selectively routing satisfied customers to a public review while
diverting dissatisfied ones to a private form is review gating. It is
prohibited regardless of how it is framed internally.

**Implementation:** *(revised 2026-09-18 — see
[16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) Part 2)*

- The private feedback box is offered **in addition to** the Google link, never
  instead of it.
- The private box is offered at **all** ratings, not only low ones.
- **Visual hierarchy may differ by rating.** At 1–3 stars, private feedback is
  presented as the primary action and Google as secondary — because for someone
  who had a bad experience, telling the owner directly genuinely is the more
  useful action.
- **Availability may never differ.** At every rating the Google option is on the
  same screen, above the fold, a full-width ≥44px button, one tap from the
  handoff, at ≥4.5:1 contrast, neutrally labelled.

> **The line between design and gating:** arranging a screen around what users
> actually want is design. Making an option technically present but practically
> unusable — buried, greyed, delayed, behind an extra tap — is gating. The
> mechanical tests below are what enforce which side we are on.

**Tests (SRS-17.1a–g):** at every rating 1–5, the Google option must be present,
above the fold at 360×640, ≥44×44px, ≥4.5:1 contrast, exactly one tap from the
handoff, present after private feedback submission, and labelled from an
approved neutral string set.

> These replace the earlier byte-identical assertion, which no longer holds now
> that hierarchy varies deliberately.

> This is the rule most likely to come under commercial pressure — an owner
> will eventually ask to "only send the happy ones." The answer is no, and the
> reason is that it endangers their profile. That conversation is a sales
> asset, not an obstacle.

---

### CR-4 — Printed material, no staff observation

> **Revised 2026-09-18 by founder decision.** Counter placement is now supported.
> The rule below reflects that decision and the guardrails that remain.

**Rule:** The QR is printed material — receipt footers, handout cards,
appointment slips, invoice copies, **and counter-top standees or stickers near
the payment point**. It is never presented on a device the business controls
(a tablet or kiosk handed to the customer), and staff never watch the customer
complete the flow.

**What still holds:**

- **No business-owned device.** The customer uses their own phone, on their own
  time. A tablet handed over at the counter is out — that is direct observation.
- **No staff supervision.** Staff may point at the code; they do not stand over
  the customer while they complete it.
- **No pressure framing.** Counter assets say *"scan to share your experience"*,
  never *"leave us a 5-star review"*.
- **No incentive at the counter** (CR-5 is unchanged and absolute).

**The risk, stated once:** Google's guidance discourages soliciting reviews
on-premises, where implicit pressure exists. Take-home material carries less
exposure than counter placement. That exposure lands on the **customer's**
Google Business Profile, not ours.

**This trade-off has been accepted deliberately** on the basis that counter
placement substantially increases scan volume — the primary risk to the business
is nobody scanning at all (R-1). Take-home placement remains the recommended
default; counter placement is supported.

**Implementation:** Print assets include both take-home formats (receipt footer,
handout card) and counter formats (standee, counter sticker). OD-5, which
proposed cutting the standee, is resolved as **keep**.

**Sales obligation:** The owner is still asked where the QR will go and who is
responsible for it — not because counter placement is disallowed, but because an
install where nobody points at the code produces nothing (R-8).

---

### CR-5 — No incentives

**Rule:** No reward, discount, free service, loyalty point, entry into a draw,
or benefit of any kind is tied to leaving a review. At any rating. Ever.

**Why:** Incentivised reviews are prohibited outright, regardless of whether
the incentive is conditioned on sentiment.

**Implementation:** No incentive mechanic exists in the product. If an owner
runs one independently using our QR, that is outside our system — but if we
learn of it, we tell them to stop, in writing.

**Note:** This closes off a conversion tactic that would probably work. That is
the point. It is also a competitive differentiator worth stating publicly.

> **Revised 2026-09-30 — loyalty.** The platform now includes an owner-run
> loyalty module ([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5). **CR-5 is
> not loosened.** Loyalty rewards are earned by visits and purchases only, and
> only because CR-6 below keeps them structurally separate from review
> collection. "No reward tied to a review" remains absolute; a reward tied to
> *something else* is permitted, provided CR-6 holds.

---

### CR-6 — Loyalty is firewalled from reviews

**Rule:** The loyalty module and the review flow share no trigger, no copy, no
identifier, and no report.

1. **Earning is never review-based.** No review, rating, tag, copy tap, Google
   click, social follow, or feedback submission can earn, accelerate, or unlock a
   badge or reward. The option does not exist in the rule builder.
2. **No cross-reference in copy.** Loyalty screens never mention reviews,
   ratings, Google or stars; review screens never mention badges, rewards,
   discounts or loyalty.
3. **No data join.** No foreign key, shared ID, or query links a loyalty member
   to a review session or event.
4. **No owner-side correlation** — no "members who reviewed" view of any kind.
5. **No follow-to-earn.** Nothing is conditioned on following, liking or
   subscribing.
6. **Owner acknowledgement** at activation that rewards must never be offered
   for reviews.

**Why:** CR-5 prohibits incentives tied to reviews. A loyalty programme that
quietly shares triggers, identity or data with review collection would be an
incentive scheme with extra steps. The firewall is what makes the two products
honestly independent.

**Enforcement:** lint and schema tests in CI (SRS-21.6, 22-HUB §5.2). Code
review rejects any import or FK crossing the boundary.

**Residual risk:** the hub shows Review and Rewards as sibling tiles
(R-27). Obtain policy/legal review of hub layout before launching loyalty.

---

## What we deliberately do not do

| Not done | Why |
|---|---|
| Verify a review was published | Not measurable via any available API, and attempting per-customer attribution would require identity linkage we should not have |
| Trigger trial expiry on published reviews | Same — unmeasurable. Trial meters on completed flows (FR-41) |
| Pre-fill the Google form | Technically impossible; Google's review form accepts no prefilled rating or text. The paste step is real |
| Store customer identity | No accounts, no login, no tracking across outlets |
| Auto-submit on the customer's behalf | Would make us the author and require their credentials |

---

## The paste step

Google's review form accepts no prefilled rating or text via URL. There is no
API, no deep link parameter, and no supported workaround. Anything claiming
otherwise is either scraping, automating a signed-in session, or lying.

We treat the paste as expected and design for it:

- An interstitial sets the expectation before handoff (FR-11)
- The copy confirmation is unmistakable (FR-9)
- The instruction is plain: paste into the box on the next screen

We accept the conversion loss this creates rather than engineering around it.
The loss is quantified as a known unknown in [07-METRICS.md](07-METRICS.md).

---

## Sales and marketing constraints

Claims we **may** make:
- Compliant by design, with these five rules stated publicly
- Customers write their own reviews
- Every customer can leave a public review regardless of rating

Claims we **may not** make:
- Any guarantee of a specific number of reviews
- Any guarantee of rating improvement
- Any guarantee of search ranking improvement
- That we can ensure a review is published
- Comparative claims about named competitors' compliance status

**The compliance page is a marketing page.** Most competitors gate. Stating our
rules publicly is both honest and a differentiator — see
[08-GTM.md](08-GTM.md).

---

## Indian regulatory context

Beyond Google's platform policy, the following apply and are noted here for
completeness. **This document is not legal advice; obtain review before
launch.**

| Area | Note |
|---|---|
| Consumer protection — fake reviews | Indian standards on online consumer reviews address authenticity and disclosure of paid or incentivised reviews. CR-1, CR-2, and CR-5 are aligned with this. |
| Data protection | Customer private feedback may contain personal data. Collect the minimum, state retention, provide deletion on request. |
| WhatsApp Business messaging | Template-based messaging, opt-out honoured, no unsolicited marketing to customers. We message **owners**, not their customers. *(Growth Services S5 lets an owner message their own consented contacts — guardrails SG-1..SG-8 in [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §7.3.)* |
| Loyalty member data | Optional phone number makes us a holder of customer PII. Minimum collection, hashed lookup, stated retention, deletion on request (FR-109). |
| Payments | Razorpay requires a published refund policy. Recurring mandates must state amount, frequency, and cancellation clearly. |
| GST | Applicable on subscription revenue above threshold. Invoicing requirement. |

---

## Enforcement in the codebase

These rules must be visible where they can be broken, not only in this document.

1. Comment each rule at its enforcement point, referencing the CR ID.
2. A test asserts the handoff screen is rating-independent (CR-3).
3. A test asserts draft output contains no substantive content absent from tag
   input (CR-1).
4. A CI check greps for a review-text content table or seed file (CR-1).
5. Code review rejects any rating-conditional branch in the handoff path.

---

## If we get this wrong

If a customer's profile is affected and our tool is implicated:

1. Stop new installs immediately.
2. Notify every active outlet in writing, same day.
3. Determine which rule failed and fix it before resuming.
4. Support the affected owner through Google's reinstatement process at our cost.

The commitment we are making by selling this product is that the owner's
profile is safer with us than without us. If that stops being true, we stop
selling.
