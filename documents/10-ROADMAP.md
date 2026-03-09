# Build Roadmap

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

---

## 1. Reality check on the timeline

The plan targets **2–3 weeks solo for v1**. That is achievable — provided
WhatsApp Business API is kept off the critical path.

### 1.1 WhatsApp API is not required for v1

WhatsApp Business API onboarding takes 1–3 weeks of calendar time independent of
engineering — BSP verification, template approval, and display-name review all
sit outside our control (C-3).

**At ten outlets, we do not need it.**

The entire v1 notification surface is **owner-facing only** — six message types
to at most ten people ([02-SRS.md](02-SRS.md) SRS-13.2). That volume does not
justify a platform dependency with a multi-week approval gate.

### 1.2 The free alternatives, ranked

| Approach | Cost | Automated | Verdict |
|---|---|---|---|
| **Email** (transactional provider, free tier) | ₹0 at this volume | ✅ Yes | **Primary channel for v1** |
| **Click-to-chat link** (`wa.me`) | ₹0 | Semi — generates the message, you tap send | **Secondary, for high-value moments** |
| **Personal/Business WhatsApp app**, sent by you | ₹0 | ❌ Manual | Fine at ten outlets |
| Unofficial automation libraries | ₹0 | ✅ Yes | ❌ **Do not use — ban risk** |
| WhatsApp Business API via BSP | Per-message | ✅ Yes | Defer to v2 |

> ⚠️ **Unofficial WhatsApp automation libraries are explicitly rejected.** They
> violate WhatsApp's terms and risk a ban on the number — which at that point is
> your primary owner-communication channel and possibly your business number.
> The saving is not worth it.

### 1.3 The v1 design: one notification adapter, three backends

Build a single notification interface with pluggable backends:

```
notify(account, template, data)
      │
      ├─► EmailBackend        ← v1 default, fully automated
      ├─► ClickToChatBackend  ← generates a wa.me link in the admin console
      └─► WhatsAppApiBackend  ← v2, swapped in when/if BSP approves
```

**Practical v1 behaviour:**

| Template | v1 delivery |
|---|---|
| Outlet activated — QR ready | Email + you send WhatsApp manually at install |
| First scan received | Email |
| **Trial threshold — pay now** | Email + **click-to-chat link you tap** ← highest-value moment, worth the manual step |
| Private feedback received | Email |
| Weekly digest | Email |
| Payment failed | Email + manual WhatsApp |

Admin console surfaces a **"pending sends"** queue: pre-composed messages with
`wa.me` links. You tap through them in a couple of minutes a day. At ten
outlets that is a trivial amount of work and it removes a multi-week dependency
entirely.

### 1.4 When to revisit

Move to WhatsApp Business API when **either** holds:

- More than ~30 active outlets (manual sending stops being trivial), **or**
- Data shows owners ignore email and respond to WhatsApp — which is plausible
  and is exactly what v1 will tell you

Start the BSP application **then**, not now. It is an adapter swap.

> **OTP delivery follows the same reasoning — and is now decided.** Owner login
> is **email + email OTP** (SRS-10.1, OD-16). SMS would cost per message and
> require DLT registration, the same category of avoidable lead time as BSP.
> Email is free and needs no approval. SMS becomes an adapter swap post-revenue.

**Realistic assessment: 3 weeks of build, 3–4 weeks to ten live installs** —
roughly a week faster than the BSP-dependent plan, with no meaningful capability
lost at this scale.

---

## 2. v1 build sequence

Ordered by dependency and by risk-retirement — the riskiest unknowns first.

### Week 0 — before any code

- [ ] **Verify the Google review URL works on a real phone, signed out** ← do this first, today
- [ ] Razorpay account, KYC started (the one remaining real lead time)
- [ ] Register domain, set up hosting and Postgres
- [ ] Transactional email provider account (free tier)
- [ ] **Configure SPF/DKIM/DMARC on the sending domain** ← login breaks without it (OD-16)
- [ ] Resolve blocking design decisions ([11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md) OD-1 to OD-4)

> ~~Start WhatsApp BSP application~~ — **removed.** Not required for v1 (§1).
> Email plus click-to-chat covers ten outlets at zero cost and zero wait.

> That last item retires the biggest technical unknown in the product. Do it
> before anything else. If the handoff does not work the way the plan assumes,
> everything downstream changes.

### Week 1 — the customer flow and instrumentation

The only surface that must be perfect. Build it first, alone.

- [ ] **FastAPI project skeleton**, SQLAlchemy + Alembic, Pydantic schemas
- [ ] Schema and migrations ([05-DATA-MODEL.md](05-DATA-MODEL.md)) —
      **global-ready columns from the first migration** ([17-GLOBAL-READY.md](17-GLOBAL-READY.md) §3)
- [ ] `plans` table seeded; no prices in code (FR-71)
- [ ] Short URL resolution, edge-cached, < 200ms
- [ ] Customer flow: landing → rating → tags → draft → copy → handoff
- [ ] Draft assembly with CR-1 enforcement and its test
- [ ] Private feedback, available at all ratings
- [ ] **Full event pipeline, verified on a real device**
- [ ] Compliance tests SRS-17.1 through SRS-17.5 in CI
- [ ] Performance budget met: < 150KB, < 2.0s FCP on 3G

**Week 1 exit criteria:** a real phone can scan a printed QR, complete the flow,
land on Google, and every step appears in the events table.

### Week 2 — admin, dashboard, print

- [ ] Admin: outlet creation, Place ID lookup, review URL validation
- [ ] **Public signup form + Places search-and-pick** (SRS-18)
- [ ] **Admin approval queue** with both verification checks (SRS-19)
- [ ] Tag seed sets per vertical, editable
- [ ] QR generation, SVG + PNG
- [ ] **Print assets, and test a real thermal receipt print** ← do not defer
- [ ] Owner auth: **email + OTP, with magic link** (OD-16)
- [ ] Verify OTP email lands in inbox, not spam, on Gmail and a common Indian host
- [ ] Dashboard: overview, funnel with boundary display, tags, feedback inbox
- [ ] Paywall lock state, designed as a conversion screen
- [ ] **Notification adapter** with email backend (§1.3)
- [ ] All six templates sending over email
- [ ] Admin "pending sends" queue with `wa.me` click-to-chat links

**Week 2 exit criteria:** an outlet can be created, activated, and its owner can
log in and see real funnel data.

### Week 3 — billing, notifications, hardening

- [ ] Razorpay: monthly mandate, annual one-time
- [ ] **Payment at signup, before approval** (SRS-18.6)
- [ ] **Refund path for rejected signups** (SRS-19.7)
- [ ] One-time fallback when mandate creation fails (C-4)
- [ ] Webhook handling, signature-verified, idempotent
- [ ] Trial metering: 15 days → 10 credits → suspend, dedup verified
- [ ] Lock transition, verified to leave the short URL untouched
- [ ] Trial-threshold message verified end to end (email + click-to-chat)
- [ ] Weekly Places poll
- [ ] Weekly digest job
- [ ] Zero-scan alert at 7 days
- [ ] Marketing site + compliance page
- [ ] Privacy, terms, refund policy published

**Week 3 exit criteria:** the nine acceptance criteria in
[02-SRS.md](02-SRS.md) §5 all pass.

### Schema and routing reservations *(added 2026-09-30)*

Cheap now, expensive to retrofit after QRs are printed. Add to the week 1–2
work; **no UI**:

- [ ] `outlets.hub_mode` (`direct` | `menu`), default `direct`
- [ ] `outlet_modules` table (module registry per outlet)
- [ ] Review flow served at `/r/{slug}/review`; `/r/{slug}` routes by `hub_mode`
- [ ] Module-aware `scan` → no behaviour change in `direct` mode

Detail: [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §9.

### Week 4+ — installs

Per [08-GTM.md](08-GTM.md) §8. Build pre-built demo pages, walk in, activate
ten qualified installs, review the funnel daily.

**Day 30 after the tenth install: the kill-metric decision.**

### v1.5 — hub shell *(added 2026-09-30; during the validation window)*

Hard cap: **~1 week**. Ships behind `hub_mode`; **validation-cohort outlets stay
on `direct`** so the kill metric is not confounded (OD-26).

- [ ] Hub screen and module tiles (FR-76 – FR-85)
- [ ] **Social connects** (FR-86 – FR-91)
- [ ] **Menu / Services** manual entry and customer view (FR-92 – FR-98)
- [ ] **Growth Services Phase A:** catalogue, "Request this" form, admin pipeline
      (FR-113 – FR-116) — a form and a table, tests demand before anything heavy
- [ ] Events: `hub_viewed`, `module_selected`, `link_clicked`, `menu_viewed`
- [ ] CR-3 tests re-run against hub → review

If this starts to crowd out install work, stop. Installs are the validation.

---

## 3. v2 — the retention answer

**Do not start v2 before the kill-metric decision.** If scan → completed flow is
under 5%, none of this matters.

Priority order. The first item is not optional.

### 2.1 Review response drafting — *the churn answer*

**The problem it solves:** review collection has a natural ceiling. Once a
clinic has 200 reviews and a 4.7 rating, the marginal review matters less and
the owner asks what they are paying for. Without an answer, churn arrives around
month 8 regardless of how well v1 works.

**What it is:** pull incoming reviews via Places API, draft replies in the
owner's voice, one-tap copy.

Why it fits: Google rewards businesses that respond; it reuses the same paste
mechanic already built; and it gives the product a reason to exist after the
review count plateaus.

> Compliance note: drafting a *merchant's reply* is materially different from
> drafting a *customer's review*. CR-1 does not apply — the merchant is the
> legitimate author of their own response. The reply must still be editable
> before posting.

### 2.1b Loyalty badges and rewards *(added 2026-09-30)*

Owner-defined badges earned by **visits**, unlocking owner-funded discounts,
freebies or free services. Staff confirm each visit with a PIN; rewards are
single-use codes. Second in v2, after review response drafting.

**Preconditions, all three:** CR-6 firewall built and CI-enforced; policy/legal
review of the hub layout (R-27); OD-25 (customer identity) and OD-28 (suspended
wallets) decided. Spec: [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5.

Retention value: a customer base earning towards rewards is a reason for the
*owner* to keep the QR live, independent of review count — it answers the same
plateau problem as §2.1.

### 2.2 Staff attribution

Multiple QRs per outlet — one per dentist, chair, or stylist. The owner gets a
leaderboard showing which staff member generates satisfied customers.

Stickiness disguised as a feature. Salons and gyms in particular will not cancel
a tool their staff are measured by.

The data model already supports this; it needs QR management and dashboard
segmentation.

### 2.3 Negative-feedback SLA loop

Today private complaints go to WhatsApp and die. Turn them into tickets: open →
resolved, with timestamps and an ageing view.

This converts the product from a marketing gimmick into an operations tool.
Owners who close the loop keep paying.

Partially seeded in v1 — `private_feedback.resolved` already exists (FR-26).

### 2.4 Weekly digest improvements

Already in v1 (FR-28), but worth investment. Unprompted proof of value in the
channel the owner actually reads is the cheapest retention mechanism available.

### 2.5 WhatsApp Business API

Swap `WhatsAppApiBackend` into the notification adapter (§1.3). Trigger to
start the BSP application: more than ~30 active outlets, or evidence that
owners ignore email.

Adapter swap, not a rewrite — that is the whole point of building §1.3 first.

*(2026-09-30)* The same BSP relationship would also serve Growth Service S5
(WhatsApp automation) — one application, two uses. Still **not** started until a
trigger above fires or S5 reaches Phase C.

### 2.6 Growth Services — Phases B and C *(added 2026-09-30)*

What Revyu sells to owners: **website building, landing video, content
management pipeline, Instagram automation, WhatsApp automation**
([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §7).

| Phase | Scope | Gate to start |
|---|---|---|
| **A** (v1.5) | Catalogue, request form, admin pipeline; founder fulfils manually | None — it is the demand test |
| **B** (v2.5) | Content pipeline tool (idea → approved → scheduled), website generator fed by outlet data | Phase A shows paying requests |
| **C** (v3) | Instagram (Meta Graph API) and WhatsApp (BSP) automation as managed integrations | PMF; Meta app review and BSP application started at this gate |

Guardrails SG-1 – SG-8 apply from Phase A. The landing video may reuse the
HyperFrames video toolchain already available in the workspace — an
implementation option, not a commitment.

---

## 4. v3 and beyond — after product-market fit

| Feature | Rationale |
|---|---|
| **Tag → operations insight** | *"Wait time complaints spike Tuesdays 6–8pm."* The tags are structured data almost nobody acts on. This is the wedge from marketing tool into business intelligence, and it justifies a materially higher price. |
| **Practo / JustDial / Zomato** | Practo specifically for dental and physio — arguably higher intent than Google for healthcare in India |
| **Multi-outlet rollup** | The path to ₹5,000+/month accounts. Schema is already multi-outlet ready. |
| Fully unattended activation | Self-serve signup + payment shipped in v1 behind an approval gate (SRS-18/19). Removing the gate entirely only makes sense if Place-match accuracy proves high enough that R-20 stops being a real risk — unlikely soon. |
| Multilingual customer flow | Hindi and regional languages. Likely a real conversion lever; needs data. |
| Benchmark reports | *"You are 4.6, category median 4.2."* Good marketing content, weak product. |
| Missed-call / SMS fallback | For customers who will not scan |

---

## 5. Explicitly not planned

| Never | Why |
|---|---|
| Sentiment gating | Prohibited (CR-3). Not a roadmap item at any price. |
| Incentives tied to reviews | Prohibited (CR-5). *Loyalty earned by visits is planned (§2.1b) and is a different thing — kept apart by CR-6.* |
| Follow-to-earn, like-gating | Prohibited (CR-6.5, FR-91) |
| Unofficial Instagram/WhatsApp automation | Prohibited (SG-1) — ban risk lands on the client's account |
| Pre-written review library | Prohibited (CR-1) |
| Counter kiosk / tablet mode | Prohibited (CR-4) |
| Review publication verification | Not technically possible (C-2) |
| Native mobile apps | The customer flow must work with zero install, permanently |
| Customer accounts | No reason to exist |

---

## 6. Sequencing principles

1. **Riskiest unknown first.** Verify the Google handoff on a real phone before
   writing a dashboard.
2. **The customer flow is built alone, first.** It is the only surface that must
   be perfect.
3. **Instrument before the first install.** A week of installs without
   instrumentation is a week of the validation window permanently lost.
4. **Avoid third-party lead times rather than scheduling around them.** WhatsApp
   BSP was removed from v1 entirely (§1) because email plus click-to-chat covers
   ten outlets at zero cost. Razorpay KYC is the one remaining unavoidable
   calendar dependency — start it in week 0.
5. **No v2 work before the kill-metric decision.** Building retention features
   for a product with 3% conversion is the most expensive possible mistake.
