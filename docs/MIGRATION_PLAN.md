# Migration Plan: Local Docker Dev → Vercel + Render + Supabase

**Document status:** Gate 1 in progress — T-01 through T-07 complete; T-08 pending; one startup blocker remaining (Render DB pooler URL)  
**Date:** 2026-04-29  
**Author:** Claude Code  
**Guardrails obeyed:** no `db push`, no destructive DB commands, no CI merges while red, Docker dev workflow preserved

---

## 0. Executive Summary

The project is a TypeScript monorepo: raw `http.createServer` API (`apps/api`, port 3001) + Next.js Pages Router frontend (`apps/web`, port 3000) + PostgreSQL 16 via Docker. The target is Vercel (frontend) + Render (API) + Supabase (Postgres). The project is largely ready for this move with two **blocking** readiness gaps that must be resolved before a production deployment is safe:

| # | Blocking gap | Details |
|---|---|---|
| B1 | **Local file storage** | `ATTACHMENTS_STORAGE=local` writes to `./uploads/` on disk. Render has an ephemeral filesystem — files disappear on every deploy. Affects: maintenance attachments, rental application documents (PII), OCR source images. Must migrate to object storage (Supabase Storage, S3, or R2) before going live. |
| B2 | **Prisma `DIRECT_URL`** | `schema.prisma` datasource only declares `url = env("DATABASE_URL")`. Supabase's runtime connection (via PgBouncer pooling) is incompatible with `prisma migrate deploy`, which requires a direct TCP connection. A `directUrl = env("DIRECT_URL")` line must be added to the `datasource db {}` block — this is a one-line schema change with a no-op migration. |

Non-blocking issues that need resolution before production go-live are called out per section.

---

## 0.1 Two-Gate Deployment Strategy

Infrastructure setup and production launch are independent decisions. This plan separates them into two gates.

**Gate 1 — Infrastructure (start now, UI-state independent)**

Set up Supabase, Render, and Vercel staging environments. This gate has no dependency on UI completeness or in-progress feature work. It can and should start as soon as the two hard blockers are resolved (both now done). Tickets: T-01 through T-08.

What Gate 1 unlocks:
- Every PR to `main` gets a **Vercel preview deployment** automatically — shareable URLs for UI review without anyone running the app locally
- UI changes on Next.js deploy to Vercel in ~1 minute and do not require any Render or Supabase changes
- Integration issues (CORS, proxy forwarding, auth headers, PDF serving) surface in staging before they surprise you in production
- Local Docker dev remains **entirely unchanged** throughout

**Gate 2 — Production Launch (after UI stabilises)**

Let real users in. This gate requires feature completeness, end-to-end staging sign-off, and production-specific decisions (custom domains, Render tier, Supabase Pro, email provider). Tickets: T-UI, T-09, T-10, T-11.

**Why the separation matters:**

The fear that "going online makes iteration harder" applies to Gate 2, not Gate 1. What actually introduces friction is having real users with real data — not the existence of a staging environment. Gate 1 infrastructure makes UI iteration *faster*: every branch gets a live preview, stakeholders can review changes on a URL instead of running the app, and the deployment muscle is built while the stakes are low.

Deferring Gate 1 until the UI is done has a concrete cost: the first Supabase migration run grows with every migration added. It is currently 82+ migrations. That run is no harder today than in three months, but it also does not get easier.

---

## 1. Current Architecture Inventory

### 1.1 Web App (`apps/web`)

| Item | Value |
|------|-------|
| Framework | Next.js Pages Router (`next: ^16.1.6`) |
| Dev command | `next dev -p 3000 -H 0.0.0.0` |
| Build command | `next build` |
| Start command | `next start` (implied) |
| Entry page | `pages/_app.js` |
| TypeScript | yes (`tsconfig.json` exists, `tsc --noEmit` in CI) |
| Styling | Tailwind v4.1, PostCSS, CVA |
| Config file | `apps/web/next.config.js` — only `redirects()`, no `output` override |
| UI pages | 88 UI pages + 200 Next.js API proxy pages (all use `proxyToBackend()`) |

### 1.2 API Server (`apps/api`)

| Item | Value |
|------|-------|
| Runtime | raw `http.createServer` — no Express/Fastify |
| Entry point | `apps/api/src/server.ts` |
| Dev command | `ts-node src/server.ts` |
| Build command | `tsc -p tsconfig.json` → produces `dist/` |
| Production start | `node dist/server.js` |
| Port | `process.env.PORT ?? 3001` — already reads from env ✅ |
| Background jobs | In-process `setInterval` running 6 job types (selection timeouts, attachment retention, scheduling escalations, email flush, recurring billing, overdue invoices, legal variable ingestion) |
| CORS | `CORS_ORIGIN` env var; defaults to `"*"` in non-production |
| Auth guard | Refuses to boot in production without `AUTH_SECRET`; fails on `AUTH_OPTIONAL=true` or `DEV_IDENTITY_ENABLED=true` ✅ |
| Route modules | 27 registered in `server.ts` |

### 1.3 Prisma Schema

| Item | Value |
|------|-------|
| Location | `apps/api/prisma/schema.prisma` |
| Migrations | `apps/api/prisma/migrations/` (82+ directories) |
| Datasource | `provider = "postgresql"`, `url = env("DATABASE_URL")` — no `directUrl` ⚠️ |
| Models | 69 |
| Enums | 61 |

### 1.4 Current Environment Variables

**`apps/api/.env.example` (all known vars):**

```
# Server
PORT=3001
NODE_ENV=development
REQUEST_TIMEOUT_MS=30000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/maint_agent

# Auth
AUTH_SECRET=change-me-in-production
AUTH_OPTIONAL=false
DEV_IDENTITY_ENABLED=false
DEV_ORG_ID=
ALLOW_OWNER_REGISTRATION=false

# CORS
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Background jobs
BG_JOBS_ENABLED=true
BG_JOB_INTERVAL_MS=3600000
OVERDUE_GRACE_HOURS=24

# File storage
ATTACHMENTS_STORAGE=local
ATTACHMENTS_LOCAL_ROOT=./uploads

# Document scanning
DOCUMENT_SCAN_PROVIDER=azure
DOCUMENT_SCAN_FALLBACK_PROVIDER=local
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=...
AZURE_DOCUMENT_INTELLIGENCE_KEY=...

# Email delivery
EMAIL_FROM_ADDRESS=
RESEND_API_KEY=
SMTP_HOST= / SMTP_PORT= / SMTP_SECURE= / SMTP_USER= / SMTP_PASS=
```

**`apps/web/.env.local`:**

```
API_BASE_URL=http://localhost:3001
```

### 1.5 Proxy Behavior

`apps/web/lib/proxy.js` (`proxyToBackend()`) is called by all 200 API proxy pages. It:
- Reads `API_BASE_URL` (defaults to `http://127.0.0.1:3001` if unset)
- Forwards all headers including `Authorization`
- Forwards query params
- Forwards HTTP status codes as-is
- Forwards binary responses (PDF, PNG, images) — guardrail F3

### 1.6 Current CI Gates (`.github/workflows/ci.yml`)

Seven gates run sequentially on every push/PR to `main`:
1. `bash scripts/guardrails.sh` — enforces G8 (db push ban), F-UI4 (className), G9, G3
2. Backend `npm install`
3. Frontend `npm install`
4. `G7: prisma generate`
5. `G7: prisma migrate deploy` + schema drift check (against test DB)
6. `G11: prisma db seed` + `seed-category-mappings.js` + `seed-test-legal-rule.js`
7. `G7: tsc --noEmit` (backend)
8. `G7: next build` (frontend, `API_BASE_URL=http://127.0.0.1:3001`)
9. `G7: tsc --noEmit` (frontend)
10. `G7: Jest tests` (against `maint_agent_test`)
11. `G7: Backend boot + 9 smoke curls`

**CI service container:** PostgreSQL 16, `maint_agent_test` DB. Env: `NODE_ENV=test`.

### 1.7 Docker / Local Dev Assumptions

- `infra/docker-compose.yml`: single `postgres:16` service, container `maint_agent_pg`, port 5432, volume `maint_agent_pgdata`
- Two databases inside: `maint_agent` (dev) and `maint_agent_test` (tests)
- Root `package.json` `dev:db` script: `cd infra && docker compose up -d`
- Local dev API: `npm run dev:api` → `ts-node src/server.ts`
- Local dev web: `npm run dev:web` → `next dev -p 3000 -H 0.0.0.0`
- `ATTACHMENTS_LOCAL_ROOT=./uploads` — files written to `apps/api/uploads/` on developer machine
- **Docker must remain the local dev path** — no changes to `infra/docker-compose.yml`

---

## 2. Target Architecture

```
Browser
  └─► Vercel (apps/web)
        └─► pages/api/* → proxyToBackend() → Render API (apps/api)
                                                └─► Supabase Postgres
```

| Layer | Platform | What runs |
|-------|----------|-----------|
| Frontend | Vercel | `apps/web` only — Next.js Pages Router |
| API | Render Web Service | `apps/api` only — raw Node.js http server |
| Database | Supabase | Managed PostgreSQL 16 |

### 2.1 Environment Boundaries

- **Browser → Vercel:** HTTPS. Vercel serves all UI pages and Next.js API routes.
- **Vercel API proxy routes → Render API:** HTTPS. `API_BASE_URL` env var on Vercel is set to the Render service URL. No `localhost` reference in production.
- **Render API → Supabase:** PostgreSQL wire protocol. `DATABASE_URL` points to PgBouncer pooled URL (runtime); `DIRECT_URL` points to direct Postgres connection (migrations only).

### 2.2 Domains Needed

| Environment | Vercel URL | Render URL |
|-------------|-----------|------------|
| Staging | `maint-agent-staging.vercel.app` (auto) | `maint-agent-api-staging.onrender.com` (auto) |
| Production | Custom domain (e.g. `app.maint-agent.com`) | Custom domain (e.g. `api.maint-agent.com`) or private Render URL |

> **Unknown requiring manual decision:** final custom domain names. The plan uses placeholder names throughout.

---

## 3. Platform Readiness Audit

### 3.1 Monorepo Build Settings

- Vercel must be configured to build only `apps/web` with root directory set to `apps/web` (or use `vercel.json` with `installCommand`/`buildCommand` pointing into the monorepo).
- Render must be configured to build only `apps/api`.
- Neither platform can use the root `package.json` `npm workspaces` install directly without configuration. Each service must install its own dependencies.
- **Required change:** add `vercel.json` at repo root (or configure via Vercel dashboard). No root-level `package.json` change needed — root workspaces are for local dev only.

### 3.2 Package Scripts

| Script | Current | Status |
|--------|---------|--------|
| `apps/api` build | `tsc -p tsconfig.json` → `dist/` | ✅ ready for Render |
| `apps/api` start | `node dist/server.js` | ✅ ready for Render |
| `apps/api` prisma generate | `prisma generate` | ✅ must run during Render build |
| `apps/web` build | `next build` | ✅ ready for Vercel |
| Prisma migrate deploy | `npx prisma migrate deploy` | ✅ must run as Render pre-deploy step |

### 3.3 Next.js Config (`apps/web/next.config.js`)

- Only contains `redirects()` — no `output: 'standalone'`, no `basePath`, no image domains that would break on Vercel.
- **No changes required** for Vercel deployment.
- If images from Render API (binary serves) are loaded via `next/image`, add the Render domain to `images.remotePatterns` — check if applicable once Render URL is known.

### 3.4 API Server PORT Binding

- `server.ts` line 74: `const port = process.env.PORT ? Number(process.env.PORT) : 3001`
- Render injects `PORT` automatically. **Already compatible. ✅**

### 3.5 CORS / Allowed Origins

- `server.ts` reads `process.env.CORS_ORIGIN`. In production: `corsOrigin = process.env.CORS_ORIGIN || (isProd ? "" : "*")`
- If `CORS_ORIGIN` is empty in production, no `Access-Control-Allow-Origin` header is set, which will block cross-origin browser requests.
- **Required action:** Set `CORS_ORIGIN` on Render to the Vercel frontend URL (e.g. `https://maint-agent-staging.vercel.app` for staging, `https://app.maint-agent.com` for production).
- Note: `CORS_ORIGIN` currently accepts a single value. If preview deployments need CORS access, this may need to become a comma-separated list or a regex. Assess during staging.

### 3.6 API_BASE_URL Behavior

- `apps/web/lib/proxy.js` reads `API_BASE_URL`. Default is `http://127.0.0.1:3001`.
- **In Vercel production/staging:** `API_BASE_URL` must be set to the Render service HTTPS URL (e.g. `https://maint-agent-api-staging.onrender.com`).
- `API_BASE_URL` is read server-side by Next.js API proxy routes — it is **not** a `NEXT_PUBLIC_*` var and must not be exposed to the browser.
- **Required change:** Set `API_BASE_URL` in Vercel environment (both staging and production).

### 3.7 Production Auth Guard

- Already enforced in `server.ts` (F1 guardrail): server exits with code 1 if `AUTH_SECRET` unset, `AUTH_OPTIONAL=true`, or `DEV_IDENTITY_ENABLED=true` in production. ✅
- **Required action:** Ensure `AUTH_OPTIONAL` and `DEV_IDENTITY_ENABLED` are absent or `false` in Render production env. `AUTH_SECRET` must be set.

### 3.8 Prisma DATABASE_URL / DIRECT_URL Setup ⚠️ BLOCKING

**Current schema (no `directUrl`):**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Supabase provides two connection strings:
- **Pooled URL** (`postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true`) — for runtime queries via PgBouncer. Required for Prisma Client in production.
- **Direct URL** (`postgresql://...@db.xxx.supabase.co:5432/postgres`) — TCP direct connection. Required for `prisma migrate deploy` and `prisma generate`.

If `DATABASE_URL` is the pooled URL at runtime and you run `prisma migrate deploy` against it, Prisma will fail because migrations require a direct connection.

**Required schema change:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

This requires:
1. Add `directUrl = env("DIRECT_URL")` to `schema.prisma`
2. Run `npx prisma migrate dev --name add-direct-url-datasource` — this produces an **empty migration** (no schema changes, only generator config change)
3. Run `npx prisma generate`
4. Verify drift is zero
5. On Render: set `DATABASE_URL` = Supabase pooled URL, `DIRECT_URL` = Supabase direct URL
6. On local dev: `DIRECT_URL` can be left unset or set to the same local URL (Prisma falls back to `DATABASE_URL` when `directUrl` is absent)

### 3.9 Prisma Generate and Migrate Deploy Commands

- `prisma generate` must run during the **Render build step** (before `tsc`), so the generated client is available for compilation.
- `prisma migrate deploy` must run as a **Render pre-deploy command** (after build, before the new instance serves traffic).
- **Never** use `prisma migrate dev` or `prisma db push` in any CI or deployment step.

Render build command: `npm install && npx prisma generate && npm run build`  
Render start command: `npx prisma migrate deploy && node dist/server.js`

> **Alternative:** Run `migrate deploy` as a separate one-time step before first deploy, then in the pre-deploy command. Either approach is valid. The start-command approach is simpler but adds 1–3 seconds to cold start.

### 3.10 Health Check Endpoint ⚠️ MISSING

Render requires a health check path to enable zero-downtime deploys. **No health endpoint currently exists.**

**Required addition** (non-invasive — add one route to `server.ts` or a new route file):
```
GET /health
→ 200 { "status": "ok", "uptime": <seconds> }
```

This route must be public (no auth required) and must respond quickly (no DB query required — or a cheap `SELECT 1` is acceptable).

**Files to change:**
- Add health route in `apps/api/src/server.ts` (before the router dispatch, or add to a route module)
- Configure Render health check path to `/health`

### 3.11 File / PDF / Image Serving Assumptions ⚠️ BLOCKING (B1)

Multiple endpoints serve binary content from the local filesystem:

| Endpoint pattern | What it serves | Where it reads from |
|-----------------|---------------|---------------------|
| `GET /maintenance-attachments/:id/file` | Maintenance attachment images/PDFs | `ATTACHMENTS_LOCAL_ROOT/...` |
| `GET /rental-attachments/:id/download` | Rental application docs (PII: ID, pay stubs) | `ATTACHMENTS_LOCAL_ROOT/...` |
| `GET /invoices/:id/source-file` | Original invoice image/PDF from OCR | `ATTACHMENTS_LOCAL_ROOT/...` |
| `GET /invoices/:id/pdf` | Generated invoice PDF | in-memory / pdfkit |
| `GET /leases/:id/pdf` | Generated lease PDF | in-memory / pdfkit |
| `GET /invoices/:id/qr` | QR bill PNG | in-memory / qrcode |
| `GET /capture-sessions/:token/upload` | Uploaded capture files | `ATTACHMENTS_LOCAL_ROOT/...` |

**Generated PDFs/PNGs** (pdfkit, qrcode) are built in-memory — these work fine on Render. ✅

**File uploads** currently write to `./uploads/` on local disk. On Render, this directory is **ephemeral** — wiped on every deploy and on instance restart. **All uploaded files would be lost.**

**Required before production:**
- Implement `ATTACHMENTS_STORAGE=s3` path in the file storage service (the code already has `ATTACHMENTS_STORAGE=local | s3` logic stub per the env example)
- Choose a provider: Supabase Storage, AWS S3, or Cloudflare R2
- Set `ATTACHMENTS_STORAGE=s3` and the relevant bucket credentials on Render
- Local dev continues using `ATTACHMENTS_STORAGE=local` — no change to Docker dev workflow

> **This is explicitly deferred from the deployment config scope** per the task constraints ("do not write deployment code yet"), but it is listed as a **hard blocker** for production go-live. Staging can proceed with the understanding that uploaded files will be lost on redeploy.

### 3.12 Upload / OCR Paths

- `POST /maintenance-attachments` — multipart upload → saves to `ATTACHMENTS_LOCAL_ROOT`
- `POST /invoices/ingest` — multipart upload → OCR via Azure DI → saves processed result
- `POST /capture-sessions/:token/upload` — mobile upload path
- `POST /document-scan` — single-file OCR

All write to local disk. Same B1 blocker applies. Azure DI credentials (`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`) must be in Render env vars (not committed to source code — **the current `.env` file has a live API key hardcoded; this must be revoked and replaced with a secret managed via Render's environment panel before the repo is made public or shared**).

### 3.13 Background Jobs / Scheduled Tasks

`server.ts` runs 6 background job types via `setInterval` (default: 1-hour interval):
1. `processSelectionTimeouts` — expire rental application owner selections
2. `processAttachmentRetention` — delete old attachments per retention policy
3. `processSchedulingEscalations` — escalate overdue scheduling requests
4. `flushPendingEmails` — send queued emails via Resend/SMTP
5. `processRecurringBilling` — generate scheduled recurring invoices
6. `processOverdueInvoices` — send overdue notifications
7. `flushLegalVariableIngestion` — ingest external legal variable data

**Render free tier:** Service sleeps after 15 minutes of inactivity, killing all timers. Background jobs will not run on free tier.

**Render paid tier (Starter+):** Service stays active. In-process scheduling works but is fragile — if the server crashes and restarts, the `setInterval` resets and the next run is `BG_JOB_INTERVAL_MS` in the future (up to 1 hour delay).

**Options (in order of increasing reliability):**
1. **Render Cron Jobs** (separate service) — free on Render, calls an HTTP endpoint on the API service. Requires adding a trigger endpoint (e.g. `POST /__internal/run-jobs` with internal auth header).
2. **Keep in-process** on paid Render tier — acceptable for staging and low-traffic production.
3. **External cron** (GitHub Actions scheduled workflow, Upstash QStash) — calls Render API endpoint.

> **Recommendation:** Keep in-process for staging. For production, switch to Render Cron Jobs calling a protected internal endpoint. Document as a pre-production ticket.

### 3.14 Docker-Only Assumptions to Remove or Isolate

These assumptions must be **isolated to dev only** (not present in production env):

| Assumption | Location | Action |
|------------|----------|--------|
| `DATABASE_URL` pointing to `localhost:5432` | `apps/api/.env` | Keep for local dev; replace with Supabase URL on Render |
| `DEV_IDENTITY_ENABLED=true` | `apps/api/.env` | Never set in Render env |
| `AUTH_OPTIONAL=true` (if used in dev) | `.env` / dev only | Never set in Render env |
| `ATTACHMENTS_LOCAL_ROOT=./uploads` | `.env` / dev only | Override with storage provider on Render |
| `DOCUMENT_SCAN_FALLBACK_PROVIDER=local` | `.env` / dev only | Fine to keep as fallback, but primary must be azure |
| `DEV_MANAGER_TOKEN` in `apps/web/pages/_app.js` | Frontend code | Must be gated behind `process.env.NODE_ENV !== 'production'` — verify this before Vercel deploy |

**Unknown requiring verification:** Does `_app.js` gate the `DEV_MANAGER_TOKEN` bootstrap on `NODE_ENV !== 'production'`? If it runs unconditionally, the dev JWT is injected into all production sessions and must be removed.

---

## 4. Supabase Migration Plan

### 4.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Org/project name:** e.g. `maint-agent-staging` and `maint-agent-prod`
3. **Region:** Choose EU (e.g. `eu-central-1` Frankfurt or `eu-west-2` London) to minimize latency with a Render EU region (`Frankfurt` or `London`)
4. Set a strong database password. Store it in a password manager immediately — Supabase does not show it again.
5. Wait for project to provision (~2 minutes).

### 4.2 Region Alignment

| Service | Recommended region |
|---------|--------------------|
| Supabase staging | `eu-central-1` (Frankfurt) |
| Render API staging | Frankfurt (EU Central) |
| Supabase production | same as staging |
| Render API production | Frankfurt (EU Central) |
| Vercel | Global CDN — automatic |

> Keeping Render and Supabase in the same region minimizes DB query latency.

### 4.3 Connection Strings

After creating the project, obtain from Supabase Dashboard → Settings → Database:

| Variable | Value | Used for |
|----------|-------|---------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1` | Prisma Client runtime (PgBouncer pooled) |
| `DIRECT_URL` | `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres` | `prisma migrate deploy`, `prisma generate` |

> **`connection_limit=1`** is required in the pooled URL when using PgBouncer with Prisma to prevent prepared statement conflicts. The Supabase docs recommend `?pgbouncer=true&connection_limit=1`.

### 4.4 Map Environment Variables

**On Render API service (staging and production):**
```
DATABASE_URL=postgresql://postgres:[PWD]@db.[REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres
```

**In `apps/api/prisma/schema.prisma`** (required code change — see §3.8):
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**For local dev:** `DIRECT_URL` can be omitted or set to the same value as `DATABASE_URL` (local Postgres does not need PgBouncer pooling).

### 4.5 Run Migrations

**First-time migration on a fresh Supabase DB:**

```bash
cd apps/api
DIRECT_URL=<supabase_direct_url> \
DATABASE_URL=<supabase_direct_url> \
  npx prisma migrate deploy
```

> Use the **direct URL** (port 5432, no pgbouncer) for the initial migration run. This applies all 82+ pending migrations.

**Subsequent deploys:** Render's start command `npx prisma migrate deploy && node dist/server.js` will apply any new migrations automatically on each deploy.

**Verify after migration:**
```sql
SELECT COUNT(*) FROM "_prisma_migrations" WHERE applied_steps_count > 0;
-- Should match the number of migration directories in apps/api/prisma/migrations/
```

### 4.6 Seed Strategy

| Seed script | Safe for staging? | Safe for production? |
|-------------|------------------|---------------------|
| `npx prisma db seed` (`prisma/seed.ts`) | ✅ Yes — creates default org, seed users, bootstrap data | ⚠️ Only on first deploy; must never re-run against existing production data |
| `node seed-category-mappings.js` | ✅ Yes | ⚠️ Only on first deploy |
| `node seed-test-legal-rule.js` | ✅ Yes (test/staging) | ❌ Never — test data must not reach production |
| `node seed-test-legal-rule.js` | ❌ Never against prod | ❌ Never |

**Staging seed procedure (one-time, after migrate deploy):**
```bash
cd apps/api
DATABASE_URL=<supabase_direct_url> npx prisma db seed
DATABASE_URL=<supabase_direct_url> node seed-category-mappings.js
# Do NOT run seed-test-legal-rule.js on staging — it creates test legal data
```

**Production seed procedure:** Same as staging minus `seed-test-legal-rule.js`. Requires **explicit manual approval** before running.

### 4.7 Data Migration from Local Dev Postgres

If existing dev data must be moved to Supabase staging:

```bash
# 1. Dump from local Docker Postgres
docker exec maint_agent_pg pg_dump \
  -U postgres \
  --no-owner \
  --no-acl \
  -F c \
  maint_agent \
  > dev_data_$(date +%Y%m%d).dump

# 2. Restore to Supabase (using direct URL)
pg_restore \
  --no-owner \
  --no-acl \
  -d "postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres" \
  dev_data_$(date +%Y%m%d).dump

# 3. Validation queries
psql "postgresql://..." -c "SELECT COUNT(*) FROM \"User\";"
psql "postgresql://..." -c "SELECT COUNT(*) FROM \"Request\";"
psql "postgresql://..." -c "SELECT COUNT(*) FROM \"Building\";"
```

> **Requires explicit approval** before running against production. The dump/restore approach is for dev→staging data migration only; production data never originates from a local dump.

### 4.8 Rollback Snapshot

Before any production migration:
1. Take a Supabase backup: Dashboard → Database → Backups → Take backup
2. Note the timestamp of the last clean state
3. Point-in-time recovery is available on Supabase Pro plan (not free tier)

**Recommendation:** Use Supabase Pro for production to enable PITR.

### 4.9 Connection Pooling

Supabase free tier has a PgBouncer pool. Key settings:

| Parameter | Recommended value | Reason |
|-----------|-------------------|--------|
| `?pgbouncer=true` | Required in pooled URL | Tells Prisma not to use prepared statements |
| `connection_limit=1` | Required in pooled URL | Prevents Prisma from opening multiple connections per worker |
| Supabase pool size | Default (15 on free tier) | Sufficient for single Render instance |

For production with multiple Render instances, increase the pool size in Supabase settings.

### 4.10 Backup and Recovery Recommendations

| Tier | Backup capability |
|------|------------------|
| Supabase Free | Daily backups, 7-day retention |
| Supabase Pro | Daily + PITR (7 days), on-demand backups |
| Production recommendation | **Supabase Pro** — PITR is required for a financial data platform |

---

## 5. Render API Deployment Plan

### 5.1 Service Type

**Render Web Service** — not a Background Worker or Cron Job.

| Setting | Value |
|---------|-------|
| Service type | Web Service |
| Region | Frankfurt (EU Central) |
| Root directory | `apps/api` |
| Runtime | Node |
| Node version | 20 (matches CI: `node-version: '20'`) |

### 5.2 Build and Start Commands

```yaml
# Render service settings
Build command:  npm install && npx prisma generate && npm run build
Start command:  npx prisma migrate deploy && node dist/server.js
```

**Why `prisma generate` in build:** The TypeScript compiler needs the generated Prisma client types to succeed. Without it, `tsc` fails.

**Why `migrate deploy` in start:** Ensures schema is current before the server accepts traffic. `migrate deploy` is idempotent — if no new migrations exist, it exits in <1 second.

**`npm run build`** resolves to `tsc -p tsconfig.json` per `apps/api/package.json`.

### 5.3 Required Environment Variables on Render

```bash
# Runtime
NODE_ENV=production
PORT=<injected by Render>

# Database
DATABASE_URL=<supabase_pooled_url>
DIRECT_URL=<supabase_direct_url>

# Auth — REQUIRED, server refuses to start without
AUTH_SECRET=<32+ char random secret>
AUTH_OPTIONAL=false
DEV_IDENTITY_ENABLED=false

# CORS — set to Vercel frontend URL
CORS_ORIGIN=https://maint-agent-staging.vercel.app   # staging
# CORS_ORIGIN=https://app.maint-agent.com            # production

FRONTEND_URL=https://maint-agent-staging.vercel.app  # staging
# FRONTEND_URL=https://app.maint-agent.com           # production

# File storage
ATTACHMENTS_STORAGE=local   # TEMPORARY for staging; replace with s3 before production
ATTACHMENTS_LOCAL_ROOT=/tmp/uploads   # ephemeral — files lost on redeploy

# Document scanning
DOCUMENT_SCAN_PROVIDER=azure
DOCUMENT_SCAN_FALLBACK_PROVIDER=local
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://maintenance-agent-docintel.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<secret — set via Render env panel, never commit>

# Email
RESEND_API_KEY=<secret>
EMAIL_FROM_ADDRESS=noreply@maint-agent.com

# Background jobs
BG_JOBS_ENABLED=true
BG_JOB_INTERVAL_MS=3600000

# Timeouts
REQUEST_TIMEOUT_MS=30000
OVERDUE_GRACE_HOURS=24

# Leave these unset or explicitly false:
# ALLOW_OWNER_REGISTRATION=false
# DEV_ORG_ID=<unset>
```

### 5.4 PORT Behavior

`server.ts:74` already reads `process.env.PORT`. Render injects `PORT` automatically. **No code change needed.** ✅

### 5.5 Node Version

CI uses Node 20. Set Render to Node 20 via the service settings or by adding a `.node-version` or `.nvmrc` file in `apps/api/` with content `20`.

### 5.6 Prisma Generate During Build

Must run before `tsc`. Current `npm run build` only runs `tsc`. Build command must be:
```
npm install && npx prisma generate && npm run build
```
This ensures the Prisma client is generated in the Render build environment before TypeScript compilation.

### 5.7 Migrate Deploy as Pre-Deploy Step

`npx prisma migrate deploy` runs in the start command, before `node dist/server.js`. This is safe because:
- Render does a rolling deploy (new instance starts before old is stopped)
- `migrate deploy` is idempotent and fast when no new migrations exist
- If migration fails, the new instance does not serve traffic — Render keeps the old one

> **Alternative for teams that want more control:** Run `migrate deploy` manually via Render Shell before deploying a new schema, then deploy the code. This gives a clear separation of "migration window" from "code deploy."

### 5.8 Health Check Path

**Add a `/health` endpoint** (required for Render zero-downtime deploys):

Configure in Render service settings:
- **Health check path:** `/health`
- **Health check timeout:** 30s (matches `REQUEST_TIMEOUT_MS`)

The endpoint must return HTTP 200. Suggested response:
```json
{ "status": "ok", "uptime": 42.5 }
```

Files to change:
- `apps/api/src/server.ts` — add before `router.dispatch`: a fast path for `GET /health` that bypasses auth and returns 200 immediately.

### 5.9 Logs and Smoke Checks Post-Deploy

After each Render deploy:
1. Check Render logs for `API running on http://localhost:<PORT>`
2. Check Render logs for `[BG-JOBS] Scheduler started`
3. Check no `[FATAL]` or `[UNCAUGHT EXCEPTION]` log lines
4. Run smoke curl from local machine:
   ```bash
   curl -sf https://maint-agent-api-staging.onrender.com/health
   ```

### 5.10 Scaling / Concurrency

- Render free tier: 1 instance, sleeps after 15 min inactivity
- Render Starter ($7/mo): 1 instance, always on, 0.5 CPU / 512 MB RAM
- Render Standard ($25/mo): 1 instance, 1 CPU / 2 GB RAM
- Horizontal scaling: Render supports multiple instances on paid plans; in-process background jobs would run on each instance (duplicate processing). For production, externalize background jobs (§3.13) before scaling horizontally.

**Recommendation:** Starter tier for staging, Standard tier for production.

### 5.11 Rollback Approach

- Render keeps the last N deploys in the dashboard.
- Manual rollback: Render dashboard → service → "Deploy" tab → click "Re-deploy" on a previous successful deploy.
- If a schema migration was applied, rolling back the code does not roll back the schema — see §11 (Rollback Plan).

---

## 6. Vercel Web Deployment Plan

### 6.1 Project Settings

| Setting | Value |
|---------|-------|
| Root directory | `apps/web` |
| Framework preset | Next.js (auto-detected) |
| Node.js version | 20.x |
| Install command | `npm install` (within `apps/web`) |
| Build command | `next build` |
| Output directory | `.next` (default) |

### 6.2 Install / Build Commands

Vercel should be pointed at `apps/web` as the root directory. If using a monorepo setup where Vercel runs from the repo root, use:
```
Install: cd apps/web && npm install
Build:   cd apps/web && npm run build
```
Or set `Root Directory = apps/web` in Vercel project settings (simpler).

### 6.3 Required Environment Variables on Vercel

**Server-side only (not exposed to browser):**
```bash
API_BASE_URL=https://maint-agent-api-staging.onrender.com   # staging
# API_BASE_URL=https://api.maint-agent.com                  # production
```

**Currently no `NEXT_PUBLIC_*` variables are used** (confirmed: `proxyToBackend()` reads `API_BASE_URL` server-side only; no direct browser→API calls observed). Verify before first deploy by searching for `NEXT_PUBLIC_` in `apps/web/`.

**If `DEV_MANAGER_TOKEN` is gated in `_app.js`** (requires verification):
```bash
# No additional vars needed for auth bootstrap
```

If `DEV_MANAGER_TOKEN` is NOT gated, a code change is required before deploying to Vercel.

### 6.4 Preview vs Production Environment Variables

| Variable | Preview | Production |
|----------|---------|------------|
| `API_BASE_URL` | `https://maint-agent-api-staging.onrender.com` | `https://api.maint-agent.com` |
| `NODE_ENV` | `production` (Vercel default for preview builds) | `production` |

Vercel allows setting environment variables per environment (Development / Preview / Production) in the dashboard.

### 6.5 Proxy Behavior Verification

After Vercel deploy, verify `proxyToBackend()` works end-to-end:

```bash
# From browser (or curl with a valid session cookie/JWT):
curl -H "Authorization: Bearer <token>" \
  https://maint-agent-staging.vercel.app/api/requests?limit=1
# Should return 200 with JSON (proxied from Render)

# Check response headers include X-API-Source or forwarded status codes
```

Key things to verify:
- Binary responses (PDFs) are forwarded correctly through `proxyToBackend()`
- Auth headers are forwarded (not stripped by Vercel edge)
- Status codes (401, 403, 404) are forwarded as-is

### 6.6 Domain / Cutover Steps

1. Staging: use auto-generated `*.vercel.app` URL — no DNS change
2. Production cutover: add custom domain in Vercel dashboard → Vercel provides DNS records (CNAME or A) → update DNS with registrar → wait for propagation (TTL-dependent, typically 5–30 min)
3. Update `CORS_ORIGIN` on Render and `FRONTEND_URL` on Render to the custom domain after DNS cutover
4. Test everything again with the new domain

### 6.7 Build / Lint / Typecheck Gates

CI already runs `next build` and `tsc --noEmit` on `apps/web`. These are sufficient gates. Vercel also runs `next build` on every PR as a preview deploy — which provides an additional build gate for free.

Note: `next lint` was removed from CI (comment in `ci.yml`: "next lint was removed in Next.js 16"). If linting is desired, run `eslint apps/web/pages apps/web/components` as a separate CI step.

---

## 7. CI/CD Changes

The existing `.github/workflows/ci.yml` is largely compatible. Required changes:

### 7.1 Keep As-Is (All 7 Gates)

- Guardrails enforcement (`scripts/guardrails.sh`)
- `prisma generate`
- Schema drift check (`prisma migrate deploy` + `migrate diff`)
- `G11: Seed test database`
- Backend typecheck (`tsc --noEmit`)
- Frontend build (`next build`)
- Frontend typecheck (`tsc --noEmit`)
- Jest tests (`--ci --forceExit`)
- Backend boot + smoke curls

### 7.2 Required Additions

**Add `DIRECT_URL` env var to CI** (once §3.8 schema change is made):
```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/maint_agent_test
  DIRECT_URL: postgresql://postgres:postgres@localhost:5432/maint_agent_test
  NODE_ENV: test
```
(For the CI test DB, `DIRECT_URL` = `DATABASE_URL` — same local Postgres, no PgBouncer.)

**Add production env validation step** — verify that critical vars are present when `NODE_ENV=production`:
```yaml
- name: "Validate production env requirements"
  run: |
    # Simulate production boot guard — ensure it fires correctly
    NODE_ENV=production AUTH_OPTIONAL=true node -e "require('./dist/server.js')" 2>&1 | \
      grep -q "FATAL.*AUTH_OPTIONAL" && echo "✅ Boot guard fires on AUTH_OPTIONAL=true" || exit 1
    NODE_ENV=production node -e "require('./dist/server.js')" 2>&1 | \
      grep -q "FATAL.*AUTH_SECRET" && echo "✅ Boot guard fires on missing AUTH_SECRET" || exit 1
  working-directory: apps/api
```

**Keep `db push` ban in guardrails script.** The `scripts/guardrails.sh` already checks for `db push` — verify it covers CI scripts and new deployment config files.

**Optionally: add smoke test against Render staging** as a post-deploy CI step (separate workflow, triggered on merge to `main`, runs after Render deploy completes):
```yaml
# .github/workflows/post-deploy-smoke.yml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
jobs:
  smoke:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - run: curl -sf ${{ secrets.RENDER_API_URL }}/health
      - run: curl -sf -H "Authorization: Bearer ${{ secrets.SMOKE_TOKEN }}" \
               ${{ secrets.RENDER_API_URL }}/requests?limit=1
```

### 7.3 Ensure These Remain Banned

- `prisma db push` — already in `scripts/guardrails.sh`
- Deployment-triggered `migrate reset` — never in any CI script
- Seed scripts running against production — seed scripts must not be called in the deploy pipeline; only in the one-time staging setup

---

## 8. Security & Auth Checklist

| Check | Status | Action |
|-------|--------|--------|
| `AUTH_OPTIONAL=false` in production | ✅ enforced by boot guard | Set `AUTH_OPTIONAL=false` (or leave unset) on Render |
| `AUTH_SECRET` must be set | ✅ enforced by boot guard | Generate a 32+ char random string; set on Render as a secret env var |
| `DEV_IDENTITY_ENABLED` must not be `true` | ✅ enforced by boot guard | Do not set on Render; leave unset |
| CORS restricted to frontend origin | ⚠️ defaults to `"*"` if `CORS_ORIGIN` unset and non-prod — production uses empty (which blocks all) | Set `CORS_ORIGIN` on Render to exact Vercel URL |
| Allowed frontend origins | ⚠️ single-origin only | If Vercel preview deploys need CORS access, extend the CORS handler to support a list/regex |
| Secrets in Render / Vercel / Supabase | Manual | Use platform secret management — never commit secrets |
| No secrets committed | ⚠️ `.env` currently has a live Azure DI key | Revoke the committed key; rotate it immediately; add `.env` to `.gitignore` verification |
| Dev JWT / token assumptions removed from production | ⚠️ `DEV_MANAGER_TOKEN` in `_app.js` | Verify the bootstrap code is gated on `NODE_ENV !== 'production'` |
| Production CORS: `FRONTEND_URL` set for QR bills | Required | Set `FRONTEND_URL` on Render to the Vercel production URL |
| Supabase DB password | Manual | Use a strong (32+ char) random password; store in password manager |
| Supabase row-level security | Not used (auth is at API layer) | Document that RLS is intentionally disabled — auth enforcement is at the API layer |

**Immediate action required: revoke the Azure DI key** currently in `apps/api/.env`:
- Go to Azure Portal → Cognitive Services → `maintenance-agent-docintel` → Keys → Regenerate Key 1
- Update the new key in Render's environment variables
- Do not commit the new key to source

---

## 9. Verification Plan

### 9.1 Staging Verification (After First Deploy)

Run these checks manually or via automated smoke script:

**API health:**
```bash
curl -sf https://maint-agent-api-staging.onrender.com/health
# Expected: 200 { "status": "ok" }
```

**Authenticated API endpoints:**
```bash
TOKEN=$(curl -s -X POST https://maint-agent-api-staging.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@local.dev","password":"..."}' | jq -r '.token')

curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/requests?limit=1"
# Expected: 200, JSON with data array

curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/leases?limit=1"
# Expected: 200

curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/jobs?limit=1"
# Expected: 200

curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/invoices?limit=1"
# Expected: 200
```

**Frontend proxy calls (through Vercel):**
```bash
# All of these should proxy through Vercel → Render → Supabase
curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-staging.vercel.app/api/requests?limit=1"
# Expected: same as direct Render call
```

**PDF / binary endpoints:**
```bash
# Requires an existing lease/invoice ID
curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/leases/<ID>/pdf" \
  -o /tmp/test.pdf && file /tmp/test.pdf
# Expected: PDF document

curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/invoices/<ID>/qr" \
  -o /tmp/test.png && file /tmp/test.png
# Expected: PNG image
```

**Invoice / QR endpoints:**
```bash
curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/invoices/<ID>/pdf" \
  -o /tmp/invoice.pdf
```

**File upload / OCR path:**
```bash
curl -sf -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-invoice.pdf" \
  "https://maint-agent-api-staging.onrender.com/invoices/ingest"
# Expected: 201 with ingestionStatus field
# Note: file upload to local disk on staging — will not persist across deploys
```

**Frontend login / session flow:**
1. Open `https://maint-agent-staging.vercel.app` in browser
2. Log in with manager credentials
3. Navigate to Requests, Leases, Jobs hub pages
4. Verify data loads (API proxy working)
5. Navigate to a detail page; verify all related data renders

**Auth failure test:**
```bash
curl -sf "https://maint-agent-api-staging.onrender.com/requests?limit=1"
# Expected: 401 { "error": "UNAUTHORIZED" }

curl -sf -H "Authorization: Bearer invalid-token" \
  "https://maint-agent-api-staging.onrender.com/requests?limit=1"
# Expected: 401
```

**Mobile / responsive smoke pages:**
- Open on a mobile device (or Chrome DevTools mobile simulation):
  - `/manager/requests` — tab strip should use ScrollableTabs
  - `/owner/index` — KpiInlineGrid should render
  - `/manager/leases` — dual-render table (card list on mobile, table on desktop)

### 9.2 Production Verification

Repeat all staging checks against production URLs after cutover. Additionally:

- Verify custom domain resolves correctly (`dig app.maint-agent.com`)
- Verify HTTPS certificate is valid
- Verify `CORS_ORIGIN` is set to the production custom domain
- Verify `FRONTEND_URL` on Render matches the production URL (affects QR bill links)
- Verify background jobs run at the next hourly interval (check Render logs)

---

## 10. Cutover Plan

### 10.1 Order of Operations

1. **Staging deployment** (see §5, §6, §4.5): deploy to staging, run verification (§9.1), fix any issues. Do not proceed until staging is fully green.

2. **Production database setup:**
   - Create Supabase production project
   - Run `prisma migrate deploy` against production Supabase (using `DIRECT_URL`)
   - Run seed scripts (excluding `seed-test-legal-rule.js`) — **explicit approval required**
   - (If migrating live data) Run `pg_dump` / `pg_restore` — **explicit approval required**
   - Validate row counts match expectations

3. **Production Render deploy:**
   - Create Render production Web Service
   - Set all required env vars (§5.3) pointing to production Supabase
   - Trigger first deploy
   - Verify `/health` returns 200
   - Verify smoke curls pass

4. **DNS / domain switch:**
   - Add custom domain to Vercel
   - Add DNS record (CNAME/A) in DNS provider
   - Wait for propagation
   - Verify HTTPS certificate is issued by Vercel (automatic via Let's Encrypt)
   - Test the custom domain in a browser

5. **Update Render env vars post-cutover:**
   - `CORS_ORIGIN` → `https://app.maint-agent.com`
   - `FRONTEND_URL` → `https://app.maint-agent.com`
   - Trigger Render redeploy (no code change needed — just env var update)

6. **Monitoring window (minimum 24 hours):**
   - Monitor Render logs for errors
   - Monitor Supabase Dashboard → Reports for query volumes and errors
   - Check background job logs at next hourly interval
   - Watch for any CORS errors in browser console
   - Watch for any 5xx errors in Vercel function logs

### 10.2 Database Migration Window

For the initial migration on a fresh Supabase DB, no migration window is needed (no live traffic yet). The first deploy IS the migration.

For future schema migrations during production operation:
- Run `migrate deploy` as part of the Render start command (existing approach — additive migrations are safe with rolling deploy)
- For destructive migrations: schedule a maintenance window, disable Render auto-deploy, run migration manually, then re-enable

---

## 11. Rollback Plan

### 11.1 Vercel Rollback

- Vercel preserves all previous deployments.
- Instant rollback: Vercel Dashboard → Deployments → click "..." on previous deploy → "Promote to Production"
- DNS is not changed — the custom domain simply starts serving the previous build.

### 11.2 Render Rollback

- Render preserves recent deploys.
- Manual rollback: Render Dashboard → Service → Deploys tab → select previous successful deploy → "Re-deploy"
- The rollback is instant at the application level; the old binary starts serving new traffic.

### 11.3 Database Rollback / Snapshot Constraints

**This is the hardest part.** Schema migrations are not automatically reversible.

| Scenario | Rollback possible? | Approach |
|----------|-------------------|---------|
| Code-only deploy (no new migrations) | ✅ Yes | Roll back Render/Vercel; DB unchanged |
| Additive migration (new nullable column) | ⚠️ Partial | Old code ignores new column; rollback code is safe. Column remains but unused. |
| Breaking migration (column removed, renamed, type changed) | ❌ No safe rollback | Must have a pre-migration Supabase backup. Restore from backup — causes data loss for writes since backup. |
| First production migration (fresh DB from seed) | ✅ Easy | Just wipe and re-seed (no real user data yet) |

**Rule:** Never deploy a breaking migration to production without a fresh Supabase backup taken immediately before. The Render start command runs `migrate deploy` — if this includes a breaking migration, rollback requires restoring the DB snapshot.

**What cannot be safely rolled back after schema migrations:**
- Any data written by the new schema version after the migration was applied
- If a column was removed and new records written, restoring the old schema means those records have invalid shape

### 11.4 Revert API_BASE_URL

If the Vercel frontend must be reverted to point to a different API:
- Update `API_BASE_URL` in Vercel environment variables
- Trigger a Vercel redeploy (or the new value takes effect on next build)

### 11.5 Emergency: Revert to Local Dev Only

If all production services are unstable:
1. Roll back Vercel to previous deploy
2. Roll back Render to previous deploy
3. If DB is corrupt: restore Supabase backup (data loss window = time since backup)
4. For immediate relief: the local Docker dev environment remains untouched throughout — the dev team can continue working locally without any production dependency

---

## 12. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | **Prisma + PgBouncer: prepared statement conflict** | Medium | High | Use `?pgbouncer=true&connection_limit=1` in `DATABASE_URL`; set `directUrl` for migrations. Already documented in §3.8. |
| R2 | **Migration drift between dev and Supabase** | Low | High | CI already runs `migrate deploy` + drift check on every PR. Shadow DB replay is clean (G8 exception retired 2026-03-31). |
| R3 | **Production auth misconfiguration** (`AUTH_OPTIONAL=true` or no `AUTH_SECRET`) | Low | Critical | Server refuses to boot (F1 guard). Will surface immediately in Render startup logs. |
| R4 | **CORS failure blocking all browser-to-API calls** | Medium | High | `CORS_ORIGIN` must be set before production. Test with browser network tab during staging verification. |
| R5 | **Binary / PDF forwarding broken through Vercel proxy** | Medium | High | `proxyToBackend()` (F3 guardrail) forwards binary content. Test PDF/PNG endpoints during staging (§9.1). Vercel serverless functions have a 4.5 MB response body limit — large PDFs could fail. |
| R6 | **File storage: uploads lost on Render redeploy** | High (certainty) | High | Acknowledged as blocking gap B1. Staging: acceptable with warning. Production: requires S3/object storage before go-live. |
| R7 | **Seed script runs against production DB** | Low (process) | Critical | Seed scripts are manual steps; never in CI pipeline; require explicit approval per G6. |
| R8 | **Render cold starts / free tier sleep** | High (free tier) | Medium | Use Render Starter ($7/mo) for staging to keep service awake. Background jobs need always-on service. |
| R9 | **Vercel preview environment mismatch** | Medium | Low | Preview deploys use the same `API_BASE_URL` as staging — preview UI hits staging API. Acceptable for now. Document this to avoid confusion. |
| R10 | **Long-running API assumptions (background jobs)** | Medium | Medium | In-process `setInterval` is fine on Render Starter+ (always-on). Risk on free tier. Externalize to Render Cron before horizontal scaling. |
| R11 | **Azure DI key committed to `.env`** | High (exists now) | High | Revoke and rotate immediately. Set new key only in Render env panel. Never commit `.env` to a public repo. |
| R12 | **`DEV_MANAGER_TOKEN` in `_app.js` running in production** | Unknown | High | Verify that `_app.js` gates the bootstrap on `NODE_ENV !== 'production'`. If not, add the gate before deploying. |
| R13 | **Vercel response size limit for large PDFs** | Unknown | Medium | Vercel serverless function response limit is 4.5 MB (Hobby) or 6 MB (Pro). Lease/invoice PDFs must be tested. If exceeded, serve PDFs directly from Render (skip proxy for those endpoints). |
| R14 | **Sharp / Tesseract.js native binary compilation on Render Linux** | Medium | Medium | `sharp` and `tesseract.js` use native addons. Render builds on Linux x86_64 — should compile correctly, but `npm install` build step must complete without errors. Verify in first Render build. |
| R15 | **Supabase free tier connection pool exhaustion** | Low (single instance) | Medium | Free tier: 15 PgBouncer connections. With `connection_limit=1` in URL, Prisma uses 1 connection per Node process. Fine for single Render instance. |

---

## 13. Implementation Tickets

Break the migration into these atomic tickets. Each can be merged independently without breaking local dev.

Tickets are grouped by gate (see §0.1). Gate 1 tickets are safe to execute regardless of in-progress UI or feature work. Gate 2 tickets require feature completeness and staging sign-off first.

---

## Gate 1 — Infrastructure Setup (start now, UI-state independent)

---

### T-01: Audit & Pre-Flight (1–2 days)

**Goal:** Confirm all unknowns before writing deployment code.

Tasks:
- [ ] Read `apps/web/pages/_app.js` — verify `DEV_MANAGER_TOKEN` bootstrap is gated on `NODE_ENV !== 'production'`
- [ ] Read `apps/web/lib/proxy.js` — confirm binary forwarding behavior (response size, Content-Type handling)
- [ ] Search `apps/web/` for any `NEXT_PUBLIC_` variable usage
- [ ] Verify `authz.ts` `isAuthOptional()` — understand when it returns true (needed to understand CI smoke test behavior)
- [ ] Confirm `apps/api/src/server.ts` CORS handler will work with a single-value `CORS_ORIGIN`; assess preview deploy CORS strategy
- [ ] Revoke the committed Azure DI key; rotate it in Azure Portal; note the new key for Render env
- [ ] Confirm Node 20 is sufficient for all native deps (`sharp`, `tesseract.js`, `pdfkit`)
- [ ] Decide on object storage provider for B1 (Supabase Storage, S3, or R2)

Files to read: `apps/web/pages/_app.js`, `apps/web/lib/proxy.js`, `apps/api/src/authz.ts`

---

### T-02: Schema Change — Add `directUrl` to Prisma Datasource (0.5 days)

**Goal:** Unblock Supabase connection pooling compatibility.

Tasks:
- [ ] Add `directUrl = env("DIRECT_URL")` to `datasource db {}` in `apps/api/prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name add-direct-url-datasource` (expected: empty migration)
- [ ] Run `npx prisma generate`
- [ ] Run drift check — must be empty
- [ ] Update `apps/api/.env.example` to document `DIRECT_URL`
- [ ] Update CI `ci.yml` to add `DIRECT_URL` env var (= same as `DATABASE_URL` for CI test DB)
- [ ] Commit, push, verify CI passes

**Files changed:**
- `apps/api/prisma/schema.prisma` (+1 line)
- `apps/api/prisma/migrations/<timestamp>_add-direct-url-datasource/migration.sql` (empty body)
- `apps/api/.env.example` (+1 line)
- `.github/workflows/ci.yml` (+1 env line)

---

### T-03: Add `/health` Endpoint (0.5 days)

**Goal:** Enable Render zero-downtime deploys and health monitoring.

Tasks:
- [ ] Add `GET /health` route to `apps/api/src/server.ts` (before `router.dispatch`, no auth required)
- [ ] Return `{ "status": "ok", "uptime": process.uptime() }`
- [ ] Add a test in an appropriate test file (or extend `helpers.test.ts`)
- [ ] Commit, push, verify CI passes

**Files changed:**
- `apps/api/src/server.ts` (+~10 lines)

---

### T-04: API Production Readiness Config (1 day)

**Goal:** Ensure the API can run in production without local dev assumptions.

Tasks:
- [ ] Verify `apps/web/pages/_app.js` — if `DEV_MANAGER_TOKEN` is not gated on `NODE_ENV !== 'production'`, add the gate
- [ ] Verify CORS handler supports the required origin format for Vercel
- [ ] Add `.nvmrc` or `.node-version` file in `apps/api/` with `20` to pin Node version on Render
- [ ] Test `npm run build` (`tsc`) passes cleanly
- [ ] Commit, push, verify CI passes

**Files potentially changed:**
- `apps/web/pages/_app.js` (conditional gate on DEV_MANAGER_TOKEN, if needed)
- `apps/api/.nvmrc` (new file, 1 line: `20`)

---

### T-05: Supabase Staging Database ✅ COMPLETE (2026-05-xx)

**Goal:** Provision the staging database and verify migration history is clean.

Tasks:
- [x] Create Supabase project `maint-agent-staging` in EU Central (project ID: `znsdygeodyglbyunitcp`, Frankfurt)
- [x] Copy connection strings from Supabase dashboard
- [x] Run `prisma migrate deploy` against Supabase staging — 84 migrations applied
- [x] Verify `_prisma_migrations` table — all migrations applied
- [ ] Run staging seed (prisma db seed + seed-category-mappings.js) — deferred
- [ ] Validate with spot queries — deferred
- [x] Store `DATABASE_URL` and `DIRECT_URL` in Render environment (not in source)

**No code changes** — this is platform setup only.

> **Connection strings:**
> - Direct (migrations): `postgresql://postgres:***@db.znsdygeodyglbyunitcp.supabase.co:5432/postgres`
> - Pooler (runtime): `postgresql://postgres.znsdygeodyglbyunitcp:***@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

---

### T-06: Render Staging API Service ⚠️ BUILD PASSING — STARTUP BLOCKED (2026-05-xx)

**Goal:** Deploy the API to Render staging and verify it starts and serves.

Tasks:
- [x] Create Render Web Service (EU Central)
- [x] Set build command: `cd apps/api && npm ci && npx prisma generate --schema ./prisma/schema.prisma && npm run build`
- [x] Set start command: `cd apps/api && node dist/server.js`
- [x] Set all required env vars (see §5.3 — full list in conversation summary)
- [x] Configure health check path: `/health`
- [x] Build succeeds — `tsc` compiles cleanly
- [ ] **BLOCKER:** Startup fails — Prisma can't reach Supabase on port 5432 from Render. Fix: change `DATABASE_URL` env var in Render dashboard to the **pooler URL (port 6543)** and add `DIRECT_URL` = direct port-5432 URL. See note below.
- [ ] Verify `/health` returns 200 (blocked)
- [ ] Verify auth-gated endpoints return 401 without token (blocked)

> **⚠️ Fix required — Render startup blocker:**
> Render's outbound connections to Supabase port 5432 are blocked. Switch `DATABASE_URL` in Render env to the Transaction Pooler URL:
> `postgresql://postgres.znsdygeodyglbyunitcp:***@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
> Keep `DIRECT_URL` = direct connection (port 5432) — used by Prisma for migrations only.
> In `apps/api/prisma/schema.prisma`, ensure `directUrl = env("DIRECT_URL")` is present (added in T-02).

**`apps/api/tsconfig.json` changes applied for Render compatibility:**
- `"strict": false, "noImplicitAny": false, "strictNullChecks": false` added
- `"rootDir": "./src"` added
- `"baseUrl"` removed
- `"src/__tests__"` added to `exclude`
- Committed to `main` (commit `27c2d46`)

---

### T-07: Vercel Staging Web Service ✅ COMPLETE (2026-05-xx)

**Goal:** Deploy the frontend to Vercel staging and verify proxy works end-to-end.

Tasks:
- [x] Create Vercel project — `rootDirectory` set to `apps/web` in Vercel dashboard (not in `vercel.json` — schema validation blocks it)
- [x] `vercel.json` at repo root contains only `{ "framework": "nextjs" }`
- [x] Trigger first deploy — HTTP 200 confirmed at `https://maintenance-agent-api-git-main-christophepians-projects.vercel.app`
- [x] Vercel Deployment Protection (SSO wall) disabled in Project Settings
- [ ] Set `API_BASE_URL` env var pointing to Render staging URL — pending Render T-06 fix
- [ ] End-to-end proxy test — pending T-06
- [ ] PDF endpoint test — pending T-06

**Fixes applied during T-07:**
- Removed `rootDirectory` from `vercel.json` (Vercel schema v1 rejects it; must be set in dashboard)
- Fixed JSX syntax error in `apps/web/pages/manager/leases/[id].js` — double `}}` after comment on line 865

---

### T-08: CI Updates (0.5 days) — NOT STARTED

**Goal:** Tighten CI to validate production readiness.

Tasks:
- [ ] Add `DIRECT_URL` env var to CI (from T-02 — may already be done)
- [ ] Add production boot guard validation step (§7.2)
- [ ] Verify guardrails script covers any new deployment config files
- [ ] (Optional) Add post-deploy smoke workflow (§7.2)
- [ ] Commit, push, verify CI passes

**Files changed:**
- `.github/workflows/ci.yml`
- (optional) `.github/workflows/post-deploy-smoke.yml` (new file)

---

## Gate 2 — Production Launch (after UI stabilises)

Do not start Gate 2 until: (a) all Gate 1 tickets are merged, (b) T-UI sign-off is complete, and (c) staging has been verified end-to-end.

---

### T-UI: Feature Completeness Sign-Off (no time estimate — product decision)

**Goal:** Confirm the product is ready for real users before production cutover. This is the explicit gate between staging infrastructure and production launch.

Tasks:
- [ ] Owner portal additions are complete and signed off (in-progress features visible in current `git status`: `apps/web/pages/owner/index.js`)
- [ ] `apps/web/pages/manager/dashboard-v2.js` is either shipped or explicitly deferred/hidden
- [ ] In-progress manager pages are stable: `finance/index.js`, `inventory.js`, `settings.js`
- [ ] All 4 persona portals reviewed on Vercel staging (Manager, Contractor, Tenant, Owner) — no blocking UX issues
- [ ] Any partially-built surface is either feature-flagged, hidden behind a route guard, or explicitly accepted as-is for launch
- [ ] Product owner sign-off given in writing before T-09 begins

**Note:** This ticket has no code changes. It is a product decision checkpoint, not an engineering one.

---

### T-09: Staging Verification Sign-Off (1 day)

**Goal:** Full end-to-end staging verification before production cutover.

Tasks:
- [ ] Run full verification checklist from §9.1
- [ ] Test all 4 persona portals (Manager, Contractor, Tenant, Owner)
- [ ] Test PDF/QR endpoints
- [ ] Test file upload (with expectation that files are lost on redeploy — document this limitation)
- [ ] Test auth failure paths
- [ ] Test CORS from browser
- [ ] Test mobile/responsive pages on a real device or DevTools
- [ ] Sign off on all items — no production cutover until all pass

---

### T-10: Production Cutover (2 days, spread over a window)

**Goal:** Move production traffic to Vercel + Render + Supabase.

Tasks:
- [ ] Create Supabase production project
- [ ] Run production migrations — **explicit approval required**
- [ ] Run production seed (minus test scripts) — **explicit approval required**
- [ ] Optionally: `pg_dump` / `pg_restore` dev data to production — **explicit approval required**
- [ ] Create Render production service with production env vars
- [ ] Create Vercel production project with production env vars
- [ ] Verify production services are healthy before DNS change
- [ ] Add custom domain to Vercel → update DNS → wait for propagation
- [ ] Update `CORS_ORIGIN` and `FRONTEND_URL` on Render production → redeploy
- [ ] Run production smoke tests (§9.2)
- [ ] Begin 24-hour monitoring window

---

### T-11: Post-Cutover Monitoring and Documentation (1 day)

**Goal:** Confirm production stability; document the new dev workflow.

Tasks:
- [ ] Monitor Render logs for 24 hours post-cutover
- [ ] Confirm background jobs ran at least once (check hourly interval)
- [ ] Check Supabase query logs for errors
- [ ] Check Vercel function logs for 5xx errors
- [ ] Update `docs/DEV_COMMANDS.md` to document new staging/production URLs
- [ ] Update `PROJECT_STATE.md` to note deployment state
- [ ] File a ticket for B1 (object storage) if not resolved before production

---

## Appendix A: Files Expected to Change

| File | Change | Ticket |
|------|--------|--------|
| `apps/api/prisma/schema.prisma` | Add `directUrl = env("DIRECT_URL")` | T-02 |
| `apps/api/prisma/migrations/<timestamp>/migration.sql` | Empty migration for directUrl | T-02 |
| `apps/api/.env.example` | Add `DIRECT_URL` documentation | T-02 |
| `apps/api/.nvmrc` | New file: `20` | T-04 |
| `apps/api/src/server.ts` | Add `GET /health` route | T-03 |
| `apps/web/pages/_app.js` | Gate `DEV_MANAGER_TOKEN` on `NODE_ENV !== 'production'` (if needed — verify first) | T-04 |
| `.github/workflows/ci.yml` | Add `DIRECT_URL` env, production guard test | T-08 |
| `.github/workflows/post-deploy-smoke.yml` | New optional smoke workflow | T-08 |

> **No changes** to: `apps/web/next.config.js`, `infra/docker-compose.yml`, `apps/web/lib/proxy.js` (unless binary forwarding issues found in T-01), route files, workflow files, repository files, schema models, or test files.

---

## Appendix B: Complete Env Var Reference by Platform

### Render API (staging)

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[PWD]@db.[STAGING_REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:[PWD]@db.[STAGING_REF].supabase.co:5432/postgres
AUTH_SECRET=<random 32+ chars>
AUTH_OPTIONAL=false
DEV_IDENTITY_ENABLED=false
CORS_ORIGIN=https://maint-agent-staging.vercel.app
FRONTEND_URL=https://maint-agent-staging.vercel.app
ATTACHMENTS_STORAGE=local
ATTACHMENTS_LOCAL_ROOT=/tmp/uploads
DOCUMENT_SCAN_PROVIDER=azure
DOCUMENT_SCAN_FALLBACK_PROVIDER=local
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://maintenance-agent-docintel.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<rotated key — from Azure Portal>
BG_JOBS_ENABLED=true
BG_JOB_INTERVAL_MS=3600000
REQUEST_TIMEOUT_MS=30000
OVERDUE_GRACE_HOURS=24
RESEND_API_KEY=<optional>
EMAIL_FROM_ADDRESS=noreply@maint-agent.com
```

### Render API (production)

Same as staging, with:
```
DATABASE_URL=postgresql://postgres:[PWD]@db.[PROD_REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:[PWD]@db.[PROD_REF].supabase.co:5432/postgres
CORS_ORIGIN=https://app.maint-agent.com
FRONTEND_URL=https://app.maint-agent.com
ATTACHMENTS_STORAGE=s3   # after B1 is resolved
# + S3/R2 bucket credentials
```

### Vercel Web (staging)

```
API_BASE_URL=https://maint-agent-api-staging.onrender.com
```

### Vercel Web (production)

```
API_BASE_URL=https://api.maint-agent.com
```

### CI (`.github/workflows/ci.yml`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maint_agent_test
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/maint_agent_test
NODE_ENV=test
```

### Local Dev (`apps/api/.env`) — unchanged

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maint_agent
PORT=3001
DEV_IDENTITY_ENABLED=true
DOCUMENT_SCAN_PROVIDER=azure
DOCUMENT_SCAN_FALLBACK_PROVIDER=local
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://...
AZURE_DOCUMENT_INTELLIGENCE_KEY=<rotated key>
ATTACHMENTS_STORAGE=local
ATTACHMENTS_LOCAL_ROOT=./uploads
```

---

## Appendix C: Unknowns Requiring Manual Decisions

| # | Unknown | Who decides | Impact |
|---|---------|-------------|--------|
| U1 | Does `_app.js` gate `DEV_MANAGER_TOKEN` on `NODE_ENV !== 'production'`? | Developer (code review) | Must be verified in T-01 before T-07 |
| U2 | Object storage provider for B1 (Supabase Storage / S3 / R2) | Team / Product | Blocks production file upload; staging can proceed without |
| U3 | Custom domain names (`app.maint-agent.com`, `api.maint-agent.com`) | Team / Product | Required for DNS cutover step in T-10 |
| U4 | Render paid tier selection (Starter $7 vs Standard $25) | Team | Affects always-on background jobs and memory for staging |
| U5 | Supabase Free vs Pro for production | Team | Affects PITR backup capability — Pro strongly recommended for financial data |
| U6 | CORS strategy for Vercel preview deployments | Team | Preview deploy URLs are random; single `CORS_ORIGIN` won't work for all previews. Options: (a) accept that preview UI cannot call Render staging; (b) extend CORS handler to support a wildcard pattern for `*.vercel.app` |
| U7 | Email provider for production (Resend vs SMTP) | Team | `RESEND_API_KEY` must be provisioned if Resend is chosen |
| U8 | Azure DI tier upgrade for production | Team | Current Free F0 tier: 500 pages/month. Upgrade to S0 before production (noted in backlog). |
| U9 | Data migration from dev Postgres to Supabase staging (yes/no) | Team | Dev data has test artifacts; fresh seed is cleaner for staging |
| U10 | Background job strategy for horizontal scaling | Team | In-process setInterval causes duplicate job execution when multiple Render instances run. Externalize before scaling to 2+ instances. |
