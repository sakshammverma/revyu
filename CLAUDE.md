# CLAUDE.md

Guidance for Claude Code when working in this repository.

**Revyu** is a QR-code Google-review collection tool for single-outlet small businesses (launch market: India). Product docs live in `documents/` (start at `documents/INDEX.md`; current build status and plan: `documents/23-STATUS-AND-PLAN.md`). **Compliance rules CR-1 to CR-6 in `documents/03-COMPLIANCE.md` are non-negotiable**: no review gating, no incentives tied to reviews, Google link reachable at every rating, drafts built only from the customer's own tags.

## Layout

- `backend/` FastAPI + SQLAlchemy 2 + Alembic + APScheduler (Postgres)
- `frontend/` Next.js 16 (App Router) + React 19 + Tailwind 4
- `documents/` specs (PRD, SRS with `FR-n`/`SRS-n` IDs, data model, API spec)

## Backend (`cd backend`, use `.venv/Scripts/python.exe` on Windows)

```
pip install -e .[dev]
alembic upgrade head
python -m app.seeds.plans          # plans table (no prices in code, FR-71)
python -m app.seeds.dev_outlet     # demo outlet at /r/demo-dental
uvicorn app.main:app --port 8000
pytest tests -q                    # one test:  pytest tests/test_hardening.py::test_name
```

- Tests use the local dev DB inside a rolled-back transaction (`tests/conftest.py` `db` fixture), so they leave no rows.
- With `ENVIRONMENT=local` (default) and no keys, payments use the mock provider (signature `"mock-signature"`), Places returns fake data, and email only logs (recorded as `skipped_no_provider`). **Any other `ENVIRONMENT` refuses to boot** unless real secrets/keys are set (`core/config.py`).
- Public write endpoints are rate-limited by `core/ratelimit.py` (in-process; swap for Redis if you run multiple workers). Scheduled jobs take a Postgres advisory lock so multiple workers don't double-run them.
- Owner session tokens and magic-link tokens are stored hashed; the raw value only exists on `session.raw_token` right after issue.
- A trial credit needs a believable journey: `copy_tapped` counts only if the session rated and is older than 5s, capped at 6/hour/outlet (`api/events.py`, `services/trial_metering.py`).
- Migrations are hand-written; run `alembic upgrade head` after pulling.

## Frontend (`cd frontend`)

```
npm run dev          # :3000, proxies /api/* to the backend (next.config.ts)
npx tsc --noEmit
npx eslint src
npm run test:e2e     # Playwright; starts/reuses both servers, needs the seeded demo-dental outlet
npm test             # Vitest for src/server/** against DATABASE_URL in .env.local (rolled-back transactions)
```

- **Migration in progress** (`documents/25-SUPABASE-MIGRATION-PLAN.md`, phases 0-7 done): the API is moving from FastAPI to Next route handlers (`src/app/api/**`, logic in `src/server/`), one endpoint at a time. Ported: every API endpoint (customer flow, owner portal, billing, loyalty, staff, admin console, gap report). Still FastAPI: only the 7 scheduled jobs (`backend/app/jobs`) and the root `/health`. Unported paths proxy to FastAPI through the `fallback` rewrite in `next.config.ts` (must stay `fallback`: a plain array runs before dynamic routes and swallows the new handlers). When you change a ported endpoint, change the TypeScript one; the Python copy is dead code until phase 8.
- Server code reads `frontend/.env.local` (gitignored; copy `DATABASE_URL` from `backend/.env`; set `DATABASE_POOL_URL` to the same string on port 6543 (transaction pooler); set `DISABLE_RATE_LIMITS=true` locally, since limits now persist in the DB). Supabase's session pooler allows only ~15 client connections project-wide, so keep the Next server on the transaction pooler and restart a long-running `npm run dev` after changing DB env. Schema types in `src/server/db/schema.ts` come from `drizzle-kit pull`; **Alembic is still the only migration tool**, so re-pull after a migration. The DB has no defaults for ids/booleans (Python supplied them), so TS inserts must set them.
- `E2E_NO_BACKEND=1 npm run test:e2e -- e2e/compliance.spec.ts` runs without FastAPI; it must stay green.

- `e2e/compliance.spec.ts` is the CR-3 boundary (SRS-17.1a-g, ratings 1-5, 360x640). It must stay green. It targets `/r/demo-dental/review`, which works in both hub modes. The e2e run sets `DISABLE_RATE_LIMITS` (honoured only when `ENVIRONMENT=local`) and writes scans/sessions to the dev DB, so dev metrics are not real numbers.

- **This Next.js has breaking changes.** Read `frontend/node_modules/next/dist/docs/` before using a Next API. Example: `error.tsx` receives `retry`, not `reset`.
- Route groups: `(marketing)` public site + `/admin/*`, `(owner)/app/(portal)` owner dashboard behind the app shell, `(owner)/app/login` and `auth/magic` outside it, `r/[slug]` the customer flow.
- **Design: stick with the current system** (blue accent, Lora headings, Plus Jakarta Sans, 16px radii). Tokens are in `src/app/globals.css`; `--accent` is `#2f6df0` for AA contrast with white text. Use token classes (`bg-accent`, `text-ink`, `border-line`), not raw hex. Shared primitives are in `src/components/ui/` (Button, Card, StatTile, Field, StatusPill, Toast, Skeleton/EmptyState/ErrorState). Check there before writing a new one.
- The customer flow (`components/flow/CustomerFlow.tsx`) must keep the Google option and a private-feedback entry visible at every step after rating (sticky bar), using the neutral label "Post publicly on Google" (CR-3, SRS-17.1). Never add a rating-conditional way to hide it.
- Data loading in client pages: `useAsync` (`src/lib/useAsync.ts`). Toasts via `useToast()` (wrap in `ToastProvider`).

## Product decisions recorded 2026-10-01

- Referral: referrer gets 70% off their next invoice **only when the referred business actually pays** (first captured payment). Applied manually by the founder at v1 via `/admin/referrals`.
- Competitor Watch: wanted, uses public Google data only (works even if the rival also uses Revyu). Not built yet.
- Revyu Pro tier: parked (owner is unsure). Google Business Profile management service: dropped.
