# Pending Implementation: Workflow Redesign

Captures every agreed decision from the tab redesign + hardening session.
Pick up from here in the next session — implement in the order listed.

---

## Context

Two sessions of design + implementation produced:
- `IN_PROGRESS` removed from `RequestStatus`; execution state lives on `Job`
- `Job` is now included in all request DTOs (`REQUEST_FULL_INCLUDE`, `REQUEST_SUMMARY_INCLUDE`)
- `completeJobWorkflow` mirrors `Request.status = COMPLETED` when job completes
- `contractorRequests.ts` writes to `Job.status`, not `Request.status` directly
- Tab structure was partially redesigned but still has three open issues (below)

The three remaining issues are:

1. **AUTO_APPROVED path must be killed** — no such thing as cost-estimated auto-approval at creation; threshold check only happens at quote award time.
2. **APPROVED → ASSIGNED partial write** (gap 4) — two unatomic writes; request can get stuck at `APPROVED` with no tab to find it.
3. **Job.COMPLETED → Request.COMPLETED mirror is swallowed** (gap 7) — try-catch only logs a warning; silent failure leaves request stuck at `ASSIGNED` instead of `COMPLETED`.

Implement in this order: **1 → 2 → 3 → 4 (tab + UI changes)**.

---

## 1. Kill AUTO_APPROVED

### Decision
- DB is test data — wipe and reset.
- `AUTO_APPROVED` no longer belongs in the workflow. The threshold check belongs at quote-award time only, which `awardQuoteWorkflow` already does correctly.

### Files to change

#### `apps/api/prisma/schema.prisma`
Find the `RequestStatus` enum and remove `AUTO_APPROVED`:

```prisma
// BEFORE
enum RequestStatus {
  PENDING_REVIEW
  AUTO_APPROVED
  APPROVED
  RFP_PENDING
  COMPLETED
  ASSIGNED
  PENDING_OWNER_APPROVAL
  REJECTED
}

// AFTER
enum RequestStatus {
  PENDING_REVIEW
  APPROVED
  RFP_PENDING
  COMPLETED
  ASSIGNED
  PENDING_OWNER_APPROVAL
  REJECTED
}
```

After editing schema, wipe the DB and re-run migrations:
```bash
# From apps/api
npx prisma migrate reset --force   # wipes DB + re-applies all migrations
```

If `migrate reset` is unavailable (non-interactive), do:
```bash
npx prisma db push --force-reset
```

#### `apps/api/src/workflows/transitions.ts`
Remove the `AUTO_APPROVED` entry from `VALID_REQUEST_TRANSITIONS`:

```typescript
// REMOVE this block entirely:
[RequestStatus.AUTO_APPROVED]: [
  RequestStatus.ASSIGNED,
],

// Also remove AUTO_APPROVED from RFP_PENDING's allowed targets:
[RequestStatus.RFP_PENDING]: [
  RequestStatus.AUTO_APPROVED,             // ← DELETE THIS LINE
  RequestStatus.PENDING_OWNER_APPROVAL,
  RequestStatus.ASSIGNED,
],
```

Final `RFP_PENDING` entry:
```typescript
[RequestStatus.RFP_PENDING]: [
  RequestStatus.PENDING_OWNER_APPROVAL,    // awarded quote > threshold
  RequestStatus.ASSIGNED,                  // direct assignment / quote awarded under threshold
],
```

#### `apps/api/src/workflows/awardQuoteWorkflow.ts`
The `SYSTEM_AUTO` approvalSource write is already collapsed to a single write (done in the previous session). No change needed here.

Verify line ~248 looks like this (not the old two-write pattern):
```typescript
if (canTransitionRequest(reqStatus, RequestStatus.ASSIGNED)) {
  await updateRequestStatus(prisma, rfp.requestId, RequestStatus.ASSIGNED, {
    approvalSource: "SYSTEM_AUTO" as any,
  });
}
```

#### Delete `apps/api/src/services/autoApproval.ts`
This entire file should be deleted. Its logic (cost threshold check at creation) is replaced by the threshold check at quote award time in `awardQuoteWorkflow`.

Check whether it is imported anywhere first:
```bash
grep -r "autoApproval" apps/api/src --include="*.ts"
```
Remove any import that references it.

#### `apps/web/pages/manager/requests.js`
Remove the `AUTO_APPROVED` / `Direct Approval` tab from `STATUS_TABS`. See section 4 below for the full revised tab array.

---

## 2. Fix APPROVED → ASSIGNED Partial Write (Gap 4)

### Problem
In `approveRequestWorkflow.ts` (path 4B, owner approval), the code does:
```typescript
// Step 1
await updateRequestStatus(prisma, requestId, RequestStatus.APPROVED, { ... });

// Step 2 — if this throws, request is stuck at APPROVED forever
await awardQuoteWorkflow(ctx, { rfpId, quoteId, actorRole: "OWNER" });
// awardQuoteWorkflow internally writes ASSIGNED
```

`APPROVED` has no tab in the agreed tab structure. A crash between these two writes
makes the request invisible.

### Fix: wrap in a transaction

The cleanest fix is to make the `APPROVED` intermediate state not visible at all by
running both status writes inside a Prisma interactive transaction.

`awardQuoteWorkflow` currently accepts `WorkflowContext` which carries `ctx.prisma`.
Prisma interactive transactions give you a `tx` client. Pass `tx` as the prisma
client to both calls.

**`apps/api/src/workflows/approveRequestWorkflow.ts`**, path 4B, replace:

```typescript
// BEFORE (lines ~140–162):
await updateRequestStatus(prisma, requestId, RequestStatus.APPROVED, {
  approvalSource: ApprovalSource.OWNER_APPROVED,
});

let jobAutoCreated = false;
try {
  const pendingRfp = await prisma.rfp.findFirst({ ... });
  if (pendingRfp?.awardedQuoteId) {
    await awardQuoteWorkflow(ctx, { rfpId: pendingRfp.id, quoteId: pendingRfp.awardedQuoteId, actorRole: "OWNER" });
    jobAutoCreated = true;
  }
} catch (rfpErr: any) {
  console.warn(`[approve] RFP award completion failed for ${requestId}:`, rfpErr.message);
}
```

```typescript
// AFTER:
let jobAutoCreated = false;
try {
  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { status: RequestStatus.APPROVED, approvalSource: ApprovalSource.OWNER_APPROVED },
    });

    const pendingRfp = await tx.rfp.findFirst({
      where: { requestId, status: RfpStatus.PENDING_OWNER_APPROVAL },
      select: { id: true, awardedQuoteId: true },
    });

    if (pendingRfp?.awardedQuoteId) {
      // awardQuoteWorkflow must receive tx as its prisma client so all writes
      // are inside the same transaction.
      await awardQuoteWorkflow(
        { ...ctx, prisma: tx as unknown as PrismaClient },
        { rfpId: pendingRfp.id, quoteId: pendingRfp.awardedQuoteId, actorRole: "OWNER" },
      );
      jobAutoCreated = true;
    }
  });
} catch (rfpErr: any) {
  // Throw — the caller needs to know the owner approval failed
  throw Object.assign(
    new Error(`Owner approval failed: ${rfpErr.message}`),
    { code: "OWNER_APPROVAL_FAILED" },
  );
}
```

**Important**: `awardQuoteWorkflow` internally calls `emit()` (fire-and-forget) and
`createNotification()`. These are outside the DB and will not be rolled back if the
transaction rolls back. This is acceptable — they are observability side effects, not
business state. If the transaction rolls back, no status change will have persisted,
so the notifications will refer to an event that didn't fully complete. Add a comment
noting this limitation.

**Belt-and-suspenders (frontend)**: As a safety net, include `APPROVED` in the
"In Progress" tab filter (see section 4). Even if the transaction approach fails
for some reason, `APPROVED` requests will be visible rather than hidden.

---

## 3. Harden Job.COMPLETED → Request.COMPLETED Mirror (Gap 7)

### Problem

`completeJobWorkflow.ts` (step 4) has:
```typescript
// CURRENT (line ~68–79):
if (updated.requestId) {
  try {
    const req = await ctx.prisma.request.findUnique({ ... });
    if (req?.status === RequestStatus.ASSIGNED) {
      await updateRequestStatus(ctx.prisma, updated.requestId, RequestStatus.COMPLETED);
    }
  } catch (err) {
    console.warn("[completeJobWorkflow] Failed to propagate COMPLETED to Request:", err);
  }
}
```

The swallowed catch means: Job = COMPLETED, Request = ASSIGNED. The request
stays in the "In Progress" tab permanently, invisible in "Done."

The same pattern exists in `contractorRequests.ts` (`updateContractorRequestStatus`):
```typescript
// Line ~152–157:
if (targetJobStatus === JobStatus.COMPLETED && request.status === RequestStatus.ASSIGNED) {
  await prisma.request.update({
    where: { id: requestId },
    data: { status: RequestStatus.COMPLETED },
  });
}
```
This one does NOT have a try-catch (it will throw naturally), which is actually correct.
No change needed here.

### Fix A: Make the mirror atomic in completeJobWorkflow (primary)

Wrap the Job update + Request status update in a single `$transaction`.
Move the event emission and invoice creation outside the transaction (they are
side effects that can fail independently without invalidating the completion itself).

**`apps/api/src/workflows/completeJobWorkflow.ts`** — replace steps 3 and 4:

```typescript
// BEFORE (steps 3 + 4 separately):
const updated = await updateJob(jobId, {
  status: JobStatus.COMPLETED,
  actualCost,
  startedAt: startedAt ? new Date(startedAt) : undefined,
  completedAt: completedAt ? new Date(completedAt) : new Date(),
});

if (updated.requestId) {
  try {
    const req = await ctx.prisma.request.findUnique({ ... });
    if (req?.status === RequestStatus.ASSIGNED) {
      await updateRequestStatus(ctx.prisma, updated.requestId, RequestStatus.COMPLETED);
    }
  } catch (err) {
    console.warn("[completeJobWorkflow] Failed to propagate COMPLETED to Request:", err);
  }
}
```

```typescript
// AFTER (atomic):
const completedAt_date = completedAt ? new Date(completedAt) : new Date();

const updated = await ctx.prisma.$transaction(async (tx) => {
  // 3a. Update Job
  const updatedJob = await tx.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      ...(actualCost !== undefined && { actualCost }),
      ...(startedAt && { startedAt: new Date(startedAt) }),
      completedAt: completedAt_date,
    },
    // include whatever updateJob normally returns — replicate its select
    select: {
      id: true,
      orgId: true,
      requestId: true,
      contractorId: true,
      status: true,
      actualCost: true,
      startedAt: true,
      completedAt: true,
    },
  });

  // 3b. Mirror COMPLETED onto the parent Request
  if (updatedJob.requestId) {
    const req = await tx.request.findUnique({
      where: { id: updatedJob.requestId },
      select: { status: true },
    });
    if (req?.status === RequestStatus.ASSIGNED) {
      await tx.request.update({
        where: { id: updatedJob.requestId },
        data: { status: RequestStatus.COMPLETED },
      });
    }
  }

  return updatedJob;
});
```

After this, the `updated` variable has the same shape. The rest of the function
(invoice auto-creation, event emission) continues unchanged outside the transaction.

**Note on `updateJob` service function**: `updateJob` in `services/jobs.ts` is a
wrapper around a `prisma.job.update`. The transaction version above duplicates its
logic inline. The alternative is to make `updateJob` accept a transaction client
(`tx | PrismaClient`). Either approach works — inline is simpler and avoids
refactoring the jobs service.

### Fix B: Belt-and-suspenders frontend filter (secondary)

In `apps/web/pages/manager/requests.js`, the Done tab filter currently matches only
`request.status === "COMPLETED"`. Add a secondary condition:

```javascript
// In the STATUS_TABS definition or wherever tab filtering happens:
{
  key: "DONE",
  label: "Done",
  statuses: ["COMPLETED"],
  // Secondary filter: catches mirror-lag edge cases
  extraFilter: (r) => r.status === "COMPLETED" ||
    (r.status === "ASSIGNED" && r.job?.status === "COMPLETED"),
}
```

The exact implementation depends on how `STATUS_TABS` is consumed in the filter
logic. If filtering is done via `statuses.includes(r.status)`, you need a custom
`extraFilter` field (or fold the logic into the filtering function). See section 4
for where this fits in the tab array.

---

## 4. Tab Redesign + Status Column Labels

### Agreed tab structure (chronological, left to right)

| Tab key | Label | Request statuses shown | Notes |
|---|---|---|---|
| `ALL` | Overview | ALL | |
| `PENDING` | Pending Review | `PENDING_REVIEW` | Legal engine uncertain; manager must triage |
| `RFP_OPEN` | RFP Open | `RFP_PENDING` | Active RFP collecting quotes. Tenant-funded badge on rows where `payingParty = TENANT` |
| `OWNER_APPROVAL` | Pending Owner Approval | `PENDING_OWNER_APPROVAL` | Quote exceeds building threshold; only owner can advance |
| `IN_PROGRESS` | In Progress | `APPROVED`, `ASSIGNED` | `APPROVED` folded here as gap-4 safety net |
| `DONE` | Done | `COMPLETED` (+ secondary filter: `ASSIGNED` + `job.status = COMPLETED`) | Work done; invoice handled in finance |
| `REJECTED` | Rejected | `REJECTED` | Terminal; goes last (reachable from multiple points) |
| `RFPS` | RFPs | — | Link to `/manager/rfps` |

### STATUS_TABS replacement in `apps/web/pages/manager/requests.js`

Replace the current `STATUS_TABS` array with:

```javascript
const STATUS_TABS = [
  {
    key:      "ALL",
    label:    "Overview",
    statuses: null,
  },
  {
    key:      "PENDING",
    label:    "Pending Review",
    statuses: ["PENDING_REVIEW"],
  },
  {
    key:      "RFP_OPEN",
    label:    "RFP Open",
    statuses: ["RFP_PENDING"],
  },
  {
    key:      "OWNER_APPROVAL",
    label:    "Pending Owner Approval",
    statuses: ["PENDING_OWNER_APPROVAL"],
  },
  {
    key:      "IN_PROGRESS",
    label:    "In Progress",
    statuses: ["APPROVED", "ASSIGNED"],
  },
  {
    key:      "DONE",
    label:    "Done",
    statuses: ["COMPLETED"],
    // Applied in addition to statuses match:
    extraFilter: (r) =>
      r.status === "COMPLETED" ||
      (r.status === "ASSIGNED" && r.job?.status === "COMPLETED"),
  },
  {
    key:      "REJECTED",
    label:    "Rejected",
    statuses: ["REJECTED"],
  },
  {
    key:   "RFPS",
    label: "RFPs",
    statuses: null,
    href: "/manager/rfps",
  },
];
```

If `extraFilter` isn't supported by the current tab-filtering logic, update the
filtering function (wherever `tab.statuses.includes(r.status)` is called) to also
check `tab.extraFilter?.(r)`.

### Status column labels (replaces raw DB enum names)

The status column in each table row should show human labels, not DB enum values.
Map as follows (derive `jobStatus` from `r.job?.status`):

| `r.status` | `r.job?.status` | Display label | Color/variant |
|---|---|---|---|
| `PENDING_REVIEW` | — | Pending Review | yellow |
| `RFP_PENDING` | — | RFP Open | blue |
| `PENDING_OWNER_APPROVAL` | — | Awaiting Owner | orange |
| `APPROVED` | — | Approved | blue |
| `ASSIGNED` | `PENDING` | Assigned — awaiting start | blue |
| `ASSIGNED` | `IN_PROGRESS` | Work underway | green |
| `ASSIGNED` | `COMPLETED` | Work done | green (transient mirror lag) |
| `COMPLETED` | `COMPLETED` | Completed | green |
| `COMPLETED` | `INVOICED` | Completed | green |
| `REJECTED` | — | Rejected | red |

Implement as a `getStatusLabel(request)` helper in `requests.js`:

```javascript
function getStatusLabel(r) {
  if (r.status === "PENDING_REVIEW")        return { label: "Pending Review",         variant: "warning" };
  if (r.status === "RFP_PENDING")           return { label: "RFP Open",               variant: "info"    };
  if (r.status === "PENDING_OWNER_APPROVAL")return { label: "Awaiting Owner Approval", variant: "warning" };
  if (r.status === "APPROVED")              return { label: "Approved",                variant: "info"    };
  if (r.status === "ASSIGNED") {
    const js = r.job?.status;
    if (js === "IN_PROGRESS") return { label: "Work underway",         variant: "success" };
    if (js === "COMPLETED" || js === "INVOICED") return { label: "Work done", variant: "success" };
    return { label: "Assigned",                variant: "info" };
  }
  if (r.status === "COMPLETED")             return { label: "Completed",               variant: "success" };
  if (r.status === "REJECTED")              return { label: "Rejected",                variant: "danger"  };
  return { label: r.status, variant: "default" };
}
```

### Tenant-funded badge

In the RFP Open tab rows, show a "Tenant-funded" badge when `r.payingParty === "TENANT"`.
The `payingParty` field already exists on the request record. Verify it is included in
the DTO (check `REQUEST_FULL_INCLUDE` in `requestRepository.ts` — add if missing).

---

## 5. Tests to Update / Add

After the above changes, the following test areas need attention:

- **`completeJobWorkflow` tests**: assert that `Request.status` becomes `COMPLETED` when
  `Job.status` transitions to `COMPLETED`. These tests may be in `completeJobWorkflow.test.ts`.
  The transaction change should not affect the observable outcome, only atomicity.

- **`approveRequestWorkflow` tests (owner path)**: assert that `APPROVED` intermediate state
  is never observable (the transaction commits atomically to `ASSIGNED`).

- **`transitions.ts` tests**: remove any test that asserts `AUTO_APPROVED` is a valid
  transition target or source.

- **Tab filter logic**: if there are frontend unit tests for the tab filtering, update them
  to reflect the new `STATUS_TABS` shape.

---

## 6. Quick Reference: Final Request Status Lifecycle

```
[Created] → PENDING_REVIEW
                │
                ├── Legal engine: OBLIGATED ──────────────────────────────┐
                │                                                          │
                └── Legal engine: uncertain / not found                   │
                         │                                                 │
                    [Manager triages]                                      │
                         │                                                 ▼
                    Manager approves ──────────────────────────────→ RFP_PENDING
                    Manager rejects ──→ REJECTED                          │
                                                                    [RFP collects quotes]
                                                                          │
                                                    Quote submitted; awardQuoteWorkflow runs
                                                          │
                                          ┌───────────────┴──────────────────────┐
                                          │                                       │
                                   quote ≤ threshold                      quote > threshold
                                          │                                       │
                                        ASSIGNED                      PENDING_OWNER_APPROVAL
                                    (approvalSource:                              │
                                     SYSTEM_AUTO)                     [Owner approves/rejects]
                                          │                                │         │
                                          │                           APPROVED    REJECTED
                                          │                                │
                                          │                             ASSIGNED
                                          │                          (approvalSource:
                                          │                           OWNER_APPROVED)
                                          │
                                  [Job: PENDING → IN_PROGRESS → COMPLETED]
                                          │
                                       COMPLETED  (Done tab)
```

`REJECTED` is reachable from: `PENDING_REVIEW`, `PENDING_OWNER_APPROVAL`, `ASSIGNED`.
`REJECTED → RFP_PENDING` is the tenant self-pay re-entry path.
