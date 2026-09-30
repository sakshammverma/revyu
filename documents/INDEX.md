# INDEX — Read This First

**Purpose:** find the exact line you need without reading whole documents.

24 docs, ~9,300 lines. Reading them all costs far more than any single question
is worth. **This file is the entry point. Load it, then jump.**

---

## 0. The rule

```
1. Look up the symbol below           → get file + line
2. Read ±20 lines around it           → usually enough
3. Only widen if genuinely needed
```

**Never** read a full document to answer a specific question.
**Never** read more than 2 docs for one question — if you need a third, the
question is really several questions.

For anything not indexed here, **grep before reading**:

```bash
grep -rn "SRS-9.4" documents/          # exact ID
grep -rn "trial threshold" documents/  # concept
```

---

## 1. Symbol → location

Every identifier in the docs is stable. Look it up, jump straight there.

| Symbol | Meaning | Defined in |
|---|---|---|
| `FR-n` | Functional requirement | [01-PRD.md](01-PRD.md) §6 |
| `NFR-n` | Non-functional requirement | [01-PRD.md](01-PRD.md) §7 |
| `CR-n` | **Compliance rule — inviolable** (CR-1…CR-6) | [03-COMPLIANCE.md](03-COMPLIANCE.md) |
| `SG-n` | Growth-service guardrail | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §7.3 |
| `S1…S5` | Growth Services (website, video, content, Instagram, WhatsApp) | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §7 |
| `SRS-n.n` | Implementation spec | [02-SRS.md](02-SRS.md) §3 |
| `C-n` | Hard constraint | [02-SRS.md](02-SRS.md) §2.4 (line 102) |
| `OD-n` | Open/resolved decision | [11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md) |
| `R-n` | Risk | [12-RISKS.md](12-RISKS.md) |

### FR ranges

| Range | File |
|---|---|
| FR-1 … FR-55 | [01-PRD.md](01-PRD.md) §6 |
| FR-56 … FR-68 | [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) — drafts, low-rating routing |
| FR-69 … FR-75 | [17-GLOBAL-READY.md](17-GLOBAL-READY.md) §7 — global readiness |
| FR-76 … FR-85 | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §1 — hub |
| FR-86 … FR-91 | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §3 — social connects |
| FR-92 … FR-98 | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §4 — menu / services |
| FR-99 … FR-112 | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5 — loyalty |
| FR-113 … FR-120 | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §7 — Growth Services |

> ⚠️ FR-56–75 also appear summarised in [01-PRD.md](01-PRD.md). **The
> topic doc is authoritative**; the PRD copy is a pointer. If they differ, fix
> the PRD.

---

## 2. Question → exact location

Most-asked questions, pre-resolved. **These line numbers are the point of this
file** — jump directly.

### Compliance *(check before any customer-flow change)*

| Question | Location |
|---|---|
| The six rules | [03-COMPLIANCE.md](03-COMPLIANCE.md) §"The six rules" |
| **Can loyalty rewards sit next to the review button?** | Only behind CR-6 — [03-COMPLIANCE.md](03-COMPLIANCE.md); [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §5.2; residual risk R-27 |
| Can rewards be earned for following / reviewing? | **No** — CR-5, CR-6.1, CR-6.5, FR-91 |
| Can we hide the Google link at low ratings? | **No** — CR-3; [16-DRAFT-AND-ROUTING.md:2.3](16-DRAFT-AND-ROUTING.md) |
| Where can the QR go? | CR-4 — printed material + counter; no business-owned tablet |
| Can drafts be SEO-optimised? | **Yes, disclosed** — [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) Part 1 |
| Compliance tests | `ANCHOR: compliance-tests` (~02-SRS.md:520) |
| Low-rating tests (7) | [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) §2.7 |

### Customer flow

| Question | Location |
|---|---|
| Screen order + per-screen spec | [02-SRS.md](02-SRS.md) §3.2 (line 159) |
| Draft assembly rules | [04-ARCHITECTURE.md](04-ARCHITECTURE.md) §6 |
| Draft generation detail | [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) §1.4 |
| Low-rating screen layout | `ANCHOR: low-rating-screen` (~16-DRAFT-AND-ROUTING.md:163) |
| Event taxonomy | [05-DATA-MODEL.md](05-DATA-MODEL.md) §5 (line 398) |
| Performance budget | [02-SRS.md](02-SRS.md) §4 (line 476) |

### Hub, modules & services *(2026-09-30)*

| Question | Location |
|---|---|
| What happens after the scan? (hub, routing, `direct` vs `menu`) | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §1 |
| The four modules | §2 review · §3 connect · §4 menu/services · §5 loyalty |
| Two meanings of "services" | [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §0 |
| Loyalty firewall, identity, staff PIN flow | §5.2 – §5.4 |
| New tables | §6 |
| Growth Services: website, video, content, Instagram, WhatsApp | §7 |
| Service guardrails | §7.3 (SG-1…SG-8) |
| How the hub affects the kill metric | §8; [07-METRICS.md](07-METRICS.md) §2 |
| Which release ships what | §9; [10-ROADMAP.md](10-ROADMAP.md) v1.5 / §2.1b / §2.6 |
| Proposed decisions | [11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md) OD-24 – OD-29 |
| Hub/loyalty/services risks | [12-RISKS.md](12-RISKS.md) R-27 – R-32 |

### Data & API

| Question | Location |
|---|---|
| All tables | [05-DATA-MODEL.md](05-DATA-MODEL.md) §3 (line 42) |
| `outlets` columns | [05-DATA-MODEL.md:72](05-DATA-MODEL.md) |
| `accounts` columns | [05-DATA-MODEL.md:44](05-DATA-MODEL.md) |
| `plans` (pricing) | [05-DATA-MODEL.md:261](05-DATA-MODEL.md) |
| **Outlet state machine** | `ANCHOR: outlet-states` (~05-DATA-MODEL.md:311) |
| **When collection stops** | `ANCHOR: collection-stops` (~05-DATA-MODEL.md:356) |
| Derived metrics / SQL | [05-DATA-MODEL.md:422](05-DATA-MODEL.md) |
| Tag seed sets | [05-DATA-MODEL.md:438](05-DATA-MODEL.md) |
| Public flow endpoints | [06-API-SPEC.md:29](06-API-SPEC.md) |
| Owner dashboard endpoints | [06-API-SPEC.md:194](06-API-SPEC.md) |
| Signup endpoints | [06-API-SPEC.md:340](06-API-SPEC.md) |
| Approval queue endpoints | [06-API-SPEC.md:411](06-API-SPEC.md) |
| Webhooks | [06-API-SPEC.md](06-API-SPEC.md) §5 |
| Error codes | [06-API-SPEC.md](06-API-SPEC.md) §6 |
| Rate limits | [06-API-SPEC.md](06-API-SPEC.md) §7 |

### Auth & billing

| Question | Location |
|---|---|
| How owners log in | [14-OWNER-ACCESS.md](14-OWNER-ACCESS.md) §1 — email + OTP |
| Login flow detail | [02-SRS.md](02-SRS.md) §3.4 (line 281) |
| Trial rules (15 days + 10 credits) | `ANCHOR: trial-metering` (~02-SRS.md:254) |
| Billing states | [02-SRS.md](02-SRS.md) §3.6 (line 404) |
| Payment provider interface | [17-GLOBAL-READY.md](17-GLOBAL-READY.md) §2.5 |

### Build & scope

| Question | Location |
|---|---|
| Stack | [04-ARCHITECTURE.md](04-ARCHITECTURE.md) §2 — FastAPI + Next.js |
| Build order | [10-ROADMAP.md](10-ROADMAP.md) §2 |
| What's v1 vs. later | [01-PRD.md](01-PRD.md) §10 |
| What's global vs. launch | [17-GLOBAL-READY.md](17-GLOBAL-READY.md) §1 |
| Multi-tenant / bulk import | [13-MULTI-TENANT.md](13-MULTI-TENANT.md) |
| **Kill metric** | `ANCHOR: kill-metric` — scan → completed flow, <5% = stop |
| Instrumentation boundary | [07-METRICS.md](07-METRICS.md) §3 |

### Design

| Question | Location |
|---|---|
| Visual system | `D:\design\design-system.md` — **not in this folder** |
| Screen list | [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §2 |
| Required divergences | [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §1.1 |
| Print assets | [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §5 |
| **Homepage structure / psychology** | [21-CONVERSION-DESIGN.md](21-CONVERSION-DESIGN.md) §3 |
| **Which colour for what** | [21-CONVERSION-DESIGN.md](21-CONVERSION-DESIGN.md) §1.1 |
| Where urgency is allowed | [21-CONVERSION-DESIGN.md](21-CONVERSION-DESIGN.md) §5 |
| Blocked on assets | [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) §6.1 |

### Journey & content

| Question | Location |
|---|---|
| What happened / what was decided when | [19-JOURNAL.md](19-JOURNAL.md) |
| Weekly metrics history | [19-JOURNAL.md](19-JOURNAL.md) § Metrics snapshot |
| Milestone checklist | [19-JOURNAL.md](19-JOURNAL.md) § Milestones |
| 40 content ideas | [20-CONTENT.md](20-CONTENT.md) §4 |
| **40 full Hinglish scripts** | [20-CONTENT.md](20-CONTENT.md) §11 |
| Production / filming notes | [20-CONTENT.md](20-CONTENT.md) §12 |
| What not to post | [20-CONTENT.md](20-CONTENT.md) §8 |
| First 3 videos to make | [20-CONTENT.md](20-CONTENT.md) §10 |

---

## 3. Facts you don't need to open a file for

Cached here because they're asked constantly. **If these conflict with a doc,
the doc wins and this table is stale — fix it.**

| Fact | Value |
|---|---|
| Backend | FastAPI (Python) |
| Frontend | Next.js (TypeScript) |
| Database | Postgres |
| Payments | Razorpay (v1), behind `PaymentProvider` |
| Owner login | Email + OTP, no password |
| Trial | 15 days, then 10 review credits, then collection stops |
| Completed flow | stars + tags + **copy tapped** |
| Product name | Revyu |
| Brand colour | Indigo #4338CA (chrome, secondary) |
| Primary CTA colour | Amber #D97706 |
| Display font | Archivo + Geist Mono |
| Price | ₹499/mo, ₹4,499/yr — flat, all verticals (in `plans`, not code) |
| Grace period | 7 days |
| Kill metric | scan → completed flow; **<5% = stop**. Measured in `direct` mode only; hub outlets use `review chosen → completed` (OD-26) |
| Post-scan modules | Review · Connect · Menu/Services · Rewards (hub only when ≥2 enabled). v1 reserves schema; UI v1.5; loyalty v2 |
| Loyalty | Visit-earned only, firewalled from reviews (CR-6), owner-funded. **Proposed, not confirmed** (OD-25 – OD-29) |
| Growth Services | Website, landing video, content pipeline, Instagram, WhatsApp automation — separate priced SKUs, concierge first |
| Launch scope | **All verticals**, India, English |
| Build scope | Any vertical, any country |
| Notifications | Email (v1); no WhatsApp API |
| Last measurable event | `handoff` — nothing after |

---

## 4. Doc map

Sorted by how often you'll need them.

| Doc | Lines | Open it when |
|---|---|---|
| [15-HOW-IT-WORKS.md](15-HOW-IT-WORKS.md) | 432 | You need the whole picture, plainly |
| [02-SRS.md](02-SRS.md) | 554 | Implementing a behaviour |
| [06-API-SPEC.md](06-API-SPEC.md) | 564 | Writing or calling an endpoint |
| [05-DATA-MODEL.md](05-DATA-MODEL.md) | 466 | Touching the schema |
| [03-COMPLIANCE.md](03-COMPLIANCE.md) | 284 | **Before any customer-flow change** |
| [12-RISKS.md](12-RISKS.md) | 480 | Assessing a tradeoff |
| [11-OPEN-DECISIONS.md](11-OPEN-DECISIONS.md) | 359 | Something seems undecided |
| [01-PRD.md](01-PRD.md) | 345 | Checking scope or an FR |
| [16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) | 316 | Drafts or low-rating screens |
| [04-ARCHITECTURE.md](04-ARCHITECTURE.md) | 292 | Structural questions |
| [09-DESIGN-BRIEF.md](09-DESIGN-BRIEF.md) | 290 | Building UI |
| [10-ROADMAP.md](10-ROADMAP.md) | 279 | What to build next |
| [08-GTM.md](08-GTM.md) | 264 | Selling, pricing, positioning |
| [13-MULTI-TENANT.md](13-MULTI-TENANT.md) | 263 | Onboarding at scale |
| [17-GLOBAL-READY.md](17-GLOBAL-READY.md) | 262 | Country/currency/locale |
| [14-OWNER-ACCESS.md](14-OWNER-ACCESS.md) | 249 | Auth or dashboard access |
| [18-BUILD-TOGETHER.md](18-BUILD-TOGETHER.md) | 243 | How we work together |
| [07-METRICS.md](07-METRICS.md) | 239 | Measurement |
| [19-JOURNAL.md](19-JOURNAL.md) | live | **Log here as things happen** |
| [20-CONTENT.md](20-CONTENT.md) | 1426 | Content ideas + 40 full scripts |
| [21-CONVERSION-DESIGN.md](21-CONVERSION-DESIGN.md) | 250 | Designing the marketing site |
| [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) | ~430 | Anything after the scan: hub, menu, connects, loyalty, Growth Services |
| [24-HUB-BUILD-PLAN.md](24-HUB-BUILD-PLAN.md) | ~330 | Building the hub, loyalty, Growth Services: tables, endpoints, screens, phases |
| [00-README.md](00-README.md) | 81 | Doc conventions |

---

## 5. Authority order

When two docs disagree:

```
1. 03-COMPLIANCE.md     CR-1…CR-6 override everything, always
2. 11-OPEN-DECISIONS.md Resolved decisions override older prose
3. Topic doc            13–17 and 22 own their subject
4. 02-SRS.md            Implementation detail
5. 01-PRD.md            Intent and scope
6. 15-HOW-IT-WORKS.md   Explanatory — never authoritative
```

Docs revised in place carry a *(Revised YYYY-MM-DD)* marker. **Later date
wins.**

---

## 6. For subagents

Put this in the prompt when delegating:

> Read `documents/INDEX.md` first. Use its symbol table and question map to jump
> to specific lines. Grep for IDs (`FR-42`, `CR-3`, `SRS-9.4`) rather than
> reading files. Read ±20 lines around a hit. Do not read more than 2 documents.
> If you need a third, say what's missing instead of reading further.

**Typical cost:** index (~200 lines) + 2 targeted reads (~40 lines) ≈ **240
lines** versus 6,200 for a full scan — roughly 25× cheaper.

---

## 7. Drift-proof anchors

Line numbers drift; these don't. High-traffic sections carry an HTML comment
anchor — grep the token, get the exact line, regardless of edits.

```bash
grep -rn "ANCHOR: collection-stops" documents/
```

| Anchor | Finds |
|---|---|
| `ANCHOR: outlet-states` | Outlet state machine |
| `ANCHOR: collection-stops` | When the QR stops collecting |
| `ANCHOR: trial-metering` | Trial threshold rules |
| `ANCHOR: compliance-tests` | CI compliance enforcement |
| `ANCHOR: low-rating-screen` | 1–3 star screen layout |
| `ANCHOR: kill-metric` | The go/stop number |

**Prefer anchors over the line numbers in §2** when a section has one.

---

## 8. Keeping this accurate

Line numbers in §2 are hints, not guarantees. If a jump lands wrong, grep the
heading text or use an anchor.

**When adding a doc or major section:** add it to §2 and §4, and add an anchor
if it'll be referenced often. An unindexed doc gets found by full scan — exactly
what this file exists to prevent.
