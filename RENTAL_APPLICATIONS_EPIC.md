# EPIC: Rental Applications → Ranking → Owner Selection → Lease from Building Template

---

## 0) Non-negotiable guardrails (must follow)

- **No `prisma db push`.** Schema changes require `npx prisma migrate dev --name ...` and drift check (G1/G8).
- **Any new model fields** require updating: Prisma schema, DTOs, mappers, canonical includes, validation, OpenAPI, api-client, contract tests (G2/H4/G9/G10).
- **No stubs in production paths** (G4).
- **No destructive DB commands** (G6).

---

## 1) Overview (what we're building)

### Tenant (public, no auth)

Tenant fills one application dossier and applies it to one or many vacant units (units have a vacant flag).

Form is web-first (English UI), based on the fields in the template:

- **Page 1:** desired object + applicant identity/employment/income + household + current landlord + reason for leaving
- **Page 2:** co-applicant block + pets/RC insurance/vehicle/parking + remarks + references + consent/signature + required documents list

All fields mandatory.

Co-applicants are 0..N, and each must provide required documents.

### Manager (per vacant unit)

Sees applications ranked by suitability & confidence. Can correct score with a reason and mark manual check complete.

### Owner (final decision)

- Picks primary + 2 backups.
- Deadline is 7 calendar days (building policy, agreed manager+owner).
- If primary doesn't sign, lease is voided and the next backup gets access automatically.
- All other candidates are rejected immediately.
- Unit status changes from `VACANT` → `AWAITING_LEASE_SIGNATURE`.

### Lease generation

- Building-level lease template is a saved Lease draft.
- On selection: copy template, fill unit-specific fields + tenant-specific fields from application, manager can review/override, then tenant receives email link to review/sign.

### Rules

- **Hard disqualifier:** net household income ≥ multiplier × (rent + charges); multiplier configurable in building policy (default 3).
- Disqualified candidates remain in list (with score + disqualified flag).
- Missing docs disqualify as well; notify missing docs only for otherwise suitable candidates.

### Docs retention

- **Rejected:** delete attachments after 30 days
- **Selected:** keep indefinitely
- **Backups:** keep until lease is signed; then apply rejection retention to non-selected.

### Email

No provider yet: implement `EmailOutbox` + dev sink view; provider integration is backlog.

---

## 2) Phase plan (ship value fast)

### Phase 1 (MVP)

- Public intake (multi-unit apply) + attachments + typed signature
- Evaluation: income rule + missing-docs disqualifier + basic scoring + confidence score
- Manager & owner dashboards (per unit)
- Owner selection + backup + deadline
- Lease creation from template + send lease link via EmailOutbox
- Tenant can open lease link and "accept/sign" using existing stub flow
- Retention job: delete rejected docs after 30 days

### Phase 2 (enhancements)

- More sophisticated plausibility heuristics (role seniority, employer plausibility)
- Better PDF export of application dossier (optional)
- Qualified e-sign integration (backlog)

---

## 3) Data model (Prisma) — NEW MODELS

Create new models under `apps/api/prisma/schema.prisma`. Use migrations only.

### 3.1 Models (proposed)

#### RentalApplication

| Field | Type |
|-------|------|
| id | uuid |
| createdAt | datetime |
| submittedAt | datetime |
| status | `DRAFT` \| `SUBMITTED` |
| signedName | string |
| signedAt | datetime |
| signatureIp | string |
| signatureUserAgent | string |
| applicationDataJson | JSON — full normalized form payload snapshot for audit/export |

#### RentalApplicant

| Field | Type |
|-------|------|
| id | uuid |
| applicationId | FK → RentalApplication |
| role | `PRIMARY` \| `CO_APPLICANT` |
| *(all applicant fields)* | name, birthdate, nationality, civilStatus, employer, jobTitle, workLocation, employedSince, netMonthlyIncome, phone, email, permitType, hasDebtEnforcement, etc. — matching the template pages 1–2 |

#### RentalAttachment

| Field | Type |
|-------|------|
| id | uuid |
| applicationId | FK → RentalApplication |
| applicantId | FK → RentalApplicant (required — docs are per applicant) |
| docType | enum (see below) |
| fileName | string |
| fileSizeBytes | int |
| mimeType | string |
| storageKey | string |
| sha256 | string |
| uploadedAt | datetime |
| retentionDeleteAt | datetime nullable |

#### RentalApplicationUnit

| Field | Type |
|-------|------|
| id | uuid |
| applicationId | FK → RentalApplication |
| unitId | FK → Unit |
| createdAt | datetime |
| status | `SUBMITTED` \| `REJECTED` \| `SELECTED_PRIMARY` \| `SELECTED_BACKUP_1` \| `SELECTED_BACKUP_2` \| `AWAITING_SIGNATURE` \| `SIGNED` \| `VOIDED` |
| evaluationJson | JSON — score breakdown, disqualifiers, confidence, missing docs list |
| scoreTotal | int |
| confidenceScore | int |
| disqualified | boolean |
| disqualifiedReasons | string[] or JSON |
| rank | int nullable — precomputed ordering (optional) |

#### RentalOwnerSelection

| Field | Type |
|-------|------|
| id | uuid |
| unitId | FK → Unit |
| createdAt | datetime |
| decidedAt | datetime |
| deadlineAt | datetime |
| primaryApplicationUnitId | FK → RentalApplicationUnit |
| backup1ApplicationUnitId | FK → RentalApplicationUnit (nullable) |
| backup2ApplicationUnitId | FK → RentalApplicationUnit (nullable) |
| status | `AWAITING_SIGNATURE` \| `SIGNED` \| `VOIDED` \| `FALLBACK_1` \| `FALLBACK_2` \| `EXHAUSTED` |

#### EmailOutbox

| Field | Type |
|-------|------|
| id | uuid |
| createdAt | datetime |
| toEmail | string |
| template | `MISSING_DOCS` \| `REJECTED` \| `SELECTED_LEASE_LINK` |
| subject | string |
| bodyText | string |
| status | `PENDING` \| `SENT` \| `FAILED` |
| metaJson | JSON — applicationId/unitId/leaseId etc. |

### 3.2 Enums

- `RentalDocType`: `IDENTITY`, `SALARY_PROOF`, `PERMIT`, `DEBT_ENFORCEMENT_EXTRACT`, `HOUSEHOLD_INSURANCE`, `STUDENT_PROOF`, `PARKING_DOCS`
- `RentalApplicationStatus`: `DRAFT`, `SUBMITTED`
- `RentalApplicationUnitStatus`: `SUBMITTED`, `REJECTED`, `SELECTED_PRIMARY`, `SELECTED_BACKUP_1`, `SELECTED_BACKUP_2`, `AWAITING_SIGNATURE`, `SIGNED`, `VOIDED`
- `RentalOwnerSelectionStatus`: `AWAITING_SIGNATURE`, `SIGNED`, `VOIDED`, `FALLBACK_1`, `FALLBACK_2`, `EXHAUSTED`
- `EmailOutboxStatus`: `PENDING`, `SENT`, `FAILED`
- `ApplicantRole`: `PRIMARY`, `CO_APPLICANT`

### 3.3 Building policy fields

Add fields to `BuildingConfig`:

| Field | Type | Default |
|-------|------|---------|
| rentalIncomeMultiplier | float | 3 |
| rentalSignatureDeadlineDays | int | 7 |
| rentalManualReviewConfidenceThreshold | int | 60 |

If you want these in a dedicated table instead, create `BuildingRentalPolicy` keyed by `buildingId`.

---

## 4) Storage adapter for attachments

### 4.1 API module

Create `apps/api/src/storage/attachments.ts`:

```typescript
interface AttachmentStorage {
  save(readable, opts) -> { key, size, sha256, mimeType };
  get(key) -> stream;
  delete(key);
}
```

- Implement `LocalDiskStorage` (dev): store under `apps/api/.data/uploads/<applicationId>/<applicantId>/<docType>/...`
- Add config `ATTACHMENTS_STORAGE=local|s3` (s3 later)
- Ensure downloads go through auth-protected routes for manager/owner (tenant only gets lease link, not raw docs)

---

## 5) Backend services (`apps/api/src/services`)

### 5.1 Validation schemas (Zod)

Create `apps/api/src/validation/rentalApplications.ts`:

- `CreateRentalApplicationSchema`
- `SubmitRentalApplicationSchema` (requires signature + all mandatory fields)
- `UploadAttachmentSchema` (docType, applicantId)
- `OwnerSelectionSchema` (primaryId, backup1Id, backup2Id)

Ensure all fields mandatory.

### 5.2 Canonical includes (G9)

Create `apps/api/src/services/rentalIncludes.ts`:

- `RENTAL_APPLICATION_INCLUDE` includes applicants, attachments, applicationUnits, and nested unit → building.
- Add `RENTAL_APPLICATION_UNIT_INCLUDE` etc.

### 5.3 DTOs + mappers

Create `apps/api/src/services/rentalApplications.ts`:

**DTOs:**
- `RentalApplicationDTO`
- `RentalApplicantDTO`
- `RentalAttachmentDTO`
- `RentalApplicationUnitDTO`
- `RentalOwnerSelectionDTO`

Mapper functions must use typed Prisma payloads based on canonical includes.

### 5.4 Core operations

In `services/rentalApplications.ts` implement:

- **`createRentalApplicationDraft(payload)`** (public)

- **`submitRentalApplication(applicationId)`:**
  - Validate required fields + signature present
  - Ensure at least 1 unit selected
  - Ensure attachments exist for required doc types for each applicant (but submission allowed; missing docs become disqualifier)
  - Create `RentalApplicationUnit` rows for each selected unit
  - Run evaluation per unit (below)
  - Enqueue `EmailOutbox` if "otherwise suitable but missing docs"

- **`uploadRentalAttachment(applicationId, applicantId, docType, file)`:**
  - Enforce ≤ 5MB
  - Store via `AttachmentStorage`
  - Create `RentalAttachment` row

- **`getApplication(id)`** / **`listApplicationsForUnit(unitId)`** for manager/owner

- **`adjustEvaluation(applicationUnitId, {scoreDelta, reason, overrideJson})`** (manager)

- **`ownerSelectCandidates(unitId, primaryAUId, backup1AUId, backup2AUId)`:**
  - Set unit status → `AWAITING_LEASE_SIGNATURE`
  - Mark selected statuses, reject rest, enqueue rejection emails
  - Generate lease project for primary
  - Enqueue `SELECTED` email with lease link

- **`handleSignatureTimeout(unitId)`** (job/cron):
  - If not signed and past deadline: void lease, promote backup1/backup2, enqueue new selected email, mark statuses accordingly

### 5.5 Evaluation engine (new domain)

Create `apps/api/src/services/rentalRules.ts`:

**Inputs:**
- Building policy (multiplier, thresholds)
- Unit rent + charges (from vacancy data / unit config)
- Application applicant incomes (sum)
- Attachments presence per required doc type

**Outputs:**
- `scoreTotal`
- `confidenceScore`
- `disqualified` + `reasons`
- `missingDocs[]`
- Breakdown list for debugging

**Income rule (hard):**
- Compare net household income against multiplier × (rent + charges)
- Annexes ignored (not fixed) per decision.

**Missing docs rule:**
- If any required doc types missing per applicant → disqualified reason `MISSING_REQUIRED_DOCS`

**Confidence (Phase 1):**
- 0–100 based on doc completeness + income proof present + basic plausibility heuristics

---

## 6) Backend routes (`apps/api/src/routes`)

Create `apps/api/src/routes/rentalApplications.ts` and register in `server.ts`.

### 6.1 Public routes (no auth)

- `GET /vacant-units` — list units where `isVacant=true` with building info (if not already present)
- `POST /rental-applications` — create draft or create+submit depending on payload
- `POST /rental-applications/:id/submit`
- `POST /rental-applications/:id/attachments` — multipart upload (accepts applicantId, docType, file)
- `GET /rental-applications/:id/summary.pdf` — optional Phase 2; can be HTML-to-PDF later

### 6.2 Manager routes (withRole MANAGER)

- `GET /manager/rental-applications?unitId=...` — ranked list
- `GET /manager/rental-applications/:id` — detail with docs metadata
- `POST /manager/rental-application-units/:id/adjust-score`

### 6.3 Owner routes (withRole OWNER)

- `GET /owner/rental-applications?unitId=...` — ranked list
- `POST /owner/units/:unitId/select-tenants` — primary + backups
- `POST /owner/units/:unitId/recompute-rank` — optional

### 6.4 System routes (protected / dev-only)

- `POST /__dev/rental/advance-timeouts` — test helper only; blocked in prod

Apply H1 wrappers (`withRole`) at registration (no ad-hoc checks).

---

## 7) Lease template support (building-level)

### 7.1 Data model

Add to `Lease` model:

| Field | Type |
|-------|------|
| isTemplate | Boolean `@default(false)` |
| templateBuildingId | String? (or `buildingId` if Lease already connects to unit/building through unitId; choose consistent relation) |
| templateName | String? |

### 7.2 Services

In `services/leases.ts`:

- **`createLeaseTemplateFromLease(leaseId, buildingId, name)`** — or "Save as template"
- **`listLeaseTemplates(buildingId)`**
- **`createLeaseFromTemplate({ templateId, unitId, applicantData })`:**
  - Copy template fields
  - Fill unit-specific fields (rooms, sqm, rent, charges)
  - Fill tenant-specific fields from application (primary applicant; include co-applicant if your lease supports)
  - Return `LeaseDTO`

### 7.3 UI integration

- **Manager flow:** From owner selection result, manager can open generated lease draft, review/override, then click "Send to tenant".
- **Owner flow:** Owner selection triggers generation automatically; manager can still adjust.

---

## 8) Frontend (`apps/web`)

### 8.1 Tenant public pages

**`/apply`:**
- Step 1: select vacant units (multi-select)
- Step 2: application form (all mandatory fields)
- Step 3: document upload checklist with drag/drop
- Step 4: review + submit + signature (typed name + checkbox)

Use Next API routes proxying to backend via `proxyToBackend()` helper (H3).

### 8.2 Manager pages

- **`/manager/vacancies`** (or under existing manager nav): list vacant units
- **`/manager/vacancies/[unitId]/applications`**: ranked list, flags, open detail, adjust score
- **`/manager/applications/[applicationId]`**: detail, documents list (download), evaluation breakdown
- **`/manager/leases/templates`**: choose building, list templates, "save current lease as template"

### 8.3 Owner pages

- **`/owner/vacancies/[unitId]/candidates`**: ranked list, select primary + backup1 + backup2, confirm deadline (from building policy)

### 8.4 Dev email sink (until provider)

- **`/manager/emails`** or **`/admin/emails`**: list EmailOutbox, view body, mark as sent (dev)

---

## 9) API Client + OpenAPI + tests (H4 hard requirement)

### 9.1 OpenAPI

Update `apps/api/openapi.yaml`:
- Add endpoints + schemas for `RentalApplicationDTO`, etc.
- Add enums

### 9.2 Typed client

Update `packages/api-client/src/index.ts`:
- Add `api.rentals.*` namespace methods
- Add DTOs

### 9.3 Contract tests (G10)

Add `apps/api/src/__tests__/rentalContracts.test.ts`:
- `POST /rental-applications` then `GET /manager/rental-applications?unitId=...`
- Assert required top-level + nested fields exist, and disqualified candidates still appear

### 9.4 Integration tests

Add `apps/api/src/__tests__/rentalApplications.test.ts`:
- Submission with missing docs disqualifies + triggers missing-doc email only if income passes
- Income below threshold disqualifies but still scored and visible
- Owner selection rejects non-selected
- Timeout fallback promotes backup
- `retentionDeleteAt` set for rejected docs

---

## 10) Background jobs / timeouts / retention

Since we don't have a job runner yet:

- Implement a simple `setInterval` in API server (dev) **OR** a route-triggered runner used by tests.

**Functions:**
- **`processSelectionTimeouts(now)`**
- **`processAttachmentRetention(now)`** — deletes storage objects whose `retentionDeleteAt <= now` and removes DB rows

Make sure production can disable the interval if needed via env flag.

---

## 11) Implementation order (exact step-by-step)

1. **Locate vacancy fields:** confirm `Unit` has `isVacant` (or add it via migration if missing). No destructive commands.
2. **Add Prisma models/enums** (Section 3) + `migrate dev`.
3. **Add attachment storage adapter** + upload endpoint (Section 4 + 6.1 attachments).
4. **Add validation schemas** for application payload and attachments.
5. **Implement rental services** (create draft, submit, list per unit, get detail).
6. **Implement evaluation engine** (income rule vs rent+charges, missing docs, score/confidence).
7. **Add manager routes + owner routes** (`withRole` wrappers).
8. **Add EmailOutbox service** + dev sink endpoint/pages.
9. **Implement owner selection** + backup logic + deadline.
10. **Add lease template support** (`isTemplate` fields + copy-from-template).
11. **Frontend:** tenant apply wizard + manager unit applications page + owner selection page.
12. **OpenAPI + typed client** updates.
13. **Tests:** unit/integration/contract tests.
14. **Retention + timeout processors** + tests.
15. **Run full CI gates** (drift, generate, tsc, next build, jest, boot + curls).

---

## 12) Acceptance criteria (Phase 1)

- [ ] Tenant can submit one dossier and apply to multiple vacant units.
- [ ] All template fields exist and are mandatory; signature is captured.
- [ ] Attachments: any format, ≤5MB, multiple per doc type, per applicant.
- [ ] Manager sees ranked applications per unit; disqualified remain visible with reasons.
- [ ] Income rule uses multiplier × (rent + charges); annexes excluded.
- [ ] Owner can select primary + 2 backups; others are rejected and get email outbox entries.
- [ ] Unit status becomes `AWAITING_LEASE_SIGNATURE`.
- [ ] Lease draft created from building template, filled with tenant data, email sent with link.
- [ ] Timeout after 7 days auto-voids and promotes backups.
- [ ] Rejected attachments scheduled for deletion at +30 days; selected retained indefinitely.
