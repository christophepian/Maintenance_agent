# Copilot Prompt — Inventory Admin Expansion (Org-Scoped, Full CRUD, Tenant↔Unit, Common Areas as Units)

## Context (read-only, do not change)

- Monorepo structure as documented in PROJECT_STATE.md
- Backend: apps/api raw Node HTTP server (NO Express/Nest)
- Prisma + Postgres + migrations
- Zod validation in apps/api/src/validation
- Domain logic in apps/api/src/services
- Frontend: apps/web Next.js Pages Router
- Next.js API routes act as proxy to backend
- Manager UI styling locked in apps/web/styles/managerStyles.js (do not modify inline styles in manager.js)

## Goal

Expand inventory management so property managers can create/edit/deactivate (soft delete) Buildings, Units, Appliances, Tenants, and Asset Models from the frontend, without terminal DB edits. Support:

- Org-scoped inventory (strict data isolation by org)
- Common areas modeled as “special units” under a building (UnitType)
- Tenant ↔ Unit is many-to-many (tenants can have multiple units; units can have multiple tenants)
- Soft delete for inventory entities
- Prevent delete when records are referenced (Requests, Occupancies, etc.)
- AssetModel library is global + org-private

  - orgId = null ⇒ global model
  - orgId = <org> ⇒ org-private model
  - selection lists include both global and org-private models

- Auth is scaffolded but may not be fully enforced; implement endpoints in a way that can later be protected with requireRole(MANAGER) easily.

---

## Slice 1 — Data Model & Prisma Migration (minimal, forward-compatible)

### Required schema updates (Prisma)

**Add Unit type for common areas**

Add enum:
```
enum UnitType { RESIDENTIAL COMMON_AREA }
```

Add `Unit.type UnitType @default(RESIDENTIAL)` (or `isCommonArea` boolean, but prefer enum).

**Add Tenant↔Unit join model**

Create `Occupancy` model (many-to-many):

- id String @id @default(uuid())
- tenantId String
- unitId String
- Relations to Tenant and Unit
- Add uniqueness constraint to prevent duplicates:

```
@@unique([tenantId, unitId])
```

Backlog: lease dates NOT required now (do not add start/end yet).

**Org scoping**

- Ensure Building has required orgId and relation to Org
- Ensure Tenant has required orgId and relation to Org
- Ensure Unit is linked to Building and thus org-scoped; optionally add orgId to Unit for easier filtering (recommended)
- Ensure Appliance is linked to Unit and thus org-scoped; optionally add orgId to Appliance for easier filtering (recommended)
- If adding orgId to Unit/Appliance, keep it consistent via service logic (set from building/org during create)

**Soft delete fields**

Add `isActive Boolean @default(true)` to:

- Building, Unit, Appliance, Tenant, AssetModel

(Contractor already has isActive.)
Prefer `isActive` over `deletedAt` for consistency with Contractor.

**AssetModel: global + org-private**

Add `orgId String?` to AssetModel (nullable)

- Global models have orgId = null

Add index:
```
@@index([orgId, isActive])
```

**Migration tasks**

- Create Prisma migration
- Regenerate Prisma client
- Update seed/dev flows if any exist (avoid breaking existing dev data)

---

## Slice 2 — Backend Services + Validation + Routes (Raw HTTP)

### Add/Update Zod schemas in apps/api/src/validation

Implement schemas for create/update:

- Building: name required
- Unit: name/label required, type enum required/optional (default RESIDENTIAL)
- Appliance: name required, category optional, assetModelId optional, serial optional
- Tenant: name required (or optional if your Tenant model differs), phone required (normalize to E.164 using your existing utility)
- AssetModel: name required, category optional, brand optional, orgId optional/null, isActive default true

### Services (apps/api/src/services)

Implement CRUD services that:

- Filter by orgId (explicit parameter, or derive from auth payload later)
- Only return isActive=true by default for list endpoints unless includeInactive=true query is passed
- For soft delete: set isActive=false

#### Required service functions (examples)

- listBuildings(orgId, includeInactive?)
- createBuilding(orgId, data)
- updateBuilding(orgId, buildingId, data)
- deactivateBuilding(orgId, buildingId)
  - prevent if active units exist (safe default)

- listUnits(orgId, buildingId, includeInactive?)
- createUnit(orgId, buildingId, data) (type supported)
- updateUnit(orgId, unitId, data)
- deactivateUnit(orgId, unitId)
  - prevent if active appliances exist (safe default)

- listAppliances(orgId, unitId, includeInactive?)
- createAppliance(orgId, unitId, data)
- updateAppliance(orgId, applianceId, data)
- deactivateAppliance(orgId, applianceId)
  - prevent if appliance referenced by any Request (Request.applianceId)

- getTenantByPhone(orgId, phoneE164)
- createOrFindTenant(orgId, data)
- updateTenant(orgId, tenantId, data)
- deactivateTenant(orgId, tenantId)
  - prevent if occupancies exist (safe default)

- listAssetModels(orgId, includeInactive?) returning:
  - global active models (orgId=null)
  - org-private active models (orgId=orgId)

- createAssetModel(orgId, data)
  - default to org-private (orgId=orgId); do NOT allow creating global models now

- updateAssetModel(orgId, modelId, data)
  - only if org-private (global reserved for future admin)

- deactivateAssetModel(orgId, modelId)
  - prevent if referenced by any Appliance

**Occupancy services**

- listUnitTenants(orgId, unitId) (via Occupancy)
- linkTenantToUnit(orgId, tenantId, unitId) (create occupancy; ignore duplicates)
- unlinkTenantFromUnit(orgId, tenantId, unitId) (delete occupancy row)
- listTenantUnits(orgId, tenantId) (optional but helpful)

### Routes to implement in apps/api/src/server.ts

Follow existing routing style.

**Buildings**
- GET /buildings
- POST /buildings
- PATCH /buildings/:id
- DELETE /buildings/:id (soft)

**Units**
- GET /buildings/:id/units (return both RESIDENTIAL + COMMON_AREA; allow ?type= filter)
- POST /buildings/:id/units
- PATCH /units/:id
- DELETE /units/:id (soft)

**Appliances**
- GET /units/:id/appliances
- POST /units/:id/appliances
- PATCH /appliances/:id
- DELETE /appliances/:id (soft, prevent if referenced by Request)

**Tenants**
- GET /tenants?phone=... (org-scoped lookup)
- POST /tenants (create/find)
- PATCH /tenants/:id
- DELETE /tenants/:id (soft, prevent if occupancies exist)

**Occupancies**
- GET /units/:id/tenants
- POST /units/:id/tenants body: { tenantId } OR { phone, name } to create tenant then link
- DELETE /units/:id/tenants/:tenantId

**AssetModels**
- GET /asset-models (return global + org-private)
- POST /asset-models (create org-private)
- PATCH /asset-models/:id (only org-private)
- DELETE /asset-models/:id (soft; prevent if referenced by Appliance)

### Org scoping mechanism (until auth enforced)

If auth middleware is not yet enforced, implement a temporary mechanism consistent with existing code:

- Use a hardcoded orgId from the first org in DB OR a configured env var DEV_ORG_ID
- Put all org scoping behind a helper getOrgIdForRequest(req) so later it can use req.user.orgId from auth middleware.

### Error handling rules

Return JSON errors consistently:

- 400 validation errors
- 404 not found
- 409 conflict for “prevent delete due to references”

Include a clear message and details if needed.

---

## Slice 3 — Frontend Proxy Routes (Next.js Pages Router)

In apps/web/pages/api, add proxy routes for every new backend endpoint above, matching existing style:

- pages/api/buildings.js (GET/POST)
- pages/api/buildings/[id].js (PATCH/DELETE)
- pages/api/units/[id].js (PATCH/DELETE)
- pages/api/buildings/[id]/units.js (GET/POST) (Pages Router supports nested folders)
- pages/api/units/[id]/appliances.js (GET/POST)
- pages/api/appliances/[id].js (PATCH/DELETE)
- pages/api/tenants/[id].js (PATCH/DELETE)
- pages/api/units/[id]/tenants.js (GET/POST)
- pages/api/units/[id]/tenants/[tenantId].js (DELETE)
- pages/api/asset-models/[id].js (PATCH/DELETE)

Proxy should:

- forward method, headers, query params
- forward body for POST/PATCH
- use API_BASE_URL default http://127.0.0.1:3001

---

## Slice 4 — Inventory Admin UI Expansion (CRUD)

### Goals

Replace rudimentary inventory UI with a practical editor:

- Buildings list → building detail
- building detail shows units split by type
- unit detail shows appliances + tenants linked
- add/edit/deactivate for each
- use confirmation dialog for deactivation
- handle API errors and display them clearly

### Pages to implement (Next.js Pages Router)

**/admin-inventory** as entry point:

- list buildings (active)
- create building form
- clicking a building routes to /admin-inventory/buildings/[id]

**/admin-inventory/buildings/[id]**:

- building header with edit + deactivate
- units list with two sections:
  - Residential units
  - Common area units
- create unit form with type selector
- clicking a unit routes to /admin-inventory/units/[id]

**/admin-inventory/units/[id]**:

- unit header with edit + deactivate
- appliances list + create appliance
- include asset model selector showing “Global + Org”
- tenants linked list:
  - search tenant by phone OR create tenant then link
  - unlink tenant action

**/admin-inventory/asset-models**:

- list: global (read-only) + org-private (editable)
- create org-private asset model
- edit/deactivate org-private model
- do not allow editing global models in UI

### Styling constraints

Keep styling minimal and consistent.

- Do not touch the locked manager styles rules.
- If you need styling, use a new small style module or reuse patterns from existing pages; do not inline-edit locked files.

---

## Slice 5 — Tests (incremental)

Add/extend Jest tests in apps/api/src/__tests__:

- happy path list/create for buildings/units/appliances
- occupancy link/unlink
- prevent delete behaviors:
  - cannot deactivate appliance if referenced by request
  - cannot deactivate asset model if referenced by appliance

Use real API calls to localhost if that is your current pattern, or refactor for test DB later (do not overbuild).

---

## Acceptance Criteria (Definition of Done)

- Managers can fully manage inventory from frontend:
  - add/edit/deactivate building, unit, appliance, tenant, asset model (org-private)
  - link/unlink tenants to units
  - create common-area “units” and attach appliances to them
- Org scoping is enforced in services/routing (even if dev org selection is temporary)
- Soft delete implemented (isActive=false), and delete is prevented if referenced:
  - appliance referenced by request ⇒ cannot deactivate
  - asset model referenced by appliance ⇒ cannot deactivate
  - tenant with occupancies ⇒ cannot deactivate (for now)
  - unit/building deactivation is prevented if active children exist (safe default)
- Asset model selection shows:
  - global active
  - org-private active
- Existing request flows remain working.
