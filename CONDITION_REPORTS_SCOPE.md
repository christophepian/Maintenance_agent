# Unit Condition Reports — Implementation Scope

> **Status:** In progress — implementation started 2026-06-04
>
> This document is the authoritative spec for the Unit Condition Reports feature.
> It supersedes any earlier verbal or chat-based scoping.
> All implementation decisions must be validated against the guardrails in
> [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) and the architecture rules in
> [apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md](apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md).

---

## 1. Feature Overview

Property managers and tenants perform a formal unit inspection when a tenant moves in
and when they move out (Swiss *état des lieux*). The tenant fills in the report
room by room (assets + general items), with condition ratings and notes. The manager
reviews and signs off on both. On move-out, the system computes deltas against the
move-in baseline; any degraded item **must** be accompanied by at least one photo.

**Actors and responsibilities:**

| Actor | Responsibility |
|---|---|
| System | Auto-creates MOVE_IN report when lease becomes ACTIVE; auto-creates MOVE_OUT when lease is TERMINATED |
| Tenant | Fills in items (room, label, condition, notes), uploads photos for damaged/degraded items, submits |
| Manager | Reviews, views delta (move-out vs move-in), adds manager notes, approves (or reopens with a note) |

---

## 2. Business Rules

1. **Deadline**: Each building has `conditionReportDeadlineDays` (default 7). The `dueAt` on a
   MOVE_IN report is `lease.activatedAt + deadlineDays`. MOVE_OUT reports inherit the same
   deadline from when they are created.
2. **Delta enforcement**: At MOVE_OUT submit time, any item whose condition is worse than the
   matching MOVE_IN item must have ≥ 1 photo. Submit is rejected (400) if this is violated.
3. **Matching logic**: items are matched by `assetId` (exact) when set, then `roomLabel +
   itemLabel` (case-insensitive) as a string fallback.
4. **Immutability**: Once a report is APPROVED, no further edits by either party.
5. **Condition ordering**: GOOD > FAIR > POOR > DAMAGED (higher ordinal = worse).

---

## 3. Schema Changes

### New enums

```prisma
enum ConditionReportType   { MOVE_IN  MOVE_OUT }
enum ConditionReportStatus { PENDING  SUBMITTED  APPROVED }
enum ItemCondition         { GOOD  FAIR  POOR  DAMAGED }
```

### New models

```
UnitConditionReport
  id orgId unitId tenantId leaseId
  type   ConditionReportType
  status ConditionReportStatus @default(PENDING)
  dueAt DateTime?
  submittedAt DateTime?
  approvedAt DateTime?
  approvedByUserId String?
  managerNotes String?
  createdAt updatedAt
  → org, unit, tenant, lease, approvedBy, items[]

UnitConditionReportItem
  id reportId
  assetId String?   ← FK to Asset (optional — general room items have no asset)
  roomLabel String  ← "Kitchen" / "Bedroom 1" / "Bathroom"
  itemLabel String  ← "Walls" / "Floor" / "Window" / or asset name
  condition ItemCondition
  notes String?
  → report, asset?, photos[]
  @@index([reportId])
  @@index([assetId])

UnitConditionReportPhoto
  id itemId
  storageKey String   ← S3 / local key via storage.save()
  url String          ← pre-signed or public URL returned to client
  caption String?
  createdAt DateTime
  → item
  @@index([itemId])
```

### BuildingConfig addition

```
conditionReportDeadlineDays Int? @default(7)
```

### Back-references on existing models

```
Asset       → conditionItems UnitConditionReportItem[]
Unit        → conditionReports UnitConditionReport[]
Tenant      → conditionReports UnitConditionReport[]
Lease       → conditionReports UnitConditionReport[]
User        → approvedConditionReports UnitConditionReport[]
Org         → conditionReports UnitConditionReport[]
```

---

## 4. Architecture

```
routes/conditionReports.ts
  → submitConditionReportWorkflow.ts  (PENDING → SUBMITTED)
  → approveConditionReportWorkflow.ts (SUBMITTED → APPROVED)
  → services/conditionReportService.ts
      computeDelta(), validatePhotosForDeltas(), createReportFromLease()
  → repositories/conditionReportRepository.ts
      REPORT_FULL_INCLUDE, REPORT_LIST_INCLUDE
      findById, listByUnit, listByTenant, create, addItem, upsertItem,
      deleteItem, addPhoto, deletePhoto, approve
```

**Event hooks** added to `events/handlers.ts`:

| Event | Condition | Action |
|---|---|---|
| `LEASE_STATUS_CHANGED` | `toStatus === "ACTIVE"` | Create MOVE_IN report via `createReportFromLease()` |
| `LEASE_STATUS_CHANGED` | `toStatus === "TERMINATED"` | Create MOVE_OUT report via `createReportFromLease()` |

**Transitions** in `workflows/transitions.ts`:

```
PENDING   → SUBMITTED  (tenant submits)
SUBMITTED → APPROVED   (manager approves)
SUBMITTED → PENDING    (manager reopens)
```

---

## 5. API Surface (14 endpoints)

### Manager endpoints

| Method | Path | Description |
|---|---|---|
| `GET`  | `/units/:id/condition-reports` | List all reports for a unit |
| `POST` | `/units/:id/condition-reports` | Manually create report (edge cases) |
| `GET`  | `/condition-reports/:id` | Report detail + items + photos + delta (move-out) |
| `POST` | `/condition-reports/:id/approve` | Manager sign-off; body: `{ managerNotes? }` |
| `POST` | `/condition-reports/:id/reopen` | Reopen SUBMITTED → PENDING; body: `{ managerNotes }` |

### Tenant-portal endpoints

| Method | Path | Description |
|---|---|---|
| `GET`    | `/tenant-portal/condition-reports` | Tenant's reports (PENDING + SUBMITTED) |
| `GET`    | `/tenant-portal/condition-reports/:id` | Report detail + items + photos |
| `POST`   | `/tenant-portal/condition-reports/:id/items` | Add item; body: `{ assetId?, roomLabel, itemLabel, condition, notes? }` |
| `PATCH`  | `/tenant-portal/condition-reports/:id/items/:itemId` | Update item condition/notes |
| `DELETE` | `/tenant-portal/condition-reports/:id/items/:itemId` | Remove item |
| `POST`   | `/tenant-portal/condition-reports/:id/items/:itemId/photos` | Upload photo (multipart/form-data, field: `photo`) |
| `DELETE` | `/tenant-portal/condition-reports/:id/items/:itemId/photos/:photoId` | Delete photo |
| `POST`   | `/tenant-portal/condition-reports/:id/submit` | Submit for manager review (validates delta photos) |

---

## 6. Delta Computation (`computeDelta`)

Runs server-side on `GET /condition-reports/:id` when `type === MOVE_OUT`.

```
1. Load the APPROVED MOVE_IN report for the same leaseId.
2. For each MOVE_OUT item:
   a. Find matching MOVE_IN item by assetId (exact) or roomLabel+itemLabel (case-insensitive).
   b. If match found: compute isDelta = condition ordinal > moveIn condition ordinal.
   c. Attach moveInCondition + isDelta to each item in the response.
3. Return deltaCount (number of degraded items), hasUnphotoedDeltas (bool).
```

**Condition ordinal:** GOOD=0, FAIR=1, POOR=2, DAMAGED=3.

---

## 7. Photo Upload

Uses existing `storage.save()` from `apps/api/src/storage/attachments.ts`.
Photo endpoint parses multipart/form-data (using `busboy`, already in use).
Max size: 5 MB. Accepted MIME: `image/jpeg`, `image/png`, `image/webp`.
Storage key pattern: `condition-reports/{reportId}/{itemId}/{uuid}.{ext}`.

Photo URL is generated via `storage.getUrl(key)` (same pattern as invoice source files).

---

## 8. Frontend Pages

### Tenant portal

| Page | Path | Description |
|---|---|---|
| Inbox | `pages/tenant/condition-reports/index.js` | Lists pending/submitted reports with status badge and due-date countdown |
| Form | `pages/tenant/condition-reports/[id].js` | Room-by-room form: add items, set condition (GOOD/FAIR/POOR/DAMAGED), add notes, upload photos (required for deltas), submit |

Nav entry added to `TenantSidebar` (icon: `ClipboardList`).

### Manager

| Page | Path | Description |
|---|---|---|
| Detail + approve | `pages/manager/condition-reports/[id].js` | Full report view with delta comparison table, manager notes textarea, Approve / Reopen buttons |

Link from unit detail (admin-inventory building page) → new "Condition Reports" tab listing reports for that unit.

### Admin-inventory integration

New **"Condition Reports"** tab on `admin-inventory/buildings/[id].js` unit detail (currently accessible via the Units tab → unit row click or unit detail).

> **Clarification needed:** The building detail page shows units but not a per-unit drill-down page. Condition Reports should surface on the **building-level** "Units" tab next to each unit row (a "View reports" link), linking to the manager condition report detail page. Confirm this approach or describe the desired navigation path.

### Asset enrichment

On the building detail page Assets tab, each asset card/row gains a `latestCondition` badge:
`{ condition: ItemCondition, reportedAt: DateTime, reportId: string } | null`
sourced from the most recent APPROVED condition report item referencing that asset.

---

## 9. Notifications

Two new `NotificationEventType` values (separate migration):

| Event | Recipient | Message |
|---|---|---|
| `CONDITION_REPORT_SUBMITTED` | All org managers | `"{tenantName} submitted their {MOVE_IN|MOVE_OUT} report for unit {unitNumber}."` |
| `CONDITION_REPORT_APPROVED` | Tenant (via tenant notification, if supported) | `"Your condition report has been approved by the property manager."` |

---

## 10. i18n Keys Required

### `en/tenant.json` → `conditionReport.*`

```
nav.conditionReports, title, subtitle, empty, loading
status.pending, status.submitted, status.approved
dueIn, overdue
form.addItem, form.roomLabel, form.itemLabel, form.condition, form.notes
form.photosRequired, form.submit, form.submitting
condition.GOOD, condition.FAIR, condition.POOR, condition.DAMAGED
```

### `en/manager.json` → `conditionReport.*`

```
nav.conditionReports (sidebar)
title, subtitle, loading, notFound
type.MOVE_IN, type.MOVE_OUT
status.pending, status.submitted, status.approved
delta.title, delta.noDelta, delta.degradedItems
approve, approving, reopen, reopening
managerNotes, managerNotesPlaceholder
```

---

## 11. Test Strategy

Integration test file: `src/__tests__/conditionReports.test.ts` — **PORT 3228**

Coverage:
1. Auto-create MOVE_IN on LEASE → ACTIVE
2. Tenant add/update/delete item
3. Tenant upload photo
4. MOVE_OUT submit blocked when delta item has no photo
5. MOVE_OUT submit succeeds when all delta items are photographed
6. Manager approve
7. Manager reopen → tenant re-edits → submit → approve
8. Delta computation correctness

---

## 12. Implementation Sequence

Each increment is committed and tested before starting the next.

| # | What ships | Testable via |
|---|---|---|
| 1 | Schema + migration + repository + routes (no photos yet) + proxy stubs | API (curl / network tab) |
| 2 | Event hooks (auto-create on LEASE_STATUS_CHANGED) + BuildingConfig deadline | Verify report created after lease activation |
| 3 | Photo upload endpoint + storage wiring | API / multipart POST |
| **4** | **Tenant frontend: inbox + form (no photo UI yet)** | **→ User can test** |
| **5** | **Photo upload UI in tenant form** | **→ User can test** |
| **6** | **Manager frontend: delta view + approve/reopen** | **→ User can test** |
| **7** | **Asset enrichment badge on building detail page** | **→ User can test** |
| 8 | Notifications (CONDITION_REPORT_SUBMITTED/APPROVED) | Notification bell |
| 9 | Full EN+FR i18n, integration tests, contracts.test.ts update | CI |

---

## 13. Open Questions

> ✅ = answered, ❓ = still open

1. **Navigation to per-unit condition reports** ❓ — Is there a per-unit detail page in
   admin-inventory, or should condition report links appear inline on the Units tab of the
   building detail page?
2. **MOVE_OUT creation timing** — Currently triggered on `toStatus === "TERMINATED"`. Is this
   correct, or should the manager manually initiate the MOVE_OUT report before termination
   is finalised?
3. **Tenant notification on APPROVED** — The current notification system targets `User` records.
   Tenants are in the `Tenant` table (separate from `User`). This increment is deferred to
   slice 8; in the meantime only managers are notified.

---

## 14. Files Created / Modified

### New backend files
- `apps/api/prisma/migrations/20260604020000_add_condition_reports/migration.sql`
- `apps/api/src/repositories/conditionReportRepository.ts`
- `apps/api/src/services/conditionReportService.ts`
- `apps/api/src/routes/conditionReports.ts`
- `apps/api/src/workflows/submitConditionReportWorkflow.ts`
- `apps/api/src/workflows/approveConditionReportWorkflow.ts`
- `apps/api/src/__tests__/conditionReports.test.ts`

### Modified backend files
- `apps/api/prisma/schema.prisma` — new models, enums, back-refs
- `apps/api/src/server.ts` — register route module
- `apps/api/src/events/handlers.ts` — LEASE_STATUS_CHANGED hooks
- `apps/api/src/workflows/transitions.ts` — new transition map
- `apps/api/src/validation/notifications.ts` — 2 new event types
- `apps/api/src/services/notifications.ts` — 2 new notify functions

### New frontend files
- `apps/web/pages/tenant/condition-reports/index.js`
- `apps/web/pages/tenant/condition-reports/[id].js`
- `apps/web/pages/manager/condition-reports/[id].js`
- `apps/web/pages/api/condition-reports/[id]/index.js`
- `apps/web/pages/api/condition-reports/[id]/approve.js`
- `apps/web/pages/api/condition-reports/[id]/reopen.js`
- `apps/web/pages/api/condition-reports/[id]/items/index.js`
- `apps/web/pages/api/condition-reports/[id]/items/[itemId]/index.js`
- `apps/web/pages/api/condition-reports/[id]/items/[itemId]/photos/index.js`
- `apps/web/pages/api/condition-reports/[id]/items/[itemId]/photos/[photoId].js`
- `apps/web/pages/api/condition-reports/[id]/submit.js`
- `apps/web/pages/api/tenant/condition-reports/index.js`
- `apps/web/pages/api/tenant/condition-reports/[id]/index.js`
- `apps/web/pages/api/tenant/condition-reports/[id]/items/index.js`
- `apps/web/pages/api/tenant/condition-reports/[id]/items/[itemId]/index.js`
- `apps/web/pages/api/tenant/condition-reports/[id]/items/[itemId]/photos/index.js`
- `apps/web/pages/api/tenant/condition-reports/[id]/items/[itemId]/photos/[photoId].js`
- `apps/web/pages/api/tenant/condition-reports/[id]/submit.js`
- `apps/web/pages/api/units/[id]/condition-reports.js`

### Modified frontend files
- `apps/web/components/TenantSidebar.js` — add conditionReports nav entry
- `apps/web/pages/admin-inventory/buildings/[id].js` — Condition Reports tab on unit detail
- `apps/web/public/locales/en/tenant.json` — conditionReport.* keys
- `apps/web/public/locales/fr/tenant.json` — conditionReport.* keys
- `apps/web/public/locales/en/manager.json` — conditionReport.* + notification event keys
- `apps/web/public/locales/fr/manager.json` — conditionReport.* + notification event keys
