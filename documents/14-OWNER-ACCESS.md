# Owner Access & Dashboard

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

Expands [02-SRS.md](02-SRS.md) §3.4 and answers: how does a business owner get
into their dashboard?

---

## 1. The short answer

**Email + OTP. No password. No account ID. No username.**

The owner enters their email address and receives a 6-digit code.

> **Decided 2026-09-18 (OD-16): OTP is delivered by email, not SMS.** Email is
> free within generous provider limits; SMS costs per message and requires DLT
> registration in India — a multi-day approval process. Phone OTP is a post-revenue
> upgrade, not a v1 requirement.

### 1.1 The phone number is still the account identity

This is the part worth being precise about, because it is easy to conflate.

| Concern | Value | Changed? |
|---|---|---|
| Account key | `accounts.owner_phone` (unique, E.164) | ❌ No |
| WhatsApp / click-to-chat destination | phone | ❌ No |
| How the founder identifies the owner | phone | ❌ No |
| **Login identifier** | **`owner_email`** | ✅ **Was phone** |
| **OTP delivery channel** | **email** | ✅ **Was SMS** |

Consequence: **`accounts.owner_email` becomes required and unique.** It was
optional. An account cannot exist without it, because without it the owner
cannot log in.

---

## 2. Why not passwords

| Consideration | Password | Email + OTP |
|---|---|---|
| Owner remembers it weekly? | ❌ No — they open this monthly at best | ✅ Nothing to remember |
| Support burden | Reset requests, a churn risk | None |
| Credential worth stealing | Yes, stored | No |
| Onboarding friction | Must set, confirm, store | Zero |
| Cost | Free | Free |

A password reset flow is, functionally, email OTP with extra steps and a stored
credential. Skipping straight to OTP removes the credential database, the reset
flow, and the credential-stuffing surface.

---

## 3. First access

There is no signup. The founder creates the outlet in admin
([13-MULTI-TENANT.md](13-MULTI-TENANT.md)) from details captured during the
install conversation.

```
Install conversation
      │  founder captures owner phone AND email (both now required)
      ▼
Admin creates outlet, activates it
      │
      ▼
"Outlet activated" email (+ manual WhatsApp, §1.3 of 10-ROADMAP)
      │  contains: QR, print assets, and the dashboard link
      ▼
Owner opens [domain]/app → enters email → OTP in inbox → in
```

**No welcome email with credentials. No "set your password" link.** The owner
types the email address they already gave you.

> ⚠️ **Sales impact:** capturing a working email is now mandatory at install,
> not nice-to-have. An owner without one cannot access their dashboard. Verify
> it on the spot — send the activation email before leaving the clinic.
> Added to the qualification checklist ([08-GTM.md](08-GTM.md) §3.2).

---

## 4. Login flow

1. Owner opens `/app`. Single field: **email address**.
2. `POST /api/app/auth/otp/request` → always returns `202`, whether or not the
   address exists (no account enumeration).
3. 6-digit OTP **sent by email**, 10-minute expiry, max 5 attempts (SRS-10.2).
4. `POST /api/app/auth/otp/verify` → session cookie, **30 days** (SRS-10.3).
5. Subsequent visits within 30 days skip OTP entirely.

**In practice:** a weekly dashboard visitor re-authenticates roughly monthly.

### 4.1 Making email OTP feel fast

Email OTP has one genuine weakness against SMS: **latency and inbox friction**.
Mitigations that matter more here than they would with SMS:

- **Magic link alongside the code.** The email contains both a 6-digit code and
  a tap-to-login link. On a phone, tapping the link is faster than switching
  apps to copy a code. Same token, same expiry, one tap.
- Subject line carries the code itself — visible from the notification shade
  without opening the email.
- Sender domain authenticated (SPF/DKIM/DMARC) from day one, or codes land in
  spam and the login is effectively broken.
- Delivery within 30 seconds, or the flow feels broken regardless of correctness.

> The magic link is the single highest-value addition here. It converts a
> switch-app-copy-paste sequence into one tap, which is the main thing SMS was
> buying.

### 4.2 Rate limits

| Endpoint | Limit |
|---|---|
| OTP request | 3 per email / 15 min, 10 per IP / hour |
| OTP verify | 5 attempts per issued OTP |

### 4.3 Failure paths

| Situation | Behaviour |
|---|---|
| Email not in system | Same `202`. Generic "if this address is registered, a code is on the way." |
| OTP expired | Request a new one. No penalty. |
| 5 failed attempts | OTP invalidated, must request again |
| **Code in spam** | Most likely failure. Login screen shows a "check spam" hint after ~60s. Authenticated sending domain is the real fix. |
| Owner changed email | **Founder updates it in admin.** No self-serve — see §7. |
| Owner lost email access | Founder verifies out-of-band (phone is on file), updates in admin |

> The spam case is the one to watch. With SMS there is no spam folder; with
> email it is the most common support issue. Domain authentication is not
> optional.

---

## 5. What the owner sees

Single-outlet in v1. Mobile-first — assume a phone, in a clinic, between
patients.

| Screen | Contents |
|---|---|
| **Overview** | Scans, completed flows, conversion rate. Trial progress (`7 review credits left`). Google rating and review count, baseline vs. now. |
| **Funnel** | Per-step drop-off, with the instrumentation boundary shown explicitly ([07-METRICS.md](07-METRICS.md) §3) |
| **Tags** | Frequency with period-over-period change |
| **Feedback** | Private feedback inbox, reverse chronological, resolve action |
| **Assets** | QR and print-asset downloads |
| **Billing** | Plan, status, unlock action |

### 5.1 The locked state

At the trial threshold the dashboard locks (SRS-9.6) — but shows **real
accumulated numbers** behind the paywall:

> *"42 scans and 6 new reviews waiting."*

This is a conversion screen, not an error screen, and should be the most
persuasive page in the product ([09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §2.3).

**The QR keeps working in every state** (C-6). Locking is a dashboard-layer
gate only.

---

## 6. OTP delivery — decided

**Email OTP for v1.** Decided 2026-09-18 (OD-16).

| Channel | Cost | Setup lead time | v1 |
|---|---|---|---|
| **Email** | Free within provider limits | None | ✅ **Chosen** |
| SMS | ~₹0.15–0.25/msg | **DLT registration — multi-day approval** | ❌ Post-revenue |
| WhatsApp | Free via API | BSP approval | ❌ Deferred ([10-ROADMAP.md](10-ROADMAP.md) §1) |

**Rationale:** free within generous limits, zero setup, no DLT paperwork, and
consistent with the notification decision that already removed WhatsApp BSP from
the critical path. The cost at ten outlets is negligible either way — the
deciding factor is **avoided lead time**, not rupees.

### 6.1 Free tier headroom

Transactional email providers typically offer a few thousand free sends monthly.
Realistic v1 usage:

| Source | Volume/month at 10 outlets |
|---|---|
| Login OTPs | 10–40 |
| Weekly digests | ~40 |
| Private feedback alerts | 20–60 |
| Activation, threshold, billing | ~15 |
| **Total** | **~150** |

Comfortably inside any free tier. At 100 outlets it is ~1,500/month — still
likely free, and by then revenue exists.

### 6.2 When to add phone OTP

Add SMS as an **option**, not a replacement, when:

- Owners report email OTP problems (spam, no email on phone), **or**
- Revenue supports the per-message cost and DLT registration, **or**
- WhatsApp API arrives for other reasons — OTP over WhatsApp is then free

**Design for this now:** the OTP channel should be a per-account field defaulting
to `email`. Adding SMS later becomes a config change plus a gateway adapter, not
an auth rewrite — the same pluggable-backend reasoning as notifications
([10-ROADMAP.md](10-ROADMAP.md) §1.3).

---

## 7. What owners deliberately cannot do in v1

| Not available | Why | When |
|---|---|---|
| Sign up themselves | Qualification gate is a human conversation ([08-GTM.md](08-GTM.md) §3.2) | Maybe never |
| Change their own email or phone | Account-takeover vector; trivial to handle manually at this scale | v2 |
| Add users / staff logins | One owner per account. Staff attribution is a v2 feature and does not require logins. | v2 |
| Add a second outlet | Schema supports it; UI does not | v2 |
| Edit their tag set | Founder-controlled — protects draft quality and CR-1 | v2, maybe |
| Delete their account | Manual request. Rare, and worth a conversation. | v2 |

All of these are correct omissions at ten outlets. Each becomes worth building
at a scale that does not exist yet.

---

## 8. Security notes

- Owners access **only** their own outlet's data, enforced server-side from the
  session, never from a client-supplied outlet ID (SRS-15.6).
- Sessions are revocable from admin.
- No password means no password database, no reset-token flow, and no
  credential-stuffing surface.
- Owner PII is limited to name, phone (E.164), and email.

### 8.1 Email-specific considerations

- **Sending domain must be authenticated (SPF/DKIM/DMARC) before the first
  install.** Unauthenticated OTP email lands in spam and the login is
  functionally broken.
- Magic-link tokens are single-use, 10-minute expiry, same lifecycle as the
  numeric code.
- Login email is a security-relevant channel — an owner's compromised inbox is
  an account takeover. Acceptable at this scale and no worse than password
  reset, which has the identical property.
- Email enumeration prevented by the uniform `202` response (§4.3).
