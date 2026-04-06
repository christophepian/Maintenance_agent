# Maintenance Agent — Project State

**Last updated:** 2026-04-03 (Recurring Invoices epic complete — 6 slices, 5 new models, 6 new enums, 4 new migrations)

> **For routine implementation work, start with [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** (~220 lines).
> This file is the canonical deep reference — guardrail details, backlog, state integrity, epic summaries.
> Open it when you need full context beyond what the overview provides.

**Companion files (do not duplicate content here):**
* [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) — primary entry-point doc for routine work (guardrails, architecture, task routing)
* [EPIC_HISTORY.md](EPIC_HISTORY.md) — all completed epic/slice narratives + hardening guidelines (H1–H6)
* [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) — full models table (64), enums (55), schema gotchas, Request.orgId migration path
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
5. `next lint --max-warnings 0` (frontend lint)
6. All Jest tests pass
7. Backend boots + smoke curls return 200

**If CI is red: do not merge, do not defer fixes.**

### G8: `prisma db push` Is Banned
`db push` must never appear in any script, CI step, or developer workflow.
CI should fail if `db push` is detected. Schema changes require migrations — no exceptions.
This reinforces G1 with enforcement at the tooling level.

**✅ Exception resolved (2026-03-31):** The shadow DB replay failure that prompted the LKDE `db push` exception (Mar 6, 2026) was caused by missing gap-filling migrations and two ordering/drift bugs. The migration-integrity-recovery slice created 5 gap-filling migrations, a drift-backfill migration, fixed a duplicate-timestamp ordering issue, and resolved a `setval(0)` bug. Shadow DB replay now succeeds cleanly ("Already in sync"). No exceptions to G8 remain.

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

### G12: Commit Every Deliverable — No Session-Long Uncommitted Work
Every self-contained deliverable (new component, service, route, migration) must be committed
**before** moving to the next task. Code that exists only in the working tree is one `git stash`
or editor reload away from being lost.

**Rule:** If you've produced >100 lines of working code without a commit, stop and commit.

Pre-commit addendum:
```bash
git status  # Verify no untracked/modified files that are part of the current deliverable
```

### G13: Frontend + Backend = One Atomic Commit
When a feature spans frontend and backend (route + proxy + UI component), all layers must
land in the **same commit**. Never leave the UI as the only uncommitted layer while the backend
is already committed — that's how the Forecast tab was lost (April 2026 incident).

If the backend is ready but the UI is still in progress, commit the backend separately with
a clear message like `feat(forecasting): backend routes (UI pending)`.

### G14: Session-End Verification
At the end of every coding session, run:
```bash
git status && git stash list && git diff --stat
```
If any meaningful work is uncommitted, commit it — even as `wip: <description>` — before
closing. Never rely on `git stash` as persistent storage.

### G15: Protect Stashes With Branches
If you must stash work, immediately convert it to a named branch:
```bash
git stash
git stash branch wip/<feature-name>   # creates branch from stash
```
This converts the stash into a proper branch that won't be silently garbage-collected.
**Never `git stash drop` without first running `git stash show --stat`.**

---

### 🎨 FRONTEND UI GUARDRAILS (F-UI1–F-UI6)

> These rules prevent the layout drift that required a full session to fix in March 2026.
> Every new manager page must follow them exactly.

#### F-UI1: Hub Pages (with tabs) — Canonical Structure

Tab strip is a direct child of `PageContent`, **before** the `Panel`. `Panel` wraps only the tab panel `div`s. One `<div className="px-4 py-4">` wrapper per tab panel — no more, no less. Page-level CTAs go in `PageHeader` `actions` prop — **never** between the header and the tab strip. Error banner sits outside both strip and Panel at the top of `PageContent`.

```
AppShell > PageShell > PageHeader (actions prop for CTAs)
  PageContent
    error-banner (if any)
    div.tab-strip
    Panel bodyClassName="p-0"
      div.tab-panel / div.tab-panel-active
        div.px-4.py-4
          content
```

- **Reference implementation:** `apps/web/pages/manager/requests.js`
- **Starter template:** `apps/web/pages/manager/_template_hub.js`

#### F-UI2: Detail/Sub-pages (no tabs) — Canonical Structure

Each logical section in its own `<Panel>`. Sections with tables use `bodyClassName="p-0"`. Sections with forms or mixed content use default Panel padding.

```
AppShell > PageShell > PageHeader
  PageContent
    Panel title="Section name"
      content
    Panel title="Table section" bodyClassName="p-0"
      table.inline-table
```

- **Starter template:** `apps/web/pages/manager/_template_detail.js`

#### F-UI3: Content Layout — Not Everything Is a Table

Use the layout that fits the content type:

| Content type | Layout |
|---|---|
| Tabular records | `<table className="inline-table">` |
| Summary stats | `grid grid-cols-2 sm:grid-cols-4` with stat cards |
| Grouped/categorized items | Category sections with headers and pills (see `DepreciationStandards.js`) |
| Single record detail | Key-value rows with `space-y-2` |
| Empty state | `<div className="empty-state"><p className="empty-state-text">` |
| Loading | `<p className="loading-text">` |

`inline-table` is for tabular data only. Never use it for categorized content, stat dashboards, or grouped layouts.

#### F-UI4: Styling — Single Source of Truth

All styles from: Tailwind utility classes, component classes in `globals.css` `@layer components`, or CSS variables in `globals.css` `:root`.

**Never:**
- `style={}` with raw values
- Hardcoded hex in JSX
- New `.css` files
- JS style objects

New repeated patterns → add a component class to `globals.css`.

#### F-UI5: Shared Components for Stateful Repeated UI

If a UI block with its own state and data fetching appears in more than one page, extract it to `apps/web/components/`. Never copy-paste stateful UI.

**Reference:** `DepreciationStandards.js`, `AssetInventoryPanel.js`.

#### F-UI6: Reference Implementations

| Purpose | File |
|---|---|
| Hub page layout + table style | `apps/web/pages/manager/requests.js` |
| Rich non-tabular content layout | `apps/web/pages/manager/legal/depreciation.js` |
| Shared stateful component | `apps/web/components/DepreciationStandards.js` |

#### F-UI7: English-Only Labels — No Hardcoded Translations

All user-visible text — UI labels, button text, status names, seed data (expense types, account names, descriptions), error messages, and tooltips — must be in **English only**.

- Seed data (`SWISS_RESIDENTIAL_TAXONOMY`, `SWISS_DEFAULT_ACCOUNTS`, etc.) must use English names and descriptions.
- Database content created via seed scripts, manual inserts, or admin forms must be English.
- Do not add German, French, or any other language strings anywhere in the codebase or seed data.
- Multilingual / i18n translation support will be implemented as a dedicated future epic. Until then, English is the single source language.

---

### 🔮 FUTURE RISK GUARDRAILS (F1–F8)

> These prevent long-term structural decay. They may not all be enforced today, but new code
> **must** respect them to avoid accruing the same debt we just cleaned up.

### F1: Production Cannot Start With Optional Auth
When `NODE_ENV=production`:
- `AUTH_OPTIONAL` must be `false`
- `AUTH_SECRET` must exist
- `DEV_IDENTITY_ENABLED` must NOT be `true` ✅ (added 2026-03-10, SA-6)
- Server must **refuse to boot** if any condition is violated
- Sensitive routes must use `requireAuth()` and `requireRole(...)` — no bypass in production paths

### F2: Org Scoping Must Be Explicit ✅ (M1 implemented)
Because `Request` has no `orgId` and multi-org is planned:
- All read/write operations for Requests, Jobs, Invoices, Leases, and Inventory must
  explicitly enforce org scope via join or helper function
- Add cross-org isolation tests when multi-org lands → **Done:** `orgIsolation.test.ts` (22 tests)
- No implicit org assumptions in query logic → **Done:** `governance/orgScope.ts` resolvers + `assertOrgScope`
- `getOrgIdForRequest()` returns `null` in production when unauthenticated → ✅ **Done 2026-03-10** (SA-1)
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

### F8: Styling System (Tailwind + CSS Variables)
Manager UI styling uses **Tailwind utility classes** backed by CSS custom properties in `apps/web/styles/globals.css`.
- `managerStyles.js` has been **deleted** — all tokens migrated to Tailwind classes and `@layer components` in globals.css
- No JS inline style objects for shared tokens — use Tailwind classes or component classes (`.tab-strip`, `.inline-table`, `.empty-state`, etc.)
- New shared styles must be added to globals.css `@layer components` or via `tailwind.config.js` theme extensions

<!-- reviewed 2026-03-14 -->

---

## 🚀 HARDENING GUIDELINES (H1–H6)

> **Full guidelines:** See [EPIC_HISTORY.md](EPIC_HISTORY.md) — search for "Hardening Infrastructure (H1–H6)".
>
> Summary: Route protection wrappers (H1), production boot guard (H2), shared proxy helper (H3), DTO tiers (H5), Request.orgId migration path (H6). All infrastructure delivered; incremental rollout in progress.

## 1. Project Goal & Architecture

> See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the full project summary, architecture diagram, personas, and task routing.
>
> Swiss property management platform. Node.js + TypeScript backend (raw `http.createServer`, port 3001), Next.js Pages Router frontend (port 3000), PostgreSQL 16 via Docker (Prisma ORM). Four personas: Manager, Contractor, Tenant, Owner.

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
│   │       ├── routes/       # Thin HTTP handlers (25 route modules)
│   │       ├── workflows/    # Orchestration layer (26 workflows + transitions)
│   │       ├── services/     # Domain logic
│   │       ├── repositories/ # Canonical Prisma access (23 repos)
│   │       ├── events/       # Domain event bus
│   │       ├── governance/   # Org scope resolvers
│   │       ├── validation/   # Zod schemas
│   │       ├── http/         # Body/JSON/query/errors/router helpers
│   │       ├── __tests__/    # 57 test suites
│   │       └── ARCHITECTURE_LOW_CONTEXT_GUIDE.md
│   └── web/
│       ├── pages/            # 275 pages (92 UI + 182 API proxies + _app.js)
│       ├── components/       # AppShell, layout primitives, shared UI
│       ├── lib/              # proxy.js, api.js, formatDisqualificationReasons.js
│       └── styles/           # globals.css (Tailwind + CSS variables)
├── packages/api-client/      # Typed API client (DTO types + fetch methods)
├── infra/docker-compose.yml  # PostgreSQL├── scripts/
│   ├── generate-roadmap.js   # HTML generator (~4.7k lines) — phases, intake, drafts, signals tabs
│   ├── roadmap-server.js     # REST API server (port 8111) — 25+ endpoints for roadmap CRUD
│   ├── roadmap-parser.js     # Intake parser + auto-triage + promotion engine (~1.4k lines)
│   ├── roadmap-shared.js     # Shared constants, ID generators, utilities
│   ├── roadmap-ticket.js     # CLI ticket creator + validator
│   └── roadmap.schema.json   # JSON Schema for ROADMAP.json validation
├── CONTRIBUTING.md           # Testing guide, port registry, contract test pattern, architecture guardrails
├── ROADMAP.json              # Product roadmap source of truth (26 features, 6 phases, 66 intake items, 37 draft tickets)
├── docs/roadmap.html         # Auto-generated roadmap dashboard (tracked in git; regenerated by pre-commit hook on every ROADMAP.json commit)└── .github/                  # CI + copilot-instructions.md
```

<!-- reviewed 2026-03-10 -->

## 4. Database Schema (Prisma)

> **Full schema reference:** See [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) for the complete models table (64 models), enums (55), schema gotchas, and Request.orgId migration path.
>
> **Status:** 71 migrations. 64 models · 55 enums. Last verified: 2026-04-06 (DT-022/INT-009/INT-025).
>
> **Quick gotchas (always check SCHEMA_REFERENCE.md for full list):**
> - `Request` has NO `orgId` — scope inherited via unit/building FK chain
> - `Job` has NO `description` — use `Request.description` via the relation
> - `Appliance` has NO `category` — lives on `AssetModel`
> - `Job.contractorId` is REQUIRED

<!-- reviewed 2026-03-10 -->
---

## 5. System Summary

> Architecture, backend layers, frontend layout, and styling rules → [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).
> Route module index, domain file maps, repository index → [ARCHITECTURE_LOW_CONTEXT_GUIDE.md](apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md).

* **Backend:** 25 route modules · 26 workflows · 23 repositories · 289 operations (224 URL paths) · `apps/api/openapi.yaml`
* **Frontend:** 275 pages (92 UI + 182 API proxies + `_app.js`) · 182/182 proxies conforming (`proxyToBackend()`)
* **Styling:** Tailwind + `@layer components` in `globals.css` · CSS variables in `:root` · `managerStyles.js` deleted (F8)
* **Infra:** PostgreSQL via Docker (`infra/docker-compose.yml`) · Dev DB `maint_agent` · Test DB `maint_agent_test` · CI: 6-gate pipeline (G1–G15)

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

## 10. Running the Project

> Full dev commands → [docs/DEV_COMMANDS.md](docs/DEV_COMMANDS.md).
>
> Quick start: `npm run dev:db` · `npm run dev:api` · `npm run dev:web` · `npm run dev:clean:all`

---

<!-- SYNC-FENCE: historical content below — do not auto-update counts -->

## 11. Completed Epics & Slices

> **Full history:** See [EPIC_HISTORY.md](EPIC_HISTORY.md) for all completed epic/slice narratives.
>
> Summary: 20+ epics completed (Feb–Mar 2026) covering cleanup, tenant asset context, inventory admin, owner-direct workflow, job lifecycle, invoicing, leases, digital signatures, tenant portal, org scoping, auth hardening, domain events, OpenAPI sync, rental applications, document OCR, financial performance, legal engine, legal auto-routing, workflow layer refactor, architecture hardening, asset inventory & depreciation, test database isolation, UI navigation & finance pages, and Chart of Accounts (FIN-COA).

| Epic | Date | Key Impact |
|------|------|------------|
| Security Hardening 1 + 2 | 2026-03-10 | SA-1 through SA-20 resolved (19 findings); `requireAnyRole()`, `requireTenantSession()` added |
| UI Navigation & Finance Pages | 2026-03 | 51/67 frontend audit findings fixed; payments/expenses/charges pages built |
| Frontend Rationalization | 2026-03-11 | Page inventory (`FRONTEND_INVENTORY.md`), proxy audit (116/119→119/119 conforming) |
| Frontend Debt Cleanup | 2026-03-12 | 4 pages deleted, 3 proxy migrations, `next.config.js` redirects |
| Prisma DTO Hardening Final | 2026-03-10 | 4 canonical includes for inventory, 2 `any` types eliminated |
| Roadmap Visual Redesign | 2026-03-10 | `generate-roadmap.js` rewritten, 26 features across 6 phases |
| Triage Rework (Slices 1–3) | 2026-03-11 | `OWNER_REJECTED` status + `ApprovalSource` enum; CTA rewrite; legal engine hardening |
| Legal Engine Remediation | 2026-03-11 | 93 corrupt rules cleaned; DSL evaluator supports `topic_match`, `AND`/`OR` |
| Navigation & UI Consistency | 2026-03-14 | Sidebar flattened, Tailwind unified, `managerStyles.js` deleted, Panel layout |
| Roadmap Pipeline Status Rename | 2026-03-21 | Status labels renamed (raw→capture, triaged→clarify, etc.) |
| Audit Remediation | 2026-03-21 | BA-01/BA-02 security fixes; `ISSUED` added to OpenAPI; `onDelete: Restrict` on Lease.unit |
| Legal Route Layer Extraction | 2026-03-22 | `legalService.ts` created; 26 direct Prisma calls removed from routes |
| Apply Wizard Selected-Units | 2026-03-22 | Selected-units summary panel in rental application wizard |
| Test Infrastructure Hardening | 2026-03-22 | Port deconfliction (3201–3219); 4 contract tests added; `CONTRIBUTING.md` created |
| Ticket Refinement Pass | 2026-03-22 | 17 draft tickets refined to full spec |
| Roadmap Sync & Generator Bugfixes | 2026-03-22 | `docs/roadmap.html` tracked in git; auto-regen on commit; 3 stale-signal bugs fixed |
| Chart of Accounts (FIN-COA) | 2026-03-23 | 3 new models (ExpenseType, Account, ExpenseMapping); 5 slices; invoice + lease classification |
| Roadmap Intake & Triage System | 2026-03-19 | 8.2k-line tooling: intake parser, auto-triage, promotion engine, REST API, HTML dashboard |
| General Ledger (FIN-LEDGER) | 2026-03-23 | LedgerEntry model; auto-posting from invoice workflows; journal + trial balance UI |
| Azure Document Intelligence | 2026-03-29 | Replaced Tesseract with Azure DI; `prebuilt-layout` model; Tesseract fallback intact |
| Migration Integrity Recovery | 2026-03-30 | 5 gap-filling migrations; G8 shadow DB exception retired permanently |
| Invoice Ingestion & Capture Sessions | 2026-03-30 | CaptureSession model; `POST /invoices/ingest`; QR code → phone upload → OCR → draft |
| Comprehensive Audit Remediation | 2026-03-31 | 46 findings resolved (CQ/SA/TC/SI/DOC); route→service extraction; 7 new test files |
| Recurring Invoices (6 slices) | 2026-04-03 | RecurringBillingSchedule, ChargeReconciliation, RentAdjustment, ContractorBillingSchedule; 5 new models, 6 enums, 4 migrations, 4 route modules, 4 repos, 10 frontend pages |

---

## 12. Backlog

### Not Implemented Yet (Active Backlog)

* Azure Document Intelligence tier upgrade — current Free F0 tier allows 500
  pages/month. Upgrade to S0 (~$1.50/1000 pages) before production go-live.
  Resource: `maintenance-agent-docintel`, West Europe.
* Lease Phase 3–5: DocuSign/Skribble integration, deposit payment tracking, archive workflow
* Role enforcement refinement (all routes protected; role granularity can be tightened further)
* Email delivery provider integration (EmailOutbox + dev sink implemented; no SMTP/SendGrid wired yet)
* Notifications push delivery (in-app notifications work; no push/email delivery)
* `reports.js` — define reporting scope before building (product decision required)
* Multi-org support (org scoping via M1; auth centralized via M2; DEFAULT_ORG_ID remains only in authz.ts dev/test fallback + orgConfig.ts bootstrap + tests; production returns null via SA-1 fix)
* Legal DSL variable resolver — wire LegalVariable values into DSL condition evaluation so rules can condition on ingested data (e.g. reference interest rate > 1.5%). Prerequisite for full canton-scoped rule evaluation. Depends on: LegalSource Scope slice (done).
* Consolidate DTO files — buildingDetail.ts was created as a standalone file; review whether it should be merged with other DTO definitions for consistency
* G8 consistency — `migrate deploy` was used instead of `migrate dev` for the building owner migration. Confirm local dev workflow always uses `migrate dev` going forward. *(Shadow DB exception retired 2026-03-31.)*
* Finance sub-pages (Payments, Expenses, Charges) — inline tab content shows plain text overflow with no link; implement full sub-pages when finance reporting scope is defined
* Sources tab in legal.js — confirm inline or stub, close the finding in AUDIT.md
* Hub tab content polish (low priority, on-demand): legal/rules, legal/evaluations, people/tenants, people/vendors, rfps tabs still use flat inline-table. Enrich when pages become high-traffic or users report friction
* ASSET_TYPE_COLORS in legal/depreciation.js uses hardcoded Tailwind color strings (bg-violet-100 text-violet-700 etc.) — these bypass the token system; migrate to CSS variables when depreciation page is next touched
* Dev auth token (`apps/web/pages/_app.js` `DEV_MANAGER_TOKEN`) expires 2027-03-15.
  Regenerate with: `cd apps/api && node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({userId:'dev-user',orgId:'default-org',email:'dev@local',role:'MANAGER'},'dev-secret-key-12345',{expiresIn:'365d'}))"`
  Replace `DEV_MANAGER_TOKEN` in `_app.js` with the new value.
  Also ensure `dev-user` exists in the DB: `cd apps/api && npx prisma db seed` (safe — upsert only).

### Multi-org Architecture Initiative
**Priority:** High — every new feature built around current partial scoping increases future migration cost
**Status:** Deferred — no timeline set
**Context:** `Request` has no `orgId` (scoped via FK chain). `DEFAULT_ORG_ID` remains in `authz.ts` dev fallback. Production null guard is in place (SA-1). Full multi-org requires: adding `orgId` to `Request` (7-step migration documented in SCHEMA_REFERENCE.md), auditing all queries for cross-org leakage, removing `DEFAULT_ORG_ID` entirely.
**Prerequisite:** Product decision on multi-org timeline before any code is written.

### Custom HTTP Stack Evaluation
**Priority:** Medium — evaluate before the team grows or route count exceeds ~200
**Status:** Deferred — explicit re-evaluation recommended at next architecture review
**Context:** Backend uses raw `http.createServer()` with custom routing (247 operations across 190 URL paths, manual URL parsing, custom auth wrappers, binary forwarding). This was the right call early. At current scale the question is whether the maintenance burden of a bespoke stack outweighs the dependency cost of Express or Fastify. Decision should be made explicitly rather than by default.
**Prerequisite:** Architecture review session — not a Copilot task.

### Future Vision (Deferred)

Conversational tenant intake with phone-based identification, automatic asset inference from unit inventory, and contractor availability scheduling.

### Known Technical Debt

- **Pre-existing test interaction failures (TC-11):** ~10 legacy test suites still use local `startServer` copies instead of canonical `testHelpers.ts`. These can fail when run in full serial mode but pass individually. All new test files (since 2026-03-22) use the shared helpers. Migration of remaining suites is low priority — track via `--testPathPattern` workaround. *(Partially resolved 2026-03-31: `startTestServer`/`stopTestServer` extracted to `testHelpers.ts`; all new tests use canonical helpers.)*

<!-- reviewed 2026-03-10 -->

---

<!-- Auto-sync log quarantined to docs/sync-log.md (DOC-1, 2026-03-31) -->


<!-- auto-sync 2026-03-31: models 53→54, models 53→54, models 53→54, models 53→54, models 53→54, models 53→54, enums 42→47, enums 42→47, enums 42→47, enums 42→47, enums 42→47, migrations 53→60, migrations 53→60, migrations 53→60, migrations 53→60, migrations 53→60, suites 45→56, suites 45→56, suites 45→56, suites 10→56 -->

### State Integrity

This document + companion files are the **single source of truth**:

* **Doc structure:** PROJECT_STATE.md (~630 lines) + EPIC_HISTORY.md (epics) + SCHEMA_REFERENCE.md (schema) + ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup)
* Filesystem (verified 2026-03-10)
* Database schema — 69 migrations; 64 models, 55 enums verified in live DB (shadow DB replay clean 2026-03-31)
* Database data — 99+ assets across 19 units (with interventions tracking), 274 depreciation standards (including 5 added for mapped topics), 16 category mappings, buildings with cantons set, 6 CO 259a statutory rules with proper DSL (verified 2026-03-07)
* Running system — core smoke endpoints return expected status codes; auth-gated routes return 401/403 without valid token (verified by `auth.manager-gates.test.ts`); legal auto-routing creates RFP and sets RFP_PENDING for requests with mapped categories when autoLegalRouting=true; asset inventory endpoints serve depreciation data (verified 2026-03-31)
* Dev auth bootstrap: Canonical dev manager is user `d93436c1-6568-4dba-8e65-fd8d34e6be2b` (email `manager@local.dev`), created via the auth flow. The legacy `dev-user` still exists in DB but is no longer used as the manager identity — notifications were migrated to `d93436c1`. Long-lived JWTs in `_app.js`; bootstrap is expiry-aware (expired tokens are auto-replaced on next page load, no manual `localStorage.clear()` needed). All three dev tokens expire 2027-03-15.
* **Multi-role auth system:** `STAFF_ROLES` array in `apps/api/src/authz.ts` is the single extension point for adding new staff roles. Currently: MANAGER, OWNER, VENDOR, INSURANCE. `requireStaffAuth()` guards all notification endpoints. Frontend `_app.js` bootstraps role-specific tokens under `authToken` (manager), `ownerToken`, `vendorToken` keys; `NotificationBell` reads the token matching its `role` prop. Adding a new role: (1) add string to `STAFF_ROLES`, (2) add entry to `DEV_TOKENS` in `_app.js`, (3) add seed user in `prisma/seed.ts`. Nothing else changes. Dev users: `d93436c1` (MANAGER, canonical), `dev-owner` (OWNER), `dev-vendor` (VENDOR). Schema `Role` enum: TENANT, CONTRACTOR, MANAGER, OWNER, VENDOR, INSURANCE (migration 35).
* Frontend navigation — sidebar: 7 flat primary nav items, no accordion. All 7 manager hub pages use inline tab content with URL-based tab persistence (?tab=key). Tab header links: always-visible "Full view →" for tabs with richer standalone pages; absent for equivalent pages. All manager pages wrapped in Panel component for consistent white card layout. Verified 2026-03-14.
* Test suite — **823 tests, 57 suites against maint_agent_test** (isolated from dev DB `maint_agent`) (verified 2026-04-03); pre-existing test interaction failures (TC-11 — legacy `startServer` copy-paste in ~57 suites; canonical `testHelpers.ts` used by all new tests).
  - ✅ **TC-4 resolved (2026-03-10):** `jest.config.js` now has `maxWorkers: 1` — integration tests run serially, eliminating parallel server spawning timeouts.
  - ✅ **TC-5 resolved (2026-03-10):** Port collision on 3206 fixed — ports reassigned: rentalContracts → 3206, rentEstimation → 3209, ia.test → 3210, tenantSession → 3208.
  - Pure-function suites (**domainEvents, httpErrors, orgIsolation, routeProtection, triage**) always pass — they do not spawn a server.
* Test DB: `maint_agent_test` (isolated) — requires seed scripts after fresh creation (see G11)
* TypeScript compilation — 0 errors (verified 2026-03-12)
* OpenAPI spec — ISSUED added to InvoiceStatus enum (2026-03-21); 3 ledger routes + LedgerEntry/AccountBalance/Pagination schemas added (2026-03-23); building owner routes remain in KNOWN_UNSPECCED_ROUTES (API-03, medium priority)
* Git — all recent work committed to main. Legal route extraction (legalService.ts), DT-027/111/112/113, ticket refinements, roadmap sync fixes, CONTRIBUTING.md, General Ledger epic — all in history.
* Architectural intent — 26 workflows, 24 repositories, 25 route modules, 7 transition maps (Request, Job, Invoice, Lease, RentalApplication, Rfp, RfpQuote)
* Roadmap system — 26 features (P0–P4), 66 intake items, 37 draft tickets (18 refined, 9 ready_candidate, 2 needs_investigation, 8 promoted), 0 custom items. Server on port 8111. HTML dashboard at `docs/roadmap.html` (now tracked in git, auto-regenerated by pre-commit hook). Status labels: capture/clarify/review/ready (renamed from raw/triaged/drafted/draft).
* CI pipeline enforces G1–G15 guardrails

Safe to:

* Pause work
* Resume later
* Onboard collaborators
* Refactor deliberately

⚠️ **Before any code change, re-read the 🛡️ GUARDRAILS section at the top of this file.**

<!-- reviewed 2026-03-10 -->

---

✅ **Project stabilized, security-hardened, org-scoped, and UI-connected (2026-04-03).** 823/823 tests pass, 57 suites, 0 TS errors. 91/94 audit findings resolved. Backend: ~62k LOC | Frontend: ~42k LOC | 289 API operations | 64 Prisma models | 55 enums | 275 frontend pages | 26 workflows | 25 route modules. Recurring Invoices epic complete (6 slices): RecurringBillingSchedule + ChargeReconciliation + ChargeReconciliationLine + RentAdjustment + ContractorBillingSchedule models; ACOMPTE reconciliation, CPI rent indexation, contractor recurring invoices with full lifecycle. Roadmap: 26 features, 66 intake items, 37 draft tickets (all refined), 8.2k+ lines tooling; HTML dashboard tracked in git with auto-regeneration on commit. See [EPIC_HISTORY.md](EPIC_HISTORY.md) for full completion details.


## 13. Authentication & Testing

### Auth — Implemented and hardened (2026-03-10)

JWT-based. Production boot guard enforced (F1). All routes auth-gated. `AUTH_OPTIONAL=true` for dev only.

> **Auth helpers table:** See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) § Auth Helpers.
> **Security hardening (SA-1–SA-22):** All resolved — see [EPIC_HISTORY.md](EPIC_HISTORY.md).
> **Prisma/DTO hardening (CQ-7/12/13/14):** All resolved — see [EPIC_HISTORY.md](EPIC_HISTORY.md).

### Testing — 823 tests, 57 suites

* Jest + ts-jest, `maxWorkers: 1` (serial integration). Test DB: `maint_agent_test` (isolated via `.env.test`).
* CI: `.github/workflows/ci.yml` with PostgreSQL service container.
* Pre-existing test interaction (TC-11): ~10 legacy suites use local `startServer` copies; all new tests use canonical `testHelpers.ts`.

<!-- reviewed 2026-03-10 -->

---

## Document Integrity

| Field | Value | Source |
|-------|-------|--------|
| Models | 64 | prisma/schema.prisma — derived |
| Enums | 55 | prisma/schema.prisma — derived |
| Migrations | 69 | prisma/migrations/ — derived |
| Workflows | 26 | src/workflows/ — derived |
| Repositories | 24 | src/repositories/ — derived |
| Route modules | 25 | src/routes/ — derived (excl. helpers.ts utility) |
| Backend LOC | ~62k | src/ (incl. tests) — derived |
| Frontend LOC | ~42k | apps/web/ — derived |
| Frontend pages | 275 | apps/web/pages/ — derived (92 UI + 182 API + _app.js) |
| API operations | 289 | openapi.yaml operationId count — derived |
| URL paths | 224 | openapi.yaml unique paths — derived |
| Tests | 57 suites (pre-existing test interaction failures, see TC-11) | jest — derived |
| Proxy conformance | 182 / 182 | apps/web/pages/api/ — derived |
| Transition maps | 7 | src/workflows/transitions.ts — derived |
| Audit findings open | 3 (SI-2/3/4: legal model orgId doc drift) | docs/AUDIT.md — manual |
| Audit findings resolved | 91 | docs/AUDIT.md — manual |
| Last auto-sync | 2026-04-03 | blueprint.js |
| Last manual review | 2026-04-03 | human |

> Derived fields are auto-updated by `npm run blueprint`. Manual fields must be updated at the end of each slice.

---

## Owner Surface Segregation Rules

> **Full rules:** See [docs/OWNER_SURFACE.md](docs/OWNER_SURFACE.md) — dashboard vs reporting separation, shared-topic framing, implementation preference, copy guidance.
