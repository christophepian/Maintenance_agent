# Maintenance Agent — Project State

**Last updated:** 2026-02-08 (SaaS layout primitives + table styling + tests/build verified)

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
│   │       ├── services/          # auth, contractors, inventory, tenants, requests, assignments
│   │       ├── validation/        # requests, contractors, inventory, auth, triage
│   │       ├── utils/             # phone normalization
│   │       └── http/              # body/json/query helpers
│   └── web/
│       ├── pages/
│       │   ├── index.js
│       │   ├── manager.js
│       │   ├── contractor.js
│       │   ├── contractor/        # contractor portal routes
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
├── tsconfig.json
├── package.json
├── infra/
│   └── docker-compose.yml
└── packages/
```

---

## 4. Database Schema (Prisma)

**Status: ACTIVE AND IN USE**

```prisma
enum Role {
  TENANT
  CONTRACTOR
  MANAGER
}

enum RequestStatus {
  PENDING_REVIEW
  AUTO_APPROVED
  APPROVED
  ASSIGNED
  IN_PROGRESS
  COMPLETED
}

enum UnitType {
  RESIDENTIAL
  COMMON_AREA
}

model Org {
  id     String     @id @default(uuid())
  name   String
  users  User[]
  config OrgConfig?
}

model OrgConfig {
  id               String  @id @default(uuid())
  orgId            String  @unique
  autoApproveLimit Int     @default(200)
  org              Org     @relation(fields: [orgId], references: [id])
}

model User {
  id           String   @id @default(uuid())
  orgId        String
  role         Role
  name         String
  email        String?
  passwordHash String?
  org          Org      @relation(fields: [orgId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Request {
  id                   String        @id @default(uuid())
  description          String
  category             String?
  estimatedCost        Int?
  status               RequestStatus @default(PENDING_REVIEW)
  contactPhone         String?
  assignedContractorId String?
  assignedContractor   Contractor?   @relation(fields: [assignedContractorId], references: [id])
  tenantId             String?
  unitId               String?
  applianceId          String?
  contractorNotes      String?
  startedAt            DateTime?
  completedAt          DateTime?
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt
}

model Contractor {
  id                String    @id @default(uuid())
  orgId             String
  org               Org       @relation(fields: [orgId], references: [id])
  name              String
  phone             String
  email             String
  hourlyRate        Int       @default(50)
  serviceCategories String
  isActive          Boolean   @default(true)
  requests          Request[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

Additional models include Building, Unit (with UnitType), Appliance, AssetModel (global + org-private), Tenant, Occupancy (tenant↔unit), RequestEvent, and Event, all org-scoped with soft delete where applicable.
```

**IA adapters (non-breaking):**

* Properties → Building (adapter DTO)
* Assets → Appliance (+ AssetModel)
* People → Tenant + Contractor union DTO
* Work Requests → Request DTO wrapper

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

### Endpoints (Verified)

#### Requests

* `GET /requests`
* `GET /requests/:id`
* `POST /requests`
* `POST /requests/approve?id={uuid}` *(manager override)*
* `DELETE /__dev/requests` *(dev only)*

#### Work Requests (alias)

* `GET /work-requests`
* `GET /work-requests/:id`
* `POST /work-requests`

#### Contractors

* `GET /contractors` — list active contractors
* `POST /contractors` — create contractor with validation
* `GET /contractors/{id}` — get single contractor
* `PATCH /contractors/{id}` — update contractor details
* `DELETE /contractors/{id}` — deactivate contractor (soft delete)

#### Request Assignment

* `POST /requests/{id}/assign` — assign contractor to request
* `DELETE /requests/{id}/assign` — unassign contractor from request
* Auto-assignment on request creation based on category match

#### Tenant Intake

* `POST /tenant-session` — identify tenant by phone and return unit/building/appliances
* `POST /triage` — deterministic troubleshooting suggestions based on unit context

#### Authentication

* `POST /auth/register` — create a user and return a token
* `POST /auth/login` — authenticate and return a token

#### Inventory (Buildings/Units/Appliances/Tenants/Asset Models/Occupancies)

* `GET /buildings`
* `POST /buildings`
* `PATCH /buildings/:id`
* `DELETE /buildings/:id`
* `GET /buildings/:id/units`
* `POST /buildings/:id/units`
* `PATCH /units/:id`
* `DELETE /units/:id`
* `GET /units/:id/appliances`
* `POST /units/:id/appliances`
* `PATCH /appliances/:id`
* `DELETE /appliances/:id`
* `GET /tenants` (list or lookup by phone)
* `POST /tenants`
* `PATCH /tenants/:id`
* `DELETE /tenants/:id`
* `GET /units/:id/tenants`
* `POST /units/:id/tenants`
* `DELETE /units/:id/tenants/:tenantId`
* `GET /asset-models`
* `POST /asset-models`
* `PATCH /asset-models/:id`
* `DELETE /asset-models/:id`

#### Org Config

* `GET /org-config`
* `PUT /org-config`

#### Properties (alias)

* `GET /properties` (wraps buildings)
* `GET /properties/:id/units`

#### People (alias)

* `GET /people/tenants`
* `GET /people/vendors`

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
* **GitHub Actions CI:**
  - Runs on push to `main` and PRs
  - Installs dependencies for both apps
  - Type-checks both backend and frontend
  - Workflow file: `.github/workflows/ci.yml` (added Feb 3)

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
cd infra
docker compose up -d

# Backend
cd apps/api
npm run start:dev

# Frontend
cd apps/web
npm run dev
```

Quick dev restart (pick when files changed):
```bash
# Backend: restart ts-node server and view logs
pkill -f "ts-node src/server.ts" || true
cd apps/api
npm run start:dev > /tmp/api.log 2>&1 &
tail -n 200 /tmp/api.log

# Frontend: clear Next cache and restart
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
- **Maintenance:** Legacy audit reports archived under `_archive/audits/`.
- **Troubleshooting workflow:**
  - If a page returns 404 or fails to fetch data, check that both servers are running (`lsof -nP -iTCP:3000,3001 -sTCP:LISTEN`).
  - If UI changes are not reflected, clear the Next.js cache (`rm -rf .next` in `apps/web`), kill any stale `next` processes, and restart both servers.
  - Use `tail -n 200 /tmp/web.log` and `/tmp/api.log` to inspect logs for errors.
  - If you see stale UI after pulling changes, restart both dev servers and hard-refresh the browser (Cmd+Shift+R) or open an incognito window.
  - If problems persist, paste the last 200 lines of `/tmp/web.log` and `/tmp/api.log` and I will diagnose further.
- **flows.js index (archived):** The previous navigation page (`flows.js`) has been archived as `flows.js.archived` and is no longer routable. All navigation is now handled by the home page (`index.js`).

Status:
- Code changes committed and pushed. Prisma migration applied locally and Prisma Client regenerated.
- Integration test executed: creating a request with category auto-assigned a matching contractor.
- Test suite verified (Feb 8): 5 suites, 40 tests passed.
- Web build verified (Feb 8): `next build` completed successfully.

### Developer Actions (runtime & debugging)

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
* Prisma + PostgreSQL integrated
* Request lifecycle implemented
* Auto-approval logic working
* Org-level configuration
* Manager dashboard with approve action
* UI styling frozen
* End-to-end flow verified:

  ```
  Web → Next proxy → API → DB
  ```
* **Project cleanup (Feb 3):** Removed dead NestJS code, added root configs, established CI/CD
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

### Not Implemented Yet

* Authentication / authorization
* Role enforcement
* Notifications
* Scheduling
* Invoicing
* Media uploads

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

* Filesystem
* Database schema
* Running system
* Architectural intent

Safe to:

* Pause work
* Resume later
* Onboard collaborators
* Refactor deliberately

---

🧊 **Project frozen in a stable state.**

Work can resume cleanly from Option C or future backlog items without rework.

---

## 13. Authentication & Testing Frameworks (Feb 5, 2026)

### Authentication

**Status:** Scaffolded and integrated

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
- Set up test database for integration testing
- Integrate tests into GitHub Actions CI/CD
- Add test coverage thresholds

**Reference:** [AUTH_AND_TESTING_IMPLEMENTATION.md](AUTH_AND_TESTING_IMPLEMENTATION.md) for detailed setup and deployment checklist
