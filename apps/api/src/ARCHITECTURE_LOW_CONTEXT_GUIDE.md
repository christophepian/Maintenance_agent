# Low-Context Architecture Guide

> **Purpose:** A future agent (or developer) with no prior context should
> be able to read this file and know *exactly which 1-3 files to touch*
> for any given change.

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
PENDING_REVIEW → APPROVED | AUTO_APPROVED | PENDING_OWNER_APPROVAL | RFP_PENDING
AUTO_APPROVED → APPROVED | ASSIGNED | IN_PROGRESS | RFP_PENDING | PENDING_OWNER_APPROVAL
PENDING_OWNER_APPROVAL → APPROVED | PENDING_REVIEW
RFP_PENDING → APPROVED | IN_PROGRESS
APPROVED → ASSIGNED | IN_PROGRESS | COMPLETED
ASSIGNED → IN_PROGRESS | COMPLETED
IN_PROGRESS → COMPLETED
COMPLETED → (terminal)
```

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
