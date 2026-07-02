# Draft Generation & Low-Rating Routing

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

Specifies two things: how review drafts are generated and disclosed, and how the
screen is arranged after a low rating.

Both replace earlier proposals that were not implementable. The versions here
achieve the same commercial goals and survive scrutiny.

---

# Part 1 — SEO-friendly drafts, disclosed

## 1.1 What changed

**Earlier proposal:** present the draft as tag-derived while silently
substituting SEO-optimised text.

**What is built instead:** drafts are genuinely optimised **and the patient is
told so.** Same output quality, disclosed.

The disclosure is one line of UI. It costs nothing, and it makes the entire
feature defensible — the patient knows what they are publishing under their own
name, and can change it.

## 1.2 The disclosure

Shown on the draft screen, adjacent to the text, before any action:

> **We've written this from what you selected.**
> Edit anything — it's your review.

Requirements:

- **Always visible.** Not a tooltip, not behind an info icon, not below the fold.
- **Plain language.** No "AI-assisted content generation" hedging.
- **Adjacent to the text**, not in a footer.
- Present at **every** rating.

That is the whole obligation. It is a sentence.

## 1.3 What "SEO-friendly" means here

These are real ranking and usefulness factors, and all are compatible with text
that derives from the patient's selections.

| Technique | Example | Allowed because |
|---|---|---|
| **Business name** | "Smile Dental Care was…" | Factual; the patient chose this business |
| **Service / vertical noun** | "…for a root canal" | Derived from the outlet's vertical and tag set |
| **Locality**, where natural | "…clinic in Indore" | Factual, from the Place record |
| **Natural phrasing** | Conversational, not clinical | Style, not substance |
| **Length** | 2–4 sentences | Longer reviews carry more weight |
| **Structural variation** | Different openings, orders, connectives | Prevents templated-looking profiles (R-3) |
| **Specificity from tags** | "painless" → "the treatment was painless" | Straight from their selection |

### What is still not allowed

| Not allowed | Why |
|---|---|
| Claims about services they did not select | Not their experience |
| Superlatives absent from tag input | "best in the city" is our opinion, not theirs |
| Invented specifics | Staff names, prices, wait times they never entered |
| Competitor mentions | Never |
| Identical drafts across patients | Enforcement signal, and obviously false |

**The test:** every substantive claim traces to a tag the patient tapped, the
business's own factual record (name, locality, vertical), or connective grammar.

## 1.4 Generation approach

**Deterministic assembly with a varied phrase bank.** Not an LLM call.

```
selected tags + outlet facts (name, vertical, locality)
        │
        ▼
  pick one phrasing variant per tag  ── from ≥4 variants each
        │
        ▼
  pick an opening template ── ≥6 variants, rotated
        │
        ▼
  join with varied connectives
        │
        ▼
  editable draft + disclosure line
```

**Why not an LLM:**

- No per-review cost or latency on the highest-drop-off screen
- Output is auditable — the CR-1 test (SRS-17.2) stays mechanical
- No risk of hallucinated specifics, which is the main failure mode here
- Works offline if assembly is client-side (OD-8)

**Variation requirements:**

- ≥4 phrasings per tag
- ≥6 opening templates
- Rotate deterministically on session ID so the same tags do not always produce
  the same sentence
- **Zero tags → empty draft.** Unchanged (CR-1, SRS-17.2).

### Example

Tags: `clean clinic`, `painless treatment`, `on time`

```
Variant A: "Had a great experience at Smile Dental Care. The clinic was
            spotless and the treatment was completely painless. They ran on
            time too."

Variant B: "Smile Dental Care in Indore is genuinely well run — clean
            throughout, and my treatment was painless. No waiting around
            either."
```

Both are longer, more natural, and carry the business name and locality. Both
trace entirely to three tags plus factual record.

## 1.5 Requirements

| ID | Requirement |
|---|---|
| FR-56 | Drafts include business name and, where natural, vertical and locality |
| FR-57 | ≥4 phrasing variants per tag; ≥6 opening templates |
| FR-58 | Variant selection rotates on session ID |
| FR-59 | **Disclosure line always visible on the draft screen, at every rating** |
| FR-60 | Draft remains fully editable and clearable (CR-2, unchanged) |
| FR-61 | Zero tags → empty draft (CR-1, unchanged) |
| FR-62 | No claim may originate outside tag input or factual outlet record |

**Test (extends SRS-17.2):** for a sample of tag combinations, assert every
substantive noun/adjective maps to a selected tag or an outlet fact. Assert no
two consecutive sessions with identical tags produce identical text.

---

# Part 2 — Low-rating routing

## 2.1 The principle

**Nothing is gated. Nothing is hidden. Both options are always real, visible,
and reachable.**

What changes at low ratings is **which action is presented as the natural next
step** — because for someone who had a bad experience, telling the owner
directly genuinely *is* the more useful action.

We expect most upset patients to stop at private feedback. That expectation is
fine. It comes from offering something people actually want, not from making the
alternative hard.

> **The line:** arranging a screen around what users want is design. Making an
> option hard to reach so it is technically present but practically unusable is
> gating. The first is what we do; the second is what CR-3 prohibits.

## 2.2 Screen behaviour by rating
<!-- ANCHOR: low-rating-screen -->


### Ratings 4–5

Unchanged from the existing flow. Draft → copy → Google handoff, with the
private feedback entry point also present.

### Ratings 1–3

```
┌──────────────────────────────────────────┐
│  Sorry that didn't go well.              │
│                                          │
│  Tell Smile Dental Care directly —       │
│  the owner sees this today.              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ What went wrong?                   │  │
│  │                                    │  │  ← focused, ready to type
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Send to the owner             │  │  ← primary
│  └────────────────────────────────────┘  │
│                                          │
│  ── or ──                                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Post publicly on Google       │  │  ← secondary, full-width,
│  └────────────────────────────────────┘  │     same screen, no scroll
│                                          │
└──────────────────────────────────────────┘
```

**Both buttons are real, full-width, above the fold, and reachable with one
thumb.** The difference is visual hierarchy — primary versus secondary styling —
not availability.

## 2.3 Hard rules

These are what keep this compliant. They are testable.

| ID | Rule |
|---|---|
| CR-3.1 | The Google option appears on the **same screen**, **above the fold**, at every rating |
| CR-3.2 | It is a **full-width tappable button**, never a text link, never in a footer |
| CR-3.3 | It is never behind a scroll, a tab, an accordion, a modal, or a second tap |
| CR-3.4 | Its touch target is ≥44px, same as the primary |
| CR-3.5 | No delay, no timer, no disabled state, no "are you sure" interstitial |
| CR-3.6 | Its label is neutral — "Post publicly on Google". Never discouraging. |
| CR-3.7 | Submitting private feedback **still shows** the Google option afterwards |
| CR-3.8 | Contrast ratio ≥4.5:1 — secondary styling, never greyed out |

**What "secondary" is allowed to mean:** outline instead of filled, positioned
second, smaller label weight.

**What it may never mean:** hidden, collapsed, low-contrast, delayed,
undersized, behind an extra tap, or discouraging in wording.

## 2.4 After private feedback is submitted

```
┌──────────────────────────────────────────┐
│  ✓ Sent. The owner will see this today.  │
│                                          │
│  You can still post publicly if you'd    │
│  like others to know.                    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Post publicly on Google       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

CR-3.7 in practice: sending private feedback never removes the public option.

## 2.5 Why this works commercially

Not a compromise — it is likely **better** than a buried button.

1. **Most upset people want acknowledgement, not revenge.** Offered a direct
   line to the owner with a same-day promise, a large share take it. You do not
   need to hide anything to get that outcome.
2. **It survives any audit.** Screenshot the screen at rating 1 — both options
   are plainly there.
3. **It produces the operations loop.** Private complaints become tickets the
   owner resolves ([10-ROADMAP.md](10-ROADMAP.md) §2.3) — the feature that makes
   the product hard to cancel.
4. **A resolved complaint sometimes becomes a good review.** A patient who felt
   handled occasionally returns and posts positively. A buried button cannot
   produce that.
5. **It is honestly sellable.** "We never hide the Google link" is a sentence you
   can say to a cautious buyer. It is on the compliance page.

## 2.6 Requirements

| ID | Requirement |
|---|---|
| FR-63 | Ratings 1–3 show private feedback as the primary action, Google as secondary |
| FR-64 | Both options on the same screen, above the fold, full-width buttons |
| FR-65 | Private feedback field is focused and ready for input on arrival |
| FR-66 | The Google option persists after private feedback is submitted |
| FR-67 | Ratings 4–5 behaviour unchanged |
| FR-68 | Private feedback promises owner visibility "today" — the SLA that makes it attractive |

## 2.7 Tests

Extends SRS-17.1, which previously asserted the handoff screen was identical at
rating 1 and 5. That assertion no longer holds — hierarchy differs by design —
so it is replaced with these:

| ID | Test |
|---|---|
| SRS-17.1a | The Google option is **present** at every rating, 1–5 |
| SRS-17.1b | At every rating it is above the fold at 360×640 without scrolling |
| SRS-17.1c | Its touch target is ≥44×44px at every rating |
| SRS-17.1d | Its contrast ratio is ≥4.5:1 at every rating |
| SRS-17.1e | It requires exactly **one** tap to reach the Google handoff, at every rating |
| SRS-17.1f | It is still present after private feedback submission |
| SRS-17.1g | Its label is drawn from an approved neutral string set |

> **These tests are the compliance boundary.** They are what distinguishes
> "private feedback shown first" from review gating, and they must be the thing
> that fails CI if the screen drifts toward burying the option later.

## 2.8 Measurement

Instrument, because the assumption should be checked rather than believed:

| Metric | Watch for |
|---|---|
| Private-first rate (1–3 stars) | Share choosing private over Google |
| Google rate at 1–3 stars | **Should be non-trivial.** Near-zero suggests the hierarchy has drifted too far and needs rebalancing. |
| Private feedback resolution rate | Owners actually closing the loop |
| Rating distribution on Google vs. in-app | A large divergence is a signal worth understanding |

> If Google submissions at 1–3 stars fall to near zero, treat that as a design
> problem to correct, not a success. The intent is that people choose — not that
> the choice is theoretical.

---

## 3. Summary of changes

| Area | Change |
|---|---|
| Draft text | SEO-optimised, business name and locality, longer, varied — **and disclosed** |
| Draft screen | Adds a permanent one-line disclosure |
| Ratings 4–5 | Unchanged |
| Ratings 1–3 | Private feedback primary, Google secondary, **both fully visible** |
| CR-1 | Unchanged — substance still traces to tags and factual record |
| CR-2 | Unchanged — always editable |
| CR-3 | **Strengthened** — hierarchy permitted, seven mechanical tests added |
| SRS-17.1 | Replaced with SRS-17.1a–g |
