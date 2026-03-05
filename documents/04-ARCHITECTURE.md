# Technical Architecture

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

---

## 1. Guiding constraints

Architecture follows from four hard constraints:

1. **The customer flow must never *break*.** A printed QR in a patient's hand is
   an asset we do not control, so the URL must always resolve — never a dead
   link, never an error, regardless of dashboard outages.
   **But collection stops when payment stops** (FR-53, revised 2026-09-18): in
   `suspended`/`deactivated` the URL serves a neutral screen and collects
   nothing. Resolution reads outlet state to decide *what to serve*; it never
   fails outright.
2. **The customer flow must be fast on 3G.** < 2s FCP, < 150KB. This rules out
   a heavy client framework on the public path.
3. **Instrumentation is the product's purpose.** Every step transition must be
   recorded reliably. Event loss corrupts the only metric that matters.
4. **Avoid third-party lead times rather than scheduling around them.** WhatsApp
   BSP was removed from v1 entirely (OD-9); email covers all owner notification.
   Razorpay KYC is the one remaining calendar dependency.

---

## 2. Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Backend** | **FastAPI (Python 3.12+)** | **Fixed requirement.** All business logic, data access, integrations. |
| ORM / migrations | SQLAlchemy 2.x + Alembic | Standard FastAPI pairing |
| Validation | Pydantic v2 | Built into FastAPI; request/response schemas |
| Background jobs | FastAPI `BackgroundTasks` + APScheduler | Weekly polls, digests. No queue at v1 volume. |
| **Frontend** | **Next.js (App Router, TypeScript)** | Marketing site, patient flow, owner dashboard, admin |
| Database | Postgres (managed) | Relational fit; event volume is fine at this scale |
| QR generation | `qrcode` + `pillow` (Python) | SVG + PNG, server-side |
| PDF / print assets | `weasyprint` or `reportlab` | Receipt footers, handout cards |
| Email | Transactional provider | Login OTP, alerts, digests |
| Payments | **`PaymentProvider` interface** → Razorpay (v1) | Provider selected by outlet country; Stripe added later without touching billing logic ([17-GLOBAL-READY.md](17-GLOBAL-READY.md) §2.5) |
| External data | Google Places API | Place lookup, weekly rating/review poll |

**Two deployables:** a FastAPI service and a Next.js app. The frontend calls the
backend over HTTP; no server-side rendering of authenticated data through
Next.js API routes — Next.js owns presentation, FastAPI owns all logic.

> **Revised 2026-09-18.** The original draft specified a Next.js monolith.
> Backend is now FastAPI per an explicit stack requirement. The split is
> straightforward, with one consequence worth noting: the short-URL path
> (§4) must stay fast across a network hop, so outlet config is cached at the
> frontend edge rather than hitting FastAPI on every scan.

**Deliberately not used in v1:** message queue, Redis, microservices, separate
analytics product, CDN beyond hosting default. At ten outlets these are cost
and complexity without benefit. Revisit at ~200 outlets.

---

## 3. Surfaces

### 3.1 Public customer flow — `/r/{slug}`

The only surface that must never fail.

- Served by **Next.js**, server-rendered. Landing screen renders meaningfully
  with **no JavaScript** (NFR-5).
- Outlet config is **cached at the Next.js edge**, so a scan does not require a
  round trip to FastAPI. This is what keeps the two-service split off the
  critical latency path.
- No authentication, no cookies beyond an anonymous session ID.
- No dependency on billing state — resolution is independent of subscription
  (C-6).
- Minimal client JS: state machine for step transitions, event beacons,
  clipboard write.
- Assets: system-adjacent fonts subset aggressively; logo served optimised;
  no icon library.

**Failure posture:** if the events endpoint is down, the flow still completes.
Events buffer client-side and retry; losing an event is preferable to blocking
a customer. If the database is down, the landing screen still serves from
cached outlet config.

#### 3.1a Hub and modules *(added 2026-09-30)*

`/r/{slug}` routes by `hub_mode` and enabled modules; the review flow moves to
`/r/{slug}/review`, with `/connect`, `/menu`, `/rewards` as siblings
([22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §1). Same edge-cached config, same
budget, same suspension rules.

**Module boundary is an architectural rule, not a convention.** Code is organised
as independent packages — `review/`, `connect/`, `menu/`, `loyalty/`, `services/`
— each with its own routers and tables, sharing only the outlet config and the
`events` writer. `loyalty/` and `review/` **may not import each other or read each
other's tables** (CR-6, enforced in CI). Loyalty's router package is also
separate in FastAPI (`/api/loyalty`, `/api/staff`).

**Growth Services** (§7 there) live in `services/` and the admin console;
third-party credentials (Instagram, WhatsApp) are encrypted at rest and scoped
minimally. Automation workers run as separate scheduled jobs so a failing
integration never touches the customer flow (C-6).

### 3.2 Owner dashboard — `/app`

- Client-rendered behind OTP auth.
- Mobile-first layout.
- Read-heavy. Aggregations computed on request at v1 volume; pre-aggregate
  later if needed.
- Lockable — the paywall state is a server-enforced gate, not a UI condition.

### 3.3 Admin console — `/admin`

- Founder-only, separate strong auth, not linked publicly, not indexed.
- Outlet creation, Place ID lookup, tag configuration, QR generation, state
  override.

---

## 4. Short URL resolution

The most latency-sensitive path in the system (< 200ms p95).

```
GET /r/{slug}
  │
  ├─► Edge lookup: slug → outlet config (cached)
  │     miss ─► Postgres, then populate cache
  │
  ├─► Emit `scan` event (fire-and-forget, never blocks render)
  │
  └─► Render landing (outlet name, logo, prompt)
```

**Caching:** outlet config is cached at the edge with a short TTL. Config
changes are infrequent; a brief staleness window is acceptable. Cache is
invalidated on admin edit **and on any state transition affecting collection**.

**The cached config carries a `collecting: true|false` flag** derived from state
(§4.1a of [05-DATA-MODEL.md](05-DATA-MODEL.md)):

- `collecting: true` → serve the full flow
- `collecting: false` → serve the neutral screen

Resolution never fails, never errors, never 404s on a valid slug. It decides
*what* to serve, not *whether* to serve. Reactivation flips the flag and
invalidates the cache, so a printed QR resumes working within the TTL window
(target: under a minute).

---

## 5. Event pipeline

```
Client ──beacon──► POST /api/events ──► Postgres (events table)
  │                                          │
  └─ buffered, retried on failure            └─► dashboard aggregation (on read)
```

- Events are append-only. Never updated, never deleted before retention expiry.
- `sendBeacon` where available so the `handoff` event survives the redirect.
- Server stamps the timestamp; client timestamps are not trusted.
- Batched where multiple transitions occur quickly.

**The `handoff` event is the last observable moment.** Everything after the
redirect happens on Google's UI and is unobservable (C-1). This is a known,
documented blind spot — see [07-METRICS.md](07-METRICS.md).

---

## 6. Draft assembly

Compliance-critical. See CR-1, CR-2.

```
selected tag IDs
      │
      ▼
 lookup tag phrases (per-outlet config)
      │
      ▼
 join with neutral connective grammar
      │
      ▼
 editable text area  ◄── customer may modify or clear entirely
```

**Rules enforced in code, with CR-referencing comments:**

- No stored review text. No table, no seed file, no fixture, no fallback string
  containing review-like content (CR-1).
- All substance maps 1:1 to selected tags. Connectives only otherwise.
- Zero tags → empty or near-empty output. This is the CR-1 test (SRS-17.2).
- Output renders editable by default, never read-only (CR-2).

**Assembly runs client-side** (OD-8). Tag phrases ship inside the outlet config
fetched at scan time (`GET /api/flow/{slug}/config`), so the draft screen needs
no network round-trip — it is the worst drop-off point and a spinner there costs
conversion.

Niche-specificity comes from *which outlet's config was fetched*; SEO quality is
authored into the phrase bank, not computed at runtime
([16-DRAFT-AND-ROUTING.md](16-DRAFT-AND-ROUTING.md) §1.4).

**Tradeoff accepted:** the phrase bank is visible in the browser. Low-value IP,
worth less than the conversion lost to a spinner. The vocabulary lives in a
single module so SRS-17.3 can still assert no review library crept in.

---

## 7. Trial metering

```
copy_tapped event
      │
      ▼
 dedup check (device fingerprint + phone, 24h window)
      │
      ├─ duplicate ─► record event, do not increment
      │
      └─ unique ────► increment completed_flows
                          │
                          ▼
                 day 15 reached? → lock dashboard, 10 credits
                 credits exhausted? → suspend (collection stops)
                          │
                          ├─ no  ─► continue
                          │
                          └─ yes ─► outlet.state = 'locked'
                                    fire WhatsApp (template 3)
                                    dashboard locks
                                    SHORT URL UNAFFECTED
```

The lock is a dashboard-layer gate. The resolution path does not read outlet
state for access control — only for rendering a deactivation message in the
explicit `deactivated` case (SRS-1.6).

---

## 8. Scheduled jobs

| Job | Frequency | Purpose |
|---|---|---|
| Places poll | Weekly per active outlet | Rating + review count time series (SRS-14) |
| Trial day-15 check | Daily | Day-15 lock trigger (credit exhaustion is event-driven) |
| Weekly digest | Weekly | Owner WhatsApp summary (SRS-13.3) |
| Event retention prune | Monthly | 24-month window (NFR-10) |

Implemented as scheduled functions. No queue infrastructure at v1 volume.

---

## 9. External integrations

### 9.1 WhatsApp Business API

**Start the BSP application on day one of the build.** Approval is 1–3 weeks of
calendar time regardless of engineering progress (C-3) and is the single most
likely cause of launch slip.

- All messages use pre-approved templates (six required, SRS-13.2).
- Delivery failures fall back to email.
- **Until approval lands, email is the primary channel and a click-to-chat link
  is the manual substitute.** The product ships without it.

### 9.2 Razorpay

- UPI AutoPay mandate for monthly; one-time order for annual.
- One-time payment fallback when mandate creation fails (C-4, SRS-12.3).
- **All state changes driven by signature-verified webhooks**, never by client
  redirect (SRS-12.8).
- Published refund policy is a gateway requirement.

### 9.3 Google Places API

- Place ID lookup at onboarding (FR-34).
- Review URL construction and validation before activation (FR-35).
- Weekly rating and review count poll (SRS-14.1).
- **Never used for trial metering** — publication is not attributable (C-2).

---

## 10. Environments

| Environment | Purpose |
|---|---|
| Local | Development. Third parties stubbed. |
| Staging | Pre-production. Razorpay test mode, WhatsApp test number. |
| Production | Live. |

Migrations are versioned and forward-only.

---

## 11. Observability

- Structured request logs with outlet ID where applicable.
- Error tracking on all three surfaces, customer flow errors alerting
  separately and loudly.
- Uptime monitoring on `/r/{slug}` specifically — this is the path that must
  never fail.
- Weekly founder report: funnel conversion across all outlets, the kill metric.

---

## 12. Scaling notes

v1 targets ten outlets. Deliberately over-simple.

Revisit when:

| Trigger | Change |
|---|---|
| ~200 outlets | Pre-aggregate dashboard metrics; add Redis for the slug cache |
| ~50k events/day | Move events to a dedicated store or partitioned tables |
| Multi-outlet accounts | Data model already supports it (see [05-DATA-MODEL.md](05-DATA-MODEL.md)); dashboard needs a rollup layer |
| WhatsApp volume | Queue with retry semantics |

None of these are v1 work. Building them now is the most likely way to miss the
30-day validation window.
