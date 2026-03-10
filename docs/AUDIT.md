# Maintenance Agent — Project Audit

**Generated:** 2026-03-10  
**Scope:** Code Quality, Schema Integrity, Test Coverage, Security & Auth  
**Source commit:** ed7c841 (branch: main)  
**Frontend rationalization audit:** Completed 2026-03-10 — results in [docs/FRONTEND_INVENTORY.md](FRONTEND_INVENTORY.md) (185 pages, 119/119 proxies conforming, 4 coming-soon stubs)

## Summary

| Area | Findings | Critical | High | Medium | Low | Resolved |
|------|----------|----------|------|--------|-----|----------|
| Code Quality & Architecture | 35 | 0 | 7 | 12 | 16 | 0 |
| Schema & Data Integrity | 12 | 0 | 1 | 7 | 4 | 9 |
| Test Coverage Gaps | 15 | 0 | 6 | 8 | 1 | 2 |
| Security & Auth | 20 | 1 | 8 | 9 | 2 | 9 |
| **Total** | **82** | **1** | **22** | **36** | **23** | **20** |

---

## Area 1 — Code Quality & Architecture

### CQ-1 · `routes/legal.ts` — massive layer violation (HIGH)

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L285–775 (multiple handlers)
- **Description:** ~300 lines of direct Prisma queries and business logic in route handlers. Legal rules CRUD (L285–370), category mappings CRUD (L380–480), coverage computation (L490–610), depreciation standards (L620–670), and evaluation listing (L688–775) all contain direct `prisma.*` calls, inline include trees, and DTO mapping.
- **Fix:** Extract to `legalAdminService` and `legalCategoryMappingRepository` with canonical includes.

### CQ-2 · `routes/rentalApplications.ts` — selection pipeline duplicated (HIGH)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Lines:** L362–575
- **Description:** `GET /manager/rental-application-units` and `GET /owner/rental-selections` contain near-duplicate ~80-line handlers with deep 4-level ad-hoc include trees and inline DTO mapping. Both define the same `applicants → attachments → unit → building` tree inline.
- **Fix:** Define `SELECTION_PIPELINE_INCLUDE` constant; extract to shared `rentalSelectionService.listPipeline()`.

### CQ-3 · `routes/tenants.ts` — business logic in route (HIGH)

- **File:** `apps/api/src/routes/tenants.ts`
- **Lines:** L141–195
- **Description:** `GET /tenants/:id/payment-history` executes a 3-query Prisma chain (occupancies → leases → invoices), performs inline DTO mapping with date formatting, and manual joins via `flatMap` — all business orchestration in the route.
- **Fix:** Extract to `tenantService.getPaymentHistory()`.

### CQ-4 · `routes/leases.ts` — notification logic in route (HIGH)

- **File:** `apps/api/src/routes/leases.ts`
- **Lines:** L120–145
- **Description:** `POST /leases/:id/ready-to-sign` dynamically imports `notificationService` and performs 3 direct Prisma queries for tenant notification logic — business orchestration belongs in the `markLeaseReadyWorkflow`.
- **Fix:** Move notification trigger into `markLeaseReadyWorkflow` or a follow-up workflow step.

### CQ-5 · `routes/legal.ts` — coverage computation (HIGH)

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L490–610
- **Description:** `GET /legal/coverage` contains ~120 lines of complex business logic: multi-query Prisma joins, keyword matching against `LegalCategoryMapping`, depreciation counting, string formatting — all inline.
- **Fix:** Extract to `legalCoverageService.computeCoverage()`.

### CQ-6 · `routes/legal.ts` — evaluation listing (HIGH)

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L688–775
- **Description:** `GET /legal/evaluations` does direct Prisma queries, JSON flattening of rule/variable versions, post-query filtering by date and status, and DTO building — all in the route handler.
- **Fix:** Extract to `legalEvaluationService.listEvaluations()`.

### CQ-7 · `routes/legal.ts` — ad-hoc includes (HIGH) ✅ Resolved 2026-03-10

- **File:** `apps/api/src/routes/legal.ts`
- **Lines:** L291–370
- **Description:** `GET /legal/variables` and `GET /legal/rules` use inline include objects (`{ versions: true, source: true }`) instead of canonical constants. Violates G9.
- **Fix:** Define `LEGAL_VARIABLE_INCLUDE` and `LEGAL_RULE_INCLUDE` constants.
- **Resolution:** Defined `LEGAL_VARIABLE_INCLUDE`, `LEGAL_RULE_INCLUDE`, `LEGAL_RULE_WITH_VERSIONS_INCLUDE`, `DEPRECIATION_STANDARD_INCLUDE` in `legalSourceRepository.ts`. All 4 inline includes in `legal.ts` replaced with canonical constants. (`prisma-dto-hardening` slice)

### CQ-8 · `routes/auth.ts` — direct Prisma (MEDIUM)

- **File:** `apps/api/src/routes/auth.ts`
- **Lines:** L228–295
- **Description:** `POST /auth/register` and `POST /auth/login` call `prisma.user.*` directly with bcrypt hashing and token generation inline.
- **Fix:** Extract to `authService.registerUser()` and `authService.loginUser()`.

### CQ-9 · `routes/requests.ts` — direct Prisma for events (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Lines:** L57–85
- **Description:** `GET /requests/:id/events` and `POST /requests/:id/events` call `prisma.requestEvent.*` directly.
- **Fix:** Extract to `requestEventService.listEvents()` and `createEvent()`.

### CQ-10 · `routes/requests.ts` — owner-reject has no workflow (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Lines:** L125–155
- **Description:** `POST /requests/:id/owner-reject` contains inline business logic: status check, status transition, and event logging — no workflow exists for owner rejection.
- **Fix:** Create `ownerRejectWorkflow` similar to `approveRequestWorkflow`.

### CQ-11 · `routes/invoices.ts` — workflows exist but not wired (MEDIUM)

- **File:** `apps/api/src/routes/invoices.ts`
- **Description:** Routes for `POST /invoices/:id/approve`, `POST /invoices/:id/pay`, and `POST /invoices/:id/dispute` call services directly. The workflow files exist in `workflows/` but are not wired into these routes.
- **Fix:** Wire `approveInvoiceWorkflow`, `payInvoiceWorkflow`, `disputeInvoiceWorkflow` into the route handlers.

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

### CQ-15 · `routes/invoices.ts` — job status branching in route (MEDIUM)

- **File:** `apps/api/src/routes/invoices.ts`
- **Lines:** L55–77
- **Description:** `POST /invoices/:id/complete` has branching business logic checking job status to decide between workflow vs direct service call.
- **Fix:** Move completion-check branching into the workflow or a dedicated `updateJobWorkflow`.

### CQ-16–35 · Additional low-severity findings

- Multiple route files contain direct `prisma.*` calls for simple existence checks (e.g., verify building exists, verify unit exists, check user role) before delegating to services. These are **low severity** — 16 instances across `leases.ts`, `financials.ts`, `inventory.ts`, `notifications.ts`, and `rentEstimation.ts`.
- **Fix:** Move existence checks into the respective service or repository layer.

**Note on stubs:** Email and signature services contain intentional MVP stubs (mark SENT/SIGNED without real providers) that read/write real DB records. No true fake-data stubs were found.

---

## Area 2 — Schema & Data Integrity

### SI-1 · Inventory missing org scope resolver (HIGH)

- **File:** `apps/api/src/governance/orgScope.ts`
- **Model:** `Appliance` / `Asset`
- **Description:** F2 explicitly requires org scope resolvers for Request, Job, Invoice, Lease, and Inventory. Resolvers exist for the first four but not for Appliance or Asset. Both models have direct `orgId` columns, so a resolver would be trivial.
- **Fix:** Add `resolveApplianceOrg()` / `resolveAssetOrg()` to `orgScope.ts`.

### SI-2 · SCHEMA_REFERENCE.md claims orgId on LegalSource (MEDIUM)

- **File:** `SCHEMA_REFERENCE.md`
- **Model:** `LegalSource`
- **Description:** Docs say LegalSource has `orgId`, but the actual schema has no `orgId` — it's jurisdiction-scoped with no Org relation.
- **Fix:** Update SCHEMA_REFERENCE.md to remove orgId from LegalSource entry.
- **Status: ✅ Resolved 2026-03-10**

### SI-3 · SCHEMA_REFERENCE.md claims orgId on LegalVariable (MEDIUM)

- **File:** `SCHEMA_REFERENCE.md`
- **Model:** `LegalVariable`
- **Description:** Docs say LegalVariable has `orgId`. Actual schema uses `jurisdiction` + `canton` scoping only.
- **Fix:** Update SCHEMA_REFERENCE.md to match actual schema.
- **Status: ✅ Resolved 2026-03-10**

### SI-4 · SCHEMA_REFERENCE.md claims orgId on LegalRule (MEDIUM)

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

### TC-1 · 9 of 14 workflows have zero test coverage (HIGH)

- **Workflows:** `activateLeaseWorkflow`, `markLeaseReadyWorkflow`, `terminateLeaseWorkflow`, `submitRentalApplicationWorkflow`, `approveInvoiceWorkflow`, `issueInvoiceWorkflow`, `disputeInvoiceWorkflow`, `payInvoiceWorkflow`, `unassignContractorWorkflow`
- **Description:** None are imported or referenced by any test file. Only 5 workflows have coverage: `createRequestWorkflow`, `approveRequestWorkflow`, `assignContractorWorkflow`, `completeJobWorkflow` (shallow), `evaluateLegalRoutingWorkflow`.
- **Fix:** Add workflow test cases exercising the HTTP endpoints that delegate to them.

### TC-2 · `routes/config.ts` has zero test coverage (HIGH)

- **Description:** The config route (org config, building config, auto-approve-limit CRUD) has no dedicated test file. Only indirectly touched by tests that import the service.
- **Fix:** Add `config.test.ts` covering GET/PATCH org config, GET/PATCH building config.

### TC-3 · `GET /leases/:id` contract test missing (HIGH)

- **Description:** G10 requires a contract test for `GET /leases/:id`. Only `GET /leases` (list) exists. The single-resource detail endpoint is not tested.
- **Fix:** Add a `GET /leases/:id` describe block asserting the full DTO shape including nested relations.

### TC-4 · `--runInBand` not configured; 16+ servers in parallel (HIGH)

- **File:** `apps/api/jest.config.js`
- **Description:** 14+ test files spawn child-process servers in parallel (no `maxWorkers` or `runInBand`). This is the documented root cause of 11–154 timeout failures.
- **Fix:** Add `--runInBand` for integration suites or split into two Jest projects (pure parallel + integration serial).
- **Status: ✅ Resolved 2026-03-10**

### TC-5 · Port 3206 used by 3 test files (HIGH)

- **Files:** `rentalContracts.test.ts`, `rentalIntegration.test.ts`, `ownerDirect.foundation.test.ts`
- **Description:** All three use port 3206 in parallel, causing `EADDRINUSE` crashes.
- **Fix:** Assign unique ports or use dynamic port allocation (`:0`).
- **Status: ✅ Resolved 2026-03-10**

### TC-6 · No cross-org access test at HTTP auth gate level (HIGH)

- **File:** `apps/api/src/__tests__/auth.manager-gates.test.ts`
- **Description:** Both manager and contractor tokens use `default-org`. No test verifies that a token with `org-B` cannot read `org-A` data at the HTTP level. Cross-org isolation is tested at the service layer in `ownerDirect.governance.test.ts`, but not at the route/auth level.
- **Fix:** Add test: create MANAGER token with `org-B`, attempt to read `org-A` data, expect 403 or empty results.

### TC-7 · `routes/helpers.ts` has zero test coverage (MEDIUM)

- **Description:** Helper routes (URL parsing utilities, query coercion) have no direct test.
- **Fix:** Add `helpers.test.ts` with unit tests for `parseUrl()` edge cases.

### TC-8 · `GET /requests` contract test missing nested assertions (MEDIUM)

- **File:** `apps/api/src/__tests__/contracts.test.ts`
- **Description:** Only checks top-level keys (`id`, `status`, `description`, `createdAt`). Does not assert nested `unit`, `tenant`, `building` relations.
- **Fix:** Add nested relation assertions.

### TC-9 · `completeJobWorkflow` test is shallow (MEDIUM)

- **Description:** The test only calls `GET /jobs` and verifies list returns. Never PATCHes a job to COMPLETED to exercise the completion → invoice auto-creation pipeline.
- **Fix:** Create a job, PATCH to COMPLETED, verify invoice auto-creation.

### TC-10 · No unit test for auth token decode/verify (MEDIUM)

- **File:** Missing `auth.unit.test.ts`
- **Description:** `decodeToken`, `verifyToken`, token-expiry handling, malformed-token parsing are not directly unit-tested.
- **Fix:** Add pure unit test for `services/auth.ts`.

### TC-11 · `startServer` copy-pasted in 14 test files (MEDIUM)

- **Description:** Each integration test has its own inline `startServer` implementation. Fragile — any startup change must be replicated everywhere.
- **Fix:** Extract shared `startServer` into `testHelpers.ts` and import.

### TC-12 · Only CONTRACTOR role tested as "wrong role" (MEDIUM)

- **File:** `apps/api/src/__tests__/auth.manager-gates.test.ts`
- **Description:** TENANT and OWNER tokens are not tested against manager-gated routes.
- **Fix:** Add test cases for TENANT and OWNER tokens hitting manager routes, asserting 403.

### TC-13 · No malformed/expired token test (MEDIUM)

- **Description:** No test covers garbage `Authorization` header, expired JWT, or token signed with wrong secret.
- **Fix:** Add test cases with malformed tokens.

### TC-14 · `ownerDirect.foundation.test.ts` uses PID-based port (MEDIUM)

- **Description:** Dynamic port offset via `3202 + (pid % 1000)` is unreliable and can collide with other hardcoded ports.
- **Fix:** Use `:0` and extract actual port from stdout.

### TC-15 · Building config only indirectly tested (LOW)

- **Description:** Building config CRUD is exercised indirectly through integration tests but has no dedicated assertion coverage.
- **Fix:** Add dedicated building config assertions.

---

## Area 4 — Security & Auth

### SA-1 · `getOrgIdForRequest()` falls back to DEFAULT_ORG_ID (CRITICAL)

- **File:** `apps/api/src/authz.ts`
- **Function:** `getOrgIdForRequest()`
- **Description:** When no user is authenticated and no `DEV_ORG_ID` env var is set, every unauthenticated request is silently assigned to `DEFAULT_ORG_ID`. Called in `server.ts` for EVERY incoming request. In multi-org: public routes would create data under the wrong org; unauthenticated requests would read/write default org data.
- **Fix:** In production, if no user is authenticated and the route isn't explicitly public, return 401 instead of defaulting.
- **Status: ✅ Resolved 2026-03-10**

### SA-2 · All tenant-portal routes are IDOR-vulnerable (HIGH)

- **File:** `apps/api/src/routes/tenants.ts`
- **Routes:** All `/tenant-portal/*` endpoints
- **Description:** All tenant-portal endpoints rely solely on a `tenantId` query parameter with no authentication. Anyone who knows or guesses a tenant ID can read their leases, notifications, invoices, and mark notifications as read/deleted.
- **Fix:** Require tenant authentication (JWT with tenant role), or session token from `createTenantSession`.
- **Status: ✅ Resolved 2026-03-10**

### SA-3 · Rental attachment download unprotected — PII exposure (HIGH)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Route:** `GET /rental-attachments/:attachmentId/download`
- **Description:** Downloads rental attachment files (identity documents, pay stubs) with no auth check. Anyone who knows or brute-forces an attachment UUID can download sensitive PII.
- **Fix:** Add `maybeRequireManager()` or role-based access.
- **Status: ✅ Resolved 2026-03-10**

### SA-4 · Rental application documents listing unprotected (HIGH)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Route:** `GET /rental-applications/:id/documents`
- **Description:** Lists applicant names, emails, and attachment metadata with no authentication.
- **Fix:** Add `maybeRequireManager()` or role-based access.
- **Status: ✅ Resolved 2026-03-10**

### SA-5 · Email outbox routes exposed without auth or prod guard (HIGH)

- **File:** `apps/api/src/routes/notifications.ts`
- **Routes:** `GET /email-outbox`, `POST /email-outbox/:id/send`
- **Description:** Exposes email outbox contents (recipient addresses, subjects, bodies) with no auth AND no production guard. Accessible in production.
- **Fix:** Add production guard and require auth.
- **Status: ✅ Resolved 2026-03-10**

### SA-6 · `DEV_IDENTITY_ENABLED` has no production guard (HIGH)

- **File:** `apps/api/src/authz.ts`
- **Description:** When `DEV_IDENTITY_ENABLED=true`, any request can spoof any role via `x-dev-role`, `x-dev-org-id`, `x-dev-user-id` headers. The boot guard in `server.ts` checks `AUTH_OPTIONAL` and `AUTH_SECRET` but does NOT check `DEV_IDENTITY_ENABLED`. If accidentally set in production, any request can impersonate any user.
- **Fix:** Add `DEV_IDENTITY_ENABLED` to the production boot guard.
- **Status: ✅ Resolved 2026-03-10**

### SA-7 · Contractor request events POST has no auth (HIGH)

- **File:** `apps/api/src/routes/requests.ts`
- **Route:** `POST /requests/:id/events`
- **Description:** Any unauthenticated user can create events on any request by providing a request ID.
- **Fix:** Wrap with `requireRole()` for CONTRACTOR or MANAGER.
- **Status: ✅ Resolved 2026-03-10**

### SA-8 · Contractor-assigned requests have no auth (HIGH)

- **File:** `apps/api/src/routes/requests.ts`
- **Route:** `GET /requests/contractor/:contractorId`
- **Description:** Returns all requests assigned to a contractor with no authentication. Anyone who knows a contractor ID can view their requests.
- **Fix:** Add `requireRole()` for CONTRACTOR.
- **Status: ✅ Resolved 2026-03-10**

### SA-9 · Dev identity header allows org spoofing (HIGH)

- **File:** `apps/api/src/authz.ts`
- **Description:** When `DEV_IDENTITY_ENABLED=true`, the `x-dev-org-id` header overrides org context. Combined with the missing production guard (SA-6), this allows accessing any org's data.
- **Fix:** Add production guard for `DEV_IDENTITY_ENABLED`.
- **Status: ✅ Resolved 2026-03-10**

### SA-10 · `maybeRequireManager` allows MANAGER + OWNER on writes (MEDIUM)

- **File:** `apps/api/src/authz.ts`
- **Function:** `maybeRequireManager()`
- **Description:** Used in lease writes, invoice creation, legal admin CRUD, and financial mutations. Permits OWNER role for operations that should be MANAGER-only.
- **Fix:** Use `requireRole('MANAGER')` for mutation routes; reserve `maybeRequireManager` for reads.
- **Status: ✅ Resolved 2026-03-10** — Replaced `maybeRequireManager` with `requireRole(req, res, 'MANAGER')` on all mutation routes in inventory.ts (×19), requests.ts (×3), tenants.ts (×6), notifications.ts (×3), rentEstimation.ts (×3), financials.ts (×1). `requireRole` includes AUTH_OPTIONAL dev bypass with warning log.

### SA-11 · Legal routes lack org scoping (MEDIUM)

- **File:** `apps/api/src/routes/legal.ts`
- **Routes:** Legal rules, variables, depreciation standards, category mapping CRUD
- **Description:** Prisma queries do not filter by `orgId`. In multi-org, all orgs would see/modify each other's legal data. Category mapping PATCH/DELETE find by ID only.
- **Fix:** Add org-scoping to queries, or document as intentionally global.
- **Status: ✅ Resolved 2026-03-10** — Global models (LegalSource, LegalVariable, LegalRule, DepreciationStandard) documented as jurisdiction-scoped by design. PUT/DELETE category-mappings now validate `existing.orgId` matches caller's orgId.

### SA-12 · `POST /requests` conditionally authed (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Description:** Auth is conditional: if `contractorId` query param is present, `maybeRequireManager` is checked. Otherwise, `getAuthUser` is used without enforcement. If `AUTH_OPTIONAL=false` is off, anyone can create requests.
- **Fix:** Add an upfront auth wrapper.
- **Status: ✅ Resolved 2026-03-10** — Added `requireAuth(req, res)` as first check in POST /requests and POST /work-requests handlers.

### SA-13 · Contractor suggest and match endpoints no auth (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Routes:** `GET /requests/:id/suggest-contractor`, `GET /requests/:id/match-contractors`
- **Description:** Returns contractor data without authentication. Has org scope check but no authentication.
- **Fix:** Add `maybeRequireManager()`.
- **Status: ✅ Resolved 2026-03-10** — Added `maybeRequireManager(req, res)` guard to both endpoints.

### SA-14 · `DELETE /requests` no auth (MEDIUM)

- **File:** `apps/api/src/routes/requests.ts`
- **Route:** `DELETE /requests`
- **Description:** Deletes all requests. Has production guard but no auth check. In dev/staging, anyone can delete all data.
- **Fix:** Add auth or IP whitelist.
- **Status: ✅ Resolved 2026-03-10** — Added `requireRole(req, res, 'MANAGER')` after production guard in DELETE /__dev/requests.

### SA-15 · `POST /document-scan` no auth (MEDIUM)

- **File:** `apps/api/src/routes/rentalApplications.ts`
- **Route:** `POST /document-scan`
- **Description:** OCR endpoint processing uploaded files with no auth. Could be abused for resource exhaustion.
- **Fix:** Add rate limiting and/or auth.
- **Status: ✅ Resolved 2026-03-10** — Added `maybeRequireManager(req, res)` guard to POST /document-scan in rentalApplications.ts (actual file location, not inventory.ts).

### SA-16 · Governance routes missing wrapper (MEDIUM)

- **File:** `apps/api/src/routes/financials.ts`
- **Routes:** `GET /governance/*`
- **Description:** Uses `maybeRequireManager` internally but not wrapped with `withAuthRequired`. If `AUTH_OPTIONAL=true`, governance access is bypassed.
- **Fix:** Wrap with `withAuthRequired`.
- **Status: ✅ Resolved 2026-03-10** — Added `requireAuth(req, res)` as first statement in all financial handlers. POST /invoices/:id/set-expense-category additionally requires MANAGER role.

### SA-17 · `maybeRequireManager` bypasses role check on AUTH_OPTIONAL (MEDIUM)

- **File:** `apps/api/src/authz.ts`
- **Function:** `maybeRequireManager()`
- **Description:** When `isAuthOptional()` returns true and no user token is provided, allows the request through without any role check. An OWNER-only endpoint could be reached by anyone in dev.
- **Fix:** Consider requiring dev identity header when AUTH_OPTIONAL so role checks still fire.
- **Status: ✅ Resolved 2026-03-10** — `maybeRequireManager` now logs `console.warn` when AUTH_OPTIONAL bypasses without a dev-role header. `requireRole`/`requireAnyRole` also log warnings on dev bypass.

### SA-18 · `POST /triage` no auth (MEDIUM)

- **File:** `apps/api/src/routes/auth.ts`
- **Route:** `POST /triage`
- **Description:** Triage endpoint is fully public, could be abused for resource consumption.
- **Fix:** Add rate limiting or basic auth.
- **Status: ✅ Resolved 2026-03-10** — Added in-memory IP-based rate limiter: 10 requests/minute/IP, returns 429 on exceed. Map auto-resets per window.

### SA-19 · Weak default JWT secret (LOW)

- **File:** `apps/api/src/services/auth.ts`
- **Description:** Fallback secret `"dev-secret-key-change-in-prod"` used when `AUTH_SECRET` not set. Production guard prevents this in prod, but staging environments may use it.
- **Fix:** Require `AUTH_SECRET` in all non-test environments.
- **Status: ✅ Resolved 2026-03-10** — Non-test environments now fail hard with `process.exit(1)` if `AUTH_SECRET` is unset. Test environments keep fallback for convenience.

### SA-20 · Event logger outputs payload (LOW)

- **File:** `apps/api/src/events/`
- **Description:** `console.log` outputs event payloads which may contain business-sensitive data. Not directly tokens/passwords, but could leak business data in container logs.
- **Fix:** Redact sensitive fields from log output.
- **Status: ✅ Resolved 2026-03-10** — Added `redactPayload()` function (redacts token, password, secret, email, tenantId, iban, accountNumber). Applied to `logEvent()` console.log in helpers.ts.

---

## Recommended Priority Order

### 1. SA-1 · `getOrgIdForRequest()` DEFAULT_ORG_ID fallback (CRITICAL)

Every unauthenticated request silently inherits the default org. This is the single biggest multi-org blast radius risk. **Fix:** Return 401 for non-public routes when no auth is present and org cannot be resolved.

### 2. SA-6 + SA-9 · `DEV_IDENTITY_ENABLED` missing production guard (HIGH)

If this env var leaks into production, any request can impersonate any user/role/org via headers. **Fix:** Add one line to the production boot guard in `server.ts`: refuse to start if `DEV_IDENTITY_ENABLED=true` in production.

### 3. SA-2 · Tenant-portal IDOR vulnerability (HIGH)

All tenant-portal endpoints are accessible with just a `tenantId` query parameter — no auth. An attacker can enumerate tenant IDs and read leases, invoices, and notifications. **Fix:** Require tenant JWT or session token validation.

### 4. SA-3 + SA-4 · Rental attachment/document PII exposure (HIGH)

Identity documents and personal data downloadable without auth by anyone who knows a UUID. **Fix:** Add `maybeRequireManager()` to both endpoints.

### 5. TC-4 + TC-5 · Test infrastructure — `--runInBand` and port collisions (HIGH)

The test suite is unreliable: 16+ servers spawn in parallel with 3 port collisions. This blocks CI reliability (G7). **Fix:** Add `--runInBand` to Jest config and deduplicate ports. Estimated effort: 30 minutes.
