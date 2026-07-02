# How It All Works — Plain Language

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

A non-technical walkthrough from all four perspectives. If you read one document
to understand the whole system, read this one.

---

## The one-paragraph version

A dental clinic signs up on our website and pays. You check their details and
approve them. They get a QR code to print on their receipts or paste them at counter so that people can scan them easly who visits them or near payment qr at their shop. Patients scan it,
tap a star rating and a few tags like "clean clinic" or "painless treatment",
and the app builds a short review from exactly those tags. The patient edits it
if they like, copies it, and lands on Google to paste it. The clinic owner logs
in to see how many people scanned, how many finished, and whether their Google
rating is moving.

> **Coming after v1 (added 2026-09-30).** Once validated, the same QR can open a
> small menu instead of going straight to the review: **1 Share your experience,
> 2 Connect (Instagram, WhatsApp, etc.), 3 Menu / Services, 4 Rewards** (loyalty
> badges the owner hands out for repeat visits — kept completely separate from
> reviews). Owners can also buy **Growth Services** from us: a website, a landing
> video, managed content, Instagram and WhatsApp automation. None of this is in
> the first build. See [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md).

---

# 1. Your perspective (Admin)

## What you actually do day to day

**Your job is approval, not data entry.** Owners sign themselves up and pay.
You check two things before letting them go live.

### The approval queue

When someone signs up and pays, they land in your approval queue. They are
**not live yet**. You see:

- Business name, vertical, owner name, phone, email
- The Google business we matched them to — name, address, current rating and
  review count
- A preview link to their customer flow, fully branded, working
- Their payment status

You check **two things**, and they are the only two that matter:

| Check | Why it matters |
|---|---|
| **Is this the right Google business?** | If wrong, their patients write reviews on a stranger's business. Unrecoverable. |
| **Where will the QR go, and who owns it?** | Receipts, handout cards, or a counter standee — all supported. What matters is that *someone* is responsible for pointing at it. |

The second one usually needs a two-minute phone call. Naming the staff member
responsible is the single best predictor of whether the install produces
anything.

Then you click **Approve**. They go live instantly and get an email with their
QR and print files.

If something is wrong, you click **Needs info** and it goes back to them with a
note.

### The rest of your admin

| What | When you touch it |
|---|---|
| **Bulk import** | Prospecting — import 50 clinics from Google Maps, get 50 branded preview pages, walk in with one already built for them |
| **Outlet list** | See every business, their state, scans, conversion |
| **Pending sends** | Pre-written WhatsApp messages with tap-to-send links, for high-value moments |
| **Manual overrides** | Fix a wrong Place ID, extend a trial, unlock an account, update an email |
| **Weekly numbers** | The one report that matters — conversion per outlet |

### What you should watch every week

1. **Scan → completed flow conversion.** Under 5% and the product does not work.
2. **Outlets with zero scans after 7 days.** Means the QR never got handed out —
   a distribution failure, not a product one. Call them.
3. **The approval queue.** Do not let it sit. Someone who paid and is waiting is
   the most fragile customer you have.

---

# 2. Business owner perspective (the clinic)

## How they find and buy

1. They land on our website — from your visit, a referral, or search
2. They read what it does, see the pricing, see the compliance page
3. They click **Get started**, fill in a short form:
   - Business name, type of business
   - Their name, phone, email
   - **They search for their business on a map and pick it** — this is the most
     important field on the form
4. They pay — ₹499/month or ₹4,499/year, UPI, card, or netbanking
5. They see: *"Payment received. We are verifying your business details — usually
   within a few hours. We will email you the moment your QR is ready."*

## What happens while they wait

You review and approve. Usually within hours.

They get an email:

> Your QR code is ready.
> Here is your QR, your receipt footer, and your handout cards.
> Print the receipt footer or hand out the cards. Your dashboard is here.

## Getting into their dashboard

**No password. No username. No account number.**

They type their **email address**, get a 6-digit code in their inbox, and they
are in. The email also has a one-tap login link, which is faster on a phone.
They stay logged in for 30 days.

Why no password: they will open this once a week at most. Nobody remembers a
password for that. Everyone can receive an email.

## What they see in their dashboard

| Section | What it tells them |
|---|---|
| **Overview** | 143 people scanned. 28 finished. That is 19.6%. Your rating went from 4.3 to 4.5, reviews from 47 to 58. |
| **Funnel** | Where people drop off, step by step |
| **Tags** | What patients actually praise — "friendly staff" 52 times, "on time" 41 |
| **Private feedback** | Complaints that came to them instead of going public. They can mark them resolved. |
| **Print assets** | Download the QR and print files again |
| **Billing** | Plan, next charge, cancel |

They will check it weekly at first, then monthly. That is normal and fine —
the weekly email digest does the real work of reminding them it is worth paying
for.

## What happens if they stop paying

There are **two different situations**, and they work differently on purpose.

### The trial runs in three stages

**Days 1–15 — everything open.** Unlimited scans, full dashboard.

**Then 10 review credits.** The dashboard locks but **the QR keeps collecting**
for 10 more completed reviews. They see:

> *"42 scans and 6 new reviews waiting. 7 review credits left."*

Two pressures at once — results they cannot see, and a countdown. This is the
conversion moment, and it only works because the QR is still running.

**Credits gone — collection stops.** They get told plainly:

> *"Your review QR has stopped working. The printed codes in your customers'
> hands are no longer collecting reviews."*

That is true, not a scare tactic. A business that printed 5,000 receipt footers
has dead assets in circulation until they pay. One payment fixes it — same code,
no reprinting.

### After they cancel or stop paying — collection stops

Payment fails, the 7-day grace runs out, or they cancel. Now:

- The QR still **resolves** — it shows their business name and a short message.
  No broken link, no error, nothing embarrassing in a patient's hand.
- But it **collects nothing**. No stars, no tags, no Google handoff.

**Why this changed:** otherwise a clinic pays for two months, cancels, and keeps
collecting reviews forever — checking results manually on their own Google
profile and never paying again. The service would have no leverage at all.

**The moment they pay again, everything resumes** — same QR, same printed
receipts, no reprinting. Usually within a minute.

---

# 3. Patient perspective (the person scanning)

**They have no account. They never log in. We never contact them. We never
learn who they are.**

## What they experience

1. They pay at the clinic and get a receipt with a QR on it
2. At home, curious, they scan it with their phone camera
3. A page opens with the clinic's name and logo:
   *"How was your visit to Smile Dental Care?"*
4. **They tap stars** — 1 to 5
5. **They tap tags** — "clean clinic", "painless treatment", "on time".
   As many or as few as they like.
6. **They see a well-written review based on what they tapped**, with a line
   above it saying so:

   > *We've written this from what you selected. Edit anything — it's your
   > review.*
   >
   > "Had a great experience at Smile Dental Care. The clinic was spotless and
   > the treatment was completely painless. They ran on time too."

   It includes the business name and reads naturally — that helps the review
   show up in search. Everything in it comes from tags they actually tapped.
   They can edit it, rewrite it, or delete it entirely.
7. They tap **Copy**. A message says: *"Copied. Next you will see Google —
   paste it in the review box there."*
8. They land on Google, paste, pick their stars again, submit.

Total time: under 90 seconds.

## The honest part

**Step 8 is where most people give up**, and we cannot fix it. Google does not
let anyone pre-fill a review — no tool can, and any that claims to is doing
something they should not.

So we do not hide the paste step. We tell them it is coming. Surprising someone
with unexpected work is how you lose them; telling them in advance is how you
keep some of them.

## If they had a bad experience

At **1–3 stars** the screen leads with the private option:

> **Sorry that didn't go well.**
> Tell Smile Dental Care directly — the owner sees this today.
>
> `[ What went wrong? ]`
> **[ Send to the owner ]** ← big, primary
>
> — or —
>
> **[ Post publicly on Google ]** ← also a full-size button, right there

**Both buttons are real and equally reachable.** One tap either way, both on the
same screen, neither hidden or scrolled away.

**We expect most upset patients to choose the private route** — not because the
other one is hard to find, but because most people who had a bad experience want
to be *heard*, not to punish. Offering a direct line to the owner with a
same-day promise is genuinely the more appealing option.

And if they send private feedback, **the Google button is still there
afterwards.** We never take it away.

> **Why we don't just hide the Google link:** that's review gating. It's against
> Google's rules, they enforce it, and the penalty — reviews stripped, profile
> suspended, dropping out of local search — lands on the *clinic*, not on us.
> The honest version works nearly as well and can't blow up in a customer's
> face.

---

# 4. Our website (marketing + self-serve)

## The pages

| Page | What it does |
|---|---|
| **Home** | What it is, the live interactive demo, how it works, pricing preview |
| **How it works** | The three steps — honestly including the paste step |
| **Compliance** | Why we do not filter reviews. Our five rules. **This is a selling page.** |
| **Pricing** | ₹499/month, ₹4,499/year, what happens after the trial |
| **Sign up** | The form + payment |
| **Login** | Email + code |
| Privacy / Terms / Refunds | Required, especially refunds for the payment gateway |

## The homepage demo

The centrepiece is **a working phone on the page**. The visitor taps the stars,
picks tags, and watches the review write itself from their choices.

It is not a video or a screenshot — it is the real product. It proves the one
thing people doubt: that the review is genuinely built from the customer's own
input and not pre-written.

## Why the compliance page sells

Most competitors filter — happy customers get the Google link, unhappy ones get
diverted. It works until Google notices, and then the *clinic* takes the
penalty, not the vendor.

We say plainly: we do not do that, here is why, here are our five rules. For a
cautious buyer — which a doctor usually is — that is the most reassuring page on
the site.

## Sign-up and payment

```
Website → Sign up form → Pay (Razorpay) → "Verifying, usually a few hours"
                                                      ↓
                                          Your approval queue
                                                      ↓
                                    Approved → email with QR → they log in
```

**Payment is fully self-serve.** Razorpay handles UPI AutoPay for monthly and a
one-time payment for annual. Money reaches you without you touching anything.

**Approval is not self-serve, deliberately.** It is the only thing standing
between a typo and a clinic's patients reviewing the wrong business.

### Why the gate is worth the delay

Two failure modes it prevents:

| Without the gate | Consequence |
|---|---|
| Wrong Google business selected | Their patients write glowing reviews for a stranger's clinic. Unrecoverable, and it is our fault. |
| Owner hands customers a business tablet to review on | Direct observation — the one placement still ruled out. Counter standees are fine; a staff-held device is not. |

A few hours' delay is a small price. And the waiting message sets the
expectation, so it reads as diligence rather than as a broken checkout.

### Existing customers pay too

When a trial ends, the dashboard locks and shows *"42 scans and 6 new reviews
waiting."* They pay on the site and unlock instantly — **no approval needed,
they are already verified.** You are not involved at all.

---

# 5. Technology, in plain terms

| Part | What we use | Why |
|---|---|---|
| **Backend** | **FastAPI (Python)** | Your call. Handles all logic, data, payments. |
| Database | PostgreSQL | Stores businesses, scans, feedback |
| Frontend | Next.js (React) | The website, the patient flow, the dashboard |
| Payments | Razorpay | UPI AutoPay, cards, netbanking |
| Email | Transactional provider | Login codes, alerts, weekly digests |
| Google data | Places API | Finds their business, tracks review count weekly |
| Hosting | Managed platform | No servers to look after |

**Three separate things, one backend:**

```
        ┌──────────────────────────────┐
        │   FastAPI backend + Postgres │
        └──────────────────────────────┘
           ▲            ▲            ▲
           │            │            │
   Patient flow    Owner dash    Website + Admin
   (phone, no      (email +      (public pages,
    login)          code)         your queue)
```

**No WhatsApp Business API and no SMS in v1.** Both need multi-week approvals and
cost money. Email does everything for free, and you tap out the occasional
WhatsApp manually. Both can be swapped in later without rewriting anything.

---

# 6. The full journey, end to end

```
   YOU                    OWNER                   PATIENT
    │                       │                        │
    │  (optional) walk in    │                        │
    │  with a demo built ───►│                        │
    │                       │                        │
    │                  visits website                 │
    │                  signs up, pays                 │
    │                       │                        │
    │◄── appears in your ────┘                        │
    │    approval queue                               │
    │                                                 │
    │  check Google match                             │
    │  call re: receipts                              │
    │  APPROVE ──────────► gets QR + print files      │
    │                       │                        │
    │                  prints on receipts             │
    │                       │                        │
    │                       └──── hands to ─────────►│
    │                                                 │
    │                                            scans QR
    │                                            taps stars
    │                                            taps tags
    │                                            edits review
    │                                            copies
    │                                                 │
    │                                            ► GOOGLE ◄
    │                                            pastes, submits
    │                                                 │
    │                  sees numbers ◄─────────────────┘
    │                  in dashboard
    │                       │
    │◄── watches weekly ────┘
    │    conversion
```

---

# 7. What each person can and cannot do

| | You | Owner | Patient |
|---|---|---|---|
| Create a business | ✅ | ✅ (self-serve, pending approval) | ❌ |
| Approve a business | ✅ | ❌ | ❌ |
| Change the Google link | ✅ | ❌ | ❌ |
| Change the tags | ✅ | ❌ (v2) | ❌ |
| See scan numbers | ✅ all | ✅ own only | ❌ |
| Read private feedback | ✅ all | ✅ own only | ❌ (writes it) |
| Pay | ❌ | ✅ | ❌ |
| Log in | ✅ | ✅ | ❌ never |
| Be contacted by us | — | ✅ email | ❌ **never** |

---

# 8. The five rules, in plain language

These protect the *clinic's* Google profile, not ours. They are not negotiable.

1. **Everything in the draft comes from what the patient tapped** — plus factual
   things like the business name. We write it well, and we tell them we wrote
   it.
2. **They can always edit it.** It is their review, under their name.
3. **Everyone can post to Google** — one star or five. At low ratings we put the
   private option first, but the Google button is always right there, same
   screen, one tap.
4. **Printed material, and nobody watches them do it.** Receipts, cards, or a
   counter standee are all fine. A tablet handed over by staff is not — the
   patient uses their own phone, on their own time.
5. **No rewards for reviews.** No discounts, no free cleanings, nothing. Ever.

An owner will eventually ask you to send only the happy ones to Google. **The
answer is no**, and the reason is that it puts *their* profile at risk — review
stripping, profile suspension, dropping out of local search. That conversation
wins deals; it is not an obstacle.

**If the worry is negative reviews**, the compliant answer works better anyway:
put the private feedback box front and centre for unhappy patients, then
actually resolve the complaint. Most people who are upset want to be heard, not
to punish. The Google link stays visible — it just is not the only thing on the
screen.

---

# 9. What the whole thing is really testing

> **Do patients actually scan these codes, and do they follow through once they
> hit the paste step?**

Nobody knows. That is why the first ten businesses matter more than any feature.

**The number: scan → completed flow.** Under 5% and the product does not work,
and no dashboard feature will save it. Over 20% and it is worth pushing hard.

Decide with ten real installs and thirty days of data. Write the number down
before you get attached to the idea.
