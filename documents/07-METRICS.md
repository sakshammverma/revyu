# Analytics & Metrics

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

---

## 1. The question this product exists to answer

> **Do customers actually scan these codes, and do they follow through once
> they hit the paste step?**

Everything measured here serves that question. Features that do not help answer
it are deferred.

---

## 2. The kill metric
<!-- ANCHOR: kill-metric -->


### Scan → completed flow conversion

```
completed flows (distinct sessions with copy_tapped)
────────────────────────────────────────────────────
             scans (distinct scan events)
```

| Band | Reading | Action |
|---|---|---|
| **< 5%** | The product does not work | **Stop.** No feature saves this. |
| 5–10% | Weak, possibly fixable | Iterate on flow UX before scaling distribution |
| 10–20% | Working | Fix the worst drop-off step, then scale |
| **> 20%** | Strong | Push hard on distribution |

> **Revised 2026-09-30 — hub mode.** The formula above is for outlets in
> `direct` mode (QR → review flow), which is **the validation cohort** (OD-26).
> When an outlet runs the hub, people who scan for the menu or rewards inflate the
> denominator, so the same outlet would read lower with no change in the product.
> Hub outlets are measured as `module_selected(review) → copy_tapped`, with
> `scan → module_selected(review)` reported separately as **review take-rate**.
> **Never mix the two modes in one kill-metric reading**, and do not set a kill
> band on take-rate until there is data. See
> [22-HUB-AND-MODULES.md](22-HUB-AND-MODULES.md) §8.

**Kill criteria — write this down before emotional investment sets in:**

> **10 qualified installs. 30 days. Measured on scan → completed flow.**
> Under 5%, the product does not work and no amount of dashboard feature work
> will change that.

The biggest risk to this business is not Google, and not competitors. It is
spending six months building dashboard features for three clinics that never
put the QR on a receipt.

---

## 3. The instrumentation boundary

**This is the most important limitation in the entire product, and it must be
stated wherever the funnel is displayed.**

```
  scan ─► flow_start ─► rating ─► tags ─► draft ─► copy ─► handoff
                                                              │
  ══════════════ MEASURABLE ═══════════════════════════════════╡
                                                              │
                                              ▼ Google's UI ▼ │
                                        sign in → paste → submit
  ══════════════ UNMEASURABLE ════════════════════════════════
```

After `handoff`, the customer is on Google's interface. They must be signed in,
find the review box, paste, re-select their stars, and submit. That is four or
more actions on a UI we neither control nor observe.

**Honest estimate: 40–60% loss at this stage.** This is an estimate, not a
measurement, and it cannot become one (C-2).

### The consequence

The kill metric **ends at the copy tap** — which is *not* the thing the owner
is buying. The owner is buying published reviews.

This gap is why a second metric is mandatory.

---

## 4. The secondary metric

### Google review count delta per outlet

Polled weekly via Places API, stored in `place_snapshots`.

```
current review_count − baseline review_count (captured at activation)
```

**Properties:**
- Lagging — reviews take days to appear
- Noisy — organic reviews are indistinguishable from ours
- Not attributable per-customer, ever (C-2)
- **The number the owner will actually judge us on**

We must see it before they do. A clinic whose review count has not moved in
three weeks is a churn risk regardless of what the funnel says.

**Usage rules:**
- Never used for trial metering (SRS-9.5, FR-44)
- Never presented as attributable to us
- Never guaranteed in sales material ([03-COMPLIANCE.md](03-COMPLIANCE.md) §
  Sales constraints)

---

## 5. Funnel instrumentation

Every step emits an event (FR-15, SRS-8.1). Full taxonomy in
[05-DATA-MODEL.md](05-DATA-MODEL.md) §5.

| Step | Event | What drop-off here means |
|---|---|---|
| Scan | `scan` | — (denominator) |
| Landing | `flow_start` | QR placement or landing screen fails to interest |
| Rating | `rating_selected` | Too much friction, or unclear ask |
| Tags | `tags_selected` | Tag set wrong for the vertical, or too many chips |
| Draft | `draft_viewed` | — |
| Copy | `copy_tapped` | **The paste expectation lands badly. Expect the worst drop here.** |
| Handoff | `handoff` | Near-zero loss expected; a gap means a technical fault |

*(2026-09-30)* Hub-mode outlets add `hub_viewed` and `module_selected` between
`scan` and `flow_start`; `flow_start` then fires on entering the review flow. The
loyalty module records **nothing** in this funnel — its activity lives in
`loyalty_ledger` and is never joined to it (CR-6.3).

**Expected worst step: draft → copy.** This is where the customer realises
manual work is required. The interstitial copy (FR-11) is the primary lever and
should be the first thing A/B tested once volume permits.

---

## 6. Supporting metrics

### 6.1 Product

| Metric | Definition | v1 target |
|---|---|---|
| Rating distribution | Share by star value | Monitor — a heavy 5-star skew may indicate QR handed out selectively, which is a CR-4 risk |
| Tag selection rate | Avg tags per completed flow | 2–4 |
| Zero-tag drafts | Share of drafts with no tags | < 10% |
| Draft edit rate | Share editing before copy | Monitor — high is healthy (CR-2 working) |
| Private feedback rate | Feedback ÷ completed flows | 5–15% |
| Private-first rate (1–3★) | Share choosing private over Google | Expected high — the design intent |
| **Google rate at 1–3★** | Share still posting publicly | **Should be non-trivial.** Near-zero means the hierarchy drifted too far and needs rebalancing (OD-19). |
| Clipboard fallback rate | Share hitting the manual path | < 5% |
| Time to complete | Median scan → copy | < 90s |

### 6.2 Business

| Metric | v1 target |
|---|---|
| Qualified installs, first 30 days | 10 |
| Approval queue age, p95 | **< 12h** — a paid customer waiting is the most fragile state (R-23) |
| Signup → approved conversion | > 90% — lower means the form is unclear |
| Zero-scan rate, self-serve vs founder-led | Tracked separately (R-24) |
| Time from install to first scan | < 72h |
| Outlets with zero scans after 7 days | **< 20%** — this measures install quality, not product quality |
| Trial → paid conversion | > 30% |
| Owner weekly dashboard open rate | > 40% |
| Monthly churn | < 5% |

> **"Outlets with zero scans after 7 days" is the install-quality metric.**
> A dead install is a distribution failure, not a product failure, and must be
> diagnosed separately or it will contaminate the kill metric. See
> [08-GTM.md](08-GTM.md) on qualified installs.

### 6.3 Technical

| Metric | Target |
|---|---|
| `/r/{slug}` p95 latency | < 200ms (NFR-3) |
| Customer flow FCP, 3G | < 2.0s (NFR-1) |
| Customer flow availability | 99.9% (NFR-4) |
| Event delivery success | > 99% |
| WhatsApp delivery success | > 95% |

---

## 7. Segmentation

Every product metric is sliced by:

- **Outlet** — the unit that matters; averages across outlets hide dead installs
- **Source** — `self_serve` vs `admin` / `bulk_import`. **Report these
  separately, never blended.** A founder-qualified install and a self-serve
  walk-up are different populations; one number describing both describes
  neither (R-24).
- **Vertical** — dental at launch, others on expansion
- **QR placement** — receipt vs. handout card vs. standee (owner-declared at
  install, not detectable). This directly informs CR-4 guidance and print asset
  priority.
- **Device** — Android vs. iOS. Clipboard behaviour differs materially.
- **Day of week / hour** — feeds the future tag-insight feature

> **Never report a single blended conversion rate across all outlets as the
> headline.** One clinic handing out 200 cards and nine doing nothing produces
> a number that describes neither. Report per-outlet, then the median.

---

## 8. Reporting cadence

| Report | Frequency | Audience | Contents |
|---|---|---|---|
| Founder funnel review | Weekly | Founder | Per-outlet conversion, the kill metric, worst drop-off step |
| Owner WhatsApp digest | Weekly | Owner | Scans, completed flows, top tag, rating change (FR-28, SRS-13.3) |
| Install health check | Weekly | Founder | Outlets with zero scans in 7 days → call them |
| Places poll | Weekly | System | Review count and rating time series |
| Kill-metric decision | Day 30 | Founder | Go / iterate / stop |

---

## 9. What we deliberately do not measure

| Not measured | Why |
|---|---|
| Whether a specific review was published | Not attributable through any API (C-2) |
| Which customer wrote which review | Would require identity linkage we should not have (SRS-16.1) |
| Anything after `handoff` | Occurs on Google's UI (C-1) |
| Customer behaviour across outlets | No cross-outlet tracking, by design |
| Sentiment of private feedback | Not needed in v1; the owner reads them |

Any dashboard element implying we can measure published reviews per customer is
a bug and a compliance risk. The funnel API returns an explicit
`note` field for this reason ([06-API-SPEC.md](06-API-SPEC.md) §3).

---

## 10. Instrumentation checklist for build

- [ ] Every event in the taxonomy fires, verified manually on a real device
- [ ] `handoff` survives the redirect (`sendBeacon`)
- [ ] Events are server-stamped, client time discarded
- [ ] Event failure never blocks the customer flow
- [ ] Dedup logic verified: same device twice in 24h counts once
- [ ] Funnel query returns correct distinct-session counts
- [ ] Baseline rating and review count captured at activation (FR-39)
- [ ] Weekly Places poll running and storing snapshots
- [ ] Per-outlet segmentation works before the first install goes live
- [ ] Zero-scan alert configured at 7 days post-activation

**Instrument before the first install, not after.** An install that runs for a
week without instrumentation is a week of the 30-day validation window
permanently lost.
