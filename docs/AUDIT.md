# Maintenance Agent — Project Audit

**Generated:** 2026-03-10
**Last updated:** 2026-05-30 — Dark mode fully implemented: 37 tokens, `html.dark` CSS override block (invest.html palette), `useTheme` hook, `AppearanceTab`, wired into all 4 settings pages. Token migration completed (bg-slate-200/300, text-slate-200/300 — total 87 additional replacements). Contrast fixes for manager attention feed and owner reporting hero. Remaining: QA pass across 4 personas. Previous: Design token migration (FE-NEW-1 resolved, 35 → 37 tokens, 3,683+87 replacements across 148 files). Session-6 code-quality sweep: 7 findings all resolved in-session.
**Scope:** Code Quality, Schema Integrity, Test Coverage, Security & Auth
**Source commit:** ed7c841 (branch: main); findings reflect state as of 2026-03-10
**Codebase at audit time:** 46 models · 38 enums · 36 migrations · 17 workflows · 10 repositories · 372 tests / 33 suites · ~36k backend LOC · ~27k frontend LOC · 195 pages · ~146 API routes
**Codebase current (2026-05-30):** 73 models · 67 enums · 98 migrations · 32 workflows · 41 repositories · 1068 tests / 72 suites · ~84k backend LOC · ~58k frontend LOC · 329 pages · 248 routes
**Frontend rationalization audit:** Completed 2026-03-10 — results in [docs/FRONTEND_INVENTORY.md](FRONTEND_INVENTORY.md) (195 pages, 119/119 proxies conforming at audit time; 197/197 conforming as of 2026-05-06)

## Summary

| Area | Findings | Critical | High | Medium | Low | Resolved | Open |
|------|----------|----------|------|--------|-----|----------|------|
| Code Quality & Architecture | 47 | 0 | 7 | 13 | 27 | 46 | 1 |
| Schema & Data Integrity | 18 | 0 | 1 | 8 | 9 | 16 | 2 |
| Test Coverage Gaps | 18 | 0 | 7 | 9 | 2 | 18 | 0 |
| Security & Auth | 22 | 1 | 8 | 10 | 3 | 22 | 0 |
| **Total** | **105** | **1** | **23** | **40** | **41** | **102** | **3** |

---

## Area 1 — Code Quality & Architecture

### CQ-1 · ✅ `routes/legal.ts` — massive layer violation (HIGH)

- **Status:** ✅ Resolved — 2026-03-22 (Legal Route Layer Extraction slice, S-P0-004-01)
- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L285–775 (multiple handlers)
- **Description:** ~300 lines of direct Prisma queries and business logic in route handlers. Legal rules CRUD (L285–370), category mappings CRUD (L380–480), coverage computation (L490–610), depreciation standards (L620–670), and evaluation listing (L688–775) all contain direct `prisma.*` calls, inline include trees, and DTO mapping.
- **Fix:** Extract to `legalAdminService` and `legalCategoryMappingRepository` with canonical includes.
- **Resolution:** All 26 direct `prisma.*` calls in `routes/legal.ts` extracted to `services/legalService.ts`. Route handlers now delegate: auth check → parse → call service → sendJson/sendError. Zero direct Prisma calls remain in the route file. New service exports: `listVariables`, `listRules`, `createRule`, `listCategoryMappings`, `createCategoryMapping`, `updateCategoryMapping`, `deleteCategoryMapping`, `getMappingCoverage`, `listEvaluations`, `listDepreciationStandards`, `createDepreciationStandard`.

### CQ-2 · `routes/rentalApplications.ts` — selection pipeline duplicated (HIGH) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Lines:** L362–575
- **Description:** `GET /manager/rental-application-units` and `GET /owner/rental-selections` contain near-duplicate ~80-line handlers with deep 4-level ad-hoc include trees and inline DTO mapping. Both define the same `applicants → attachments → unit → building` tree inline.
- **Fix:** Define `SELECTION_PIPELINE_INCLUDE` constant; extract to shared `rentalSelectionService.listPipeline()`.
- **Partial progress (2026-03-10):** `SELECTION_PIPELINE_INCLUDE` constant extracted and shared by both handlers (CQ-14 resolution). Service extraction to `rentalSelectionService.listPipeline()` still pending.
- **Resolution:** Created `rentalSelectionService.ts` with `listManagerSelections()` and `listOwnerSelections()`. Both route handlers now delegate to service calls.

### CQ-3 · `routes/tenants.ts` — business logic in route (HIGH) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/tenants.ts`
- **Lines:** L141–195
- **Description:** `GET /tenants/:id/payment-history` executes a 3-query Prisma chain (occupancies → leases → invoices), performs inline DTO mapping with date formatting, and manual joins via `flatMap` — all business orchestration in the route.
- **Fix:** Extract to `tenantService.getPaymentHistory()`.
- **Resolution:** Route no longer exists in the codebase — removed in a prior refactor. Finding is moot.

### CQ-4 · `routes/leases.ts` — notification logic in route (HIGH) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/leases.ts`
- **Lines:** L120–145
- **Description:** `POST /leases/:id/ready-to-sign` dynamically imports `notificationService` and performs 3 direct Prisma queries for tenant notification logic — business orchestration belongs in the `markLeaseReadyWorkflow`.
- **Fix:** Move notification trigger into `markLeaseReadyWorkflow` or a follow-up workflow step.

### CQ-5 · `routes/legal.ts` — coverage computation (HIGH) ✅ Resolved 2026-03-22

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L490–610
- **Description:** `GET /legal/coverage` contains ~120 lines of complex business logic: multi-query Prisma joins, keyword matching against `LegalCategoryMapping`, depreciation counting, string formatting — all inline.
- **Fix:** Extract to `legalCoverageService.computeCoverage()`.
- **Resolution:** Covered by CQ-1 resolution — all 26 direct Prisma calls extracted to `services/legalService.ts`. `routes/legal.ts` now has zero direct `prisma.*` calls.

### CQ-6 · `routes/legal.ts` — evaluation listing (HIGH) ✅ Resolved 2026-03-22

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L688–775
- **Description:** `GET /legal/evaluations` does direct Prisma queries, JSON flattening of rule/variable versions, post-query filtering by date and status, and DTO building — all in the route handler.
- **Fix:** Extract to `legalEvaluationService.listEvaluations()`.
- **Resolution:** Covered by CQ-1 resolution — `listEvaluations()` extracted to `services/legalService.ts`.

### CQ-7 · `routes/legal.ts` — ad-hoc includes (HIGH) ✅ Resolved 2026-03-10

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L291–370
- **Description:** `GET /legal/variables` and `GET /legal/rules` use inline include objects (`{ versions: true, source: true }`) instead of canonical constants. Violates G9.
- **Fix:** Define `LEGAL_VARIABLE_INCLUDE` and `LEGAL_RULE_INCLUDE` constants.
- **Resolution:** Defined `LEGAL_VARIABLE_INCLUDE`, `LEGAL_RULE_INCLUDE`, `LEGAL_RULE_WITH_VERSIONS_INCLUDE`, `DEPRECIATION_STANDARD_INCLUDE` in `legalSourceRepository.ts`. All 4 inline includes in `legal.ts` replaced with canonical constants. (`prisma-dto-hardening` slice)

### CQ-8 · `routes/auth.ts` — direct Prisma (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/auth.ts`
- **Lines:** L228–295
- **Description:** `POST /auth/register` and `POST /auth/login` call `prisma.user.*` directly with bcrypt hashing and token generation inline.
- **Fix:** Extract to `authService.registerUser()` and `authService.loginUser()`.
- **Resolution:** Created `userService.ts` with `registerUser()` and `authenticateUser()`. Both route handlers now delegate to service calls.

### CQ-9 · `routes/requests.ts` — direct Prisma for events (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/requests.ts`
- **Lines:** L57–85
- **Description:** `GET /requests/:id/events` and `POST /requests/:id/events` call `prisma.requestEvent.*` directly.
- **Fix:** Extract to `requestEventService.listEvents()` and `createEvent()`.
- **Resolution:** Created `requestEventService.ts` with `listRequestEvents()` and `createRequestEvent()`. Both route handlers now delegate to service calls.

### CQ-10 · `routes/requests.ts` — owner-reject has no workflow (MEDIUM) ✅ Resolved 2026-03-11

- **File:** `apps/api/src/routes/requests.ts`
- **Lines:** L125–155
- **Description:** `POST /requests/:id/owner-reject` contains inline business logic: status check, status transition, and event logging — no workflow exists for owner rejection.
- **Fix:** Create `ownerRejectWorkflow` similar to `approveRequestWorkflow`.
- **Resolution:** Created `ownerRejectWorkflow.ts` during Triage Rework epic. Route now delegates to workflow. Added OWNER_REJECTED status, PENDING_OWNER_APPROVAL → OWNER_REJECTED transition in `transitions.ts`, and `ApprovalSource` tracking.

### CQ-11 · `routes/invoices.ts` — workflows exist but not wired (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/invoices.ts`
- **Description:** Routes for `POST /invoices/:id/approve`, `POST /invoices/:id/pay`, and `POST /invoices/:id/dispute` call services directly. The workflow files exist in `workflows/` but are not wired into these routes.
- **Fix:** Wire `approveInvoiceWorkflow`, `payInvoiceWorkflow`, `disputeInvoiceWorkflow` into the route handlers.
- **Resolution:** All three workflows are now imported and delegated to in `invoices.ts` (lines 207, 228, 252). `invoiceWorkflows.test.ts` provides integration coverage for all three transition paths including guard violations and cross-org isolation.

### CQ-12 · `routes/inventory.ts` — direct Prisma for assets (MEDIUM) ✅ Resolved 2026-03-10

- **File:** `apps/api/src/routes/legal.ts` (actual location; AUDIT incorrectly cited inventory.ts)
- **Lines:** L781–812
- **Description:** `GET /assets` and `POST /assets` call `prisma.asset.*` directly despite `assetRepository` existing.
- **Fix:** Use existing `assetRepository` functions.
- **Resolution:** Added `ASSET_LIST_INCLUDE`, `findAssetsForOrg()`, and `createAssetSimple()` to `assetRepository.ts`. Route now uses `assetRepo.findAssetsForOrg()` and `assetRepo.createAssetSimple()`. (`prisma-dto-hardening` slice)

### CQ-13 · `routes/contractor.ts` — direct Prisma for verification (MEDIUM) ✅ Resolved 2026-03-10

- **File:** `apps/api/src/routes/contractor.ts`
- **Lines:** L39–45
- **Description:** All 4 contractor route handlers call `prisma.contractor.findFirst()` directly to verify contractor existence and org ownership.
- **Fix:** Extract to `contractorRepository.verifyOrgOwnership()`.
- **Resolution:** Created `contractorRepository.ts` with `CONTRACTOR_INCLUDE` and `verifyOrgOwnership()`. All 4 handlers in `contractor.ts` now use `contractorRepo.verifyOrgOwnership()`. (`prisma-dto-hardening` slice)

### CQ-14 · `routes/rentalApplications.ts` — attachment download direct Prisma (MEDIUM) ✅ Resolved 2026-03-10

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Lines:** L593–660
- **Description:** `GET /rental-attachments/:id/download` and `GET /rental-applications/:id/documents` call `prisma.rentalAttachment.*` directly with ad-hoc includes.
- **Fix:** Move to `rentalApplicationRepository.findAttachment()` and use canonical include.
- **Resolution:** Added `RENTAL_DOCUMENTS_INCLUDE`, `findAttachmentById()`, and `findApplicationDocuments()` to `rentalApplicationRepository.ts`. Also extracted `SELECTION_PIPELINE_INCLUDE` to deduplicate manager/owner selection queries. (`prisma-dto-hardening` slice)

### CQ-15 · `routes/invoices.ts` — job status branching in route (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/invoices.ts`
- **Lines:** L55–77
- **Description:** `POST /invoices/:id/complete` has branching business logic checking job status to decide between workflow vs direct service call.
- **Fix:** Move completion-check branching into the workflow or a dedicated `updateJobWorkflow`.
- **Resolution:** Created `updateJobWorkflow.ts` with completion branching logic. Route now delegates to single workflow call.

### CQ-16–35 · Additional low-severity findings ✅ Resolved 2026-03-31

- Multiple route files contain direct `prisma.*` calls for simple existence checks (e.g., verify building exists, verify unit exists, check user role) before delegating to services. These are **low severity** — 16 instances across `leases.ts`, `financials.ts`, `inventory.ts`, `notifications.ts`, and `rentEstimation.ts`.
- **Fix:** Move existence checks into the respective service or repository layer.
- **Resolution:** Actual violations were 5 instances across 2 files (inventory.ts: 4, leases.ts: 1). Added `findOrgOwnersWithBilling`, `findUserByOrgAndEmail`, `createOwnerUser`, `findOrgOwnerById` to `inventoryRepository.ts`. Lease route uses `findLeaseRaw` from `leaseRepository`. `financials.ts`, `notifications.ts`, `rentEstimation.ts` were already clean.

**Note on stubs:** Email and signature services contain intentional MVP stubs (mark SENT/SIGNED without real providers) that read/write real DB records. No true fake-data stubs were found.

---

## Area 2 — Schema & Data Integrity

### SI-1 · Inventory missing org scope resolver (HIGH) ✅ Resolved 2026-03-16

- **File:** `apps/api/src/governance/orgScope.ts`
- **Model:** `Appliance` / `Asset`
- **Description:** F2 explicitly requires org scope resolvers for Request, Job, Invoice, Lease, and Inventory. Resolvers exist for the first four but not for Appliance or Asset. Both models have direct `orgId` columns, so a resolver would be trivial.
- **Fix:** Add `resolveApplianceOrg()` / `resolveAssetOrg()` to `orgScope.ts`.
- **Resolution:** Added `resolveApplianceOrg()` and `resolveAssetOrg()` following the existing direct-orgId pattern (identical to `resolveJobOrg`). 8 new unit tests in `orgIsolation.test.ts` (resolver happy/not-found + 4 cross-org matrix scenarios). (`pre-rfp-scope-and-auth-hardening` slice)

### SI-2 · SCHEMA_REFERENCE.md claims orgId on LegalSource (MEDIUM) ✅ Resolved 2026-03-10

- **File:** `SCHEMA_REFERENCE.md`
- **Model:** `LegalSource`
- **Description:** Docs say LegalSource has `orgId`, but the actual schema has no `orgId` — it's jurisdiction-scoped with no Org relation.
- **Fix:** Update SCHEMA_REFERENCE.md to remove orgId from LegalSource entry.
- **Status: ✅ Resolved 2026-03-10**

### SI-3 · SCHEMA_REFERENCE.md claims orgId on LegalVariable (MEDIUM) ✅ Resolved 2026-03-10

- **File:** `SCHEMA_REFERENCE.md`
- **Model:** `LegalVariable`
- **Description:** Docs say LegalVariable has `orgId`. Actual schema uses `jurisdiction` + `canton` scoping only.
- **Fix:** Update SCHEMA_REFERENCE.md to match actual schema.
- **Status: ✅ Resolved 2026-03-10**

### SI-4 · SCHEMA_REFERENCE.md claims orgId on LegalRule (MEDIUM) ✅ Resolved 2026-03-10

- **File:** `SCHEMA_REFERENCE.md`
- **Model:** `LegalRule`
- **Description:** Docs say LegalRule has `orgId`. Actual unique key is global (`@@unique([key])`).
- **Fix:** Update SCHEMA_REFERENCE.md.
- **Status: ✅ Resolved 2026-03-10**

### SI-5 · InvoiceStatus enum doc drift (MEDIUM)

- **File:** `SCHEMA_REFERENCE.md`
- **Enum:** `InvoiceStatus`
- **Description:** Docs list: DRAFT, APPROVED, PAID, DISPUTED. Schema has 5 values: DRAFT, APPROVED, PAID, DISPUTED, **ISSUED**. The ISSUED status is missing from docs but is actively used in `issueInvoiceWorkflow`.
- **Fix:** Add ISSUED to the InvoiceStatus listing in docs.
- **Status: ✅ Resolved 2026-03-10**

### SI-6 · RentalApplicationStatus enum doc drift (MEDIUM)

- **File:** `SCHEMA_REFERENCE.md`
- **Enum:** `RentalApplicationStatus`
- **Description:** Docs list: DRAFT, SUBMITTED, UNDER_REVIEW, CLOSED. Schema only has: **DRAFT, SUBMITTED**. `UNDER_REVIEW` and `CLOSED` do not exist in the schema.
- **Fix:** Remove phantom values from docs.
- **Status: ✅ Resolved 2026-03-10**

### SI-7 · RentalApplicationUnitStatus enum doc drift (MEDIUM)

- **File:** `SCHEMA_REFERENCE.md`
- **Enum:** `RentalApplicationUnitStatus`
- **Description:** Docs have phantom `WITHDRAWN`; schema has 3 extra real values: AWAITING_SIGNATURE, SIGNED, VOIDED.
- **Fix:** Sync docs with actual schema values.
- **Status: ✅ Resolved 2026-03-10**

### SI-8 · EmailTemplate enum doc drift (MEDIUM)

- **File:** `SCHEMA_REFERENCE.md`
- **Enum:** `EmailTemplate`
- **Description:** Docs list: LEASE_READY_TO_SIGN, APPLICATION_RECEIVED, APPLICATION_REJECTED, SELECTION_TIMEOUT_WARNING. Schema has completely different set: MISSING_DOCS, REJECTED, SELECTED_LEASE_LINK, MANAGER_TENANT_SELECTED.
- **Fix:** Rewrite the EmailTemplate enum listing.
- **Status: ✅ Resolved 2026-03-10**

### SI-9 · Request.orgId migration still pending (LOW)

- **Model:** `Request`
- **Description:** The 7-step migration path for adding orgId to Request is still pending — no migration file exists. Documented as "NOT before [multi-org]". Current FK-chain resolver is the active workaround.
- **Fix:** No action until multi-org feature lands. Status: correctly deferred.

### SI-10 · RentalOwnerSelectionStatus enum doc drift (LOW)

- **File:** `SCHEMA_REFERENCE.md`
- **Description:** Docs list EXPIRED; schema has VOIDED instead.
- **Fix:** Replace EXPIRED with VOIDED in docs.
- **Status: ✅ Resolved 2026-03-10**

### SI-11 · EmailOutboxStatus enum doc drift (LOW)

- **File:** `SCHEMA_REFERENCE.md`
- **Description:** Docs say QUEUED; schema says PENDING.
- **Fix:** Replace QUEUED with PENDING in docs.
- **Status: ✅ Resolved 2026-03-10**

### SI-12 · Schema gotchas and enum integrity verified (INFO)

- All 4 documented gotchas (Request no orgId, Job no description, Appliance no category, Job.contractorId required) remain accurate.
- All enum values in `transitions.ts` match `schema.prisma` exactly — no drift.
- All DEFAULT_ORG_ID usages (20 matches) are within permitted locations (authz.ts, orgConfig.ts, test files). No F7 violations.

---

## Area 3 — Test Coverage Gaps

### TC-1 · Untested workflows (HIGH) ⚠️ Partially Resolved 2026-03-31

- **Workflows currently untested:** `activateLeaseWorkflow`, `terminateLeaseWorkflow`, `submitRentalApplicationWorkflow`, `issueInvoiceWorkflow`, `unassignContractorWorkflow`, `ownerRejectWorkflow`
- **Description:** 6 of 23 workflows have no direct test coverage. Tested workflows (17): `createRequestWorkflow`, `approveRequestWorkflow`, `assignContractorWorkflow`, `completeJobWorkflow`, `evaluateLegalRoutingWorkflow`, `approveInvoiceWorkflow`, `payInvoiceWorkflow`, `disputeInvoiceWorkflow`, `markLeaseReadyWorkflow`, `tenantSelfPayWorkflow`, `uploadMaintenanceAttachmentWorkflow`, `submitQuoteWorkflow`, `rfpReinviteWorkflow`, `rfpDirectAssignWorkflow`, `schedulingWorkflow`, `awardQuoteWorkflow`, `completionRatingWorkflow`.
- **Fix:** Add workflow test cases for the 6 remaining untested workflows, prioritising `issueInvoiceWorkflow` (used by the ledger backfill path) and `terminateLeaseWorkflow`.
- **Updated 2026-03-31:** Workflow count now 23. `markLeaseReadyWorkflow` covered by `leases.test.ts`. `approveInvoiceWorkflow`, `payInvoiceWorkflow`, `disputeInvoiceWorkflow` covered by `invoiceWorkflows.test.ts`. RFP/scheduling/completion workflows covered by their respective test suites. `createNotificationWorkflow` and `markNotificationReadWorkflow` removed from codebase (not present in workflows/).
- **Resolution (partial):** Created `workflowCoverage.test.ts` with tests for 5 of 6 workflows: `activateLeaseWorkflow`, `terminateLeaseWorkflow`, `issueInvoiceWorkflow`, `unassignContractorWorkflow`, `ownerRejectWorkflow`. Remaining: `submitRentalApplicationWorkflow` (complex transactional workflow requiring multi-step setup).

### TC-2 · `routes/config.ts` has zero test coverage (HIGH) ✅ Resolved 2026-03-31

- **Description:** The config route (org config, building config, auto-approve-limit CRUD) has no dedicated test file. Only indirectly touched by tests that import the service.
- **Fix:** Add `config.test.ts` covering GET/PATCH org config, GET/PATCH building config.
- **Resolution:** Created `config.test.ts` with HTTP integration tests covering GET/PUT org-config, GET/PUT building config, GET/PUT/DELETE unit config, and 401 without token.

### TC-3 · `GET /leases/:id` contract test missing (HIGH) ✅ Resolved 2026-03-31

- **Description:** G10 requires a contract test for `GET /leases/:id`. Only `GET /leases` (list) exists. The single-resource detail endpoint is not tested.
- **Fix:** Add a `GET /leases/:id` describe block asserting the full DTO shape including nested relations.
- **Resolution:** Created `leaseContract.test.ts` with full DTO shape assertions including nested unit (unitNumber), building (name), expense items array, plus 404 and 401 tests.

### TC-4 · ✅ `--runInBand` not configured; 16+ servers in parallel (HIGH)

- **File:** `apps/api/jest.config.js`
- **Description:** 14+ test files spawn child-process servers in parallel (no `maxWorkers` or `runInBand`). This is the documented root cause of 11–154 timeout failures.
- **Fix:** Add `--runInBand` for integration suites or split into two Jest projects (pure parallel + integration serial).
- **Status: ✅ Resolved 2026-03-10**

### TC-5 · ✅ Port 3206 used by 3 test files (HIGH)

- **Files:** `rentalContracts.test.ts`, `rentalIntegration.test.ts`, `ownerDirect.foundation.test.ts`
- **Description:** All three use port 3206 in parallel, causing `EADDRINUSE` crashes.
- **Fix:** Assign unique ports or use dynamic port allocation (`:0`).
- **Status: ✅ Resolved 2026-03-10**

### TC-6 · No cross-org access test at HTTP auth gate level (HIGH) ✅ Resolved 2026-03-16

- **File:** `apps/api/src/__tests__/auth.manager-gates.test.ts`
- **Description:** Both manager and contractor tokens use `default-org`. No test verifies that a token with `org-B` cannot read `org-A` data at the HTTP level. Cross-org isolation is tested at the service layer in `ownerDirect.governance.test.ts`, but not at the route/auth level.
- **Fix:** Add test: create MANAGER token with `org-B`, attempt to read `org-A` data, expect 403 or empty results.
- **Resolution:** Added 5 HTTP-level cross-org tests in `auth.manager-gates.test.ts`: org-B token gets empty lists for `/contractors`, `/requests`, `/buildings`; org-A token sees its own data; org-B token cannot see contractor created by org-A. All tests use a real server with `AUTH_OPTIONAL=false`. (`pre-rfp-scope-and-auth-hardening` slice)

### TC-7 · `routes/helpers.ts` has zero test coverage (MEDIUM) ✅ Resolved 2026-03-31

- **Description:** Helper routes (URL parsing utilities, query coercion) have no direct test.
- **Fix:** Add `helpers.test.ts` with unit tests for `parseUrl()` edge cases.
- **Resolution:** Created `helpers.test.ts` with pure unit tests for `requireOrgViewer`, `requireOwnerAccess`, `requireGovernanceAccess`, `safeSendError` using mock req/res objects.

### TC-8 · `GET /requests` contract test missing nested assertions (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/__tests__/contracts.test.ts`
- **Description:** Only checks top-level keys (`id`, `status`, `description`, `createdAt`). Does not assert nested `unit`, `tenant`, `building` relations.
- **Fix:** Add nested relation assertions.
- **Resolution:** Added nested assertions for `unit` (id, unitNumber), `tenant` (id, name), `building` (id, name), `assignedContractor` (id, name) in `contracts.test.ts`.

### TC-9 · `completeJobWorkflow` test is shallow (MEDIUM) ✅ Resolved 2026-03-31

- **Description:** The test only calls `GET /jobs` and verifies list returns. Never PATCHes a job to COMPLETED to exercise the completion → invoice auto-creation pipeline.
- **Fix:** Create a job, PATCH to COMPLETED, verify invoice auto-creation.
- **Resolution:** Deepened `workflows.test.ts` to PATCH a job through IN_PROGRESS → COMPLETED, then verify invoice auto-creation via `GET /invoices?jobId=`, plus 409 double-completion guard.

### TC-10 · No unit test for auth token decode/verify (MEDIUM) ✅ Resolved 2026-03-31

- **File:** Missing `auth.unit.test.ts`
- **Description:** `decodeToken`, `verifyToken`, token-expiry handling, malformed-token parsing are not directly unit-tested.
- **Fix:** Add pure unit test for `services/auth.ts`.
- **Resolution:** Created `auth.unit.test.ts` with pure unit tests for `encodeToken`/`decodeToken` round-trip, JWT field assertions, garbage/empty/wrong-secret/expired/truncated token handling, all 4 roles, `extractToken` Bearer extraction and edge cases.

### TC-11 · `startServer` copy-pasted in 14 test files (MEDIUM) ✅ Resolved 2026-03-31

- **Description:** Each integration test has its own inline `startServer` implementation. Fragile — any startup change must be replicated everywhere.
- **Fix:** Extract shared `startServer` into `testHelpers.ts` and import.
- **Resolution:** All 28 server-spawning test files now import `startTestServer`/`stopTestServer` from `testHelpers.ts`. Zero inline `startServer` definitions remain.

### TC-12 · Only CONTRACTOR role tested as "wrong role" (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/__tests__/auth.manager-gates.test.ts`
- **Description:** TENANT and OWNER tokens are not tested against manager-gated routes.
- **Fix:** Add test cases for TENANT and OWNER tokens hitting manager routes, asserting 403.
- **Resolution:** Added TENANT token rejection tests in `auth.manager-gates.test.ts` covering POST /contractors, /leases, /buildings — all assert 401/403.

### TC-13 · No malformed/expired token test (MEDIUM) ✅ Resolved 2026-03-31

- **Description:** No test covers garbage `Authorization` header, expired JWT, or token signed with wrong secret.
- **Fix:** Add test cases with malformed tokens.
- **Resolution:** Added malformed/expired/wrong-secret/empty token tests to `auth.manager-gates.test.ts` — all return 401.

### TC-14 · `ownerDirect.foundation.test.ts` uses PID-based port (MEDIUM) ✅ Resolved 2026-03-31

- **Description:** Dynamic port offset via `3202 + (pid % 1000)` is unreliable and can collide with other hardcoded ports.
- **Fix:** Use `:0` and extract actual port from stdout.
- **Resolution:** File now uses static `const PORT = 3203` and imports `startTestServer`/`stopTestServer` from `testHelpers.ts`.

### TC-15 · Building config only indirectly tested (LOW) ✅ Resolved 2026-03-31

- **Description:** Building config CRUD is exercised indirectly through integration tests but has no dedicated assertion coverage.
- **Fix:** Add dedicated building config assertions.
- **Resolution:** Dedicated building config GET/PUT tests added in `config.test.ts` (part of TC-2 resolution).

---

## Area 4 — Security & Auth

### SA-1 · ✅ `getOrgIdForRequest()` falls back to DEFAULT_ORG_ID (CRITICAL)

- **File:** `apps/api/src/authz.ts`
- **Function:** `getOrgIdForRequest()`
- **Description:** When no user is authenticated and no `DEV_ORG_ID` env var is set, every unauthenticated request is silently assigned to `DEFAULT_ORG_ID`. Called in `server.ts` for EVERY incoming request. In multi-org: public routes would create data under the wrong org; unauthenticated requests would read/write default org data.
- **Fix:** In production, if no user is authenticated and the route isn't explicitly public, return 401 instead of defaulting.
- **Status: ✅ Resolved 2026-03-10**

### SA-2 · ✅ All tenant-portal routes are IDOR-vulnerable (HIGH)

- **File:** `apps/api/src/routes/tenants.ts`
- **Routes:** All `/tenant-portal/*` endpoints
- **Description:** All tenant-portal endpoints rely solely on a `tenantId` query parameter with no authentication. Anyone who knows or guesses a tenant ID can read their leases, notifications, invoices, and mark notifications as read/deleted.
- **Fix:** Require tenant authentication (JWT with tenant role), or session token from `createTenantSession`.
- **Status: ✅ Resolved 2026-03-10**

### SA-3 · ✅ Rental attachment download unprotected — PII exposure (HIGH)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Route:** `GET /rental-attachments/:attachmentId/download`
- **Description:** Downloads rental attachment files (identity documents, pay stubs) with no auth check. Anyone who knows or brute-forces an attachment UUID can download sensitive PII.
- **Fix:** Add `maybeRequireManager()` or role-based access.
- **Status: ✅ Resolved 2026-03-10**

### SA-4 · ✅ Rental application documents listing unprotected (HIGH)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Route:** `GET /rental-applications/:id/documents`
- **Description:** Lists applicant names, emails, and attachment metadata with no authentication.
- **Fix:** Add `maybeRequireManager()` or role-based access.
- **Status: ✅ Resolved 2026-03-10**

### SA-5 · ✅ Email outbox routes exposed without auth or prod guard (HIGH)

- **File:** `apps/api/src/routes/notifications.ts`
- **Routes:** `GET /email-outbox`, `POST /email-outbox/:id/send`
- **Description:** Exposes email outbox contents (recipient addresses, subjects, bodies) with no auth AND no production guard. Accessible in production.
- **Fix:** Add production guard and require auth.
- **Status: ✅ Resolved 2026-03-10**

### SA-6 · ✅ `DEV_IDENTITY_ENABLED` has no production guard (HIGH)

- **File:** `apps/api/src/authz.ts`
- **Description:** When `DEV_IDENTITY_ENABLED=true`, any request can spoof any role via `x-dev-role`, `x-dev-org-id`, `x-dev-user-id` headers. The boot guard in `server.ts` checks `AUTH_OPTIONAL` and `AUTH_SECRET` but does NOT check `DEV_IDENTITY_ENABLED`. If accidentally set in production, any request can impersonate any user.
- **Fix:** Add `DEV_IDENTITY_ENABLED` to the production boot guard.
- **Status: ✅ Resolved 2026-03-10**

### SA-7 · ✅ Contractor request events POST has no auth (HIGH)

- **File:** `apps/api/src/routes/requests.ts`
- **Route:** `POST /requests/:id/events`
- **Description:** Any unauthenticated user can create events on any request by providing a request ID.
- **Fix:** Wrap with `requireRole()` for CONTRACTOR or MANAGER.
- **Status: ✅ Resolved 2026-03-10**

### SA-8 · ✅ Contractor-assigned requests have no auth (HIGH)

- **File:** `apps/api/src/routes/requests.ts`
- **Route:** `GET /requests/contractor/:contractorId`
- **Description:** Returns all requests assigned to a contractor with no authentication. Anyone who knows a contractor ID can view their requests.
- **Fix:** Add `requireRole()` for CONTRACTOR.
- **Status: ✅ Resolved 2026-03-10**

### SA-9 · ✅ Dev identity header allows org spoofing (HIGH)

- **File:** `apps/api/src/authz.ts`
- **Description:** When `DEV_IDENTITY_ENABLED=true`, the `x-dev-org-id` header overrides org context. Combined with the missing production guard (SA-6), this allows accessing any org's data.
- **Fix:** Add production guard for `DEV_IDENTITY_ENABLED`.
- **Status: ✅ Resolved 2026-03-10**

### SA-10 · ✅ `maybeRequireManager` allows MANAGER + OWNER on writes (MEDIUM)

- **File:** `apps/api/src/authz.ts`
- **Function:** `maybeRequireManager()`
- **Description:** Used in lease writes, invoice creation, legal admin CRUD, and financial mutations. Permits OWNER role for operations that should be MANAGER-only.
- **Fix:** Use `requireRole('MANAGER')` for mutation routes; reserve `maybeRequireManager` for reads.
- **Status: ✅ Resolved 2026-03-10** — Replaced `maybeRequireManager` with `requireRole(req, res, 'MANAGER')` on all mutation routes in inventory.ts (×19), requests.ts (×3), tenants.ts (×6), notifications.ts (×3), rentEstimation.ts (×3), financials.ts (×1). `requireRole` includes AUTH_OPTIONAL dev bypass with warning log.

### SA-11 · ✅ Legal routes lack org scoping (MEDIUM)

- **File:** `apps/api/src/routes/legal.ts`
- **Routes:** Legal rules, variables, depreciation standards, category mapping CRUD
- **Description:** Prisma queries do not filter by `orgId`. In multi-org, all orgs would see/modify each other's legal data. Category mapping PATCH/DELETE find by ID only.
- **Fix:** Add org-scoping to queries, or document as intentionally global.
- **Status: ✅ Resolved 2026-03-10** — Global models (LegalSource, LegalVariable, LegalRule, DepreciationStandard) documented as jurisdiction-scoped by design. PUT/DELETE category-mappings now validate `existing.orgId` matches caller's orgId.

### SA-12 · ✅ `POST /requests` conditionally authed (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Description:** Auth is conditional: if `contractorId` query param is present, `maybeRequireManager` is checked. Otherwise, `getAuthUser` is used without enforcement. If `AUTH_OPTIONAL=false` is off, anyone can create requests.
- **Fix:** Add an upfront auth wrapper.
- **Status: ✅ Resolved 2026-03-10** — Added `requireAuth(req, res)` as first check in POST /requests and POST /work-requests handlers.

### SA-13 · ✅ Contractor suggest and match endpoints no auth (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Routes:** `GET /requests/:id/suggest-contractor`, `GET /requests/:id/match-contractors`
- **Description:** Returns contractor data without authentication. Has org scope check but no authentication.
- **Fix:** Add `maybeRequireManager()`.
- **Status: ✅ Resolved 2026-03-10** — Added `maybeRequireManager(req, res)` guard to both endpoints.

### SA-14 · ✅ `DELETE /requests` no auth (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Route:** `DELETE /requests`
- **Description:** Deletes all requests. Has production guard but no auth check. In dev/staging, anyone can delete all data.
- **Fix:** Add auth or IP whitelist.
- **Status: ✅ Resolved 2026-03-10** — Added `requireRole(req, res, 'MANAGER')` after production guard in DELETE /__dev/requests.

### SA-15 · ✅ `POST /document-scan` no auth (MEDIUM)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Route:** `POST /document-scan`
- **Description:** OCR endpoint processing uploaded files with no auth. Could be abused for resource exhaustion.
- **Fix:** Add rate limiting and/or auth.
- **Status: ✅ Resolved 2026-03-10** — Added `maybeRequireManager(req, res)` guard to POST /document-scan in rentalApplications.ts (actual file location, not inventory.ts).

### SA-16 · ✅ Governance routes missing wrapper (MEDIUM)

- **File:** `apps/api/src/routes/financials.ts`
- **Routes:** `GET /governance/*`
- **Description:** Uses `maybeRequireManager` internally but not wrapped with `withAuthRequired`. If `AUTH_OPTIONAL=true`, governance access is bypassed.
- **Fix:** Wrap with `withAuthRequired`.
- **Status: ✅ Resolved 2026-03-10** — Added `requireAuth(req, res)` as first statement in all financial handlers. POST /invoices/:id/set-expense-category additionally requires MANAGER role.

### SA-17 · ✅ `maybeRequireManager` bypasses role check on AUTH_OPTIONAL (MEDIUM)

- **File:** `apps/api/src/authz.ts`
- **Function:** `maybeRequireManager()`
- **Description:** When `isAuthOptional()` returns true and no user token is provided, allows the request through without any role check. An OWNER-only endpoint could be reached by anyone in dev.
- **Fix:** Consider requiring dev identity header when AUTH_OPTIONAL so role checks still fire.
- **Status: ✅ Resolved 2026-03-10** — `maybeRequireManager` now logs `console.warn` when AUTH_OPTIONAL bypasses without a dev-role header. `requireRole`/`requireAnyRole` also log warnings on dev bypass.

### SA-18 · ✅ `POST /triage` no auth (MEDIUM)

- **File:** `apps/api/src/routes/auth.ts`
- **Route:** `POST /triage`
- **Description:** Triage endpoint is fully public, could be abused for resource consumption.
- **Fix:** Add rate limiting or basic auth.
- **Status: ✅ Resolved 2026-03-10** — Added in-memory IP-based rate limiter: 10 requests/minute/IP, returns 429 on exceed. Map auto-resets per window.

### SA-19 · ✅ Weak default JWT secret (LOW)

- **File:** `apps/api/src/services/auth.ts`
- **Description:** Fallback secret `"dev-secret-key-change-in-prod"` used when `AUTH_SECRET` not set. Production guard prevents this in prod, but staging environments may use it.
- **Fix:** Require `AUTH_SECRET` in all non-test environments.
- **Status: ✅ Resolved 2026-03-10** — Non-test environments now fail hard with `process.exit(1)` if `AUTH_SECRET` is unset. Test environments keep fallback for convenience.

### SA-20 · ✅ Event logger outputs payload (LOW)

- **File:** `apps/api/src/events/`
- **Description:** `console.log` outputs event payloads which may contain business-sensitive data. Not directly tokens/passwords, but could leak business data in container logs.
- **Fix:** Redact sensitive fields from log output.
- **Status: ✅ Resolved 2026-03-10** — Added `redactPayload()` function (redacts token, password, secret, email, tenantId, iban, accountNumber). Applied to `logEvent()` console.log in helpers.ts.

---

## Recommended Priority Order

> **Previous top 5 all resolved (2026-03-10):** SA-1 (DEFAULT_ORG_ID fallback), SA-6+SA-9 (DEV_IDENTITY_ENABLED guard), SA-2 (tenant-portal IDOR), SA-3+SA-4 (PII exposure), TC-4+TC-5 (test infrastructure). All 20 security findings now closed.

### 1. ~~CQ-1 + CQ-5 + CQ-6 · `routes/legal.ts` layer violation~~ ✅ Resolved 2026-03-22

All 26 direct `prisma.*` calls extracted to `services/legalService.ts`.

### 2. TC-1 · 6 of 23 workflows untested (HIGH) — updated 2026-03-31

`issueInvoiceWorkflow`, `activateLeaseWorkflow`, `terminateLeaseWorkflow`, `submitRentalApplicationWorkflow`, `unassignContractorWorkflow`, `ownerRejectWorkflow` remain untested. Invoice lifecycle now well-covered; lease teardown and submission workflows are the priority gap. **Fix:** Add HTTP-level tests for `terminateLeaseWorkflow` and `issueInvoiceWorkflow` first.

### 3. TC-16 · No integration tests for capture session routes (HIGH) — new 2026-03-31

See TC-16 in the new findings section.

### 4. CQ-3 + CQ-4 · Business logic in routes/tenants.ts and routes/leases.ts (HIGH)

Payment history 3-query chain in tenants.ts, notification orchestration in leases.ts — both belong in services/workflows. **Fix:** Extract to `tenantService.getPaymentHistory()` and move notification into `markLeaseReadyWorkflow`.

### 4. ~~TC-6 · No cross-org HTTP auth test~~ ✅ Resolved 2026-03-16

5 HTTP-level cross-org tests added in `auth.manager-gates.test.ts` proving org-B tokens get empty results on org-A endpoints.

### 5. ~~SI-1 · Inventory missing org scope resolver~~ ✅ Resolved 2026-03-16

`resolveApplianceOrg()` and `resolveAssetOrg()` added to `orgScope.ts` with 8 unit tests.

---

## Post-Audit Developments (2026-03-10 → 2026-03-15)

Significant work completed since the original audit was generated. This section documents changes that affect audit scope or introduce new architectural context.

### Completed Epics

| Epic | Date | Impact on Audit |
|------|------|-----------------|
| Security Hardening Slices 1 & 2 | 2026-03-10 | All 20 SA findings resolved. Production boot guards, role enforcement on mutations, org scoping, rate limiting, JWT hardening, event log redaction. |
| Prisma DTO Hardening Final | 2026-03-10 | CQ-7, CQ-12, CQ-13, CQ-14 resolved. 18 canonical include constants, compile-time DTO constraints, `includeIntegrity.test.ts` drift detection. |
| Triage Rework (Slices 1–3) | 2026-03-11 | CQ-10 resolved. `ownerRejectWorkflow` created, OWNER_REJECTED status + PENDING_OWNER_APPROVAL transitions, `ApprovalSource` tracking. Legal engine hardened: LegalRuleScope enum, confidence gating, UNKNOWN/DISCRETIONARY → ROUTE_TO_OWNER. |
| Legal Engine Remediation | 2026-03-11 | 93 corrupt rules cleaned, DSL evaluator rewritten (`topic_match`, `always_true`, `AND`/`OR`), `RENT_REDUCTION` rule type added. 5 active MAINTENANCE_OBLIGATION rules, 37 active category mappings. |
| Navigation & UI Consistency | 2026-03-14 | 14 slices: sidebar flattened, 7 hub pages with URL tab persistence, Tailwind unified (managerStyles.js deleted), all list endpoints return `{ data, total }`, 26 tables migrated to inline-table class, Panel wrapper on all manager pages. |
| Frontend Canonical Tables | 2026-03-14 | Shared `SortableHeader`, `PaginationControls`, `tableUtils` components (F-UI5 guardrail). 7 pages migrated to shared table infrastructure. |
| Frontend Rationalization | 2026-03-10 | Full page inventory (195 pages), 12 empty states standardized, 119/119 proxy conformance. |
| Frontend Debt Cleanup | 2026-03-10 | 52/67 frontend findings resolved. |
| Test Harness Hardening | 2026-03-30 | Schema drift (missing migration for `Request.urgency` + `BillingEntity.userId`) resolved. 735/735 → 738/738 tests green. |
| API Proxy Parity | 2026-03-30 | 7 unspecced routes documented in openapi.yaml; `KNOWN_UNSPECCED_ROUTES` cleared; `contractors.js` migrated to `proxyToBackend` (163/163 conforming); 3 contract tests added; api-client extended. CQ-1 resolved. |
| INV-HUB (Capture Sessions + Invoice Ingestion) | 2026-03-28/29 | QR-code capture session flow (5 routes, `captureSessionRepository.ts` as 18th repository), `POST /invoices/ingest` (MANAGER-only), `invoiceIngestionService.ts`, `documentScanner` improvements. Introduced CQ-36, CQ-37, TC-16, TC-17, SA-21, SA-22. |
| Migration Integrity Recovery | 2026-03-31 | G8 shadow-DB exception retired. 5 gap-filling migrations created, 1 drift-backfill migration, duplicate-timestamp ordering fix, `setval(0)` bug fixed. Shadow DB replay clean ("Already in sync"). CQ-11 marked resolved. |

### New Guardrails Established

- **F-UI1–F-UI6:** Frontend UI guardrails codified in PROJECT_STATE.md — CSS variable tokens, `@layer components`, Tailwind-only styling, shared table components, panel wrapper pattern, URL tab persistence.
- **H1–H6:** Hardening guidelines for route protection, query scoping, error responses, input validation, sensitive data, transition enforcement.

### Stats Delta

| Metric | At Audit (2026-03-10) | Current (2026-03-31) |
|--------|----------------------|---------------------|
| Models | 45 | 54 |
| Enums | 35 | 47 |
| Migrations | 32 | 60 |
| Workflows | 14 | 24 |
| Repositories | 8 | 17 |
| Tests | ~312 | 980 |
| Suites | ~28 | 65 |
| API routes | ~120 | 247 |
| Frontend pages | 185 | 288 |
| Backend LOC | ~34k | ~73k |
| Frontend LOC | ~20k | ~45k |
| Audit resolved | 20 | 91 |
| Audit open | 62 | 1 (TC-1 ⚠️ partial — `submitRentalApplicationWorkflow` untested) |

### In Progress: RFP Epic

`docs/rfp-epic.md` defines 7 slices for the maintenance-request-to-RFP flow. **Slice 1 (`rfp-manager-view`) completed 2026-03-17**: `rfpRepository.ts` created (11th repository), Rfp→Request Prisma relation added, RFP DTOs enriched with request summary (number, description, category, attachment count), manager RFP list page upgraded from cards to table with real data, detail page created at `/manager/rfps/[id]`.

**Slice 2 (`contractor-rfp-marketplace`) completed 2026-03-17**: Contractor-facing RFP endpoints (`GET /contractor/rfps`, `GET /contractor/rfps/:id`), visibility rules (OPEN + category match OR invited), contractor-safe DTO (postal code only, no full address/tenant identity), list + detail pages, 12 integration tests covering auth gates, visibility logic, response stripping, and cross-org isolation.

---

## New Findings — 2026-03-31 Audit

Scope: code added in the 2026-03-28/29 session (INV-HUB: capture sessions, invoice ingestion) plus migration-integrity-recovery slice. All findings below are new and were not present in the original 82-finding audit.

### CQ-36 · `routes/ledger.ts` POST /backfill — direct Prisma calls in route (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/ledger.ts:135,156,161,176,181`
- **Description:** The `POST /ledger/backfill` handler contains 6 direct `prisma.*` calls (`prisma.invoice.findMany` ×3, `prisma.ledgerEntry.findMany` ×2) inline in the route handler, in addition to iterating over results and calling workflows. These queries belong in `ledgerService` or a dedicated `ledgerRepository`. Violates G9.
- **Fix:** Extract the draft/issued/paid invoice fetch loops into `ledgerService.getUnpostedInvoices()` (or similar). The handler should only call `seedSwissTaxonomy`, `ledgerService.*`, and `issueInvoiceWorkflow`.
- **Resolution:** Added `getDraftInvoiceIds()`, `getUnpostedIssuedInvoiceIds()`, `getUnpostedPaidInvoiceIds()` to `ledgerService.ts`. Route handler now delegates all Prisma queries to service functions.

### CQ-37 · `routes/captureSessions.ts` POST /:token/complete — ingestion orchestration in route (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/captureSessions.ts:134–182`
- **Description:** The `POST /capture-sessions/:token/complete` handler validates the session token, calls `completeSession()`, then iterates over uploaded file URLs, fetches each file from storage, determines MIME type, and calls `ingestInvoice()` — all inline in the route. This multi-step orchestration (complete → fetch files → ingest each) belongs in a workflow or service (e.g., `captureSessionCompletionService` or a `completeCaptureSessionWorkflow`).
- **Fix:** Extract the post-completion ingestion loop into `captureSessionService.completeAndIngest()` or a dedicated workflow. The route handler should call one function and return.
- **Resolution:** Added `completeAndIngest()` to `captureSessionService.ts`. Route handler now makes a single service call.

---

### SI-13 · SCHEMA_REFERENCE.md missing `CaptureSession` and `LedgerEntry` models (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `SCHEMA_REFERENCE.md`
- **Description:** SCHEMA_REFERENCE.md claimed 54 models but listed only 52. The two models added in the INV-HUB (2026-03-28) and FIN-COA epics — `CaptureSession` and `LedgerEntry` — were absent.
- **Resolution:** Both model rows added to the Models table in this session. `Invoice` row updated with ingestion fields (direction, sourceChannel, ingestionStatus, ocrConfidence, rawOcrText, sourceFileUrl).

### SI-14 · SCHEMA_REFERENCE.md missing 6 enums (LOW) ✅ Resolved 2026-03-31

- **File:** `SCHEMA_REFERENCE.md`
- **Enums absent:** `CaptureSessionStatus`, `InvoiceDirection`, `InvoiceSourceChannel`, `IngestionStatus`, `RfpQuoteStatus`, `RequestUrgency`
- **Description:** The Key Enums section claimed 47 total but documented only 41.
- **Resolution:** All 6 enums added to SCHEMA_REFERENCE.md Key Enums section.

---

### TC-16 · No integration tests for capture session routes (HIGH) ✅ Resolved 2026-03-31

- **Files:** No test file exists for `/capture-sessions` endpoints
- **Description:** The capture session routes added in the 2026-03-28/29 session (`POST /capture-sessions`, `GET /capture-sessions/:id`, `GET /capture-sessions/validate/:token`, `POST /capture-sessions/:token/upload`, `POST /capture-sessions/:token/complete`) have zero HTTP-level integration test coverage. The MANAGER-only auth gate on POST/GET is untested, and the public token-validation/upload/complete flow is untested.
- **Fix:** Add `captureSession.test.ts` on a new port (next: 3221). Cover: 401 without token on POST /capture-sessions; token-gated 410 on expired session; upload size limit; complete-and-ingest happy path.
- **Resolution:** Created `captureSession.test.ts` on port 3221 with auth gates (401 without token, 401/403 for CONTRACTOR/TENANT), full lifecycle (create → validate → upload → complete), 404 for non-existent session, 400 for garbage token, 410 for completed session.

### TC-17 · No integration test for `POST /invoices/ingest` (MEDIUM) ✅ Resolved 2026-03-31

- **File:** No test covers `POST /invoices/ingest`
- **Description:** The invoice ingestion endpoint added in the 2026-03-28/29 session has no HTTP-level test. Auth enforcement (MANAGER-only), file parsing, and the ingest → createInvoice pipeline are untested at the route level. `documentClassification.test.ts` and `documentExtraction.test.ts` cover lower-level OCR units but not the HTTP endpoint itself.
- **Resolution:** Created `invoiceIngest.test.ts` on port 3222 with auth gates (401 without token, 401/403 for CONTRACTOR/TENANT), 400 without multipart boundary, 400 without file field, and happy-path file upload.
- **Fix:** Add a test in `captureSession.test.ts` (or a dedicated `invoiceIngest.test.ts`) exercising POST /invoices/ingest with a minimal PDF fixture, asserting the 201 response shape and `ingestionStatus` field.

---

### SA-21 · No rate limiting on public capture session upload/complete endpoints (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/captureSessions.ts`
- **Routes:** `POST /capture-sessions/:token/upload`, `POST /capture-sessions/:token/complete`
- **Description:** Both endpoints are intentionally public (token-gated, no JWT). A valid session token can be used to upload up to 10 files (MAX_UPLOADS enforced per session) and trigger OCR/ingestion on each. There is no per-IP rate limit or per-token request throttle. A leaked or guessed token could be used to spam file storage and trigger repeated expensive OCR calls. Contrast with SA-18 (`POST /triage` has 10 req/min/IP rate limiting).
- **Fix:** Apply IP-based rate limiting to the upload endpoint (e.g., 20 requests/min/IP matching the triage pattern). Alternatively, enforce a per-session upload call limit at the HTTP layer before delegating to the service.
- **Resolution:** Added in-memory IP-based rate limiter (20 requests/minute/IP) applied to upload and complete endpoints.

### SA-22 · `GET /capture-sessions/:id` auth inconsistency: OWNER can access (LOW) ✅ Resolved 2026-03-31

- **File:** `apps/api/src/routes/captureSessions.ts:54–67`
- **Description:** `GET /capture-sessions/:id` uses `requireOrgViewer()` which permits both MANAGER and OWNER roles. The `POST /capture-sessions` (create) endpoint explicitly requires `requireAnyRole(["MANAGER"])`. Capture sessions are a tool created by managers to capture documents via mobile; there is no documented reason for OWNERs to poll session status. This inconsistency means an OWNER token can read capture session state even though only a MANAGER can create one.
- **Fix:** Replace `requireOrgViewer(req, res)` with `requireAnyRole(req, res, ["MANAGER"])` on the GET handler, matching the create endpoint. Low severity since both roles share the same org scope and OWNER access to session status is not a data leak, but it violates least-privilege.
- **Resolution:** Replaced `requireOrgViewer` with `requireAnyRole(["MANAGER"])` on GET handler.

---

## New Findings — 2026-03-31 External Audit Review

These findings were surfaced by an external audit review of PROJECT_STATE.md. Findings already present in the AUDIT.md findings above were discarded; only net-new observations are recorded here.

### SI-15 · `PROJECT_STATE.md` current-state sections have stale counts (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `PROJECT_STATE.md` — lines 7, 437, 439, 1287, 1293, 1301
- **Description:** The State Integrity section and companion-file pointer claim counts that do not match current reality. The "single source of truth" claim is undermined when that section's numbers are months out of date. Specific stale claims:
  - Line 7: companion file pointer says "models table (53), enums (42)" — actual: 54 / 47
  - Line 437: "complete models table (53 models), enums (42)" — stale
  - Line 439: "53 migrations. 53 models · 42 enums. Last verified: 2026-03-25" — actual: 60 / 54 / 47 (as of 2026-03-31)
  - Line 1287: State Integrity says "53 migrations; 53 models, 42 enums" — actual: 60 / 54 / 47
  - Line 1293: "735 tests, 49 suites" — actual: 738 tests (since test harness hardening 2026-03-30)
  - Line 1301: "16 repositories" — actual: 18 (captureSessionRepository + schedulingRepository added since)
- **Fix:** Update all current-state number references in the header pointer, schema summary, and State Integrity block. Historical narrative sections (epic stats at lines 697, 763, 800) are intentionally archival and need not be changed.
- **Resolution:** Fixed in this session — see SI-15 resolution edits below.

### SI-16 · G8 exception still documented as active in `PROJECT_STATE.md` (MEDIUM) ✅ Resolved 2026-03-31

- **File:** `PROJECT_STATE.md` — lines 128, 1121
- **Description:** The G8 guardrail section (line 128) still carries a `⚠️ Known Exception (Mar 6, 2026)` warning saying the shadow DB cannot replay the lease migration — the exact problem resolved by the migration-integrity-recovery slice on 2026-03-31. The backlog note at line 1121 says "Consider resolving the shadow DB exception (G8) to unblock `migrate dev` reliably" — also stale. `.github/copilot-instructions.md` was already updated but PROJECT_STATE.md was not.
- **Fix:** Retire the known exception from the G8 section; remove or date-stamp the backlog note at line 1121.
- **Resolution:** Fixed in this session.

### SI-17 · State Integrity "all endpoints return 200" is stale and over-broad (LOW) ✅ Resolved 2026-03-31

- **File:** `PROJECT_STATE.md:1289`
- **Description:** The State Integrity block contains "all endpoints return 200; legal auto-routing creates RFP... (verified 2026-03-07)". This claim is 3+ weeks stale (192 routes now exist vs ~120 at verification), and the phrasing is misleading — a correctly functioning system returns 401/403 on auth failures and 404 on missing records. The claim likely means "core smoke-test paths return 200" but reads as a universal assertion that cannot be sustained.
- **Fix:** Replace with a bounded statement: "Core smoke endpoints return expected status codes; auth-gated routes return 401/403 without valid token (verified by auth.manager-gates.test.ts)."
- **Resolution:** Replaced the stale claim in PROJECT_STATE.md with bounded statement referencing auth test coverage.

### DOC-1 · Auto-sync comment block in `PROJECT_STATE.md` contains impossible delta values (LOW) ✅ Resolved 2026-03-31

- **File:** `PROJECT_STATE.md` — lines 1162–1279
- **Description:** The auto-sync comment block (30+ `<!-- auto-sync ... -->` fragments) was generated by tooling and contains at least two impossible deltas that indicate a malformed sync: `models 3→45` (line 1186 — a jump from 3 to 45 models is not possible in one commit; should be `44→45`) and `migrations 5→49` (line 1264 — same class of error). These fragments add noise to human review, contain corrupted records that cannot be trusted for audit, and have not been updated since 2026-03-25 despite significant subsequent changes.
- **Fix:** Either regenerate the block with verified tooling, or quarantine it in a separate auto-generated appendix file (`docs/sync-log.md`) so it does not appear inline in the human-facing project-state document. Do not use the block for numerical claims without independent verification.
- **Resolution:** Block quarantined to `docs/sync-log.md` with explanatory header. PROJECT_STATE.md now contains a pointer comment only.

---

## Area 5 — Architecture Compliance (new 2026-05-06)

### ARCH-1 · Service layer direct Prisma access (362 calls, 54 files) (LOW)

- **File(s):** `apps/api/src/services/` (54 files)
- **Description:** 362 direct `prisma.*` calls exist in service files, bypassing the repository layer. Architecture rule: services MUST delegate to repositories. No direct Prisma client usage in `src/services/`. Heaviest offenders: `leases.ts` (31), `legalService.ts` (20), `ledgerService.ts` (16), `tenants.ts` (15), `rentalApplications.ts` (15), `invoices.ts` (15), `financials.ts` (15).
- **Impact:** Inline include trees, duplicated query logic, no canonical type safety from `GetPayload`, impossible to enforce include constants across callers.
- **Fix:** Migrate in 5 slices (DT-120 to DT-124) sorted by call-count ascending. Each slice routes service calls through existing or new repository functions with canonical `_INCLUDE` constants.
- **Status:** Partially resolved — DT-120 first slice complete 2026-05-30. 9 files de-Prisma'd: `tenantIdentity.ts`, `requestEventService.ts`, `unitConfig.ts`, `requestAssignment.ts`, `signatureRequests.ts`, `invoices.ts` (list query), `rentalSelectionService.ts`, `npvService.ts`, `cashflowPlanningService.ts`. 10 new repository functions added across 5 repos. Higher-call-count files (leases.ts, tenants.ts, ledgerService.ts, financials.ts) remain for DT-121–DT-124.

### ARCH-2 · Repository layer `any` type violations (22 instances, 8 files) (LOW)

- **File(s):** `apps/api/src/repositories/` (8 files)
- **Description:** 22 meaningful `: any` instances. By file: `invoiceRepository.ts` (1 — `where: any`), `leaseRepository.ts` (4 — `data: any`), `rentalApplicationRepository.ts` (3 — `data: any`), `rfpRepository.ts` (1 — `lineItems?: any`), `recommendationRepository.ts` (1 — `userDecision: any`), `rentAdjustmentRepository.ts` (1 — `calculationDetails?: any`), `strategyProfileRepository.ts` (9 — enum fields typed as any), `taxRuleRepository.ts` (2 — `citationsJson?: any`).
- **Impact:** Bypasses Prisma generated input type validation; silent type mismatches can corrupt persisted data without compile-time detection. Violates G2/G3 (typed DTO mappers).
- **Fix:** Replace with `Prisma.LeaseUpdateInput`, `Prisma.JsonValue`, enum literals from `@prisma/client`, etc. Self-contained one-session pass (no schema changes needed).
- **Status:** Resolved 2026-05-06 — DT-125 implemented. All 22 instances replaced with proper Prisma types (commit 91fc71a). tsc 0 errors, 67/67 suites, 1009/1009 tests.

---

## New Findings — 2026-05-30 Session-6 Code-Quality Sweep

All 7 findings below were identified and resolved within the same session. `tsc --noEmit` clean · 72/72 suites · 1068/1068 tests after all fixes.

### FE-1 · Sortable-table template missing SortableHeader (LOW) ✅ Resolved 2026-05-30

- **File:** `apps/web/pages/manager/_template_detail.js`
- **Description:** Canonical detail-page template had three plain `<th>` columns (Name, Status, Date) with no `SortableHeader` — violating the mandatory sortable-table protocol. Three read-only ledger/accounting display tables (`finance/ledger.js`, `finance/imports/[id].js`, `owner/finance.js`) also flagged; these are balance-sheet Actifs/Passifs read-only grids where sorting adds no UX value.
- **Fix:** Applied `SortableHeader` + `useLocalSort` + `clientSort` to the template. Granted `// sortable-audit-exempt` to the three read-only tables. Updated `scripts/audit-sortable-tables.js` to honour the exemption marker.
- **Resolution:** Template fixed; audit script updated; `node scripts/audit-sortable-tables.js` reports 0 violations.

### FE-2 · Inline `style={{ height: 600 }}` in admin-inventory buildings detail (LOW) ✅ Resolved 2026-05-30

- **File:** `apps/web/pages/admin-inventory/buildings/[id].js` line 1518
- **Description:** Single inline style attribute using a numeric pixel value — violates the "no `style={{}}` — use Tailwind" guardrail (F8).
- **Fix:** Replaced with `className="h-[600px]"`.

### CQ-NEW-1 · Direct `prisma.*` calls in `routes/inventory.ts` (LOW) ✅ Resolved 2026-05-30

- **File:** `apps/api/src/routes/inventory.ts`
- **Description:** Two `POST /seed-default-assets` handlers called `prisma.building.findFirst` and `prisma.unit.findFirst` directly in the route layer — bypassing the repository tier (G9).
- **Fix:** Replaced with `inventoryRepo.findBuildingByIdAndOrg()` and `inventoryRepo.findUnitByIdAndOrg()` (both already existed).

### CQ-NEW-2 · Direct `prisma.*` calls in `routes/tenantConversation.ts` (LOW) ✅ Resolved 2026-05-30

- **File:** `apps/api/src/routes/tenantConversation.ts`
- **Description:** Inline `resolveConversationTenantId` helper with 2 `prisma.tenant.*` calls defined inside the route file — layer violation.
- **Fix:** Moved function to `repositories/conversationRepository.ts`; route now imports it from there.

### CQ-NEW-3 · DT-120 first slice — service-layer Prisma bypass (LOW) ✅ Partial 2026-05-30

- **Files:** 9 service files (`tenantIdentity.ts`, `requestEventService.ts`, `unitConfig.ts`, `requestAssignment.ts`, `signatureRequests.ts`, `invoices.ts`, `rentalSelectionService.ts`, `npvService.ts`, `cashflowPlanningService.ts`)
- **Description:** First slice of ARCH-1 (DT-120 epic): lowest-call-count service files still contained direct `prisma.*` calls.
- **Fix:** All 9 files now call repository functions. 10 new repo functions added: `findTenantEmail` (tenantRepo), `findRequestExistsById` + `unassignRequestContractor` (requestRepo), `findUnitExistsByIdAndOrg` + `findUnitWithBuildingConfig` (inventoryRepo), `findInvoicesWithCount` (invoiceRepo), `findBuildingsWithLeaseTemplates` + `findRentIncomeLeasesForBuilding` + `findRentIncomeLeasesForBuildings` (leaseRepo), + `findContractorByIdRaw` already existed.
- **Remaining:** Higher-call-count files (leases.ts ~31, tenants.ts ~15, ledgerService.ts ~16, financials.ts ~15) tracked as DT-121–DT-124.

### ARCH-NEW-1 · Service-layer `any` type pollution (LOW) ✅ Resolved 2026-05-30

- **Files:** `services/rentalApplications.ts` (27), `services/legalDecisionEngine.ts` (6), `services/legalService.ts` (4), `services/legalIngestion.ts` (4)
- **Description:** Mapper functions and DSL evaluation functions used `: any` / `as any` parameter types, defeating Prisma's `GetPayload` type safety at the service boundary.
- **Fix:** Added `RentalApplicationRow`, `RentalApplicantRow`, `RentalApplicationUnitRow` derived types to `rentalIncludes.ts`. Added `RequestLegalDecisionRow` to `requestRepository.ts`. Added `LegalDslJson` interface in `legalDecisionEngine.ts`. Replaced all `any` instances with proper Prisma payload types or `Prisma.JsonValue` / `Prisma.InputJsonValue`.

### ARCH-NEW-3 · Missing HTTP tests for 3 workflow routes (LOW) ✅ Resolved 2026-05-30

- **Files:** `routes/cashflowPlans.ts`, `routes/recommendations.ts`, `routes/legal.ts` (claim-analysis endpoint)
- **Description:** `cashflowPlanWorkflow`, `recommendationWorkflow`, and `analyseClaimWorkflow` had no HTTP integration tests — auth gates and basic shape were unverified.
- **Fix:** Created `src/__tests__/newWorkflowRoutes.test.ts` (port 3272) with 20 tests covering 401 (no token), 403 (wrong role), and auth-passing 4xx/5xx for all route+method combinations.- **Fix:** Created `src/__tests__/newWorkflowRoutes.test.ts` (port 3272) with 20 tests covering 401 (no token), 403 (wrong role), and auth-passing 4xx/5xx for all route+method combinations.

---

## Design Token Migration — 2026-05-30

### FE-NEW-1 · Hardcoded Tailwind color classes — token coverage gap (LOW) ✅ Resolved 2026-05-30

- **Files:** `apps/web/styles/globals.css`, `apps/web/pages/**/*.js`, `apps/web/components/**/*.js`
- **Description:** The `@theme {}` semantic token layer was defined correctly but incompletely adopted. 3,683 raw Tailwind color classes (`text-slate-*`, `bg-white`, `bg-slate-*`, `border-slate-*`) were hardcoded across 131 files in JSX and the `@layer components` block. These classes bypassed the token system, making any future dark mode or theme change require per-file edits instead of a single CSS variable override.
- **Root cause:** The semantic tokens (`--color-surface`, `--color-brand`, etc.) were added as infrastructure but the existing component layer and all JSX pages were never migrated to use them. The design guidelines specified `@apply`-backed component classes as canonical but did not explicitly prohibit raw Tailwind color utilities in JSX.
- **Fix:**
  1. Added 4 new tokens to `@theme {}`: `--color-foreground` (#0f172a = slate-900), `--color-foreground-dim` (#94a3b8 = slate-400), `--color-surface-subtle` (#f8fafc = slate-50), `--color-surface-divider` (#f1f5f9 = slate-100). Total tokens: 35.
  2. Migrated all hardcoded `@apply` lines in `globals.css @layer components` to semantic equivalents.
  3. Created `scripts/migrate-tokens.js` — a word-boundary-safe Node.js codemod with prefix-chain and opacity-modifier preservation. Applied 3,683 replacements across 131 JSX files.
  4. Three intentional exceptions documented with `/* no-token: <reason> */`: toggle thumb in `NotificationPreferencesTab.js`, hover state in `UndoToast.js`, semi-transparent badge in `manager/requests.js`.
  5. Updated `PROJECT_OVERVIEW.md §Frontend Styling` to make semantic-token usage explicit and add `bg-slate-*` / `text-slate-*` to the Never list.
- **Guardrail added to guidelines:** Inline Tailwind utilities must use semantic token classes (`bg-surface`, `text-foreground`, `border-surface-border`, etc.). Raw `bg-white`, `text-slate-*`, `border-slate-*` are prohibited; use `/* no-token: <reason> */` for intentional exceptions.

---

## Dark Mode — Implementation Status (2026-05-30)

### ✅ Complete

| Work stream | Status | Notes |
|---|---|---|
| `html.dark` token override block (41 CSS vars) | ✅ Done | invest.html palette: `#05081a/0d1226/141d38`, rgba glass borders, brand accent unchanged |
| `@custom-variant dark` declaration | ✅ Done | `(&:where(.dark, .dark *))` — `.dark` class on `<html>` activates `dark:` utilities |
| Token completion — `bg-slate-200/300`, `text-slate-200/300` | ✅ Done | 87 additional replacements across 48 files; `bg-track` token added for progress bars |
| `useTheme` hook + localStorage persistence | ✅ Done | `apps/web/hooks/useTheme.js` |
| `_app.js` theme restore on mount | ✅ Done | Reads `localStorage.theme` before first render |
| `AppearanceTab` component | ✅ Done | Light / Dark radio toggles; visual pattern matches `NotificationPreferencesTab` |
| Settings integration — all 4 personas | ✅ Done | Manager, owner, contractor, tenant; EN+FR locale keys |
| Status pill dark variants | ✅ Done | All CVA Badge variants use semantic tokens (`warning-*`, `destructive-*`, `brand-*`, `info-*`, `muted`) |
| Manager attention feed contrast | ✅ Done | `CATEGORY_CHIP` + `CARD_STYLE` migrated from hardcoded amber/red/blue to semantic tokens |
| Owner reporting hero banner | ✅ Done | `dark:from-brand-light dark:via-info-light dark:to-transparent` override |
| `/* no-token: */` exceptions reviewed | ✅ Done | 3 exceptions retained: toggle thumb (always white), UndoToast hover (dark bg), confidence badge (colored card) |

### Remaining scope

| Work stream | Effort | Notes |
|---|---|---|
| QA across 4 personas | ~1.5 days | Full light/dark sweep: manager, owner, contractor, tenant. 28 hardcoded `bg-slate-700/800/900` instances (Tooltip popup, UndoToast bg, dark selected-state pills, health dots) visible in dark mode — may need `dark:` overrides. |

**Default: light mode. User opts in via Settings → Appearance. No `prefers-color-scheme` fallback.**
