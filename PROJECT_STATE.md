# Maintenance Agent — Project State

**Last updated:** 2026-02-03

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
* **Contractor** — executes work *(not implemented yet)*

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
├── _archive/                      # legacy backups (NOT USED)
├── apps/
│   ├── api/                       # Backend (ACTIVE)
│   │   ├── .env
│   │   ├── package.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── server.ts          # ACTIVE runtime entry
│   │       ├── services/
│   │       │   ├── maintenanceRequests.ts
│   │       │   ├── autoApproval.ts
│   │       │   └── orgConfig.ts
│   │       ├── validation/
│   │       │   └── requests.ts
│   │       └── http/
│   │           ├── body.ts
│   │           ├── json.ts
│   │           └── query.ts
│   └── web/                       # Frontend (ACTIVE)
│       ├── pages/
│       │   ├── index.js           # Tenant UI
│       │   ├── manager.js         # Manager dashboard
│       │   └── api/
│       │       ├── requests.js
│       │       ├── org-config.js
│       │       └── requests/
│       │           ├── [id].js       # GET /api/requests/[id] proxy (added Feb 3)
│       │           └── approve.js
│       └── styles/
│           └── managerStyles.js   # UI style lock
├── .github/
│   ├── copilot-instructions.md  # AI agent guidance
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI (added Feb 3)
├── tsconfig.json                # Root TypeScript config with project references
├── package.json                 # Root monorepo workspace stub
├── infra/
│   └── docker-compose.yml         # PostgreSQL
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
  id    String @id @default(uuid())
  orgId String
  role  Role
  name  String
  org   Org    @relation(fields: [orgId], references: [id])
}

model Request {
  id            String         @id @default(uuid())
  description   String
  category      String?
  estimatedCost Int?
  status        RequestStatus
  createdAt     DateTime       @default(now())
}
```

---

## 5. Backend API

### Entry Point

* File: `apps/api/src/server.ts`
* Run: `npm run dev`
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

#### Org Config

* `GET /org-config`
* `PUT /org-config`

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

### Manager Dashboard (`/manager`)

* View all requests
* Filter:

  * All
  * Needs approval
  * Auto-approved
* Approve pending requests
* Configure auto-approval threshold
* Status badges
* UI styling **frozen** via `styles/managerStyles.js`

### API Proxy Routes (`/api`)

* `GET /api/requests` → backend `GET /requests`
* `POST /api/requests` → backend `POST /requests`
* `GET /api/requests/[id]` → backend `GET /requests/{id}` *(added Feb 3)*
* `POST /api/requests/approve` → backend approve endpoint
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
npm run dev

# Frontend
cd apps/web
npm run dev
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

### Not Implemented Yet

* Authentication / authorization
* Role enforcement
* Contractor model
* Assignment & routing
* Scheduling
* Invoicing
* Media uploads

---

## 12. Backlog

### Option C (Next Major Increment)

* Contractor model
* Assignment logic
* Display contractor on manager UI

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
