# backend/ - database toolkit (retired API)

This directory used to be the Revyu API (FastAPI). The API now lives in
`frontend/src/app/api/**` (Next.js route handlers) and runs on Vercel; see
`documents/25-SUPABASE-MIGRATION-PLAN.md`.

What is still used from here:

| Path | Purpose |
|---|---|
| `alembic/` | The only migration tool. `alembic upgrade head` against the Supabase **session pooler** URL. |
| `app/models/`, `app/core/` | Imported by Alembic for table metadata and settings. Keep importable. |
| `app/seeds/` | `plans`, `service_catalog`, `dev_outlet` seed scripts. |
| `tests/` | Legacy pytest suite for the retired API; useful as a behavioural reference. |

What is dead (kept as a rollback path until the TypeScript API has run in
production for a while, then delete): `app/api/`, `app/jobs/`, and the services
that only they use. **Do not add features here.**
