# How We Build Together

**Version:** Draft v1
**Date:** 2026-09-18

You want to learn development — specifically the decision-making, not just
syntax. This document defines how we work so that actually happens.

**Mode chosen: teach first, then build together.**

---

## 1. The loop

For each piece of work:

```
1. CONCEPT      I explain what we're about to build and why it's needed.
                No code yet. Plain language.

2. OPTIONS      I lay out the real ways to do it — usually 2–3 —
                with honest tradeoffs. Including the one I'd pick and why.

3. YOU DECIDE   You choose. Ask anything first. "I don't know, what would
                you do?" is a fine answer — but I'll make you hear the
                reasoning before I proceed.

4. I BUILD      I write it, following your decision.

5. WALKTHROUGH  I show what I wrote and explain the non-obvious parts.
                Not line-by-line — the parts where a choice was made.

6. YOU QUESTION Anything unclear. No question is too basic.
```

**This is slower than me just building.** That is the point. You are trading
speed for understanding, which is the right trade when you intend to run this
business and eventually maintain the code.

---

## 2. What I will always explain

Every time a choice gets made, you get:

- **What the options were** — including ones I rejected
- **Why this one** — the actual reason, not "best practice"
- **What it costs** — every choice gives something up
- **When it would be wrong** — the conditions under which we'd choose differently

> "Best practice" is not an explanation. If I ever say it without a reason,
> push back.

---

## 3. What I won't do

| Won't | Why |
|---|---|
| Write code before you've decided the approach | Defeats the purpose |
| Hide a decision inside an implementation | Decisions are yours to make |
| Say "trust me" | If I can't explain it, I don't understand it well enough |
| Assume you know a term | I'll define jargon on first use |
| Make you feel slow for asking | You're learning; that's the job |

---

## 4. Concepts you'll pick up, in order

Roughly the order they'll come up as we build. You don't need to study these —
they arrive naturally with the work.

### Phase 1 — Foundations *(building the customer flow)*

| Concept | Where it shows up |
|---|---|
| **Client vs. server** | Why the flow runs on the phone but data lives on our server |
| **HTTP requests** | How the phone asks our backend for things |
| **Database schema** | Why tables and columns are shaped the way they are |
| **API design** | Why endpoints are split the way they are |
| **State machines** | The outlet lifecycle — `trial` → `locked` → `suspended` |
| **Caching** | Why the QR path is fast, and what "stale" costs |

### Phase 2 — Structure *(dashboard and admin)*

| Concept | Where it shows up |
|---|---|
| **Authentication vs. authorization** | Who you are vs. what you may see |
| **Sessions and tokens** | How login persists for 30 days |
| **Data access control** | Why owners can only see their own outlet |
| **Aggregation** | Turning raw events into a funnel |
| **Background jobs** | Weekly polls and digests |

### Phase 3 — Integration *(payments and external services)*

| Concept | Where it shows up |
|---|---|
| **Webhooks** | Why Razorpay calls us, not the other way round |
| **Idempotency** | Why the same webhook twice must not charge twice |
| **Third-party failure** | What happens when Google's API is down |
| **Secrets management** | Why API keys never reach the browser |

### Phase 4 — Judgement *(the part that matters most)*

| Concept | Where it shows up |
|---|---|
| **Technical debt** | What we deliberately did badly, and when to fix it |
| **Premature optimisation** | Why we have no message queue |
| **Failure modes** | What breaks first under load, and does it matter |
| **Reversibility** | Why some decisions need care and others don't |

> **Phase 4 is the real skill.** Syntax is learnable in weeks. Knowing *which
> problems are worth solving now* takes far longer, and it is what separates
> someone who can code from someone who can build a product.

---

## 5. The decision-making framework

The questions I ask myself before every choice. Learn these and you can make
most calls yourself.

### 5.1 Is this reversible?

| Reversible | Irreversible-ish |
|---|---|
| Button colour, copy, layout | Database schema after real data exists |
| Which library | Your API contract once others depend on it |
| Internal structure | Anything printed and handed to customers |

**Reversible → decide fast, move on.** Irreversible → slow down and think.

This is why the QR slug format got careful thought and the dashboard layout
didn't.

### 5.2 What is the cost of being wrong?

Not "what's the chance I'm wrong" — **what happens if I am.**

A wrong Place ID sends a clinic's customers to review a stranger's business.
Low probability, catastrophic cost → that's why there's a manual approval gate.

A slightly wrong tag set is fixable in an afternoon → no gate needed.

### 5.3 Does this need to exist yet?

The most valuable question, and the one most often skipped.

We have no message queue, no Redis, no microservices — not because they're bad,
but because at ten outlets they're cost with no benefit. Every one is written
down with the trigger for revisiting
([04-ARCHITECTURE.md](04-ARCHITECTURE.md) §12).

> **The instinct to build for scale you don't have is the most expensive habit
> in software.** It's also the most common.

### 5.4 What breaks first?

Before building, ask what fails when load or complexity grows. Usually you find
the real constraint isn't what you assumed.

For us: the QR path must never fail, so it's simplest and most independent.
The dashboard can be slow — nobody's watching it at 2am.

### 5.5 Am I solving the real problem?

The riskiest question, because the answer is often no.

Example from this product: the docs specified a beautiful funnel dashboard. But
the real problem is "do customers scan and follow through?" — which needs
instrumentation, not a dashboard. Instrumentation ships first.

---

## 6. Questions worth asking me

If you're not sure what to ask, these always produce something useful:

- *"What did you consider and reject?"*
- *"What would break if we did the simple version instead?"*
- *"Which part of this are you least sure about?"*
- *"What will we regret in six months?"*
- *"Is this solving a problem we actually have?"*
- *"What happens when this fails?"*

> The last one especially. Most code is written assuming success. The
> interesting part is what happens when the network drops, the API is down, or
> the user taps back at the wrong moment.

---

## 7. What you own vs. what I own

| You decide | I decide |
|---|---|
| What the product does | How it's structured internally |
| What's worth building | Which library, which pattern |
| Business tradeoffs | Code organisation, naming |
| Risk appetite | Test coverage |
| When "good enough" is enough | Whether something is actually finished |

**Where they overlap, I explain and you choose.** That's most architecture
decisions — they look technical but are really business tradeoffs wearing a
technical costume.

> Example: "Should the draft be assembled on the phone or the server?" sounds
> technical. It's actually "do we want it instant but slightly bigger, or
> smaller but with a delay on our worst drop-off screen?" — a product question.
> That's OD-8, and it's yours.

---

## 8. Ground rules

1. **No question is too basic.** "What's a webhook?" is a good question. Not
   asking is the expensive thing.
2. **Tell me when I'm going too fast.** I can't see your face.
3. **Tell me when an explanation didn't land.** I'll try a different angle
   rather than repeating the same one.
4. **Push back on my recommendations.** I'm often right and sometimes not, and
   you'll learn more arguing than agreeing.
5. **You can always say "just build it."** Some decisions genuinely aren't worth
   your time. I'll tell you which ones I think those are.

---

## 9. First session

When you're ready to start building, we begin with the **database schema** —
the least reversible decision in the whole build, which is exactly why it goes
first.

**I'll explain:** what a schema is, why the table shape matters, what "migration"
means and why it hurts later.

**You'll decide:** a handful of real tradeoffs, including some already flagged as
open decisions.

**Before that, four things still block us:** product name, accent colour, display
font, and confirming dental as the launch vertical
([11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md)).

Those are yours. Everything else is ready.
