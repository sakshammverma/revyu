# Multi-Tenant Design & Bulk Onboarding

**Product:** Revyu
**Version:** Draft v1
**Date:** 2026-09-18

---

## 1. The requirement

> Adding a new business must be trivially cheap, and adding many at once must be
> possible in a single operation.

This is a founder-velocity requirement, not a customer-facing feature. If
onboarding takes 20 minutes of manual work per outlet, the business caps at
whatever the founder can personally process — and the partner channel
([08-GTM.md](08-GTM.md) §3.4) never becomes viable.

**Target: under 60 seconds per outlet, and 50 outlets in one bulk operation.**

---

## 2. What the current design already supports

The data model is multi-tenant from day one
([05-DATA-MODEL.md](documents/05-DATA-MODEL.md)):

- `accounts` → `outlets` is 1:N. v1 enforces one outlet per account in
  *application logic only* — the schema never assumed otherwise.
- Every tenant-scoped table carries `outlet_id`. No global state, no per-tenant
  tables, no per-tenant schemas.
- Slugs are non-sequential and independent of any identifier.
- Tag sets are per-outlet, seeded from vertical defaults.

**Nothing in the schema needs to change.** What is missing is the tooling layer
above it.

---

## 3. The onboarding bottleneck, measured

Per-outlet manual work in the current admin design (SRS-11):

| Step | Time | Automatable |
|---|---|---|
| Enter business name, vertical, owner phone/email | 60s | ⚠️ Partly — bulk import |
| Find Google Place ID | 90s | ✅ Fully |
| Source and upload logo | 120s | ⚠️ Partly — auto-fetch, manual fallback |
| Validate review URL | 30s | ✅ Fully |
| Review/edit tag set | 60s | ✅ Default and move on |
| Generate QR, download assets | 45s | ✅ Fully |
| Compose print assets | 120s | ✅ Fully |
| **Total** | **~8 min** | → target **< 60s** |

At 8 minutes each, 50 outlets is a full working day. At 60 seconds, it is under
an hour.

---

## 4. Design changes

### 4.1 Bulk import

**`POST /api/admin/outlets/bulk`** — accepts CSV or a JSON array.

Minimum viable row:

```csv
business_name,vertical,owner_phone,owner_email,google_maps_url
Smile Dental Care,dental,+919876543210,dr@smile.in,https://maps.app.goo.gl/xxxx
Bright Smiles,dental,+919812345678,info@bright.in,https://maps.app.goo.gl/yyyy
```

> **`owner_email` is required and must be unique** (OD-16) — it is the dashboard
> login identifier. Rows without one, or with a duplicate, are rejected with
> `EMAIL_REQUIRED` / `EMAIL_DUPLICATE` rather than created.
>
> For **prospecting imports** where the email is not yet known, import with a
> placeholder and leave the outlet in `draft`. Preview works without it;
> activation does not. The real address is captured during the install
> conversation ([08-GTM.md](08-GTM.md) §3.2, gate item 4).

Per row, the system automatically:

1. Creates or matches the `account` by phone
2. Resolves `google_maps_url` → Place ID → validated review URL
3. Attempts logo auto-fetch (§4.3)
4. Seeds the tag set from `vertical`
5. Generates slug + QR
6. Renders print assets
7. Leaves the outlet in `draft` — **never auto-activates** (§4.6)

**Response** reports per-row status, so a partial failure never blocks the batch:

```json
{
  "created": 47,
  "failed": 3,
  "rows": [
    { "row": 1, "outlet_id": "uuid", "slug": "k7m2xq", "status": "draft" },
    { "row": 12, "status": "error", "error": "PLACE_ID_NOT_FOUND" }
  ]
}
```

### 4.2 Place ID resolution from a Maps link

The single biggest time saver. Owners can paste a Google Maps share link from
their phone in seconds; nobody knows what a Place ID is.

Accept and resolve: `maps.app.goo.gl` short links, full `google.com/maps` URLs,
a raw Place ID, or a plain business-name + city search.

Ambiguous matches are queued for manual resolution rather than guessed —
attaching a clinic to the wrong Place ID sends every review to a stranger's
business.

### 4.3 Logo auto-fetch

Attempt in order: Google Business Profile photo → website favicon/`og:image` →
**generated wordmark fallback** (business name set in the display face on paper
base, per the design system).

**The fallback must be good enough to ship.** An outlet blocked on a logo is an
outlet that does not launch. Manual replacement stays available in admin.

### 4.4 Vertical templates

Adding a new vertical must be a config change, not a code change.

```
verticals/
  dental.json      { label, tags[], copy_variants, print_defaults }
  physio.json
  gym.json
  salon.json
  coaching.json
```

Each defines its tag seed set ([05-DATA-MODEL.md](documents/05-DATA-MODEL.md) §7),
customer-flow copy variants, and print asset defaults.

**Test:** adding a sixth vertical should require one JSON file and zero
deployments of changed application logic.

### 4.5 Asset generation pipeline

On activation, generate and store: QR (SVG + PNG ≥1024px), receipt footer strip,
handout card PDF, and a combined print-ready bundle.

Generated asynchronously, in parallel across a batch. The admin console shows
per-outlet asset status.

**One bulk action: "download all print assets for this batch"** as a single zip,
organised per outlet — so a batch of 50 becomes one file to send to a printer.

### 4.6 Bulk activation is deliberately separate

Bulk import creates outlets in `draft`. **Activation stays per-outlet and
manual.**

This is intentional friction. Activation starts the 15-day trial clock
(SRS-9.4) and implies the qualification gate has been met — receipt/card
commitment, named staff member, printing confirmed
([08-GTM.md](08-GTM.md) §3.2).

> Bulk-activating 50 outlets would produce 50 trial clocks running against
> businesses that have not agreed to anything, and would poison the kill metric
> with dead installs (R-8). **Prepare in bulk; activate one at a time.**

### 4.7 Pre-built demo mode

Directly serves the GTM motion ([08-GTM.md](08-GTM.md) §3.1) — walking in with
the prospect's page already built.

A `draft` outlet is **fully previewable** at `/r/{slug}` before activation:

- The complete customer flow works, with real branding and real tag set
- No trial clock, no metering, no events counted toward the funnel
- A subtle non-production marker so a demo is never mistaken for a live install

This means bulk import doubles as **bulk prospecting**: import 50 clinics from a
Maps scrape, and walk in to any of them with a finished product.

---

## 5. Partner / agency multi-tenancy

Deferred to v2 ([08-GTM.md](08-GTM.md) §3.4, OD-7), but the design should not
preclude it.

Requires one new level above `accounts`:

```
partners ──1:N── accounts ──1:N── outlets
```

Plus: partner-scoped admin with their own bulk import, white-label branding per
partner, partner-level billing (wholesale), and a rollup dashboard.

**Not built in v1.** Noted so that adding `partner_id` later is an additive
migration, not a restructure.

---

## 6. Revised admin requirements

Extends [02-SRS.md](documents/02-SRS.md) §3.5.

| ID | Requirement | Priority |
|---|---|---|
| SRS-11.10 | Bulk import outlets via CSV or JSON, per-row status reporting | Must |
| SRS-11.11 | Resolve Place ID from a Maps share link, full URL, raw ID, or name+city | Must |
| SRS-11.12 | Ambiguous Place matches queued for manual resolution, never guessed | Must |
| SRS-11.13 | Logo auto-fetch with generated wordmark fallback | Must |
| SRS-11.14 | Vertical templates as config files, no code change to add one | Must |
| SRS-11.15 | Async parallel asset generation across a batch | Must |
| SRS-11.16 | Bulk download of print assets as one organised zip | Should |
| SRS-11.17 | `draft` outlets fully previewable with a non-production marker | Must |
| SRS-11.18 | Activation remains per-outlet and manual | Must |
| SRS-11.19 | Batch view: filter by state, vertical, import batch | Should |
| SRS-11.20 | Bulk import rejects rows with missing or duplicate `owner_email` (OD-16) | Must |
| SRS-11.21 | Activation blocked unless a real (non-placeholder) `owner_email` is present | Must |

---

## 7. Build impact

Against [10-ROADMAP.md](documents/10-ROADMAP.md):

| Item | Where | Added effort |
|---|---|---|
| Vertical templates as config | Week 1 | ~0 — cheaper than hardcoding |
| Maps link → Place ID resolution | Week 2 | +3h |
| Logo auto-fetch + fallback | Week 2 | +4h |
| Bulk import endpoint + CSV parse | Week 2 | +4h |
| Async asset pipeline | Week 2 | +3h |
| Bulk zip download | Week 2 | +2h |
| Draft preview mode | Week 2 | +1h |
| **Total** | | **~2 days** |

**Worth it.** Two days buys back roughly seven minutes per outlet forever, and
makes the pre-built demo motion — the core of the GTM plan — practical at scale
rather than a per-prospect chore.

**Not worth doing now:** partner tenancy (§5), an admin onboarding UI beyond CSV
upload. Those serve scale that does not exist yet.

> Self-serve signup **is** in v1 (SRS-18/19) — but it is a separate path from
> bulk import. Bulk import serves prospecting (you, importing 50 clinics to walk
> into); self-serve serves inbound (a referral signing up at 11pm). Both feed the
> same approval queue.

---

## 8. Acceptance test

> Import a CSV of 50 dental clinics scraped from Google Maps. Within 10 minutes,
> every one has a working preview URL with correct branding, a validated review
> link, a seeded tag set, and downloadable print assets — with zero per-outlet
> manual work except resolving genuinely ambiguous Place matches.
>
> Then walk into any one of them and activate it in under 60 seconds.
