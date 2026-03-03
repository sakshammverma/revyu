# Documentation Index

Product documentation for **Revyu** — a QR-code based review collection
tool for single-outlet small businesses.

**The platform serves any vertical in any country**
([17-GLOBAL-READY.md](17-GLOBAL-READY.md)). **v1 launches deliberately narrow:**
dental clinics, India, English. Docs describing the launch are dental-first on
purpose; docs describing the system are not.

Status: **v1 built, hardening in progress.** The specs describe intent; see [23-STATUS-AND-PLAN.md](23-STATUS-AND-PLAN.md) for what is actually built and what is pending.

---

## Reading order

| # | Document | Read if you are | Status |
|---|---|---|---|
| 01 | [Product Requirements (PRD)](01-PRD.md) | anyone — start here | Draft v1 |
| 02 | [Software Requirements Spec (SRS)](02-SRS.md) | building it | Draft v1 |
| 03 | [Compliance Policy](03-COMPLIANCE.md) | **everyone, no exceptions** | Draft v1 |
| 04 | [Technical Architecture](04-ARCHITECTURE.md) | building it | Draft v1 |
| 05 | [Data Model](05-DATA-MODEL.md) | building it | Draft v1 |
| 06 | [API Specification](06-API-SPEC.md) | building it | Draft v1 |
| 07 | [Analytics & Metrics](07-METRICS.md) | building or selling it | Draft v1 |
| 08 | [Go-to-Market Plan](08-GTM.md) | selling it | Draft v1 |
| 09 | [Design Brief](09-DESIGN-BRIEF.md) | designing it | Draft v1 |
| 10 | [Build Roadmap](10-ROADMAP.md) | planning the build | Draft v1 |
| 11 | [Open Decisions](11-OPEN-DECISIONS.md) | **the owner — unblock these** | Live |
| 12 | [Risk Register](12-RISKS.md) | anyone | Draft v1 |
| 13 | [Multi-Tenant & Bulk Onboarding](13-MULTI-TENANT.md) | building it | Draft v1 |
| 14 | [Owner Access & Dashboard](14-OWNER-ACCESS.md) | building it | Draft v1 |
| 15 | **[How It All Works — Plain Language](15-HOW-IT-WORKS.md)** | **anyone — best starting point** | Draft v1 |
| 16 | [Draft Generation & Low-Rating Routing](16-DRAFT-AND-ROUTING.md) | building or designing it | Draft v1 |
| 17 | [Global & Multi-Vertical Readiness](17-GLOBAL-READY.md) | building it | Draft v1 |
| 18 | **[How We Build Together](18-BUILD-TOGETHER.md)** | **read before we start coding** | Live |
| 19 | **[Build Journal](19-JOURNAL.md)** | **log here as things happen** | Live |
| 20 | [Content Playbook](20-CONTENT.md) | making content | Draft v1 |
| 21 | [Conversion Design](21-CONVERSION-DESIGN.md) | designing the marketing site | Draft v1 |
| 23 | **[Build Status, Plan & Growth Ideas](23-STATUS-AND-PLAN.md)** | **anyone — what is built, pending, next** | **Live** (2026-10-01) |
| 22 | **[Hub, Modules & Growth Services](22-HUB-AND-MODULES.md)** | building anything after the scan: menu, connects, loyalty, services | **Proposed** (2026-09-30) |

---

> **Looking for a specific fact?** → **[INDEX.md](INDEX.md)** — symbol table and
> question map. Jump to the line; don't read whole docs.
>
> **New here and want the whole picture?** → [15-HOW-IT-WORKS.md](15-HOW-IT-WORKS.md)
> — plain language, all four perspectives.

## The three things that matter most

If you read nothing else:

1. **[Compliance](03-COMPLIANCE.md)** — six non-negotiable rules (CR-1 – CR-6). Breaking them
   risks the *customer's* Google Business Profile, not just ours. There is no
   version of this product that quietly relaxes them.

2. **The kill metric** — scan → completed flow conversion.
   Under 5%, the product does not work. Over 20%, push hard.
   Defined in [Metrics](07-METRICS.md).

3. **[Open Decisions](11-OPEN-DECISIONS.md)** — placeholders that block design
   and build. Product name, accent colour, font licence, pricing tier.

---

## Conventions used in these documents

- `Revyu` — placeholder. Single find-and-replace once named.
- `#4338CA` — placeholder for the accent colour. See
  [Open Decisions](11-OPEN-DECISIONS.md).
- **Business** / **Owner** — the paying customer (e.g. a dental clinic).
- **Customer** / **Patron** — the business's customer, who scans the QR.
  Never a user of ours in the account sense.
- **Completed flow** — stars + tags + copy tapped. The unit of trial metering.
- Requirement IDs: `FR-n` functional, `NFR-n` non-functional, `CR-n` compliance.
  These IDs are stable — reference them in code comments and tickets.

---

## Document status

All documents are **Draft v1**, written pre-build from the founding plan.
They describe intent, not shipped behaviour. Expect revision once the first
ten installs produce real conversion data.

Last updated: 2026-09-30 — added the hub, loyalty and Growth Services
([22](22-HUB-AND-MODULES.md)), CR-6, and OD-24 – OD-29 (proposed).
