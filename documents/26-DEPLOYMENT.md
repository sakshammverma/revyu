# Deployment & Operations Runbook

**Product:** Revyu
**Date:** 2026-10-09
**Audience:** whoever deploys or operates production (today: the founder).

The whole product is one Next.js app (`frontend/`) on **Vercel**, talking to
**Supabase Postgres** (and Supabase Storage for uploads). `backend/` is only
the database toolkit: Alembic migrations and seed scripts. Nothing else is
deployed.

---

## 1. External services you need

| Service | Used for | Without it |
|---|---|---|
| Supabase (Pro plan for backups) | Postgres, Storage bucket for logos/menu photos | Nothing works |
| Vercel | Hosting, Cron (7 jobs in `frontend/vercel.json`) | — |
| Razorpay (live keys, 2 plans, 1 webhook) | Mandates, one-time orders, refunds | Production refuses to start |
| Google Places API (New) | Signup search, gap report, weekly rating poll | Production refuses to start |
| Resend **or** any SMTP login | OTP login codes, magic links, owner alerts, digests | Production refuses to start |
| A domain with HTTPS | Printed QR codes encode `PUBLIC_FLOW_BASE_URL` | Production refuses localhost/http |

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

The full list with comments is in `frontend/.env.example`. In any
`ENVIRONMENT` other than `local` the server **refuses to start** if a required
value is missing or a secret is a default (`src/server/env.ts`). A deployment
that leaves `ENVIRONMENT` unset is treated as `production` (it never silently
falls back to mock payments).

| Variable | Production value |
|---|---|
| `ENVIRONMENT` | `production` (or `staging` for a preview project) |
| `DATABASE_POOL_URL` | Supabase **transaction pooler** URL, port **6543** |
| `DATABASE_URL` | Supabase **session pooler** URL, port 5432 (fallback; Alembic uses it) |
| `FRONTEND_BASE_URL` | `https://<your domain>` — used in emailed login links |
| `PUBLIC_FLOW_BASE_URL` | `https://<your domain>` — **printed into every QR; never change it after printing** |
| `ADMIN_SESSION_SECRET`, `AUTH_SECRET`, `CRON_SECRET` | 3 different random values, 32+ chars (`openssl rand -hex 32`) |
| `EMAIL_PROVIDER_API_KEY` *or* `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Email transport |
| `EMAIL_FROM_ADDRESS` | A sender on a domain verified with your email provider |
| `ADMIN_NOTIFY_EMAIL` | Founder inbox for growth-service requests and print-kit orders |
| `GOOGLE_PLACES_API_KEY` | Server key restricted to the Places API (New) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Live API keys |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you set on the webhook (step 4) |
| `RAZORPAY_PLAN_ID_MONTHLY`, `RAZORPAY_PLAN_ID_ANNUAL` | Plan ids from the Razorpay dashboard |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads (server-only key; never exposed to the browser) |

Never set `DISABLE_RATE_LIMITS` in production (it is ignored outside `local` anyway).

## 3. First deploy

1. **Database** (from `backend/`, with `DATABASE_URL` pointing at the
   production session pooler):
   ```
   pip install -e .
   alembic upgrade head            # the only way to change the schema
   python -m app.seeds.plans       # prices live in the plans table (FR-71)
   python -m app.seeds.service_catalog
   ```
   Do **not** run `app.seeds.dev_outlet` against production.
2. **Supabase Storage:** nothing to do. The public bucket `outlet-media` is
   created automatically on the first upload (`frontend/src/server/services/storage.ts`).
3. **Vercel:** import the repo with root directory `frontend/`, framework
   Next.js, default build (`next build`). Add the variables from §2. Deploy.
4. **Razorpay webhook:** `https://<domain>/api/webhooks/razorpay`, with events
   `subscription.authenticated`, `subscription.activated`,
   `subscription.charged`, `subscription.halted`, `subscription.cancelled`,
   `payment.failed`, `order.paid`. Use the same secret as `RAZORPAY_WEBHOOK_SECRET`.
5. **Cron:** Vercel reads `frontend/vercel.json` and sends `CRON_SECRET`
   automatically. Check Project → Cron Jobs lists 7 jobs.
6. **Smoke test** (see §5).

## 4. Every later deploy

1. If the commit adds an Alembic migration, run `alembic upgrade head` against
   production **before** promoting the deploy (migrations are additive by
   convention so the old code keeps working against the new schema).
2. Re-pull the Drizzle schema locally (`npx drizzle-kit pull`) and commit it
   if the migration changed tables.
3. Push; Vercel builds and deploys. Roll back from the Vercel dashboard
   ("Promote" the previous deployment) if the smoke test fails.

## 5. Smoke test after a deploy

- `GET /api/health` → `{"status":"ok","db":true}` (point an uptime monitor here; 503 means the DB is unreachable).
- Open `/r/<a live slug>` on a phone: rate 1★ and 5★, confirm "Post publicly on Google" is visible both times.
- Log in at `/app/login` with a real owner email (checks email delivery).
- `/admin` with the admin token: the metrics page loads.

## 6. Security posture (what is enforced where)

- **Headers** (`frontend/next.config.ts`): HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`,
  `Permissions-Policy` (camera only for the staff console), `Cache-Control:
  no-store` on `/api/*`. There is no script-src CSP: Next injects inline
  bootstrap scripts and Razorpay Checkout loads remote script; adding one needs
  nonces (see Next's CSP guide) and testing checkout end to end.
- **Owner auth:** HttpOnly, `SameSite=Lax`, `Secure` cookie; tokens hashed at
  rest; the session token never appears in a response body. Cookie-carrying
  POST/PUT/PATCH/DELETE requests from another origin are refused (`CROSS_ORIGIN`,
  `src/server/http.ts`).
- **Admin:** bearer token compared in constant time; token kept in
  sessionStorage, re-prompted on any 401.
- **Staff PINs:** 10 tries / 15 min per IP, and 20 wrong PINs / hour per outlet
  (then locked for the rest of the hour). Turning a PIN off ends its sessions
  immediately.
- **Rate limits** are stored in Postgres (`rate_limit_hits`) so they hold across
  serverless instances. Client IP comes from `x-vercel-forwarded-for` /
  `x-real-ip`. If you ever put another proxy in front of Vercel, make sure it
  overwrites `x-real-ip`, or IP limits can be bypassed.
- **Trial-credit abuse:** a credit needs a session with a device hash, a rating
  recorded in an earlier request, 5+ seconds of flow, and is capped at 6/hour
  per outlet and 3/day per IP per outlet.
- **Webhooks:** HMAC over the raw body; payments deduped by id; a replayed
  charge cannot extend access (period end comes from Razorpay), and a stale
  `payment.failed` cannot undo a later successful charge.

## 7. Backups and recovery

- Use **Supabase Pro** before real outlets: daily backups, 7-day retention.
  Enable **PITR** once paying customers depend on it.
- The data that cannot be recreated: `accounts`, `outlets` (slugs are printed
  on paper), `subscriptions`/`payments`, `private_feedback`, loyalty tables.
  Events can be lost without harm.
- Restore drill (do it once before launch): restore a backup into a new
  Supabase project, point a Vercel preview's `DATABASE_*` at it, and load an
  outlet page and the owner dashboard.
- Slugs and `PUBLIC_FLOW_BASE_URL` are effectively permanent: printed QRs
  depend on them. Never rename the domain without a redirect.

## 8. Monitoring and logs

- Vercel → Logs shows route errors as `Unhandled route error <METHOD> <path>`
  with the stack; client responses only ever get `{"detail":{"error":{"code":"INTERNAL"}}}`.
- Page/render errors Next captures are logged as one JSON line with
  `"kind":"server_error"` (`src/instrumentation.ts`), and browser errors as
  `"kind":"client_error"` (`src/instrumentation-client.ts` beacons to
  `/api/client-errors`, max 5 per page load, 30/hour per IP). Paths only, never
  query strings or headers. Filter the Vercel log view on `kind` to see them.
  Error pages show a short reference (the digest) that matches the log line.
- Email failures are recorded on the `notifications` row (`failed` /
  `skipped_no_provider`); a growing `skipped_no_provider` count means no
  provider is configured.
- Cron runs appear under Vercel → Cron Jobs; each job takes a Postgres advisory
  lock, so an overlapping run is skipped rather than doubled.
- Still to set up outside the code: an uptime monitor on `/api/health` (any
  free pinger, every 5 minutes), and log alerts on `kind` (Vercel log drains or
  a tracker like Sentry if volume grows).
- **Supabase free projects pause after about a week without traffic** (the
  pooler then answers `tenant/user ... not found`). Production must be on Pro;
  a paused dev project is restored from the Supabase dashboard.

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every request 500s right after deploy, logs say `Unsafe configuration: …` | A required variable is missing; the message names it |
| `too many clients` / connection errors | `DATABASE_POOL_URL` not set or on port 5432; use the 6543 transaction pooler |
| Signup shows "Payment processing is temporarily unavailable" | Razorpay keys or plan ids wrong |
| Owners never receive login codes | Email provider rejected the sender; check `notifications.status` |
| Cron returns 401 | `CRON_SECRET` differs between Vercel env and what Cron sends (redeploy after changing it) |
| A customer sees "Not currently collecting feedback" | Outlet state is paused/suspended/deactivated (by design, C-6) |
