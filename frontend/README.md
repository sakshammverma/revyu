# Revyu app (UI + API)

The Next.js app that is the whole product. See the [root README](../README.md) for setup and [`documents/26-DEPLOYMENT.md`](../documents/26-DEPLOYMENT.md) for production.

| Path | What lives there |
|---|---|
| `src/app/(marketing)` | Public site, signup, gap report, and the founder console at `/admin/*` |
| `src/app/(owner)/app` | Owner dashboard (`(portal)`), login, magic-link landing |
| `src/app/r/[slug]` | Customer pages: hub, review flow (`/review`), menu, rewards, connect |
| `src/app/staff/[slug]` | Staff counter console (PIN login, visits, redemptions) |
| `src/app/api/**` | Route handlers; each delegates to `src/server/services/*` |
| `src/server/` | Env (`env.ts`), DB (Drizzle schema pulled from Postgres), HTTP helpers (`http.ts`: errors, rate limits, CSRF guard), services, notifications |
| `src/components/ui` | Shared primitives (Button, Card, Field, StatusPill, Toast, Skeleton/EmptyState/ErrorState) |
| `e2e/` | Playwright specs; `compliance.spec.ts` is the CR-3 boundary |

Conventions:

- Services take a `db: DbLike` so tests run them inside a rolled-back transaction (`src/server/testing/helpers.ts`).
- Wrap every route in `handler()` from `src/server/http.ts`: it maps `HttpError`s, hides internals on 500, and refuses cross-origin cookie writes.
- Alembic (in `backend/`) is the only migration tool; re-pull `src/server/db/schema.ts` with `drizzle-kit pull` afterwards. The DB has no defaults for ids or booleans, so inserts must set them.
- This Next.js version has breaking changes from older docs: read `node_modules/next/dist/docs/` before using a Next API.
