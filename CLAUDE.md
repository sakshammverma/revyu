# CLAUDE.md

Guidance for Claude Code when working in this repository.

**Revyu** is a QR-code Google-review collection tool for single-outlet small businesses (launch market: India). Product docs live in `documents/` (start at `documents/INDEX.md`; current build status and plan: `documents/23-STATUS-AND-PLAN.md`). **Compliance rules CR-1 to CR-6 in `documents/03-COMPLIANCE.md` are non-negotiable**: no review gating, no incentives tied to reviews, Google link reachable at every rating, drafts built only from the customer's own tags.

## Layout

- `frontend/` Next.js 16 (App Router) + React 19 + Tailwind 4. **It is the whole product**: UI plus the API (`src/app/api/**`, logic in `src/server/`), deployed to Vercel, talking to Supabase Postgres.
- `backend/` the former FastAPI server, now only the **database toolkit**: Alembic migrations and seed scripts (Postgres). It is not deployed and serves nothing; see `backend/README.md`.
- `documents/` specs (PRD, SRS with `FR-n`/`SRS-n` IDs, data model, API spec)

## Database toolkit (`cd backend`, use `.venv/Scripts/python.exe` on Windows)

```
pip install -e .[dev]
alembic upgrade head               # the ONLY way to change the schema
python -m app.seeds.plans          # plans table (no prices in code, FR-71)
python -m app.seeds.service_catalog
python -m app.seeds.dev_outlet     # demo outlet at /r/demo-dental
pytest tests -q                    # legacy suite for the retired API; still green
```

- The FastAPI app (`app/api`, `app/services`, `app/jobs`) is **retired dead code**, kept only until the TypeScript API has run in production for a while (rollback path). Do not add features there. Alembic still imports `app.models`, so the package must stay importable.
- `DATABASE_URL` here is the Supabase **session pooler** (port 5432); the Next server uses the transaction pooler (see Frontend). The session pooler allows only ~15 client connections project-wide, so `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` cap SQLAlchemy.
- Migrations are hand-written; run `alembic upgrade head` after pulling, then re-pull the Drizzle schema (see Frontend).

## Frontend (`cd frontend`)

```
npm run dev          # :3000, serves the UI and the API
npx tsc --noEmit
npx eslint src
npm run test:e2e     # Playwright; starts/reuses the dev server, needs the seeded demo-dental outlet
npm test             # Vitest for src/server/** against DATABASE_URL in .env.local (rolled-back transactions)
```

- **The API is TypeScript now** (Supabase migration finished; `documents/25-SUPABASE-MIGRATION-PLAN.md`). Every endpoint is a Next route handler under `src/app/api/**` with logic in `src/server/services/*` taking a `db: DbLike` so it is testable inside a rolled-back transaction (`src/server/testing/helpers.ts`, `handlerPattern.test.ts`). Scheduled jobs are `src/server/services/jobs.ts`, triggered by Vercel Cron (`vercel.json`, a test keeps it in sync with the registry) through `/api/cron/<job>` guarded by `CRON_SECRET`. There is no proxy or second server.
- Server code reads `frontend/.env.local` (gitignored; copy `DATABASE_URL` from `backend/.env`; set `DATABASE_POOL_URL` to the same string on port 6543 (transaction pooler); set `DISABLE_RATE_LIMITS=true` locally, since limits now persist in the DB). Supabase's session pooler allows only ~15 client connections project-wide, so keep the Next server on the transaction pooler and restart a long-running `npm run dev` after changing DB env. Schema types in `src/server/db/schema.ts` come from `drizzle-kit pull`; **Alembic is still the only migration tool**, so re-pull after a migration. The DB has no defaults for ids/booleans (Python supplied them), so TS inserts must set them.
- Tests are hermetic: `vitest.config.mts` blanks every provider key (Google, Razorpay, Resend, Supabase) whatever is in `.env.local`. Local dev with real test keys in `.env.local` will use them (e.g. Razorpay test mode), so blank them to use the mock provider.

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
