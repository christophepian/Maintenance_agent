# Low-Context Architecture Guide

> **File-routing map.** Find which 1–3 files to touch for any change.
> For guardrails, rules, and task routing → **[PROJECT_OVERVIEW.md](../../../PROJECT_OVERVIEW.md)**.
> For auth helpers, security rules, boot guards → same file.

**Codebase:** 64 models · 55 enums · 71 migrations · 25 workflows · 23 repositories · ~64k backend LOC · ~42k frontend LOC · 289 API operations (224 URL paths)

**Layer order (never skip):** routes → workflows → services → repositories → Prisma

---

## 1 · Where to Change Things

**Status transitions** → `workflows/transitions.ts` (all `VALID_*_TRANSITIONS` maps + `assert*Transition()`)

**Add a field to Request/Job/Invoice response:**
1. `prisma/schema.prisma` + migration
2. Repository include constant: `requestRepository.ts` → `REQUEST_FULL_INCLUDE`, `jobRepository.ts` → `JOB_FULL_INCLUDE`, `invoiceRepository.ts` → `INVOICE_FULL_INCLUDE`
3. DTO mapper: `services/maintenanceRequests.ts` → `toDTO()`, `services/jobs.ts` → `mapJobToDTO()`, `services/invoices.ts` → `mapInvoiceToDTO()`

**Add an HTTP endpoint** → route in `routes/`, workflow in `workflows/` (if mutation), repository for new queries

**Add a business action** → new `workflows/<name>Workflow.ts` (typed `Input`/`Result`, transition guard, service calls, `emit()`, canonical reload) + transition rule in `transitions.ts` + export from `workflows/index.ts` + route handler

**Add a domain event handler** → `events/bus.ts` (emission), `events/handlers.ts` (handler registration)

---

## 2 · Domain File Maps

### Requests & Maintenance
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/requests.ts` | CRUD + status endpoints |
| Workflows | `createRequestWorkflow.ts`, `approveRequestWorkflow.ts`, `assignContractorWorkflow.ts`, `unassignContractorWorkflow.ts`, `ownerRejectWorkflow.ts`, `uploadMaintenanceAttachmentWorkflow.ts` | |
| Service | `services/maintenanceRequests.ts` | `toDTO()` |
| Service | `services/autoApproval.ts` | `decideRequestStatusWithRules()` — used by createRequestWorkflow step 2 |
| Service | `services/requestAssignment.ts` | `findMatchingContractor()`, `assignContractor()` |
| Repo | `repositories/requestRepository.ts` | `REQUEST_FULL_INCLUDE` |
| Validation | `validation/requests.ts` | Zod schemas |

### Jobs
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/completion.ts` | Job completion + rating endpoints |
| Workflows | `completeJobWorkflow.ts`, `completionRatingWorkflow.ts`, `schedulingWorkflow.ts`, `updateJobWorkflow.ts` | |
| Service | `services/jobs.ts` | `mapJobToDTO()` |
| Repo | `repositories/jobRepository.ts` | `JOB_FULL_INCLUDE` |
| Note | `Job` has no `description` — use `Request.description` | `Job.contractorId` is required, not optional |

### Invoices
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/invoices.ts` | CRUD + status endpoints |
| Workflows | `issueInvoiceWorkflow.ts`, `approveInvoiceWorkflow.ts`, `disputeInvoiceWorkflow.ts`, `payInvoiceWorkflow.ts`, `tenantSelfPayWorkflow.ts` | |
| Service | `services/invoices.ts` | `mapInvoiceToDTO()`, `normalizeLineItems()`, `summarizeTotals()` |
| Repo | `repositories/invoiceRepository.ts` | `INVOICE_FULL_INCLUDE` |
| Ingestion | `services/invoiceIngestionService.ts` | OCR → draft invoice |

### Leases
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/leases.ts` | CRUD + expense items |
| Workflows | `markLeaseReadyWorkflow.ts`, `activateLeaseWorkflow.ts`, `terminateLeaseWorkflow.ts` | |
| Service | `services/leases.ts` | DTO mapping, expense item CRUD |
| Service | `services/leasePDFRenderer.ts` | PDF generation |
| Repo | `repositories/leaseRepository.ts` | `LEASE_FULL_INCLUDE` |

### Legal
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/legal.ts` | Variables, rules, category mappings, evaluations, depreciation standards |
| Workflow | `evaluateLegalRoutingWorkflow.ts` | Legal obligation evaluation |
| Service | `services/legalDecisionEngine.ts` | `evaluateRequestLegalDecision()` — used by createRequestWorkflow step 6 |
| Service | `services/legalService.ts` | All legal CRUD: `listVariables`, `listRules`, `createRule`, `listCategoryMappings`, `getMappingCoverage`, `listEvaluations`, `listDepreciationStandards` |
| Service | `services/legalIngestion.ts` | Legal document ingestion |
| Repo | `repositories/legalSourceRepository.ts` | Legal source data access |
| Includes | `services/legalIncludes.ts` | Shared include constants |

### Inventory & Assets
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/inventory.ts` | Asset CRUD, repair-replace analysis, depreciation |
| Service | `services/assetInventory.ts` | `getRepairReplaceAnalysis()`, `computeDepreciation()`, `getAssetInventoryForUnit()` |
| Service | `services/inventory.ts` | Asset management logic |
| Repo | `repositories/inventoryRepository.ts` | Asset data access |
| Repo | `repositories/assetRepository.ts` | AssetModel data access |
| Note | `Appliance` has no `category` — lives on `AssetModel` | Depreciation: `replacedAt ?? installedAt` as clock start, caps at 100% |

### Auth & Tenants
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/auth.ts` | Login, registration |
| Route | `routes/tenants.ts` | Tenant portal endpoints |
| Service | `services/tenantSession.ts` | Tenant JWT validation |
| Service | `services/tenantPortal.ts` | Tenant-facing logic |
| Service | `services/tenantIdentity.ts` | Tenant identity management |
| Authz | `authz.ts` | All auth helpers (see PROJECT_OVERVIEW.md) |
| Gotcha | Tenant-portal routes: use `requireTenantSession()` — never accept `tenantId` as query param | `POST /tenant-session` is the only unauthenticated entry point |

### Notifications
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/notifications.ts` | Notification endpoints |
| Service | `services/notifications.ts` | Notification logic |
| Service | `services/emailOutbox.ts` | Email queuing |
| Service | `services/emailTransport.ts` | Email delivery |
| Events | `events/handlers.ts` | Domain event → notification triggers |

### Financials · COA · Ledger
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/coa.ts` | 7 endpoints: expense-types, accounts, mappings CRUD + seed |
| Route | `routes/ledger.ts` | 3 endpoints: journal, trial-balance, account balance |
| Route | `routes/financials.ts` | Financial summary endpoints |
| Service | `services/coaService.ts` | COA CRUD + Swiss taxonomy seed |
| Service | `services/ledgerService.ts` | `postJournalEntries`, `postInvoiceIssued/Paid`, `getTrialBalance` |
| Service | `services/financials.ts` | Financial aggregations |
| Repo | `repositories/expenseTypeRepository.ts`, `accountRepository.ts`, `expenseMappingRepository.ts` | COA data access |
| Validation | `validation/coaValidation.ts` | Zod schemas |
| Wiring | Ledger auto-posts from `issueInvoiceWorkflow` + `payInvoiceWorkflow` (best-effort) | |

### Capture Sessions & Ingestion
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/captureSessions.ts` | Capture session endpoints |
| Service | `services/captureSessionService.ts` | Session management |
| Service | `services/documentScan.ts` | Document scanning |
| Service | `services/documentScanner.ts` | Scanner abstraction |
| Service | `services/invoiceIngestionService.ts` | Invoice OCR → draft |
| Repo | `repositories/captureSessionRepository.ts` | Session data access |

### RFPs (Request for Proposals)
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/contractor.ts` | Contractor + RFP endpoints |
| Workflows | `awardQuoteWorkflow.ts`, `submitQuoteWorkflow.ts`, `rfpDirectAssignWorkflow.ts`, `rfpReinviteWorkflow.ts` | |
| Service | `services/rfps.ts` | RFP logic |
| Repo | `repositories/rfpRepository.ts` | RFP data access |

### Cashflow Planning
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/cashflowPlans.ts` | List, create, update, submit, approve, RFP candidate generation and creation |
| Workflow | `workflows/cashflowPlanWorkflow.ts` | `createPlanWorkflow`, `updatePlanWorkflow`, `addOverrideWorkflow`, `removeOverrideWorkflow`, `submitPlanWorkflow`, `approvePlanWorkflow` |
| Service | `services/cashflowPlanningService.ts` | `computeMonthlyCashflow()`, `computeRfpCandidates()` |
| Service | `services/capexProjectionService.ts` | CapEx projection + timing recommendations (shared) |
| Repo | `repositories/cashflowPlanRepository.ts` | `CASHFLOW_PLAN_INCLUDE`, CashflowPlan / CashflowOverride data access |
| Repo | `repositories/taxRuleRepository.ts` | TaxRule / TaxRuleVersion data access |
| Note | Status flow: DRAFT → SUBMITTED → APPROVED. RFP candidates only available for APPROVED plans. |  |

### Rental Applications
| Layer | File | Key exports |
|-------|------|-------------|
| Route | `routes/rentalApplications.ts` | Application CRUD |
| Workflow | `submitRentalApplicationWorkflow.ts` | DRAFT → SUBMITTED |
| Service | `services/rentalApplications.ts` | Application logic |
| Service | `services/ownerSelection.ts` | Per-unit selection status |
| Service | `services/rentalSelectionService.ts` | Selection workflow |
| Repo | `repositories/rentalApplicationRepository.ts` | Application data access |
| Includes | `services/rentalIncludes.ts` | Shared include constants |

---

## 3 · Route Module Index (21 files)

| File | Domain |
|------|--------|
| `routes/auth.ts` | Login, registration |
| `routes/captureSessions.ts` | Capture sessions |
| `routes/cashflowPlans.ts` | Cashflow planning — list, create, update, submit, approve, RFP candidates |
| `routes/coa.ts` | Chart of Accounts (7 endpoints) |
| `routes/completion.ts` | Job completion + rating |
| `routes/config.ts` | Org + building config |
| `routes/contractor.ts` | Contractor profiles + RFPs |
| `routes/financials.ts` | Financial summaries |
| `routes/helpers.ts` | Shared route utilities |
| `routes/inventory.ts` | Assets, depreciation, repair-replace |
| `routes/invoices.ts` | Invoice CRUD + lifecycle |
| `routes/leases.ts` | Lease CRUD + expense items |
| `routes/ledger.ts` | Journal entries, trial balance |
| `routes/legal.ts` | Legal variables, rules, mappings |
| `routes/maintenanceAttachments.ts` | File attachments |
| `routes/notifications.ts` | Notification endpoints |
| `routes/rentEstimation.ts` | Rent estimation |
| `routes/rentalApplications.ts` | Rental applications |
| `routes/requests.ts` | Maintenance requests |
| `routes/scheduling.ts` | Scheduling |
| `routes/tenants.ts` | Tenant portal |

## 4 · Repository Index (20 files)

| File | Include constant | Entity |
|------|-----------------|--------|
| `requestRepository.ts` | `REQUEST_FULL_INCLUDE` | Request |
| `jobRepository.ts` | `JOB_FULL_INCLUDE` | Job |
| `invoiceRepository.ts` | `INVOICE_FULL_INCLUDE` | Invoice |
| `leaseRepository.ts` | `LEASE_FULL_INCLUDE` | Lease |
| `contractorRepository.ts` | `CONTRACTOR_INCLUDE` | Contractor |
| `inventoryRepository.ts` | — | Appliance / AssetIntervention |
| `assetRepository.ts` | — | AssetModel |
| `rfpRepository.ts` | — | Rfp / RfpQuote |
| `rentalApplicationRepository.ts` | — | RentalApplication |
| `captureSessionRepository.ts` | — | CaptureSession |
| `legalSourceRepository.ts` | — | LegalSource |
| `schedulingRepository.ts` | — | ScheduledMaintenance |
| `ratingRepository.ts` | — | CompletionRating |
| `maintenanceAttachmentRepo.ts` | — | MaintenanceAttachment |
| `expenseTypeRepository.ts` | — | ExpenseType |
| `accountRepository.ts` | — | Account |
| `expenseMappingRepository.ts` | — | ExpenseMapping |
| `cashflowPlanRepository.ts` | `CASHFLOW_PLAN_INCLUDE` | CashflowPlan / CashflowOverride |
| `taxRuleRepository.ts` | — | TaxRule / TaxRuleVersion |

## 5 · Workflow Index (25 workflows)

| Workflow | Entity | Transition |
|----------|--------|------------|
| `createRequestWorkflow` | Request | → PENDING_REVIEW / AUTO_APPROVED |
| `approveRequestWorkflow` | Request | PENDING → APPROVED |
| `assignContractorWorkflow` | Request | → ASSIGNED |
| `unassignContractorWorkflow` | Request | ASSIGNED → previous |
| `ownerRejectWorkflow` | Request | → OWNER_REJECTED |
| `evaluateLegalRoutingWorkflow` | Request | → RFP_PENDING |
| `uploadMaintenanceAttachmentWorkflow` | Request | (attachment) |
| `completeJobWorkflow` | Job | → COMPLETED |
| `completionRatingWorkflow` | Job | (rating) |
| `schedulingWorkflow` | Job | (scheduling) |
| `updateJobWorkflow` | Job | (update) |
| `issueInvoiceWorkflow` | Invoice | → ISSUED |
| `approveInvoiceWorkflow` | Invoice | → APPROVED |
| `disputeInvoiceWorkflow` | Invoice | → DISPUTED |
| `payInvoiceWorkflow` | Invoice | → PAID |
| `tenantSelfPayWorkflow` | Invoice | (tenant pay) |
| `markLeaseReadyWorkflow` | Lease | DRAFT → READY_TO_SIGN |
| `activateLeaseWorkflow` | Lease | SIGNED → ACTIVE |
| `terminateLeaseWorkflow` | Lease | ACTIVE → TERMINATED |
| `submitRentalApplicationWorkflow` | RentalApp | DRAFT → SUBMITTED |
| `awardQuoteWorkflow` | Rfp | → AWARDED |
| `submitQuoteWorkflow` | RfpQuote | (submit) |
| `rfpDirectAssignWorkflow` | Rfp | (direct assign) |
| `rfpReinviteWorkflow` | Rfp | (re-invite) |
| `cashflowPlanWorkflow` | CashflowPlan | DRAFT → SUBMITTED → APPROVED |

Support files: `workflows/transitions.ts` (guards), `workflows/context.ts` (WorkflowContext type)

---

## 6 · Transition Maps

### Request
```
PENDING_REVIEW → RFP_PENDING | PENDING_OWNER_APPROVAL
RFP_PENDING → AUTO_APPROVED | PENDING_OWNER_APPROVAL | ASSIGNED
PENDING_OWNER_APPROVAL → APPROVED | RFP_PENDING | OWNER_REJECTED
AUTO_APPROVED → ASSIGNED | IN_PROGRESS
APPROVED → ASSIGNED | IN_PROGRESS
ASSIGNED → IN_PROGRESS | COMPLETED
IN_PROGRESS → COMPLETED
COMPLETED → (terminal)
OWNER_REJECTED → RFP_PENDING (tenant self-pay path)
```
Key fields: `approvalSource` (SYSTEM_AUTO | OWNER_APPROVED | OWNER_REJECTED | LEGAL_OBLIGATION), `rejectionReason` (String?)

### Job
```
PENDING → IN_PROGRESS | COMPLETED
IN_PROGRESS → COMPLETED
COMPLETED → INVOICED
INVOICED → (terminal)
```

### Invoice
```
DRAFT → ISSUED | APPROVED
ISSUED → APPROVED | DISPUTED
APPROVED → PAID | DISPUTED
DISPUTED → APPROVED | DRAFT
PAID → (terminal)
```

### Lease
```
DRAFT → READY_TO_SIGN | CANCELLED
READY_TO_SIGN → SIGNED | CANCELLED
SIGNED → ACTIVE
ACTIVE → TERMINATED
TERMINATED / CANCELLED → (terminal)
```

### Rental Application
```
DRAFT → SUBMITTED → (terminal; per-unit status via ownerSelection)
```

---

## 7 · Architecture Notes (non-obvious)

**WorkflowContext** — every workflow takes `{ orgId, prisma, actorUserId? }` as first arg. Routes build it from `HandlerContext`. Workflows never import the singleton `prismaClient`.

**Repository pattern** — repos export canonical include constants (`XXX_FULL_INCLUDE`). All Prisma calls live here. DTO mappers use `Prisma.XGetPayload<{ include: typeof X_INCLUDE }>` — never `any`.

**Workflow rules** — typed `Input`/`Result` interfaces · transitions via `assert*Transition()` only · emit domain events · JSDoc header lists steps as numbered list.

**Schema gotchas** — `Request` has no `orgId` (scoped via unit→building FK chain) · `Job` has no `description` (use `Request.description`) · `Appliance` has no `category` (lives on `AssetModel`) · `Job.contractorId` is required

---

## 8 · Frontend Patterns

**Hub page (with tabs)** → copy `apps/web/pages/manager/_template_hub.js` · see F-UI1 in PROJECT_STATE.md
**Detail page (no tabs)** → copy `apps/web/pages/manager/_template_detail.js` · see F-UI2
**Content-rich layout** → see F-UI3 · visual reference: `legal/depreciation.js`