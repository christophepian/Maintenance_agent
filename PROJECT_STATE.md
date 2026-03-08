# Maintenance Agent — Project State

**Last updated:** 2026-03-08 (LegalSource Scope Field + Ingestion Filter)

**Companion files (do not duplicate content here):**
* [EPIC_HISTORY.md](EPIC_HISTORY.md) — all completed epic/slice narratives + hardening guidelines (H1–H6)
* [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) — full models table (44), enums (35), schema gotchas, Request.orgId migration path
* `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — low-context lookup table for "what file to change for X"

---

## 🛡️ GUARDRAILS — Read Before Making ANY Change

> **These rules exist because we lost a full day (Feb 24–25) fixing silent failures caused by
> schema drift, stub services, and missing Prisma includes. Every rule below maps to a real
> outage. Do NOT skip them.**

### G1: Schema Changes — Always Migrate, Never `db push`
- **NEVER** use `npx prisma db push` in dev or production. It creates drift between the
  migration history and the database, which is invisible until queries crash.
- **ALWAYS** use `npx prisma migrate dev --name <description>` for schema changes.
- After ANY schema change, run the drift check:
  ```bash
  cd apps/api
  npx prisma migrate diff \
    --from-schema-datasource ./prisma/schema.prisma \
    --to-schema-datamodel ./prisma/schema.prisma \
    --script
  ```
  **Expected output:** `-- This is an empty migration.`
  If it outputs SQL, you have drift. Fix it before committing.

### G2: New Model Fields — Update All Consumers
When adding a field to a Prisma model, you MUST update:
1. The Prisma schema (`schema.prisma`)
2. The service DTO interface (e.g., `LeaseDTO`, `JobDTO`)
3. The mapper function (e.g., `mapLeaseToDTO`, `mapJobToDTO`)
4. Every `include`/`select` clause that touches the model
5. The validation schema if the field is user-facing
6. Run `npx prisma generate` after changes

### G3: Prisma `include` — Always Include What You Map
If a DTO mapper accesses a relation (e.g., `job.request.tenant`), the query that feeds it
**MUST** have a matching `include`. Prisma returns `undefined` for non-included relations,
which silently drops data from API responses.

**Bad:**
```typescript
const job = await prisma.job.create({ data: { ... } });
return mapJobToDTO(job); // job.request is undefined → DTO has empty relations
```
**Good:**
```typescript
const job = await prisma.job.create({
  data: { ... },
  include: { request: { include: { tenant: true, unit: { include: { building: true } } } }, contractor: true },
});
return mapJobToDTO(job);
```

### G4: No Stub Services in Production Paths
Never leave a stub function (returns fake data without writing to DB) in a file that
production routes import from. If a real implementation exists elsewhere, **re-export it**:
```typescript
// ❌ BAD: stub in maintenanceRequests.ts alongside real functions
export async function assignContractor() { return { success: true }; }

// ✅ GOOD: re-export from the real implementation
export { assignContractor } from './requestAssignment';
```

### G5: Pre-Commit Smoke Test
Before committing backend changes, run this 30-second check:
```bash
cd apps/api

# 1. Schema drift = zero
npx prisma migrate diff --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma --script 2>&1 | grep -q "empty migration" \
  && echo "✅ No drift" || echo "❌ DRIFT DETECTED"

# 2. Prisma client generates cleanly
npx prisma generate 2>&1 | tail -1

# 3. Server starts without crash (5s timeout)
timeout 8 npx ts-node --transpile-only src/server.ts &
sleep 5
curl -sf 'http://127.0.0.1:3001/requests?limit=1' > /dev/null \
  && echo "✅ Server OK" || echo "❌ Server FAIL"
curl -sf 'http://127.0.0.1:3001/leases?limit=1' > /dev/null \
  && echo "✅ Leases OK" || echo "❌ Leases FAIL"
curl -sf 'http://127.0.0.1:3001/jobs?limit=1' > /dev/null \
  && echo "✅ Jobs OK" || echo "❌ Jobs FAIL"
kill %1 2>/dev/null
```

### G6: Destructive Database Commands — Require Explicit Approval
**The PostgreSQL database uses Docker volume `maint_agent_pgdata` for persistent storage.**

Safe commands (data preserved):
- `docker-compose up` / `stop` — start/stop services
- `npm run start:dev` — restart backend
- `npx prisma migrate dev --name <desc>` — add new migrations

❌ **DESTRUCTIVE — DO NOT RUN without explicit user approval:**
- `docker-compose down -v` — removes database volume and all data
- `npx prisma migrate reset` — drops all tables and reseeds
- `npx prisma db push --force-reset` — drops and recreates schema
- `docker volume rm maint_agent_pgdata` — deletes persistent storage

### G7: CI Is a Hard Gate
CI must run and pass **all** of the following before merge:
1. Schema drift check = empty migration
2. `npx prisma generate` succeeds
3. `tsc --noEmit` (backend type check)
4. `next build` (frontend build)
5. All Jest tests pass
6. Backend boots + smoke curls return 200

**If CI is red: do not merge, do not defer fixes.**

### G8: `prisma db push` Is Banned
`db push` must never appear in any script, CI step, or developer workflow.
CI should fail if `db push` is detected. Schema changes require migrations — no exceptions.
This reinforces G1 with enforcement at the tooling level.

**⚠️ Known Exception (Mar 6, 2026):** LKDE epic used `db push` because the shadow database cannot replay the migration `20260223_add_leases` (Lease model was significantly restructured in subsequent migrations, causing shadow DB to fail midway through the migration sequence). This was a one-time additive-only change (12 new tables, no modifications to existing data). See the LKDE epic section below for full context. Future schema changes should attempt `migrate dev` first.

### G9: Canonical Include Definitions (No Ad-Hoc Include Trees)
For any service that returns a DTO, define a **centralized include constant** rather than
scattering ad-hoc include trees across queries:
```typescript
// ✅ GOOD: single source of truth for Job relations
export const JOB_INCLUDE = {
  request: {
    include: {
      tenant: true,
      unit: { include: { building: true } },
      appliance: { include: { assetModel: true } },
    },
  },
  contractor: true,
  invoices: { include: { lineItems: true } },
};
```
Rules:
- All DTO mappers must use typed Prisma payloads fed by the canonical include.
- If a DTO changes → update the include constant in the same PR.
- No random one-off include trees in individual query calls.

### G10: API Contract Tests (Prevent Silent DTO Drift)
Maintain contract tests for key endpoints:
- `GET /requests?limit=1`
- `GET /jobs?limit=1`
- `GET /invoices?limit=1`
- `GET /leases/:id`

Tests must assert:
- Required top-level fields exist
- Required nested relations exist (not `null` / `undefined` unexpectedly)
- If a DTO changes → update the contract test in the same PR

### G11: Test Database Requires Seed After Fresh Creation
The test database (`maint_agent_test`) requires seed data for some test suites. After creating a fresh `maint_agent_test`, run in order:
1. `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maint_agent_test npx prisma migrate deploy`
2. `DATABASE_URL=...maint_agent_test npx prisma db seed`
3. `DATABASE_URL=...maint_agent_test node seed-category-mappings.js`
4. `DATABASE_URL=...maint_agent_test node seed-test-legal-rule.js`

`rentalIntegration.test.ts` depends on `default-org` existing in the test DB with correct seed data.
**Never run these seed scripts against `maint_agent` (dev DB).**

---

### 🔮 FUTURE RISK GUARDRAILS (F1–F8)

> These prevent long-term structural decay. They may not all be enforced today, but new code
> **must** respect them to avoid accruing the same debt we just cleaned up.

### F1: Production Cannot Start With Optional Auth
When `NODE_ENV=production`:
- `AUTH_OPTIONAL` must be `false`
- `AUTH_SECRET` must exist
- Server must **refuse to boot** if either condition is violated
- Sensitive routes must use `requireAuth()` and `requireRole(...)` — no bypass in production paths

### F2: Org Scoping Must Be Explicit ✅ (M1 implemented)
Because `Request` has no `orgId` and multi-org is planned:
- All read/write operations for Requests, Jobs, Invoices, Leases, and Inventory must
  explicitly enforce org scope via join or helper function
- Add cross-org isolation tests when multi-org lands → **Done:** `orgIsolation.test.ts` (22 tests)
- No implicit org assumptions in query logic → **Done:** `governance/orgScope.ts` resolvers + `assertOrgScope`
- Remaining: `DEFAULT_ORG_ID` in `routes/auth.ts` (M2 scope)

### F3: Proxy Layer Must Be Transparent
Next.js API proxy routes must:
- Forward all headers (including `Authorization`)
- Forward query params unchanged
- Forward HTTP status codes as-is
- Forward binary responses correctly (PDF, PNG)
- **Never** re-parse URLs when `query` is already available in the handler context

### F4: Emergency DB Fixes Must Be Codified
If a manual `ALTER TABLE` is ever applied to fix a live issue:
1. Create a proper Prisma migration immediately after
2. Verify drift returns empty
3. Add a note to the stabilization log in this document
4. No permanent manual DB edits — every change must be in the migration history

### F5: Financial & PDF Logic Requires Golden Tests
For lease PDFs, invoice PDFs, QR bills, and line item totals:
- Tests must verify SHA-256 is present in lease PDF footer
- Invoice totals must equal sum of line items (cents-level precision)
- QR endpoint must return valid PNG
- `includeQRBill=false` must actually exclude the QR section
- Financial correctness cannot rely on manual spot-checks

### F6: Clean Dev Environment Scripts
Formalize restart workflows as npm scripts instead of scattered shell commands:
```bash
npm run dev:clean:api   # kill stale ts-node, restart backend
npm run dev:clean:web   # kill stale next, clear .next, restart frontend
npm run dev:clean:all   # both of the above
npm run dev:db          # start PostgreSQL via Docker
```
**Status: Implemented** — these scripts are defined in root `package.json`.

### F7: No Single-Org Assumption in New Code
Even while single-org (`DEFAULT_ORG_ID`) is active:
- New models must include `orgId` unless architecturally justified
- No hard-coded `DEFAULT_ORG_ID` outside the bootstrap/seed path
- All queries must consider org scope
- Multi-org should not require rewriting existing services

### F8: Styling Lock Enforcement
Manager UI styling lives **only** in `apps/web/styles/managerStyles.js` (see Section 7).
- No inline style changes in manager workspace pages
- Styling PRs must modify the lock file or justify a new shared style layer
- This rule extends the existing policy in Section 7 with PR-level enforcement

---

## 🚀 HARDENING GUIDELINES (H1–H6)

> **Full guidelines:** See [EPIC_HISTORY.md](EPIC_HISTORY.md) — search for "Hardening Infrastructure (H1–H6)".
>
> Summary: Route protection wrappers (H1), production boot guard (H2), shared proxy helper (H3), DTO tiers (H5), Request.orgId migration path (H6). All infrastructure delivered; incremental rollout in progress.

## 1. Project Goal (MVP)

Build a web-first maintenance platform for Swiss property managers that:

* Allows tenants to submit repair requests conversationally
* Automatically routes requests to preferred contractors *(future)*
* Auto-approves low-cost work
  *(approval threshold configurable per property manager; default CHF 200)*
* Handles exceptions via manager review
* Minimizes property manager involvement in standard cases

### Personas

* **Tenant** — submits repair requests
* **Property Manager** — configures rules, approves escalations
* **Contractor** — executes work *(portal + status updates implemented)*
* **Owner** — approves work, manages invoices *(NEW in Slice 4+)*

---

## 2. High-Level Architecture

### Monorepo

* `apps/` — runtime applications (api + web)
* `infra/` — infrastructure (Docker)
* `packages/` — shared packages (api-client)
* `_archive/` — archived docs, scripts, legacy backups

### Backend API — `apps/api/src/server.ts` (port 3001)

* Node.js + TypeScript, raw `http.createServer` — **no Express/NestJS**
* Layered: `routes/` → `workflows/` (14) → `services/` → `repositories/` (6) → `events/` (15 types)
* State machines: `workflows/transitions.ts` (Request, Job, Invoice, Lease, RentalApplication)
* Org scoping: `governance/orgScope.ts`
* Prisma ORM + PostgreSQL + Zod validation

### Frontend — `apps/web/` (port 3000)

* Next.js Pages Router, proxy layer to backend via `pages/api/`
* Personas: Tenant `/`, Manager `/manager`, Contractor `/contractor`, Owner `/owner`

### Database — PostgreSQL 16 via Docker, Prisma migrations

---

## 3. Repository Structure

```
Maintenance_Agent/
├── PROJECT_STATE.md          # This file (trimmed source of truth)
├── EPIC_HISTORY.md           # All completed epic/slice narratives
├── SCHEMA_REFERENCE.md       # Full models table, enums, schema gotchas
├── _archive/                 # Legacy docs, scripts, test pages, OCR data
├── apps/
│   ├── api/
│   │   ├── prisma/           # schema.prisma + migrations/
│   │   └── src/
│   │       ├── server.ts     # Raw HTTP entry point (port 3001)
│   │       ├── routes/       # Thin HTTP handlers (13 route modules)
│   │       ├── workflows/    # Orchestration layer (14 workflows + transitions)
│   │       ├── services/     # Domain logic
│   │       ├── repositories/ # Canonical Prisma access (6 repos)
│   │       ├── events/       # Domain event bus
│   │       ├── governance/   # Org scope resolvers
│   │       ├── validation/   # Zod schemas
│   │       ├── http/         # Body/JSON/query/errors/router helpers
│   │       ├── __tests__/    # 28 test suites
│   │       └── ARCHITECTURE_LOW_CONTEXT_GUIDE.md
│   └── web/
│       ├── pages/            # ~171 pages (UI + API proxies)
│       ├── components/       # AppShell, layout primitives, shared UI
│       ├── lib/              # proxy.js, api.js, formatDisqualificationReasons.js
│       └── styles/           # managerStyles.js (locked)
├── packages/api-client/      # Typed API client (DTO types + fetch methods)
├── infra/docker-compose.yml  # PostgreSQL
└── .github/                  # CI + copilot-instructions.md
```


## 4. Database Schema (Prisma)

> **Full schema reference:** See [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) for the complete models table (44 models), enums (33), schema gotchas, and Request.orgId migration path.
>
> **Status:** 29 migrations + `db push` for LKDE tables. Last verified: 2026-03-08.
>
> **Quick gotchas (always check SCHEMA_REFERENCE.md for full list):**
> - `Request` has NO `orgId` — scope inherited via unit/building FK chain
> - `Job` has NO `description` — use `Request.description` via the relation
> - `Appliance` has NO `category` — lives on `AssetModel`
> - `Job.contractorId` is REQUIRED
---

## 5. Backend API

* **Entry:** `apps/api/src/server.ts` — raw `http.createServer`, port **3001**
* **Architecture:** `routes/` (thin HTTP) → `workflows/` (14) → `services/` → `repositories/` (6) → `events/`
* **Route modules (13):** requests, leases, invoices, inventory, tenants, config, notifications, auth, rentalApplications, contractor, financials, legal, helpers — all registered via `register*Routes(router)` in server.ts
* **Full endpoint list:** See `apps/api/openapi.yaml` (~153 routes, 14 tags) or `ARCHITECTURE_LOW_CONTEXT_GUIDE.md`

---

## 6. Frontend (Next.js)

* **Port:** 3000 (Next.js Pages Router)
* **Proxy pattern:** `apps/web/pages/api/` routes proxy to backend (103/106 use centralized `proxyToBackend()` from `lib/proxy.js`)
* **Auth utilities:** Shared `apps/web/lib/api.js` — `authHeaders()`, `fetchWithAuth()`, `apiFetch()`
* **Layout:** `AppShell` component with role-scoped sidebar (MANAGER/CONTRACTOR/TENANT/OWNER)
* **Reusable components:** `PageShell`, `PageHeader`, `PageContent`, `Panel`, `Section`, `ContractorPicker`, `NotificationBell`, `AssetInventoryPanel`
* **Key page groups:** `/manager/*` (requests, inventory, legal, leases, settings), `/contractor/*` (jobs, invoices), `/tenant/*` (leases, chat), `/owner/*` (approvals, invoices, vacancies), `/admin-inventory/*`, `/apply` (rental wizard), `/listings`
* **~171 frontend pages** (UI + API proxies)

---

## 7. Styling Policy

* Manager UI styles **locked** in `apps/web/styles/managerStyles.js` — do not modify inline styles in `manager.js`.

---

## 8. Infrastructure & DevOps

* PostgreSQL via Docker: `infra/docker-compose.yml` (port 5432)
* Dev DB: `maint_agent` | Test DB: `maint_agent_test` (isolated)
* CI: `.github/workflows/ci.yml` — 6-gate pipeline enforcing G1–G11
* Prisma migrations: `apps/api/prisma/migrations/` (29 migrations + db push for LKDE)

---

## 9. Environment & Tooling

### Backend

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maint_agent
PORT=3001
```

### Frontend

* `API_BASE_URL` optional
* Defaults to `http://127.0.0.1:3001`

---

## 10. Running the Project (Local)

```bash
# Database
npm run dev:db          # or: cd infra && docker compose up -d

# Backend
npm run dev:api         # or: cd apps/api && npm run start:dev

# Frontend
npm run dev:web         # or: cd apps/web && npm run dev

# Clean restart (kills stale processes, clears caches)
npm run dev:clean:all

# Check ports
lsof -nP -iTCP:3000,3001 -sTCP:LISTEN
```

---

## 11. Completed Epics & Slices

> **Full history:** See [EPIC_HISTORY.md](EPIC_HISTORY.md) for all completed epic/slice narratives.
>
> Summary: 20+ epics completed (Feb–Mar 2026) covering cleanup, tenant asset context, inventory admin, owner-direct workflow, job lifecycle, invoicing, leases, digital signatures, tenant portal, org scoping, auth hardening, domain events, OpenAPI sync, rental applications, document OCR, financial performance, legal engine, legal auto-routing, workflow layer refactor, architecture hardening, asset inventory & depreciation, test database isolation, and UI navigation & finance pages.

### UI Navigation & Finance Pages (Mar 2026)
**Status:** ✅ COMPLETE

Resolved 51 of 67 findings from a full frontend audit covering dead CTAs, empty states, missing links, and orphaned pages across all 4 portals.

**Batches completed:**
- **Login redirect:** post-login role-based redirect added
- **Navigation link pass:** ~30 plain-text references converted to working `next/link` navigation across manager, contractor, owner, and tenant portals
- **Orphaned pages:** legacy `manager.js` + `contractor.js` deleted; `operations/` pages redirect; building financials wired into sidebar; fill vacancy wizard linked from vacancies list
- **People detail tabs:** tenant + vendor Contracts and Invoices tabs replaced with real data (leases, invoices, jobs fetched by tenantId/contractorId)
- **Contractor job flow:** job detail page built out, `status-updates.js` redirects to jobs, invoice creation form with jobId pre-fill added
- **Finance pages:** `payments.js`, `expenses.js`, `charges.js` replaced — all derive from Invoice + Lease models, no new Prisma models or migrations
  - **payments:** filtered view of PAID invoices with building/date filters
  - **expenses:** filtered view by ExpenseCategory with inline category editing
  - **charges:** lease chargesItems editor with summary and itemized tabs
  - `GET /invoices` extended with `status`, `expenseCategory`, `buildingId`, `paidAfter`, `paidBefore` query params

**Remaining (parked):**
- `reports.js` — product decision required
- `tenant/assets.js` — belongs with Asset Inventory epic
- ~8 cosmetic items (back links, minor empty states)

### Not Implemented Yet (Active Backlog)

* Lease Phase 3–5: DocuSign/Skribble integration, deposit payment tracking, archive workflow
* Role enforcement refinement (all routes protected; role granularity can be tightened further)
* Email delivery provider integration (EmailOutbox + dev sink implemented; no SMTP/SendGrid wired yet)
* Notifications push delivery (in-app notifications work; no push/email delivery)
* `reports.js` — define reporting scope before building (product decision required)
* Multi-org support (org scoping via M1; auth centralized via M2; DEFAULT_ORG_ID remains only in authz.ts fallback + orgConfig.ts bootstrap + tests)
* Legal DSL variable resolver — wire LegalVariable values into DSL condition evaluation so rules can condition on ingested data (e.g. reference interest rate > 1.5%). Prerequisite for full canton-scoped rule evaluation. Depends on: LegalSource Scope slice (done).

---

## 12. Backlog

### Not Implemented Yet (Active Backlog)

* Lease Phase 3–5: DocuSign/Skribble integration, deposit payment tracking, archive workflow
* Role enforcement refinement (all routes protected; role granularity can be tightened further)
* Email delivery provider integration (EmailOutbox + dev sink implemented; no SMTP/SendGrid wired yet)
* Notifications push delivery (in-app notifications work; no push/email delivery)
* `reports.js` — define reporting scope before building (product decision required)
* Multi-org support (org scoping via M1; auth centralized via M2; DEFAULT_ORG_ID remains only in authz.ts fallback + orgConfig.ts bootstrap + tests)
* Legal DSL variable resolver — wire LegalVariable values into DSL condition evaluation so rules can condition on ingested data (e.g. reference interest rate > 1.5%). Prerequisite for full canton-scoped rule evaluation. Depends on: LegalSource Scope slice (done).

### Future Vision (Deferred)

Conversational tenant intake with phone-based identification, automatic asset inference from unit inventory, and contractor availability scheduling.

---

### State Integrity

This document + companion files are the **single source of truth**:

* **Doc structure:** PROJECT_STATE.md (~500 lines) + EPIC_HISTORY.md (epics) + SCHEMA_REFERENCE.md (schema) + ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup)
* Filesystem (verified 2026-03-08)
* Database schema — 29 migrations + `db push` for LKDE tables + `RFP_PENDING` enum value + `autoLegalRouting` column (shadow DB issue — see G8 exception in LKDE epic section); 44 models, 35 enums verified in live DB
* Database data — 99+ assets across 19 units (with interventions tracking), 274 depreciation standards (including 5 added for mapped topics), 16 category mappings, buildings with cantons set, 6 CO 259a statutory rules with proper DSL (verified 2026-03-07)
* Running system — all endpoints return 200; legal auto-routing creates RFP and sets RFP_PENDING for requests with mapped categories when autoLegalRouting=true; asset inventory endpoints serve depreciation data (verified 2026-03-07)
* Frontend navigation — ~51 of 67 audit findings resolved; all 4 portals (manager, contractor, owner, tenant) fully connected with working links, detail tabs, and finance pages (verified 2026-03-08)
* Test suite — **308 tests, 28 suites, ALL PASSING against maint_agent_test** (isolated from dev DB `maint_agent`) (verified 2026-03-08). Includes 20 new asset inventory tests. 28 pre-existing timeout flakes in 6 suites (auth, requests, ia, ownerDirect.governance, rentalContracts, rentEstimation) — not introduced by any recent slice.
* Test DB: `maint_agent_test` (isolated) — requires seed scripts after fresh creation (see G11)
* TypeScript compilation — 0 errors (verified 2026-03-08)
* OpenAPI spec — fully synced with router registrations (verified 2026-03-07)
* Git — uncommitted changes: Asset Inventory & Depreciation Tracking slice + Phase 3 Architecture Hardening + rentalIntegration test fix (seed data) + Legal Knowledge & Decision Engine epic + Legal Auto-Routing + Building Financial Performance epic + auth hardening + requests page accordion UI + comprehensive asset seed + LegalSource Scope Field + Ingestion Filter slice
* Architectural intent — 14 workflows, 6 repositories, 5 transition maps (Request, Job, Invoice, Lease, RentalApplication)
* CI pipeline enforces G1–G11 guardrails

Safe to:

* Pause work
* Resume later
* Onboard collaborators
* Refactor deliberately

⚠️ **Before any code change, re-read the 🛡️ GUARDRAILS section at the top of this file.**

---

✅ **Project stabilized, audit-hardened, org-scoped, and UI-connected (2026-03-08).** 308/308 tests, 28 suites, 0 TS errors. ~51/67 frontend audit findings resolved. Backend: ~30,000 LOC | Frontend: ~22,000 LOC | ~153 API routes | 44 Prisma models | 35 enums | ~171 frontend pages | 14 workflows | 6 repositories. See [EPIC_HISTORY.md](EPIC_HISTORY.md) for full completion details.


## 13. Authentication & Testing

### Auth — Implemented and hardened (Mar 4)

* `AUTH_OPTIONAL` defaults to **false** (required). Set `"true"` in `.env` for dev.
* All routes wrapped with `withAuthRequired()` or `withRole()`. Production boot guard enforced.
* JWT via `services/auth.ts`, middleware via `auth.ts` + `http/routeProtection.ts`

### Testing — 308 tests, 28 suites

* Jest + ts-jest, pattern: `src/__tests__/**/*.test.ts`
* Test DB: `maint_agent_test` (isolated from dev via `.env.test` + `dotenv-cli`)
* `npm test` / `npm run test:watch` / `npm run test:dev` (debug against dev DB)
* CI: `.github/workflows/ci.yml` with PostgreSQL service container
