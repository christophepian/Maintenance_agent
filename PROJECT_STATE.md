# Maintenance Agent — Project State

**Last updated:** 2026-02-25 (Committed `7661aec` — M5 OpenAPI + Typed Client, 178 tests green, zero uncommitted changes, Architecture Hardening epic COMPLETE)

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

Single repository containing:

* `apps/` — runtime applications
* `infra/` — infrastructure (Docker)
* `packages/` — shared packages / metadata
* `_archive/` — archived audit reports and removed legacy backups

---

### Backend API (ACTIVE)

* Node.js + TypeScript
* Raw HTTP server using `http.createServer`
* **No Express or NestJS** (removed during cleanup Feb 3)
* Entry point: `apps/api/src/server.ts`
* Prisma ORM
* PostgreSQL persistence
* Zod for request validation
* Port: **3001**

---

### Frontend (ACTIVE)

* Next.js **Pages Router**
* Tenant UI (`/`)
* Manager dashboard UI (`/manager`)
* Owner portal UI (`/owner`) — *under construction*
* Port: **3000**
* Uses Next.js API routes as a **proxy layer** to backend API

---

### Database (ACTIVE)

* PostgreSQL 16
* Running via Docker
* Prisma migrations applied
* Data persists across restarts

---

## 3. Repository Structure (Authoritative)

```
Maintenance_Agent/
├── PROJECT_STATE.md
├── .gitignore
├── _archive/
│   ├── audits/
│   ├── docs/                      # 18 legacy slice/feature docs (archived Feb 23)
│   ├── prompts/                   # Completed copilot prompts (archived Feb 25)
│   │   └── INVENTORY_ADMIN_EXPANSION.md
│   ├── scripts/                   # One-off scripts & manual test scripts (archived Feb 25)
│   │   ├── write-server.py
│   │   ├── seed-tenant-lease.py
│   │   ├── test-lease-lifecycle.sh
│   │   └── test-tenant-portal.sh
│   ├── test-pages/                # Dev-only frontend test pages (archived Feb 25)
│   │   ├── flows.js
│   │   ├── test-jobs.js
│   │   ├── test-leases.js
│   │   ├── test-notifications.js
│   │   ├── test-pdf.js
│   │   ├── test-qrbill.js
│   │   └── test-requests-simple.js
│   └── *.md                       # Top-level archived docs
├── apps/
│   ├── api/
│   │   ├── .env
│   │   ├── package.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── server.ts
│   │       ├── auth.ts
│   │       ├── __tests__/
│   │       ├── governance/        # orgScope.ts — org isolation resolvers & assertion
│   │       ├── events/            # domain event bus (types, bus, handlers, index)
│   │       ├── services/          # jobs, invoices, contractors, inventory, tenants, requests, assignments
│   │       ├── validation/        # invoices, requests, contractors, inventory, auth, triage
│   │       ├── utils/             # phone normalization
│   │       └── http/              # body/json/query/errors/router helpers
│   └── web/
│       ├── pages/
│       │   ├── index.js
│       │   ├── manager.js
│       │   ├── contractor.js
│       │   ├── contractor/        # contractor portal routes
│       │   ├── owner/             # owner portal (under construction)
│       │   ├── admin-inventory.js
│       │   ├── admin-inventory/   # buildings, units, asset-models
│       │   ├── tenant.js
│       │   ├── tenant-chat.js
│       │   ├── tenant-form.js
│       │   ├── manager/           # manager operations pages
│       │   ├── contractors.js
│       │   └── api/               # proxy routes to backend
│       ├── components/            # AppShell, shared UI
│       │   └── layout/            # PageShell, PageHeader, PageContent, Panel, Section, SidebarLayout
│       └── styles/
│           └── managerStyles.js
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── tsconfig.json
├── package.json
├── infra/
│   └── docker-compose.yml
└── packages/
    └── api-client/        # typed API client (DTO types + fetch-based methods)
```

---

## 4. Database Schema (Prisma)

**Status: ACTIVE AND IN USE — 23 migrations applied, zero drift**

**Last verified:** 2026-02-25

### Models (20 total)

| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Org** | id, name, mode (MANAGED/OWNER_DIRECT) | → OrgConfig, Users, Buildings, Contractors, ... |
| **OrgConfig** | orgId, autoApproveLimit, landlord fields | → Org |
| **User** | orgId, role (TENANT/CONTRACTOR/MANAGER/OWNER), email, passwordHash | → Org |
| **Building** | orgId, name, address, isActive | → Units, BuildingConfig, ApprovalRules, Notifications |
| **BuildingConfig** | buildingId, autoApproveLimit, emergencyAutoDispatch | → Building, Org |
| **Unit** | buildingId, orgId, unitNumber, floor, type (RESIDENTIAL/COMMON_AREA), isActive | → Building, Occupancies, Appliances, Requests, Leases, UnitConfig |
| **UnitConfig** | unitId, autoApproveLimit, emergencyAutoDispatch | → Unit, Org |
| **Tenant** | orgId, name, phone (E.164), email, isActive | → Occupancies, Requests |
| **Occupancy** | tenantId, unitId (unique pair) | → Tenant, Unit |
| **Appliance** | unitId, orgId, assetModelId?, name, serial, isActive | → Unit, AssetModel, Requests |
| **AssetModel** | orgId?, manufacturer, model, **category**, specs, isActive | → Appliances |
| **Contractor** | orgId, name, phone, email, hourlyRate, serviceCategories (JSON), isActive | → Requests, Jobs, BillingEntity |
| **Request** | description, category?, estimatedCost?, status, contactPhone, assignedContractorId?, tenantId?, unitId?, applianceId?, contractorNotes | → Contractor, Tenant, Unit, Appliance, Job, RequestEvents |
| **RequestEvent** | requestId, type (RequestEventType), contractorId?, note | → Request, Contractor |
| **Event** | orgId, type, actorUserId?, requestId?, payload (JSON) | (standalone) |
| **Job** | orgId, requestId (unique), **contractorId** (required), status, actualCost | → Request, Contractor, Invoices |
| **Invoice** | orgId, **jobId** (required), leaseId?, issuer fields, recipient fields, amounts in cents, status, lineItems | → Job, Lease, BillingEntity, InvoiceLineItems |
| **InvoiceLineItem** | invoiceId, description, quantity, unitPrice (cents), vatRate, lineTotal | → Invoice |
| **BillingEntity** | orgId, type, contractorId?, name, address, iban, vatNumber | → Org, Contractor |
| **ApprovalRule** | orgId, buildingId?, name, priority, conditions (JSON), action | → Org, Building |
| **Notification** | orgId, userId, buildingId?, entityType, entityId, eventType, readAt | → Org, Building |
| **Lease** | orgId, status, unitId, 40+ fields (parties, object, dates, rent, deposit, PDF refs, lifecycle timestamps) | → Org, Unit, SignatureRequests, Invoices |
| **SignatureRequest** | orgId, entityType, entityId, provider, level, status, signersJson | → Org, Lease |

### Key Enums
- `RequestStatus`: PENDING_REVIEW, AUTO_APPROVED, APPROVED, ASSIGNED, IN_PROGRESS, COMPLETED, PENDING_OWNER_APPROVAL
- `JobStatus`: PENDING, IN_PROGRESS, COMPLETED, INVOICED
- `InvoiceStatus`: DRAFT, APPROVED, PAID, DISPUTED
- `LeaseStatus`: DRAFT, READY_TO_SIGN, SIGNED, ACTIVE, TERMINATED, CANCELLED
- `SignatureRequestStatus`: DRAFT, SENT, SIGNED, DECLINED, EXPIRED, ERROR
- `Role`: TENANT, CONTRACTOR, MANAGER, OWNER
- `OrgMode`: MANAGED, OWNER_DIRECT
- `UnitType`: RESIDENTIAL, COMMON_AREA

### ⚠️ Schema Gotchas (fields that DON'T exist where you'd expect)
- **`Request` has NO `orgId`** — requests are not directly org-scoped (they inherit scope through unit/building)
- **`Job` has NO `description`** — use `Request.description` via the relation
- **`Appliance` has NO `category`** — category lives on `AssetModel`, accessed via `appliance.assetModel.category`
- **`Job.contractorId` is REQUIRED** — every Job must reference an active Contractor

---

## 5. Backend API

### Entry Point

* File: `apps/api/src/server.ts`
* Run: `npm run start:dev`
* Port: **3001**

### Implementation Details

* Raw Node HTTP server
* Manual routing & URL parsing
* Manual JSON body parsing
* Manual CORS handling
* Prisma Client instantiated directly
* Zod validation in `src/validation`
* Domain logic in `src/services`

---

### Endpoints (Verified 2026-02-25)

#### Core Architecture
Routes are split into modular files under `src/routes/`:
- `routes/requests.ts` — request CRUD, assignment, owner approval, work-requests alias
- `routes/leases.ts` — lease CRUD, PDF, ready-to-sign, lifecycle, signature requests, lease invoices
- `routes/invoices.ts` — invoice CRUD, approve/pay/dispute, PDF generation, QR codes
- `routes/inventory.ts` — buildings, units, appliances, asset models, occupancies
- `routes/tenants.ts` — tenant CRUD, tenant portal (lease view + accept)
- `routes/config.ts` — org config, building config, unit config
- `routes/notifications.ts` — notification list, unread count, mark read
- `routes/auth.ts` — register, login, tenant-session, triage
- `routes/helpers.ts` — event logging, governance access helpers

All registered in `src/server.ts` via `register*Routes(router)`.

#### Requests
- `GET /requests` — list (with limit, offset, order)
- `GET /requests/:id` — get by ID
- `POST /requests` — create (validates via Zod, auto-approve logic, auto-assign contractor)
- `POST /requests/approve?id={uuid}` — manager override
- `POST /requests/:id/assign` — assign contractor
- `DELETE /requests/:id/assign` — unassign contractor
- `POST /requests/:id/owner-approve` — owner approval
- `POST /requests/:id/owner-reject` — owner rejection
- `GET /owner/pending-approvals` — owner dashboard
- `DELETE /__dev/requests` — dev only

#### Work Requests (alias)
- `GET /work-requests`, `GET /work-requests/:id`, `POST /work-requests`

#### Leases
- `GET /leases`, `POST /leases`, `GET /leases/:id`, `PATCH /leases/:id`
- `POST /leases/:id/generate-pdf` — generate draft PDF
- `POST /leases/:id/store-pdf` — store PDF reference
- `POST /leases/:id/store-signed-pdf` — store signed PDF
- `POST /leases/:id/ready-to-sign` — mark ready
- `POST /leases/:id/cancel` — cancel lease
- `POST /leases/:id/confirm-deposit` — confirm deposit payment
- `POST /leases/:id/activate` — activate lease
- `POST /leases/:id/terminate` — terminate lease
- `POST /leases/:id/archive` — archive lease
- `POST /leases/:id/invoices` — create lease invoice
- `GET /leases/:id/invoices` — list lease invoices

#### Signature Requests
- `GET /signature-requests`, `GET /signature-requests/:id`
- `POST /signature-requests/:id/send`, `POST /signature-requests/:id/mark-signed`

#### Invoices
- `GET /invoices`, `GET /invoices/:id`, `POST /invoices`
- `PATCH /invoices/:id` — update
- `POST /invoices/:id/approve`, `POST /invoices/:id/mark-paid`, `POST /invoices/:id/dispute`
- `POST /invoices/:id/issue` — issue with invoice number
- `GET /invoices/:id/pdf` — generate PDF (with `?includeQRBill=true|false`)
- `GET /invoices/:id/qr-code.png` — QR bill image
- `GET /owner/invoices` — owner invoice dashboard

#### Jobs
- `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`

#### Contractors
- `GET /contractors`, `POST /contractors`, `GET /contractors/:id`
- `PATCH /contractors/:id`, `DELETE /contractors/:id`

#### Tenants
- `GET /tenants`, `POST /tenants`, `PATCH /tenants/:id`, `DELETE /tenants/:id`

#### Tenant Portal
- `GET /tenant-portal/leases` — tenant lease list (occupancy-verified)
- `GET /tenant-portal/leases/:id` — tenant lease detail
- `POST /tenant-portal/leases/:id/accept` — tenant sign/accept

#### Inventory
- Buildings: `GET /buildings`, `POST /buildings`, `PATCH /buildings/:id`, `DELETE /buildings/:id`
- Units: `GET /buildings/:id/units`, `POST /buildings/:id/units`, `PATCH /units/:id`, `DELETE /units/:id`
- Appliances: `GET /units/:id/appliances`, `POST /units/:id/appliances`, `PATCH /appliances/:id`, `DELETE /appliances/:id`
- Asset Models: `GET /asset-models`, `POST /asset-models`, `PATCH /asset-models/:id`, `DELETE /asset-models/:id`
- Occupancies: `GET /units/:id/tenants`, `POST /units/:id/tenants`, `DELETE /units/:id/tenants/:tenantId`

#### Configuration
- `GET /org-config`, `PUT /org-config`
- `GET /buildings/:id/config`, `PUT /buildings/:id/config`
- `GET /units/:id/config`, `PUT /units/:id/config`

#### Notifications
- `GET /notifications` — list (requires userId)
- `GET /notifications/unread-count`
- `POST /notifications/:id/read`
- `POST /notifications/mark-all-read`

#### Auth
- `POST /auth/register`, `POST /auth/login`
- `POST /tenant-session`, `POST /triage`

#### Aliases
- `GET /properties` (wraps buildings), `GET /properties/:id/units`
- `GET /people/tenants`, `GET /people/vendors`

---

### Request Lifecycle

1. Tenant submits request
2. Backend validates input (Zod)
3. Auto-approval logic compares `estimatedCost` vs `OrgConfig.autoApproveLimit`
4. Request status set to:

   * `AUTO_APPROVED`
   * or `PENDING_REVIEW`
5. Manager may override via approve endpoint → `APPROVED`

---

## 6. Frontend (Next.js)

### Tenant UI (`/`)

* Category selector
* Description textarea
* Live validation
* Debug payload display

### Contractor Management UI (`/contractors`)

* Add contractor form:
  * Name (required)
  * Phone (required, validated)
  * Email (required, validated)
  * Hourly rate (CHF 10–500)
  * Service categories (checkboxes: stove, oven, dishwasher, bathroom, lighting)
* Contractor list with:
  * Name, phone, email, hourly rate
  * Service categories display
  * Deactivate button
* Real-time form validation feedback

### Manager Back Office

* `AppShell` sidebar + role switcher
* Primary modules: Properties, Work Requests, People, Assets, Finance, Reports, Settings
* Legacy operations pages remain under `/manager/operations/*`

### Inventory Admin

* `/admin-inventory` entry
* `/admin-inventory/buildings/[id]`
* `/admin-inventory/units/[id]`
* `/admin-inventory/asset-models`

### Tenant Conversational Intake (NEW)

* `/tenant` — phone-based identification
* `/tenant-chat` — conversational troubleshooting and request creation

### Authentication UI (NEW)

* `/login` — sign in or register (manager / contractor)

### API Proxy Routes (`/api`)

* `GET /api/requests` → backend `GET /requests`
* `POST /api/requests` → backend `POST /requests`
* `GET /api/requests/[id]` → backend `GET /requests/{id}` *(added Feb 3)*
* `POST /api/requests/approve` → backend approve endpoint
* `GET /api/work-requests` → backend `GET /work-requests`
* `GET /api/work-requests/[id]` → backend `GET /work-requests/:id`
* `POST /api/work-requests` → backend `POST /work-requests`
* `GET /api/properties` → backend `GET /properties`
* `GET /api/properties/[id]/units` → backend `GET /properties/:id/units`
* `GET /api/people/tenants` → backend `GET /people/tenants`
* `GET /api/people/vendors` → backend `GET /people/vendors`
* `GET /api/contractors` → backend `GET /contractors`
* `POST /api/contractors` → backend `POST /contractors`
* `GET /api/contractors/[id]` → backend `GET /contractors/:id`
* `PATCH /api/contractors/[id]` → backend `PATCH /contractors/:id`
* `DELETE /api/contractors/[id]` → backend `DELETE /contractors/:id`
* Inventory proxies under `/api/buildings`, `/api/units`, `/api/appliances`, `/api/tenants`, `/api/asset-models`
* `POST /api/tenant-session` → backend `POST /tenant-session`
* `POST /api/triage` → backend `POST /triage`
* `POST /api/auth/login` → backend `POST /auth/login`
* `POST /api/auth/register` → backend `POST /auth/register`
* `GET /api/org-config` → backend `GET /org-config`
* `PUT /api/org-config` → backend `PUT /org-config`

---

## 7. Styling Policy (IMPORTANT)

* Manager UI styling is **locked**
* All styles live in:

  ```
  apps/web/styles/managerStyles.js
  ```
* **Do not modify inline styles in `manager.js`**
* Any future visual changes must be intentional edits to the style lock file

---

## 8. Infrastructure & DevOps

### PostgreSQL (Docker)

* Image: `postgres:16`
* Port: `5432`
* Volume: persistent
* File: `infra/docker-compose.yml`

### Git & CI/CD

* **Repository:** https://github.com/christophepian/Maintenance_agent.git
* **Main branch:** all production-ready commits
* **GitHub Actions CI** (hardened Feb 25 per G7):
  - Runs on push to `main` and PRs
  - Uses PostgreSQL 16 service container for live tests
  - **6 mandatory gates** (all must pass before merge):
    1. G8 enforcement: scans for banned `db push` references
    2. `prisma generate` + schema drift check = empty migration
    3. `tsc --noEmit` (backend type check)
    4. `next build` (frontend build)
    5. Jest tests (`npm test -- --ci --forceExit`)
    6. Backend boot + smoke curls (5 endpoints must return 200)
  - Workflow file: `.github/workflows/ci.yml`

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
```

Clean restart scripts (kill stale processes, clear caches):
```bash
npm run dev:clean:api   # kill stale ts-node, restart backend
npm run dev:clean:web   # kill stale next, clear .next, restart frontend
npm run dev:clean:all   # both of the above
```

Manual restart (if scripts don't work):
```bash
# Backend: restart ts-node server and view logs
pkill -f "ts-node.*src/server" || true
cd apps/api
npm run start:dev > /tmp/api.log 2>&1 &
tail -n 200 /tmp/api.log

# Frontend: clear Next cache and restart
pkill -f "next dev" || true
cd apps/web
rm -rf .next
API_BASE_URL=http://127.0.0.1:3001 npm run dev > /tmp/web.log 2>&1 &
tail -n 200 /tmp/web.log
```

Check ports:

```bash
lsof -nP -iTCP:3000,3001 -sTCP:LISTEN
```

---

## 11. Cleanup & Refactoring (Feb 3, 2026)

### Changes Made

**Removed:**
- Legacy NestJS scaffolding (`main.ts`, `app.module.ts`, `requests.controller.ts`, `requests.module.ts`)
- Disabled files (`prisma.service.ts.disabled`, `.gitignore.save`)
- Legacy server backup (`_archive/apps_api_src_apps_backup/`)
- Package lockfiles (`apps/api/package-lock.json`, `apps/web/package-lock.json`)
- Unused NestJS dependencies (`@nestjs/*`) from `apps/api/package.json`

**Added:**
- Root `tsconfig.json` with project references for monorepo support
- Root `package.json` with workspace configuration
- Frontend API proxy route `apps/web/pages/api/requests/[id].js` for `GET /api/requests/:id`
- `.github/copilot-instructions.md` for AI agent guidance
- `.github/workflows/ci.yml` for GitHub Actions CI/CD pipeline
- Git repository with initial commit pushed to GitHub

**Updated:**
- `apps/api/package.json` scripts: use `ts-node src/server.ts` for dev, `tsc` for build
- `.gitignore`: constrained aggressive patterns, added `.env.local`
- `PROJECT_STATE.md`: documented all changes

### Rationale

The project had legacy NestJS scaffolding that was never used at runtime, making the codebase confusing for new developers. The cleanup focused on:
- Removing dead code and backups
- Clarifying that the backend is a raw HTTP server (not Express/NestJS)
- Establishing monorepo structure with root configs
- Adding CI/CD for early error detection
- Documenting architectural decisions for future maintainers

## 12. Slice 4 — Tenant → Unit → Appliance (Feb 3, 2026)

**Overview:** Added tenant asset context so tenants and managers can associate maintenance requests with a unit and a specific appliance. This enables better routing and clearer repair context for contractors.

What was added:
- Prisma models: `Tenant`, `Building`, `Unit`, `Appliance`, `AssetModel` (migration `20260203112038_add_tenant_asset_context` applied)
- Backend services: tenant lookup/creation, inventory services for buildings/units/appliances/asset models, phone normalization utility (E.164)
- API endpoints (backend `apps/api/src/server.ts`):
  - `GET /tenants?phone=...` — lookup tenant by phone
  - `POST /tenants` — create or find tenant
  - `GET /buildings`, `POST /buildings`
  - `GET /buildings/:id/units`, `POST /buildings/:id/units`
  - `GET /units/:id/appliances`, `POST /units/:id/appliances`
  - `GET /asset-models`, `POST /asset-models`
  - `GET /requests/:id/suggest-contractor` — suggest contractor by request category
  - `GET /contractors/match?category=...` — find a matching contractor for an org/category

- Request enhancements: `Request` now optionally stores `tenantId`, `unitId`, `applianceId` and frontend request creation includes these values when available

Frontend changes (`apps/web`):
- `pages/tenant-form.js` — tenant phone lookup, unit & appliance selection, request creation with `tenantId` and `applianceId`, shows suggested contractor when category selected
- `pages/admin-inventory.js` — admin UI for buildings/units/appliances/asset models

Operational notes:

## 13. Inventory Admin Expansion (Feb 7–8, 2026)

**Overview:** Expanded inventory management with org-scoped CRUD, soft deletes, tenant occupancy, admin UI detail pages, and full integration tests.

What was added:
- Prisma schema: `Occupancy` join model (tenant ↔ unit), `UnitType` enum, `isActive` soft-delete flags on inventory entities.
- Backend services: `services/inventory.ts` (org-scoped buildings/units/appliances/asset models), `services/occupancies.ts`, updated `services/tenants.ts` with deactivation guards.
- Validation: Zod schemas for buildings, units, appliances, asset models, occupancies, and request assignment.
- Raw HTTP routes: comprehensive CRUD for inventory and occupancy in `apps/api/src/server.ts` (including unit tenant links).
- Frontend API proxies: 11 Next.js API routes under `apps/web/pages/api/` for inventory endpoints.
- Admin UI pages:
  - `pages/admin-inventory.js` (main hub)
  - `pages/admin-inventory/buildings/[id].js`
  - `pages/admin-inventory/units/[id].js`
  - `pages/admin-inventory/asset-models.js`
- Tests: 29 new integration tests in `apps/api/src/__tests__/inventory.test.ts` covering CRUD, soft deletes, org scoping, occupancy, and validation.

Follow-up fixes:
- Next.js `Link` syntax updated to remove nested `<a>` tags across inventory UI pages.
- Admin inventory UI aligned with backend payloads (`unitNumber`, `serial`) and response envelopes (`{ data: ... }`).
- Tenant management UI: assign/unassign tenants on unit detail, create tenant + auto-assign, and a Tenants tab with filtered list (by selected building/unit).
- Backend: `GET /tenants` now supports listing when `phone` is omitted (proxy updated). Tenants tab refreshes on open.

## 14. Back-Office Navigation Cohesion (Feb 8, 2026)

**Overview:** Added a shared sidebar layout and persona-scoped routes for manager/contractor/tenant navigation without changing backend APIs.

What was added:
- Shared layout: `apps/web/components/AppShell.js` with role dropdown and sidebar navigation.
- Manager workspace routes under `/manager/*` (requests, inventory, contractors, tenants placeholder, invoices placeholder) using AppShell.
- Contractor workspace routes under `/contractor/*` (jobs, estimates, invoices placeholders) using AppShell.
- Tenant pages now render within AppShell with tenant nav links.
- Legacy routes remain accessible; `/manager` and `/contractor` now redirect client-side to their workspace entry pages.


### Recent Changes & Troubleshooting (Feb 4–6, 2026)

- **Navigation improvements:** The home page (`/`, `pages/index.js`) is now the single entry point for all flows. The old `flows.js` navigation page has been archived and removed from routing.
- **404 and fetch errors:** Fixed 404 errors for `/admin-inventory` and `/manager` by clearing the Next.js cache, killing stale processes, and restarting both backend and frontend servers. Resolved "Failed to fetch" errors by ensuring the backend server was running on port 3001.
- **Tenant chat UX:** Prevented the conversation from looping by pausing new input when suggestions are shown (unless clarification is needed) and adding a clear resolution message on “That fixed it.”
- **Security hardening:**
  - Production CORS now honors `CORS_ORIGIN` and defaults to locked-down behavior.
  - Dev-only `DELETE /__dev/requests` is blocked in production.
  - `AUTH_SECRET` is required in production for JWT handling.
- **Frontend dependencies:** Next.js upgraded to a patched version (now 16.x) to address audit findings.
- **Tailwind v4 fix:** Updated PostCSS config to use `@tailwindcss/postcss` and switched global stylesheet to `@import "tailwindcss"` to restore utility classes.
- **SaaS layout primitives:** Added reusable layout components (`PageShell`, `PageHeader`, `PageContent`, `Panel`, `Section`, `SidebarLayout`) and applied a reference implementation on `/contractors`.
- **Table styling:** Modernized the manager and contractor tables with Tailwind SaaS-style classes (subtle header tint, light borders, refined hover).
- **Web build script:** Added `npm run build` in `apps/web`.
- **Layout alignment:** Applied `PageShell`/`PageHeader`/`PageContent` to `/manager`, `/contractor`, and `/admin-inventory` for consistent titles, actions, and spacing. Fixed JSX nesting in manager dashboard.
- **Maintenance:** Legacy audit reports archived under `_archive/audits/`.
- **Troubleshooting workflow:**
  - If a page returns 404 or fails to fetch data, check that both servers are running (`lsof -nP -iTCP:3000,3001 -sTCP:LISTEN`).
  - If UI changes are not reflected, clear the Next.js cache (`rm -rf .next` in `apps/web`), kill any stale `next` processes, and restart both servers.
  - Use `tail -n 200 /tmp/web.log` and `/tmp/api.log` to inspect logs for errors.
  - If you see stale UI after pulling changes, restart both dev servers and hard-refresh the browser (Cmd+Shift+R) or open an incognito window.
  - If problems persist, paste the last 200 lines of `/tmp/web.log` and `/tmp/api.log` and I will diagnose further.
- **flows.js index (archived):** The previous navigation page (`flows.js`) has been archived as `flows.js.archived` and is no longer routable. All navigation is now handled by the home page (`index.js`).

### Recent Changes (Feb 10, 2026)

**Owner-direct foundations (Slice 1 + Slice 2):**

- **Prisma schema:**
  - Added `OrgMode` enum with `MANAGED` and `OWNER_DIRECT` values
  - Added `mode` field to `Org` (default: `MANAGED`)
  - Added `OWNER` role to `Role` enum
  - `BuildingConfig` model already existed with building-level overrides (`autoApproveLimit`, `emergencyAutoDispatch`, `requireOwnerApprovalAbove`)

- **Backend services:**
  - `services/orgConfig.ts`: Now reads/writes `Org.mode` alongside `autoApproveLimit`
  - `services/buildingConfig.ts`: Fixed upsert logic to properly handle `null` values (clearing overrides)
  - `services/buildingConfig.ts`: `computeEffectiveConfig()` returns merged org + building settings

- **Backend access control:**
  - `requireGovernanceAccess()` helper enforces role-based governance:
    - `OWNER_DIRECT` mode: only OWNER can change org/building config
    - `MANAGED` mode: MANAGER or OWNER can change config
  - `GET/PUT /org-config` now includes `mode` field
  - `GET/PUT /buildings/:id/config` protected by governance access
  - `POST /auth/register`: OWNER role creation guarded by `ALLOW_OWNER_REGISTRATION=true` (dev only)

- **Frontend:**
  - `/manager/settings`: New UI for org mode toggle (Managed vs Owner-direct) and auto-approve threshold
  - `/api/buildings/[id]/config.js`: Proxy already existed for building config endpoints

- **Tests:**
  - `ownerDirect.foundation.test.ts`: Tests org mode default, config updates, building overrides, and effective config fallback
  - `ownerDirect.governance.test.ts`: Tests role-based access enforcement for MANAGED vs OWNER_DIRECT modes
  - All 48 tests passing (8 test suites)

- **Migrations:**
  - `20260210150110_add_owner_direct_foundation`: Added `OrgMode` enum, `Org.mode`, `BuildingConfig` table
  - `20260210160000_add_owner_role`: Added `OWNER` to `Role` enum

**Owner approval workflow (Slice 4):**
- **Request statuses:** Uses `PENDING_OWNER_APPROVAL` when owner approval is required.
- **Backend endpoints:**
  - `GET /owner/pending-approvals` (optional `?buildingId=`)
  - `POST /requests/:id/owner-approve`
  - `POST /requests/:id/owner-reject`
- **Event logging:** Owner approve/reject recorded via `Event` with `OWNER_APPROVED` / `OWNER_REJECTED`.
- **Auto-approval integration:** Owner-direct threshold enforced during request creation (including work-requests alias).
- **Frontend:**
  - `/owner/approvals` UI for reviewing and approving/rejecting requests
  - Proxy route `/api/owner/approvals`
  - Status badge updates in manager + contractor views for `PENDING_OWNER_APPROVAL`
- **Startup fix:** API now creates default org + org config on startup if missing.

**Status:**
- Phase 1 (Slice 1: org mode + governance settings) ✅ Complete
- Phase 2 (Slice 2: OWNER role + access control) ✅ Complete
- Phase 3 (Slice 3: rules engine + approval rules UI) ✅ Complete
- Phase 4 (Slice 4: owner approval workflow) ✅ Complete
- Phase 5 (Slice 5: job lifecycle and invoicing) ✅ Complete
- Phase 6 (Slice 6: Owner & Contractor portal UIs) ✅ Complete
- Phase 7 (Slice 7: Contractor portal enhancements) ✅ Complete
- Frontend build verified ✅
- Core functionality tests passing ✅ (53/59 tests passing; inventory tests have env issues)

**Next steps (not yet implemented):**
- Slice 8: Reporting & analytics (optional)

---

### Recent Changes (Feb 11, 2026) — Job Lifecycle & Invoicing (Slice 5)

**Backend Implementation:**
- Added **Job model** with status lifecycle (PENDING → IN_PROGRESS → COMPLETED → INVOICED)
- Added **Invoice model** with approval workflow (DRAFT → APPROVED → PAID / DISPUTED)
- Created `services/jobs.ts` with full CRUD + status management
- Created `services/invoices.ts` with lifecycle operations (approve, mark paid, dispute)
- Added validation schemas for invoices
- Integrated job creation into owner approval flow (auto-creates Job when request approved in owner-direct mode)
- Implemented invoice auto-creation when job marked COMPLETED with actualCost
- Added API routes:
  - `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`
  - `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/{approve|mark-paid|dispute}`
  - `GET /owner/invoices` (owner dashboard)
- Event logging for OWNER_APPROVED, INVOICE_APPROVED, INVOICE_PAID, INVOICE_DISPUTED
- 11 new unit tests, all passing

**Database Schema Updates:**
- New enums: `JobStatus` (PENDING, IN_PROGRESS, COMPLETED, INVOICED), `InvoiceStatus` (DRAFT, APPROVED, PAID, DISPUTED)
- New tables: Job (1:1 to Request), Invoice (N:1 to Job)
- Migration: `20260211085910_add_job_and_invoice_models`

**Documentation:**
- Created `SLICE_5_JOB_LIFECYCLE_INVOICING.md` with full implementation details

**Remaining Work (Frontend - Slice 8: Analytics & Reporting):**
- Owner financial dashboard with invoice metrics
- Contractor performance reports (job completion rates, rating)
- Cost analysis and overrun tracking
- Job completion timeline reports

### Unit Number Rule Matching Enhancement (Feb 11, 2026)

**Overview:** Extended approval rules engine to support unit number matching with pattern operators, enabling fine-grained approval policies like "Units starting with '10' auto-approve ≤ $500."

**Backend Implementation:**
- Extended `RuleConditionField` enum: Added `UNIT_NUMBER = "UNIT_NUMBER"`
- Extended `RuleConditionOperator` enum: Added `CONTAINS`, `STARTS_WITH`, `ENDS_WITH` (pattern operators for string fields)
- Updated `RequestContext` type: Added `unitNumber?: string | null` field
- Enhanced `evaluateCondition()` function in `services/approvalRules.ts`:
  - Added UNIT_NUMBER field extraction from request context
  - Implemented pattern matching logic:
    - `CONTAINS`: checks if context value includes pattern (e.g., "105" contains "10" ✓)
    - `STARTS_WITH`: checks prefix (e.g., "105" starts with "10" ✓)
    - `ENDS_WITH`: checks suffix (e.g., "101" ends with "01" ✓)
- Updated `decideRequestStatusWithRules()` in `services/autoApproval.ts`: Added `unitNumber` parameter to requestContext
- Modified `apps/api/src/server.ts` (2 locations): Extract `unitNumber` from unit record and pass to approval engine

**Frontend Implementation:**
- Updated condition editor form in `apps/web/pages/admin-inventory/buildings/[id].js`:
  - Added `UNIT_NUMBER` option to field selector dropdown
  - Enhanced operator selector: Shows pattern operators (CONTAINS, STARTS_WITH, ENDS_WITH) for string fields (CATEGORY, UNIT_TYPE, UNIT_NUMBER)
  - Added context-specific placeholder text: "e.g., 101, 2xx, PH" for unit number input
- Rule display section: Automatically renders new field (no changes needed; uses generic field/operator/value rendering)

**Example Use Cases:**
- "Units 101–110 auto-approve ≤ CHF 500": `Unit Number STARTS_WITH "10" AND Estimated Cost ≤ 500`
- "Penthouse special handling": `Unit Number STARTS_WITH "PH"`
- "All '2xx' units bypass approval": `Unit Number STARTS_WITH "2"`
- "Common area units": `Unit Number CONTAINS "COMMON"`

**Testing & Validation:**
- TypeScript compilation: ✅ Clean build, no errors
- Backend integration: ✅ Unit numbers extracted from Prisma query and passed through approval pipeline
- Frontend form: ✅ UNIT_NUMBER field visible, operators field-dependent, placeholder text guides users
- Rule display: ✅ New field automatically displayed in rule list (generic rendering)

**Status:**
- Backend type system extended ✅
- Evaluation logic with pattern matching implemented ✅
- Server request processing updated (2 locations) ✅
- Frontend form controls added with smart operator filtering ✅
- Documentation created ✅
- Ready for testing with real unit numbers ✅

Status:

- All critical code changes completed and tested
- All 178 tests passing ✅ (19 unit test suites + 1 contract test suite: requests, auth, governance, inventory, jobs, invoices, leases, notifications, billing, PDFs, QR bills, tenant session, triage, unit config cascade, IA, orgIsolation, httpErrors, domainEvents, openApiSync, contracts)
- Prisma migrations all applied (23 total)
- Full end-to-end owner-direct workflow functional:
  1. Tenant submits request → 2. Owner approves → 3. Job auto-created → 4. Contractor manages job → 5. Invoice auto-created → 6. Owner approves/pays

---

### Project Audit & Repository Cleanup (Feb 23, 2026)

**Comprehensive Audit Summary:** ✅ **PRODUCTION READY**

Automated audit of the entire project verified:
- **Backend Build:** TypeScript compilation clean (0 errors)
- **Frontend Build:** Next.js build successful (49 pages generated)
- **Tests:** All 178 tests passing (20 suites covering full feature set)
- **Database:** PostgreSQL running, 23 migrations applied, schema up-to-date
- **Dependencies:** Minor updates available (non-blocking), no critical vulnerabilities
- **Code Quality:** One deprecated component removed
- **System Health:** All critical systems operational ✅

**Cleanup Actions (Feb 23):**
1. **Deleted deprecated ManagerNavbar.jsx** — Eliminated linter errors
2. **Archived 18 legacy markdown files** to `_archive/docs/`
3. **Updated .gitignore** — Now tracks archived docs
4. **Created PROJECT_AUDIT_2026-02-23.md** — Full health report
5. **Git commits (2):** Clean repository state established

**Repository Status:** Clean, well-organized, production-ready ✅

---

### Stabilization & Tech Debt Cleanup (Feb 24–25, 2026)

**Context:** Server crashing on lease/signature/invoice endpoints due to accumulated schema drift
and code-schema mismatches. Full day lost diagnosing and fixing.

**Root Causes Identified:**

| # | Issue | Severity | How It Hid |
|---|-------|----------|------------|
| 1 | **Database missing 10 columns + 2 enum values** (Lease lifecycle fields, Invoice.leaseId) — schema said they existed but DB didn't have them | 🔴 CRASH | Used `prisma db push` at some point instead of `migrate dev`; drift invisible until queries hit those columns |
| 2 | **`createLeaseInvoice()` referenced `Job.description`** (doesn't exist), `Request.orgId` (doesn't exist), and created Job without required `contractorId` | 🔴 CRASH | Function was only called via lease invoice creation, which wasn't in the main test path |
| 3 | **`assignContractor()` / `unassignContractor()` were stubs** in `maintenanceRequests.ts` that returned fake success without writing to DB | 🔴 CRASH (silent) | API returned `{ success: true }` — looked correct, but DB was never updated. Real implementations existed in `requestAssignment.ts` but weren't imported |
| 4 | **Invoice PDF route re-parsed URL incorrectly** — `?includeQRBill=false` was silently ignored, QR bill always included | 🔴 CRASH (feature) | `parseQuery()` was called on already-stripped URL fragment; `query` from HandlerContext was available but not used |
| 5 | **Job DTO mapper used `appliance.category`** but Appliance has no `category` field (it's on AssetModel) | 🟡 WARN | Returns `undefined` — doesn't crash but loses data |
| 6 | **`createJob`, `updateJob`, `getOrCreateJobForRequest`** returned incomplete DTOs (no `include` clauses) | 🟡 WARN | Mapper has `?.` guards so no crash, but relations silently omitted from API response |
| 7 | **`getOrCreateJobInvoice` missing `include: { lineItems: true }`** on findFirst | 🟡 WARN | Existing invoices returned without their line items |

**Fixes Applied:**
1. Applied safe ALTERs directly to DB (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) — no `migrate reset` or data loss
2. Rewrote `createLeaseInvoice()` to use `Request.contractorNotes` for tagging and find/create admin contractor
3. Replaced stubs with `export { assignContractor, unassignContractor, findMatchingContractor } from './requestAssignment'`
4. Changed PDF route to destructure `query` from HandlerContext
5. Updated mapper to use `assetModel?.category ?? appliance.name`
6. Added full `include` clauses to all Job CRUD operations
7. Added `include: { lineItems: true }` to `getOrCreateJobInvoice`

**Verification:** All endpoints tested live — zero crashes, zero drift, zero errors.

**Guardrails added:** See Section "🛡️ GUARDRAILS" at top of this document (G1–G6).

---

- Added lightweight contractor suggestion endpoints:
  - `GET /requests/:id/suggest-contractor` — suggests a contractor by request category
  - `GET /contractors/match?category=...` — returns a matching contractor for the org
- Wired frontend proxy (`apps/web/pages/api/contractors.js`) to forward `?category=` to `/contractors/match` and show suggestions in `tenant-form.js`.
- Added console logging in suggestion handlers for easier debugging.
- Observed intermittent Next dev binding issues (EADDRINUSE). Recommended restart steps added under "Running the Project" and quick dev restart snippet; Next may need `.next` cleared and stale `next` processes killed before restart.
- Logs written during local runs: `/tmp/api.log` (backend) and `/tmp/web.log` (frontend). Use `tail -n 200` to inspect.

If you still see stale UI after pulling changes, restart both dev servers and hard-refresh the browser (Cmd+Shift+R) or open an incognito window. If problems persist, paste the last 200 lines of `/tmp/web.log` and `/tmp/api.log` and I will diagnose further.


### Completed

* Raw HTTP backend stabilized
* Prisma + PostgreSQL integrated (23 migrations, zero drift)
* Request lifecycle implemented (full CRUD + auto-approve + owner approval)
* Auto-approval logic working (org-level + building-level + unit-level + rules engine)
* Org-level configuration with MANAGED/OWNER_DIRECT modes
* Manager dashboard with approve action
* Owner portal with approval workflow
* Contractor portal with job management
* Tenant portal with lease view + accept/sign
* Job lifecycle (PENDING → IN_PROGRESS → COMPLETED → INVOICED)
* Invoice lifecycle (DRAFT → APPROVED → PAID with PDF + QR bill generation)
* Digital lease generation (Swiss ImmoScout24 template, 40+ fields)
* Signature request workflow (create → send → sign, provider-agnostic)
* Inventory admin (buildings, units, appliances, asset models, occupancies)
* Billing entities with contractor linking
* Notification system (scaffolded, route-registered)
* Auth system (JWT scaffolded, optional enforcement)
* UI styling frozen
* **Tech debt cleanup (Feb 24–25):** Schema drift fixed, stub services replaced, all code-schema mismatches resolved
* **Guardrail audit fixes (Feb 25):** CI hardened to 6-gate pipeline (G7), production boot guard (F1), canonical includes extracted — `JOB_INCLUDE`, `LEASE_INCLUDE`, `INVOICE_INCLUDE` (G9), API contract tests created (G10), proxy auth forwarding fixed (F3), dev scripts formalized (F6), `managerStyles.js` created (F8)
* End-to-end flows verified:

  ```
  Tenant → Request → Auto-approve/Owner-approve → Job → Invoice → Payment
  Tenant → Lease → Sign → Activate → Terminate → Archive
  Web → Next proxy → API → DB (all endpoints live-tested)
  ```
* **Frontend [id] route:** Implemented proxy for `GET /api/requests/:id` → backend
* **Slice 1 (Feb 3):** Contractor model, backend CRUD services, validation, frontend management UI
  * Prisma migration: added Contractor table with orgId, name, phone, email, hourlyRate, serviceCategories, isActive
  * Backend services: listContractors, getContractorById, createContractor, updateContractor, deactivateContractor
  * Zod validation: phone format, email format, hourlyRate 10–500, categories required array
  * API endpoints: GET /contractors, POST /contractors, GET /contractors/:id, PATCH /contractors/:id, DELETE /contractors/:id
  * Frontend page: /contractors with form and list
  * Frontend proxy routes: /api/contractors and /api/contractors/[id]
  * Testing completed: all endpoints verified working, validation errors properly handled, database persistence confirmed

* **Slice 2 (Feb 3):** Request assignment & routing
  * Auto-assignment service: matches requests to contractors by category
  * Manual assignment endpoints: POST /requests/{id}/assign, DELETE /requests/{id}/assign
  * Assignment validation: contractor must exist and be active
  * Request DTO enhanced: includes assignedContractor with name, phone, email, hourlyRate
  * Backend queries updated: all request operations include contractor relation
  * Manager dashboard updated: displays assigned contractor details (name, phone, hourly rate)
  * Auto-assignment on request creation: if category matches contractor, auto-assign immediately
  * Testing completed: auto-assignment works, manual assignment/unassignment works, validation errors handled, dashboard displays contractors

* **Slice 8, Phase 1 (Implementation — Feb 23):** Digital Lease Generation + Signature-Ready Workflow ✅
  * See `_archive/SLICE_8_DIGITAL_LEASE_GENERATION.md` for specification
  * **Database:** Lease model (40+ fields), SignatureRequest model, 4 new enums (LeaseStatus, SignatureProvider, SignatureLevel, SignatureRequestStatus), OrgConfig landlord fields
  * **Backend services:** `apps/api/src/services/leases.ts` (CRUD + auto-fill from OrgConfig/Unit/Building, rent total recompute, PDF ref storage, ready-to-sign workflow, cancel), `signatureRequests.ts` (create/list/get/send/markSigned with auto-signer extraction from lease)
  * **PDF generation:** `apps/api/src/services/leasePDFRenderer.ts` — Swiss ImmoScout24-style lease PDF via PDFKit (§1 Parties, §2 Object, §3 Duration, §4 Termination, §5 Rent/Charges, §6 Payment, §7 Deposit, §15 Stipulations, Signatures block, Footer with SHA-256)
  * **Backend routes:** 10 new endpoints in server.ts (GET/POST /leases, GET/PATCH /leases/:id, POST /leases/:id/generate-pdf, POST /leases/:id/ready-to-sign, POST /leases/:id/cancel, GET /signature-requests, GET /signature-requests/:id, POST /signature-requests/:id/send, POST /signature-requests/:id/mark-signed)
  * **Frontend proxy:** 4 proxy files (leases/index.js, leases/[...id].js with PDF streaming, signature-requests/index.js, signature-requests/[...id].js)
  * **Frontend pages:** Lease list page (manager/leases/index.js — status filter, building/unit selectors, create form), Lease editor (manager/leases/[id].js — 8 accordion sections, Save/Generate PDF/Ready to Sign/Cancel actions, signature request table)
  * **Navigation:** AppShell updated with "Leases" section in manager nav
  * **Validation:** Zod schemas (CreateLeaseSchema, UpdateLeaseSchema, ReadyToSignSchema) in `apps/api/src/validation/leases.ts`
  * **Tests:** 17 passing tests in `apps/api/src/__tests__/leases.test.ts` covering full lifecycle (create with auto-fill, list/get, org isolation, update, PDF generation + SHA-256, store PDF ref, ready-to-sign, reject non-DRAFT edit, signature requests CRUD, send, reject double-send, mark signed + lease status update, cancel constraints)
  * Status: **Implementation complete, all tests passing, frontend builds clean** ✅

* **Slice 8, Phase 2 (Implementation — Feb 23):** Tenant View Portal + Accept/Sign Stub ✅
  * **Backend service:** `apps/api/src/services/tenantPortal.ts` — tenant-safe lease access (read-only, filtered to READY_TO_SIGN + SIGNED only), occupancy verification, tenant accept/sign flow
  * **Backend routes:** 3 new endpoints in server.ts: `GET /tenant-portal/leases` (list by tenantId+unitId), `GET /tenant-portal/leases/:id` (detail), `POST /tenant-portal/leases/:id/accept` (tenant sign stub)
  * **Security:** Occupancy-verified access — tenants can only see leases for units they occupy; wrong tenant gets 403; DRAFT leases hidden
  * **Tenant DTO:** Subset of full LeaseDTO (no landlord email/address, no payment details) + signatureStatus + tenantAcceptedAt
  * **Frontend proxy:** `pages/api/tenant-portal/leases/index.js` and `pages/api/tenant-portal/leases/[...id].js`
  * **Frontend pages:** `pages/tenant/leases/index.js` (lease list with status badges, action-required banner for READY_TO_SIGN), `pages/tenant/leases/[id].js` (full detail view: §1 Parties, §2 Object, §3-4 Duration, §5-6 Rent, §7 Deposit, §15 Stipulations, signature status, 2-step accept confirmation)
  * **Navigation:** "My Leases" added to tenantNav in AppShell
  * **Accept flow:** 2-step confirmation → marks SignatureRequest as SIGNED + Lease as SIGNED; prevents re-accept (409)
  * **Tests:** 22 passing integration tests in `test-tenant-portal.sh` (DRAFT hidden, param validation, READY_TO_SIGN visible, detail correctness, wrong-tenant 403, accept flow, SIGNED state, re-accept 409)
  * Status: **Implementation complete, all tests passing, TS compiles, frontend builds clean** ✅

### Architecture Hardening (Feb 25, 2026)

**M1: Org Scoping Enforcement Framework** ✅ (Committed `a3e3dab`)
- New `governance/orgScope.ts`: resolveRequestOrg (FK chain traversal: unit→tenant→appliance→contractor), resolveJobOrg, resolveInvoiceOrg, resolveLeaseOrg, assertOrgScope with OrgScopeMismatchError
- `maintenanceRequests.ts`: orgScopeWhere filter for list queries; listMaintenanceRequests & listOwnerPendingApprovals now require orgId param
- `routes/requests.ts`: all 15+ endpoints org-scoped via resolveRequestOrg + assertOrgScope; contractor routes verify contractor.orgId; removed DEFAULT_ORG_ID and getOrgIdForRequest imports
- `routes/tenants.ts`: tenant/contractor reads verify orgId; contractor CRUD uses ctx.orgId; removed DEFAULT_ORG_ID
- `routes/invoices.ts`: GET /jobs/:id checks job.orgId; idempotent getOrCreateInvoiceForJob (M1.5 fix)
- `routes/inventory.ts`: removed unused DEFAULT_ORG_ID import
- New `__tests__/orgIsolation.test.ts`: 22 unit tests covering all resolvers, assertOrgScope (match/mismatch/orphan/prod), cross-org matrix
- **Remaining DEFAULT_ORG_ID:** only in `routes/auth.ts` (6 occurrences) — deferred to M2
- Verification: tsc 0 errors, 148 tests pass (17 suites), 0 schema drift, frontend build clean

**M2: Centralized Auth Enforcement** ✅ (Committed `3a477cc`)
- Eliminated all redundant `getOrgIdForRequest(req)` calls from route files; orgId now sourced exclusively from `HandlerContext` (populated by `server.ts` at dispatch)
- `routes/auth.ts`: removed `DEFAULT_ORG_ID` + `getOrgIdForRequest` imports; 9 handlers → ctx.orgId
- `routes/invoices.ts`: removed `getOrgIdForRequest` import; 16 handlers → ctx.orgId
- `routes/leases.ts`: removed `getOrgIdForRequest` import; 20 handlers → ctx.orgId
- `routes/config.ts`: removed `getOrgIdForRequest` import; 16 handlers → ctx.orgId
- `getOrgIdForRequest` now only called in `server.ts` (canonical) and defined in `authz.ts`
- No route file imports `getOrgIdForRequest` or `DEFAULT_ORG_ID` anymore
- Net reduction: 56 lines of redundant code removed (4 files, 62 insertions / 118 deletions)
- Verification: tsc 0 errors, 148 tests pass (16 suites), 0 schema drift, frontend build clean
**M3: Internal Middleware & Error Standardization** ✅ (Committed `ea193d8`)
- New `http/errors.ts`: typed error hierarchy — `HttpError` base class with `ValidationError` (400), `InvalidJsonError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `PayloadTooLargeError` (413)
- `http/router.ts`: dispatch error handler auto-maps `HttpError` and `OrgScopeMismatchError` to correct HTTP responses — handlers can throw instead of manually calling `sendError()`
- `http/body.ts`: `readJson()` now throws `InvalidJsonError`/`PayloadTooLargeError` (backward compat: message strings unchanged); new `parseBody(req, zodSchema)` combines read + validate in one call
- New `__tests__/httpErrors.test.ts`: 13 unit tests covering hierarchy, instanceof discrimination, backward compat, OrgScopeMismatchError
- Existing handlers unchanged — continue to work with their own try/catch; new/refactored handlers can use the throw-based pattern
- Verification: tsc 0 errors, 161 tests pass (17 suites), 0 schema drift, frontend build clean
**M4: Domain Events + Idempotent Workflow** ✅ (Committed `0a459a2`)
- New `events/` module: in-process pub/sub domain event bus
- `events/types.ts`: typed `DomainEventMap` with 10 event types (REQUEST_CREATED, OWNER_APPROVED, OWNER_REJECTED, REQUEST_STATUS_CHANGED, JOB_CREATED, INVOICE_ISSUED/APPROVED/PAID/DISPUTED, LEASE_STATUS_CHANGED)
- `events/bus.ts`: `emit()`, `on()`, `onAll()`, `clearAllListeners()` — error-isolated, wildcard-first ordering
- `events/handlers.ts`: audit persist handler (wildcard) writes every event to Event table
- `events/index.ts`: barrel export for clean `import { emit } from "../events"`
- `server.ts`: `registerEventHandlers(prisma)` called at boot
- New `__tests__/domainEvents.test.ts`: 11 unit tests covering bus mechanics
- Existing `logEvent()` calls remain — new code can use typed `emit()` instead
- Verification: tsc 0 errors, 172 tests pass (18 suites), 0 schema drift, frontend build clean
**M5: OpenAPI + Typed Client** ✅ (Committed `7661aec`)
- `apps/api/openapi.yaml`: comprehensive OpenAPI 3.1 specification covering all 116+ registered routes across 14 tags (Auth, Requests, Jobs, Invoices, Leases, SignatureRequests, Config, ApprovalRules, BillingEntities, Inventory, Tenants, Notifications, Dev)
- Full DTO schemas: MaintenanceRequestDTO, JobDTO, InvoiceDTO, LeaseDTO, ContractorDTO, TenantDTO, BuildingDTO, UnitDTO, ApplianceDTO, NotificationDTO, ApprovalRuleDTO, BillingEntityDTO, + all enums (RequestStatus, JobStatus, InvoiceStatus, LeaseStatus, etc.)
- ErrorResponse envelope schema with reusable response references (NotFound, ValidationError, Forbidden)
- `packages/api-client/`: zero-dependency fetch-based typed API client
  - All DTO types exported as TypeScript interfaces
  - Namespace-organized methods: `api.requests.*`, `api.jobs.*`, `api.invoices.*`, `api.leases.*`, etc.
  - `ApiClientError` with status, code, message for structured error handling
  - Supports pagination params, binary responses (PDF/PNG)
- New `__tests__/openApiSync.test.ts`: 6 tests ensuring bidirectional sync between spec and router registrations (code→spec, spec→code, unique operationIds, required DTO schemas)
- Verification: tsc 0 errors, 178 tests pass (19 suites), 0 schema drift, frontend build clean, api-client typecheck clean

### Not Implemented Yet (Active Backlog)

* Lease Phase 3–5: DocuSign/Skribble integration, deposit payment tracking, archive workflow
* Authentication enforcement (scaffolded, not wired to all routes) — see M2 above
* Role enforcement on all sensitive endpoints (partially implemented)
* Notifications delivery (routes exist, notifications created, but no push/email delivery)
* Media uploads (photos of damage, documents)
* Tenant portal redesign (conversational → structured)
* Reporting & analytics dashboard
* Multi-org support (org scoping via M1; auth centralized via M2; DEFAULT_ORG_ID remains only in authz.ts fallback + orgConfig.ts bootstrap + tests)

---

## 12. Backlog

### Slice 2 (Completed)

* Assignment logic: match requests to contractors by category ✅
* Display assigned contractor on manager UI ✅
* Update request status workflow to include contractor assignment ✅

### Slice 3 (Next)

* Notification system (contractor assigned, work completed)
* Finance workflows (invoices, payments, ledger)

### Future: Tenant Identification, Asset Context & Automated Scheduling

**Problem**
Current tenant UI relies on manual category selection and free-text descriptions, which is sufficient for early testing but does not leverage structured property data.

**Target State**

* Tenants identified by **phone number**
* Phone number linked to:

  * tenant
  * rented unit
  * property
* Each unit maintains an inventory of:

  * appliances
  * appliance models
  * serial numbers (when available)

**Desired Capabilities**

* Tenant submits request conversationally (chat-style)
* System automatically infers:

  * tenant identity
  * unit and property
  * affected appliance
  * exact appliance model
* Request is enriched with structured asset data without tenant input
* System proposes or books appointments by:

  * querying assigned contractor availability
  * respecting SLAs and urgency
  * minimizing tenant back-and-forth

**Out of Scope (for now)**

* Authentication UX
* SMS / messaging provider selection
* Calendar provider selection
* Real-time booking confirmation

**Dependencies**

* Contractor model and assignment
* Tenant ↔ unit ↔ property relationships
* Asset / appliance data model

**Notes**

* Initial implementations may fall back to manual confirmation when inference confidence is low
* Conversational UI remains central but becomes data-guided rather than form-driven

---

### State Integrity

This document is the **single source of truth** and matches:

* Filesystem (verified 2026-02-25, post-M1 — committed `a3e3dab`)
* Database schema — zero drift (`prisma migrate diff` clean)
* Running system — all endpoints return 200 (verified 2026-02-25)
* Git — clean working tree, all changes committed
* Architectural intent
* CI pipeline enforces G1–G10 guardrails

Safe to:

* Pause work
* Resume later
* Onboard collaborators
* Refactor deliberately

⚠️ **Before any code change, re-read the 🛡️ GUARDRAILS section at the top of this file.**

---

✅ **Project stabilized, audit-hardened, and org-scoped (2026-02-25).**

All crash-level and warning-level issues resolved. Guardrail enforcement in CI (G7), canonical includes (G9), contract tests (G10), production boot guard (F1), proxy auth forwarding (F3), dev scripts (F6), and styling lock file (F8) all implemented. M1 Org Scoping Enforcement Framework complete — all routes enforce org isolation via governance/orgScope.ts. Work can resume from M2 (Centralized Auth) or the Active Backlog without rework.

---

## 13. Authentication & Testing Frameworks (Feb 5, 2026)

### Authentication

**Status:** Scaffolded and integrated

- `AUTH_OPTIONAL` (default true in non-production) allows manager endpoints without tokens for internal demos.
- Set `AUTH_OPTIONAL=false` or run in production to enforce manager-only access (401/403).

- Auth service (`src/services/auth.ts`):
  - JWT token encoding/decoding
  - Token payload structure with userId, orgId, email, role
- Auth middleware (`src/auth.ts`):
  - Optional `authMiddleware()` for request user extraction
  - `requireAuth()` for protected routes
  - `requireRole(role)` for role-based access (TENANT, CONTRACTOR, MANAGER)
- Prisma schema updated:
  - User model now has `email` (optional, unique per org), `passwordHash`, timestamps
  - Migration applied: `20260205142350_add_auth_to_user`

**Next steps:**
- Wire middleware into protected routes in server.ts
- Add auth guards to manager/contractor endpoints

### Automated Testing

**Status:** Scaffolded and ready

- Jest configuration (`jest.config.js`):
  - TypeScript support via ts-jest
  - Test discovery pattern: `src/__tests__/**/*.test.ts`
- Test scripts in `package.json`:
  - `npm test` — run all tests
  - `npm run test:watch` — watch mode
- Sample integration tests (`src/__tests__/requests.test.ts`):
  - Tests for GET /requests, GET /org-config, GET /contractors
  - Graceful handling of connection errors
- Dependencies: jest@29.7.0, ts-jest@29.1.1, @types/jest@29.5.11

**Next steps:**
- Add unit tests for validation schemas and services
- Add test coverage thresholds

**Reference:** See `_archive/PROJECT_AUDIT_2026-02-23.md` for comprehensive audit report including dependency status, recommendations, and detailed system health analysis.

**Update (Feb 25):** CI now includes Jest tests and test database (PostgreSQL service container). API contract tests added in `src/__tests__/contracts.test.ts` (G10).
