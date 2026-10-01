# 25 — Supabase Migration Plan

**Status:** proposed, 2026-10-02. Nothing here is built yet.
**Goal:** run Revyu with no Python server. Supabase provides Postgres, Auth,
Storage and cron. Next.js on Vercel provides the API and the UI.

---

## 1. What exists today (inventory)

| Area | Size | Where |
|---|---|---|
| HTTP endpoints | 78 across 18 routers | `backend/app/api/` |
| Tables (SQLAlchemy models) | 37 | `backend/app/models/` |
| Migrations | 10, hand-written Alembic | `backend/alembic/versions/` |
| Scheduled jobs | 7 (APScheduler + advisory lock) | `backend/app/jobs/scheduler.py` |
| Business logic | ~9.5k lines of Python in total | `services/`, `loyalty/`, `jobs/` |
| Tests | 6 pytest files + Playwright e2e | `backend/tests/`, `frontend/e2e/` |
| Python-only libraries | `qrcode`, `reportlab` (PDF), `Pillow` (logo) | `services/qr.py`, `print_assets.py`, `logo.py` |

## 2. Target architecture

```
Browser ──► Vercel (Next.js)
              ├─ pages / UI                       (unchanged)
              └─ app/api/**/route.ts              (replaces FastAPI)
                    │  server-only Supabase client (service role)
                    ▼
            Supabase
              ├─ Postgres          (same schema, managed by supabase/migrations)
              ├─ Auth              (owner + admin login: email OTP / magic link)
              ├─ Storage           (menu photos, covers → replaces /uploads)
              ├─ pg_cron + pg_net  (fires the 7 jobs)
              └─ Edge Function     (optional: only if a job outgrows a route)
```

### Key decision: logic lives in Next.js route handlers, not in the browser

Supabase also lets the browser query tables directly through the anon key and
Row Level Security (RLS). **We do not use that for Revyu.**

- CR-1 to CR-6 (no gating, Google link at every rating, tag-only drafts,
  trial-credit rules) must be enforced in one server-side place. If the browser
  could write to tables, any user could bypass them.
- Rate limits, trial metering and the `copy_tapped` believability rules need
  server code anyway.
- The current `/api/*` paths and response shapes are kept, so the frontend
  pages barely change. Only `next.config.ts` rewrites go away.

So: **RLS is enabled on every table with no policies (deny all)**. Only the
server, using the service-role key, reads or writes. The service-role key is
set only in Vercel server env vars and never gets the `NEXT_PUBLIC_` prefix.

Edge Functions (Deno) are a second option for logic. We use route handlers
because they're in the same repo and language as the frontend, share types,
and deploy in one step.

## 3. Component-by-component mapping

| Today (FastAPI) | Supabase / Vercel replacement | Notes |
|---|---|---|
| Postgres + SQLAlchemy | Supabase Postgres + `@supabase/supabase-js` or Drizzle ORM | Drizzle recommended: typed queries and transactions, which the loyalty ledger and billing need. Connect via the Supavisor pooler. |
| Alembic migrations | `supabase/migrations/*.sql` | Baseline = `pg_dump --schema-only` of the current DB, then new SQL files from there. |
| Seeds (`plans`, tags, service catalog, demo outlet) | `supabase/seed.sql` (dev) + one-off SQL for prod `plans` | Prices stay in the `plans` table, not code (FR-71). |
| Owner login: email OTP + magic link, hashed session tokens (`services/owner_auth.py`) | **Supabase Auth** email OTP + magic link, cookies via `@supabase/ssr` | `accounts.id` maps to `auth.users.id` (add an `auth_user_id` column). Removes `otp_codes` and `owner_sessions`. Customise the Auth email templates. |
| Admin login (`core/admin_auth.py`, shared secret) | Supabase Auth user with an `app_metadata.role = 'admin'` claim | Checked in a `requireAdmin()` helper in every `/api/admin/*` route. |
| Staff PIN login, loyalty wallet codes | **Keep custom** (hashed PIN/token tables), ported to TS | Customers and staff are not Supabase Auth users. |
| In-process rate limiter (`core/ratelimit.py`) | Postgres table `rate_limit_hits` + one SQL function `hit_rate_limit(key, limit, window)` | Works across all Vercel instances, which the in-process limiter can't. Upstash Redis is the alternative if Postgres load matters. |
| APScheduler, 7 jobs | `pg_cron` schedules → `pg_net` POST to `/api/cron/<job>` with a `CRON_SECRET` header | Supabase cron works on the free plan. Vercel Hobby cron is limited to once a day, so it's not used. |
| Advisory lock for jobs | Keep: `pg_try_advisory_lock` inside each cron route | Or rely on pg_cron firing once. |
| `/uploads` StaticFiles | **Supabase Storage** public bucket `outlet-media` | Upload through a server route (validate type and size) or signed upload URLs. Store the object path in the DB. |
| QR PNG/SVG (`qrcode`) | `qrcode` npm package | Same error-correction level H. |
| Print PDFs A5/A7 (`reportlab`) | `pdf-lib` in a Node runtime route | Re-check layout against the current output. |
| Generated logo (`Pillow`) | `@vercel/og` / Satori, or `sharp` | Node runtime. |
| Razorpay provider + webhook | Route handler, read the raw body, HMAC-SHA256 with `crypto` | Keep the mock provider for local. |
| Google Places | `fetch` from server routes | Keep the fake-data fallback when no key is set. |
| Email provider | `fetch` to the same provider | Keep `skipped_no_provider` logging. |
| `ENVIRONMENT` boot guard (`core/config.py`) | `lib/env.ts` validated with zod at startup | Same rule: non-local env refuses to start without real keys. |
| pytest (rolled-back txn) | Vitest against local Supabase (`supabase start`, Docker) | Wrap each test in a transaction, or reset with `supabase db reset`. |

### The 7 jobs

| Job | Schedule (today: server-local time, no TZ set in `scheduler.py`) | New route |
|---|---|---|
| places_poll | Mon 03:00 | `/api/cron/places-poll` |
| trial_day15_check | daily 02:00 | `/api/cron/trial-day15` |
| cancellation_expiry | daily 02:30 | `/api/cron/cancellation-expiry` |
| event_retention_prune | 1st of month 04:00 | `/api/cron/event-prune`, or pure SQL in pg_cron |
| weekly_digest | Mon 08:00 | `/api/cron/weekly-digest` |
| zero_scan_nudges | Mon 09:00 | `/api/cron/zero-scan` |
| payment_grace_reminders | daily 10:00 | `/api/cron/grace-reminders` |

pg_cron uses UTC. Decide the intended IST times and convert them (e.g. 08:00 IST = 02:30 UTC).

## 4. Phases

Each phase ships on its own. Use the strangler pattern: endpoints move one
router at a time. `next.config.ts` keeps proxying the routes that haven't
moved to FastAPI, so the app works throughout.

**Phase 0 — Database on Supabase (½–1 day).** Point the current FastAPI at
Supabase Postgres (session pooler, port 5432) and run `alembic upgrade head`.
Nothing else changes. *Exit:* pytest and e2e pass against Supabase.

**Phase 1 — Foundations (2–3 days).**
- `supabase init`; baseline migration from `pg_dump --schema-only`. From now
  on, schema changes go in `supabase/migrations`, not Alembic.
- Add Drizzle schema (introspect with `drizzle-kit pull`), `lib/db.ts`,
  `lib/env.ts`, `lib/ratelimit.ts`, `requireOwner()` / `requireAdmin()`.
- Enable RLS on every table (deny all).
- Vitest + local Supabase test harness.

**Phase 2 — Customer flow + compliance core (3–5 days).** `flow.py`,
`events.py`, `hub_public.py`, `services/trial_metering.py`, `services/links.py`.
This is the CR-3 boundary. *Exit:* `e2e/compliance.spec.ts` green with
FastAPI's `/api/flow` and `/api/events` turned off.

**Phase 3 — Auth (2–3 days).** Supabase Auth for owners and admins. Migrate
existing `accounts` (create `auth.users` rows by email, link `auth_user_id`).
Rewrite `/app/login`, `auth/magic`, logout. Drop `owner_sessions` and
`otp_codes` after cut-over.

**Phase 4 — Owner portal (4–6 days).** `dashboard.py`, `hub_config.py` (the
biggest router, 26 endpoints, plus uploads → Storage), `assets.py` (QR, PDFs,
logo), `competitors.py`, `referrals.py`, `growth.py` (owner side).

**Phase 5 — Signup, billing, webhooks (3–4 days).** `signup.py`, `billing.py`,
`webhooks.py`, `services/payments/*`, `one_time_pay.py`. Test the Razorpay
webhook signature against real test-mode payloads.

**Phase 6 — Loyalty + staff (3–4 days).** `loyalty/service.py` (520 lines,
ledger in transactions), `staff.py`. Keep the CR-6 firewall between loyalty and
reviews.

**Phase 7 — Admin (2–3 days).** `admin.py`, `admin_ops.py`, `admin_outlets.py`
(incl. bulk import), growth admin.

**Phase 8 — Jobs + cut-over (2–3 days).** The 7 cron routes + pg_cron schedules.
Remove the `next.config.ts` rewrites, delete `render.yaml`, and archive
`backend/`. Port the remaining pytest cases to Vitest.

**Total: roughly 4–6 weeks of focused work.** This is a rough estimate. The
risk sits in Phases 2, 5 and 6, where correctness matters most.

## 5. Risks and things to decide

1. **Vercel Hobby is non-commercial only** (Vercel's terms). Revyu charges
   businesses, so production needs Vercel Pro (~$20/mo) or another Next.js host.
2. **Supabase free projects pause after ~7 days without activity**, and the
   free plan has no backups. Use Supabase Pro (~$25/mo) before real outlets.
3. **Serverless cold starts and timeouts.** Bulk import and `places_poll`
   could exceed function time limits. Batch them, or move them to an Edge
   Function.
4. **Compliance regressions.** Every ported customer-flow endpoint must pass
   `e2e/compliance.spec.ts` before FastAPI's version is switched off.
5. **Owner re-login.** Moving to Supabase Auth signs out every existing owner
   once. Fine at current scale.
6. **Two backends during migration.** Both write to the same DB, so schema
   changes must not break the not-yet-ported side. Freeze schema changes, or
   apply them in both places.

**Decisions needed before Phase 1:**
- Drizzle vs plain `supabase-js` (recommend Drizzle).
- Rate limiting: Postgres table vs Upstash (recommend Postgres to start).
- Whether to do Phase 0 now and pause there. That alone gets the DB on
  Supabase with no rewrite.
