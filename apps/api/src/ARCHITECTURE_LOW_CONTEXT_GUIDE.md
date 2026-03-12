# Low-Context Architecture Guide

> **Purpose:** A future agent (or developer) with no prior context should
> be able to read this file and know *exactly which 1-3 files to touch*
> for any given change.

**Codebase:** 46 models · 38 enums · 35 migrations · 17 workflows · 10 repositories · ~36k backend LOC · ~25k frontend LOC

---

## Layer Diagram

```
┌─────────────┐
│   routes/    │  Thin HTTP glue: parse params → build WorkflowContext → call workflow → send response
├─────────────┤
│  workflows/  │  Business orchestration: sequence of service calls, transition guards, event emission
├─────────────┤
│  services/   │  Domain logic: DTO mapping, business rules, complex calculations
├─────────────┤
│ repositories/│  Data access: Prisma queries, canonical includes, org-scoping
├─────────────┤
│   events/    │  Side-effects: async event bus, notification triggers
└─────────────┘
```

**Rule:** Each layer only calls the layer directly below it.
Routes → Workflows → Services → Repositories → Prisma.

---

## Where to Change Things

### "I need to change a status transition rule"
→ **`src/workflows/transitions.ts`** — the `VALID_*_TRANSITIONS` maps.
Every status change in the system passes through `assert*Transition()`.

### "I need to add a new field to the Request/Job/Invoice API response"
1. Add column to **`prisma/schema.prisma`** + run migration
2. Update the **include constant** in the relevant repository:
   - `src/repositories/requestRepository.ts` → `REQUEST_FULL_INCLUDE`
   - `src/repositories/jobRepository.ts` → `JOB_FULL_INCLUDE`
   - `src/repositories/invoiceRepository.ts` → `INVOICE_FULL_INCLUDE`
3. Update the **DTO mapper** in the relevant service:
   - `src/services/maintenanceRequests.ts` → `toDTO()`
   - `src/services/jobs.ts` → `mapJobToDTO()`
   - `src/services/invoices.ts` → `mapInvoiceToDTO()`

### "I need to add a new HTTP endpoint"
1. Add the route handler in the appropriate file under **`src/routes/`**
2. If it mutates state, create or use an existing **workflow** in `src/workflows/`
3. If the workflow needs new data queries, add them to the relevant **repository**

### "I need to add a new business action (e.g., cancel a request)"
1. Create **`src/workflows/cancelRequestWorkflow.ts`** with:
   - Explicit `Input` and `Result` types at the top
   - Transition guard via `assertRequestTransition()`
   - Service delegation
   - Event emission via `emit()`
   - Canonical reload + DTO return
2. Add transition rule to **`src/workflows/transitions.ts`**
3. Export from **`src/workflows/index.ts`**
4. Wire into the relevant route handler

### "I need to change how auto-approval works"
→ **`src/services/autoApproval.ts`** — `decideRequestStatusWithRules()`
→ Used by `src/workflows/createRequestWorkflow.ts` step 2

### "I need to change the legal auto-routing logic"
→ **`src/services/legalDecisionEngine.ts`** — `evaluateRequestLegalDecision()`
→ Used by `src/workflows/createRequestWorkflow.ts` step 6
→ And `src/workflows/evaluateLegalRoutingWorkflow.ts`

### "I need to change how contractor matching works"
→ **`src/services/requestAssignment.ts`** — `findMatchingContractor()`, `assignContractor()`

### "I need to change invoice financial calculations (VAT, line items)"
→ **`src/services/invoices.ts`** — `normalizeLineItems()`, `summarizeTotals()`

### "I need to change org/building configuration"
→ **`src/services/orgConfig.ts`** — `getOrgConfig()`
→ **`src/services/buildingConfig.ts`** — `computeEffectiveConfig()`

### "I need to add a new domain event handler"
→ **`src/events/bus.ts`** — event emission
→ **`src/events/handlers/`** — add new handler file

---

## Workflow Pattern (Template)

Every workflow follows this structure:

```typescript
// src/workflows/doSomethingWorkflow.ts

import { WorkflowContext } from "./context";
import { assertXxxTransition } from "./transitions";
import { emit } from "../events/bus";

// ─── Input / Output (explicit, exported) ───────
export interface DoSomethingInput { ... }
export interface DoSomethingResult { ... }

// ─── Workflow ──────────────────────────────────
export async function doSomethingWorkflow(
  ctx: WorkflowContext,
  input: DoSomethingInput,
): Promise<DoSomethingResult> {
  // 1. Fetch + validate (via repository)
  // 2. Transition guard (via transitions.ts)
  // 3. Business logic (via service calls)
  // 4. Emit domain event (best-effort)
  // 5. Canonical reload + DTO return
}
```

---

## Repository Pattern

```typescript
// src/repositories/xxxRepository.ts

import { PrismaClient } from "@prisma/client";

// Canonical includes (single source of truth for DTO shape)
export const XXX_FULL_INCLUDE = { ... } as const;
export const XXX_SUMMARY_INCLUDE = { ... } as const;

// All functions take `prisma: PrismaClient` as first arg (injectable)
export async function findXxxById(prisma: PrismaClient, id: string) { ... }
export async function findXxxsByOrg(prisma: PrismaClient, opts: ListOpts) { ... }
```

**Key:** Repositories are the *only* place raw Prisma calls live.
Services and workflows never call `prisma.xxx.findUnique()` directly.

---

## Context Object

```typescript
interface WorkflowContext {
  orgId: string;        // Resolved from auth/route
  prisma: PrismaClient; // Injectable (for testing)
  actorUserId?: string | null; // For audit trail
}
```

Routes build `WorkflowContext` from `HandlerContext` and pass it into workflows.

---

## File Index

| File | Purpose |
|------|---------|
| `workflows/transitions.ts` | State transition maps + guards |
| `workflows/context.ts` | WorkflowContext type |
| `workflows/createRequestWorkflow.ts` | Create maintenance request |
| `workflows/approveRequestWorkflow.ts` | Approve request (manager + owner) |
| `workflows/assignContractorWorkflow.ts` | Assign contractor to request |
| `workflows/unassignContractorWorkflow.ts` | Remove contractor assignment |
| `workflows/completeJobWorkflow.ts` | Mark job completed |
| `workflows/issueInvoiceWorkflow.ts` | Issue (lock + number) invoice |
| `workflows/approveInvoiceWorkflow.ts` | Approve invoice |
| `workflows/disputeInvoiceWorkflow.ts` | Dispute invoice |
| `workflows/payInvoiceWorkflow.ts` | Mark invoice paid |
| `workflows/evaluateLegalRoutingWorkflow.ts` | Legal obligation evaluation |
| `repositories/requestRepository.ts` | Request data access |
| `repositories/jobRepository.ts` | Job data access |
| `repositories/invoiceRepository.ts` | Invoice data access |
| `services/maintenanceRequests.ts` | Request DTOs + business logic |
| `services/jobs.ts` | Job DTOs + CRUD |
| `services/invoices.ts` | Invoice DTOs + CRUD + financial logic |
| `services/autoApproval.ts` | Auto-approval rules engine |
| `services/legalDecisionEngine.ts` | Legal routing decisions |
| `services/requestAssignment.ts` | Contractor matching + assignment |
| `events/bus.ts` | Domain event bus |

---

## Transition Maps

### Request Lifecycle
```
PENDING_REVIEW → RFP_PENDING | PENDING_OWNER_APPROVAL
RFP_PENDING → AUTO_APPROVED | PENDING_OWNER_APPROVAL
PENDING_OWNER_APPROVAL → APPROVED | OWNER_REJECTED
AUTO_APPROVED → IN_PROGRESS
APPROVED → IN_PROGRESS
IN_PROGRESS → COMPLETED
COMPLETED → (terminal)
OWNER_REJECTED → (terminal)
```

**Key fields:**
- `approvalSource` (ApprovalSource?) — SYSTEM_AUTO | OWNER_APPROVED | OWNER_REJECTED | LEGAL_OBLIGATION
- `rejectionReason` (String?) — free-text reason when owner rejects

### Job Lifecycle
```
PENDING → IN_PROGRESS | COMPLETED
IN_PROGRESS → COMPLETED
COMPLETED → INVOICED
INVOICED → (terminal)
```

### Invoice Lifecycle
```
DRAFT → ISSUED | APPROVED
ISSUED → APPROVED | DISPUTED
APPROVED → PAID | DISPUTED
DISPUTED → APPROVED | DRAFT
PAID → (terminal)
```

### Lease Lifecycle
```
DRAFT → READY_TO_SIGN | CANCELLED
READY_TO_SIGN → SIGNED | CANCELLED
SIGNED → ACTIVE
ACTIVE → TERMINATED
TERMINATED → (terminal)
CANCELLED → (terminal)
```

### Rental Application Lifecycle
```
DRAFT → SUBMITTED
SUBMITTED → (terminal; per-unit status managed by ownerSelection)
```

---

## Workflow Conventions

Every workflow is a single async function that orchestrates one business
action.  It lives in `workflows/<name>Workflow.ts` and is the **only**
entry point for that action from route handlers.

### File Structure (canonical template)

```typescript
/**
 * <name>Workflow
 *
 * Canonical entry point for <action description>.
 * Orchestrates:
 *   1. Fetch entity + org ownership check
 *   2. Assert state transition is valid
 *   3. Persist changes (via repository)
 *   4. Emit domain event
 *   5. Return typed result
 */

import { WorkflowContext } from "./context";
import { assert<Entity>Transition } from "./transitions";
import { emit } from "../events/bus";
// ... repository + service imports

// ─── Input / Output ────────────────────────────────────────────

export interface <Name>Input { ... }
export interface <Name>Result { dto: <EntityDTO>; }

// ─── Workflow ──────────────────────────────────────────────────

export async function <name>Workflow(
  ctx: WorkflowContext,
  input: <Name>Input,
): Promise<<Name>Result> {
  // Steps 1–5 ...
}
```

### Rules

| Rule | Description |
|------|-------------|
| **W1** | Every workflow has typed `Input` and `Result` interfaces. |
| **W2** | First parameter is always `WorkflowContext { orgId, prisma, actorUserId? }`. |
| **W3** | State transitions use `assert*Transition()` from `transitions.ts` — never inline status checks. |
| **W4** | Persistence goes through repository functions, never direct `prisma.*` in the workflow (exception: transactions). |
| **W5** | Every state change emits a domain event via `emit()` (fire-and-forget with `.catch()`). |
| **W6** | Workflows never import the singleton `prismaClient` — they use `ctx.prisma`. |
| **W7** | Route handlers call workflows; workflows call repositories + services. |
| **W8** | JSDoc header lists orchestration steps as a numbered list. |

### Inventory (16 workflows)

| Workflow | Entity | Transition |
|----------|--------|------------|
| createRequestWorkflow | Request | → PENDING_REVIEW / AUTO_APPROVED |
| approveRequestWorkflow | Request | PENDING → APPROVED |
| assignContractorWorkflow | Request | → ASSIGNED |
| unassignContractorWorkflow | Request | ASSIGNED → previous |
| evaluateLegalRoutingWorkflow | Request | → RFP_PENDING |
| completeJobWorkflow | Job | → COMPLETED |
| issueInvoiceWorkflow | Invoice | → ISSUED |
| approveInvoiceWorkflow | Invoice | → APPROVED |
| disputeInvoiceWorkflow | Invoice | → DISPUTED |
| payInvoiceWorkflow | Invoice | → PAID |
| markLeaseReadyWorkflow | Lease | DRAFT → READY_TO_SIGN |
| activateLeaseWorkflow | Lease | SIGNED → ACTIVE |
| terminateLeaseWorkflow | Lease | ACTIVE → TERMINATED |
| submitRentalApplicationWorkflow | RentalApplication | DRAFT → SUBMITTED |

---

## Auth Helpers — `authz.ts`

| Helper | Roles / Use case |
|--------|------------------|
| `requireAuth(req, res)` | Any authenticated route — returns user or 401 |
| `maybeRequireManager(req, res)` | MANAGER or OWNER reads — returns false + 401/403 if fails |
| `requireRole(req, res, role)` | Single role enforcement — returns false + 403 if fails |
| `requireAnyRole(req, res, roles[])` | Multi-role — e.g. `['CONTRACTOR', 'MANAGER']` — returns false + 403 if fails |
| `requireTenantSession(req, res)` | Tenant-portal routes only — validates tenant JWT, returns `tenantId` string or null |
| `getOrgIdForRequest(req)` | Resolves orgId from auth context — returns `string \| null` — null in production when unauthenticated |

### Usage pattern
Every handler that calls an auth helper must check the return value and return early:
```typescript
if (!maybeRequireManager(req, res)) return;
// or
const tenantId = requireTenantSession(req, res);
if (!tenantId) return;
```

### Production boot guards
Server refuses to start (`process.exit(1)`) if any of the following are true in `NODE_ENV=production`:
- `AUTH_OPTIONAL=true`
- `DEV_IDENTITY_ENABLED=true`
- `AUTH_SECRET` not set

---

## Tenant Portal Auth

All `/tenant-portal/*` routes require a tenant JWT:
- Header: `Authorization: Bearer <token>`
- Token must have `role: TENANT` and `tenantId` claim
- Use `requireTenantSession(req, res)` — returns `tenantId` or null
- `POST /tenant-session` is the unauthenticated login entry point
- Do NOT accept `tenantId` as a query parameter on tenant-portal routes

---

## Security Rules

- Every route handler must have an explicit auth wrapper — no unauthenticated handlers except public entry points (`POST /tenant-session`, `GET /listings`, `POST /triage`)
- `maybeRequireManager` is for reads only — use `requireRole('MANAGER')` for all mutation routes
- `DEV_IDENTITY_ENABLED` headers (`x-dev-role`, `x-dev-org-id`, `x-dev-user-id`) are dev-only and blocked at boot in production
- `getOrgIdForRequest()` returns null in production for unauthenticated requests — always null-check at the call site
- Rental attachment downloads and document listings require manager auth — they contain PII
- Dev-only routes (`/dev/emails`, `/dev/*`) must have a production guard returning 404 before any logic runs