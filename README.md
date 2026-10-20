# Revyu

> Compliant Google review collection and customer hub for single-outlet local businesses (launch market: India).

Customers scan a printed QR, tap a rating and what stood out, edit a draft built only from their own choices, and paste it on Google. The Google option is on screen at every rating, and private feedback to the owner is always available too (compliance rules CR-1 to CR-6 in [`documents/03-COMPLIANCE.md`](documents/03-COMPLIANCE.md)).

## Layout

| Path | What it is |
|---|---|
| `frontend/` | **The whole product**: Next.js 16 (App Router) + React 19 + Tailwind 4. UI and API (`src/app/api/**`, logic in `src/server/`). Deployed to Vercel. |
| `backend/` | Database toolkit only: Alembic migrations and seed scripts for Postgres. Not deployed. (The old FastAPI server under `backend/app/api` is retired.) |
| `documents/` | PRD, SRS, compliance rules, data model, API spec. Start at [`documents/INDEX.md`](documents/INDEX.md). |

## Local development

Prerequisites: Node 22+, Python 3.11+, a Postgres database (a Supabase project works).

```bash
# 1. Database schema and seed data
cd backend
python -m venv .venv && .venv/Scripts/activate      # Linux/macOS: source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env                                 # set DATABASE_URL
alembic upgrade head
python -m app.seeds.plans
python -m app.seeds.service_catalog
python -m app.seeds.dev_outlet                       # demo outlet at /r/demo-dental

# 2. App (UI + API)
cd ../frontend
npm install
cp .env.example .env.local                           # same DATABASE_URL; see comments inside
npm run dev                                          # http://localhost:3000
```

With empty provider keys and `ENVIRONMENT=local`, payments use a mock Razorpay, Places returns fake data, and email is printed to the console.

## Tests and checks

```bash
cd frontend
npx tsc --noEmit
npx eslint src
npm test              # Vitest: server services and routes, each test in a rolled-back DB transaction
npm run test:e2e      # Playwright: compliance boundary (SRS-17.1a-g at ratings 1-5), drafts, hub, hub editor
npx next build
```

`e2e/compliance.spec.ts` is the compliance boundary and must stay green.

## Deploying

See [`documents/26-DEPLOYMENT.md`](documents/26-DEPLOYMENT.md): required services, every environment variable, first deploy, migrations, smoke test, backups, and troubleshooting.

## License

Proprietary. All rights reserved.
