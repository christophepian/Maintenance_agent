# T-04 API Production-Readiness Checklist

**Date:** 2026-04-30
**Status:** ✅ Complete
**Gate:** Gate 1 (Infrastructure Setup) — ticket 4 of 8

---

## 1. Build pipeline

| Step | Command | Result |
|------|---------|--------|
| TypeScript check | `npx tsc --noEmit` | ✅ 0 errors |
| Production build | `npm run build` (`tsc -p tsconfig.json`) | ✅ Emits `dist/server.js` (CommonJS, target es2020) |
| Start in prod | `npm start` (`node dist/server.js`) | ✅ Works |

`tsconfig.json` targets `commonjs` + `es2020` — compatible with Node 20.

---

## 2. Process model

| Concern | Status | Evidence |
|---------|--------|----------|
| `PORT` env-driven | ✅ | [server.ts:73](apps/api/src/server.ts#L73) — `process.env.PORT ? Number(...) : 3001` |
| Single process (no cluster) | ✅ | Render web service = 1 instance per dyno; horizontal scale via Render plan |
| Background jobs gated | ✅ | `BG_JOBS_ENABLED=false` disables interval ([server.ts:246](apps/api/src/server.ts#L246)) — important for multi-instance: only one worker should run BG jobs |
| Request timeout | ✅ | `REQUEST_TIMEOUT_MS=30000` default ([server.ts:74](apps/api/src/server.ts#L74)) |
| Per-request 504 handler | ✅ | [server.ts:160-166](apps/api/src/server.ts#L160-L166) |

**⚠ Operational note for multi-instance:** When Render scales to >1 instance, set `BG_JOBS_ENABLED=false` on all but one (or migrate to Render Cron). Currently 1 instance is the design assumption.

---

## 3. Graceful shutdown (SIGTERM)

Render sends `SIGTERM` then waits 30s before `SIGKILL`. Verified flow:

1. `process.on("SIGTERM", shutdown)` ([server.ts:357](apps/api/src/server.ts#L357))
2. `isShuttingDown=true` — health probe immediately returns 503 → load balancer drains traffic
3. `bgJobTimer` cleared → no new background work
4. `server.close()` → no new connections accepted
5. Poll `activeResponses` every 200ms; when empty, `prisma.$disconnect()` then `process.exit(0)`
6. Drain timeout: `DRAIN_TIMEOUT_MS=10000` force-closes lingering responses
7. **NEW (T-04):** Hard exit at `SHUTDOWN_HARD_EXIT_MS=25000` if drain itself hangs — guarantees self-exit before Render's 30s SIGKILL

**Result:** ✅ Render orchestrator will record clean stops; no zombie processes.

---

## 4. Production boot guards

Server **refuses to start** in `NODE_ENV=production` if any of the following hold ([server.ts:54-72](apps/api/src/server.ts#L54-L72)):

- ❌ `AUTH_SECRET` unset → FATAL
- ❌ `AUTH_OPTIONAL=true` → FATAL
- ❌ `DEV_IDENTITY_ENABLED=true` → FATAL

Dev-only routes also gated:
- `POST /__dev/rental/run-jobs` → 403 in prod
- `POST /dev/switch-owner` → 403 in prod

---

## 5. Required production env vars

Minimum set Render must provide:

```dotenv
# Core
NODE_ENV=production
PORT=10000                              # Render injects this
DATABASE_URL=postgresql://...:6543/...?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...:5432/...    # Direct connection for migrations
AUTH_SECRET=<256-bit random>            # openssl rand -base64 32

# CORS
CORS_ORIGIN=https://app.example.com     # Production frontend domain (single origin)
FRONTEND_URL=https://app.example.com    # Used in QR-bill links + tenant portal links

# File storage (B1 — must be S3 in prod, local disk does not survive Render restarts)
ATTACHMENTS_STORAGE=s3
S3_REGION=eu-central-1
S3_BUCKET=maint-agent-attachments
S3_ACCESS_KEY_ID=<from Supabase Storage panel>
S3_SECRET_ACCESS_KEY=<from Supabase Storage panel>
S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3
S3_FORCE_PATH_STYLE=true                # Required for Supabase Storage

# Document scanning (rotate the dev key first!)
DOCUMENT_SCAN_PROVIDER=azure
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://....cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<rotated>

# Email
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=noreply@example.com

# Optional but recommended
GIT_SHA=<auto-injected by Render>       # Surfaces in /health response
SHUTDOWN_HARD_EXIT_MS=25000             # default OK
BG_JOBS_ENABLED=true                    # Single-instance default
```

---

## 6. Observability hooks

| Hook | Where | Purpose |
|------|-------|---------|
| `console.log` / `console.error` | Throughout | Render captures stdout/stderr → log stream |
| `unhandledRejection` | [server.ts:359](apps/api/src/server.ts#L359) | Prevents silent error loss |
| `uncaughtException` | [server.ts:363](apps/api/src/server.ts#L363) | Logs + exits 1 after 1s flush |
| `server.on("error")` | [server.ts:369](apps/api/src/server.ts#L369) | Catches port-bind / network errors |
| `GET /health` | T-03 | Uptime probe with `version: GIT_SHA` and `dbLatencyMs` |

No external APM (Datadog / Sentry) yet — recommend adding in a later post-launch ticket.

---

## 7. Known limitations / deferred to later

| Concern | Risk | Deferred to |
|---------|------|-------------|
| No structured (JSON) logging — plain `console.log` | Render free tier OK, harder to query at scale | Post-launch |
| No Sentry/error tracking | Errors only visible in Render log stream | Post-launch |
| No rate limiting on auth endpoints | Login brute-force vector | Post-launch (or via Render WAF) |
| Single-instance assumption for BG jobs | Cannot horizontally scale without `BG_JOBS_ENABLED=false` toggle | Migrate to Render Cron when scaling >1 instance |
| No metrics endpoint (`/metrics` for Prometheus) | No throughput/latency dashboards | Post-launch |

None of these block initial production deployment.

---

## 8. Gate 1 status

- ✅ T-01 Audit & Pre-Flight (commit `0e864f1`)
- ✅ T-02 `directUrl` in Prisma schema (pre-existing)
- ✅ T-03 `GET /health` endpoint (commit prior)
- ✅ **T-04 API prod readiness (this ticket)**
- ⏭ T-05 Provision Supabase project
- ⏭ T-06 Provision Render service
- ⏭ T-07 Provision Supabase S3 bucket
- ⏭ T-08 Provision Vercel project + env wiring

**Next:** T-05 / T-07 are infrastructure provisioning tasks that require user action in the Supabase / Render / Vercel dashboards. The agent can prepare the configuration manifests and step-by-step instructions but cannot click the buttons.
