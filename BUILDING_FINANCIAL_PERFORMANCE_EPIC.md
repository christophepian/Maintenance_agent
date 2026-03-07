# Copilot Prompt — Epic: Building Financial Performance Engine

You are working in the monorepo described in `PROJECT_STATE.md`. Follow all guardrails **G1–G10** and hardening **H1–H6**.

---

## Critical Rules

- **Never** use `prisma db push`. Always use `npx prisma migrate dev --name <migration_name>`.

- After schema changes run:
  ```bash
  npx prisma migrate dev
  npx prisma migrate diff
  npx prisma generate
  ```

- Update all consumers when schema changes (**H4**):
  - Prisma schema
  - DTO interfaces
  - DTO mappers
  - Canonical include constants
  - OpenAPI specification
  - Typed API client (`packages/api-client`)
  - Contract tests

- DTO mappers must only access relations included in the query (**G3**).

- Use canonical includes (**G9**). No ad-hoc include trees.

- CI must remain green:
  - drift check
  - `prisma generate`
  - `tsc --noEmit`
  - `next build`
  - Jest tests
  - boot smoke tests

---

## Epic Goal

Implement a **Building Financial Performance Engine** that provides financial KPIs per building for a user-defined period.

This system must return:

- **earned income** (cash basis) — based on payments received
- **projected income** — expected rent from leases

> This is **asset performance analytics**, NOT accounting.

---

## Locked Design Decisions

### Income Model

Return two metrics:

- **`earnedIncomeCents`**
  - Sum of lease invoice payments where `paidAt` is within the period.

- **`projectedIncomeCents`**
  - Expected rent from leases overlapping the selected period.
  - Prorate for partial months if needed.

### Date Format

API must use ISO format:

```
from=YYYY-MM-DD
to=YYYY-MM-DD
```

The UI may display dates in `DD-MM-YYYY`, but must convert to ISO before calling the API.

### Period Semantics

- `from` **inclusive**
- `to` **exclusive**

Example:

```
from=2026-01-01
to=2026-02-01
```

Represents **January**.

---

## Expense Classification

Add enum:

```
ExpenseCategory
```

Values:

```
MAINTENANCE
UTILITIES
CLEANING
INSURANCE
TAX
ADMIN
CAPEX
OTHER
```

Add to `Invoice`:

```
expenseCategory  ExpenseCategory?
```

Rules:

- Invoices linked to Jobs/Requests are automatically treated as `MAINTENANCE`
- These invoices **cannot** be manually reclassified (return **409** if attempted)
- Non-job invoices can be categorized manually

---

## Financial Totals

Return the following totals (all in cents):

```
earnedIncomeCents
projectedIncomeCents
expensesTotalCents
maintenanceTotalCents
capexTotalCents
operatingTotalCents
netIncomeCents
netOperatingIncomeCents
```

Definitions:

- `expensesTotalCents` = sum(all expenses)
- `capexTotalCents` = sum(category == CAPEX)
- `operatingTotalCents` = expensesTotalCents − capexTotalCents
- `netIncomeCents` = earnedIncomeCents − expensesTotalCents
- `netOperatingIncomeCents` = earnedIncomeCents − operatingTotalCents

---

## Additional KPIs

Return:

```
maintenanceRatio
costPerUnitCents
collectionRate
```

Definitions:

- `maintenanceRatio` = maintenanceTotalCents / earnedIncomeCents
- `costPerUnitCents` = expensesTotalCents / activeUnitsCount
- `collectionRate` = earnedIncomeCents / projectedIncomeCents

> If denominators are zero → return `0`.

---

## Snapshot System (Monthly Cache)

Implement monthly financial snapshots.

**Purpose:**

- Accelerate dashboard queries
- Support historical analysis
- Enable caching

Snapshots act as a **cache** and can be recomputed.

### Prisma Model

Add model:

```prisma
model BuildingFinancialSnapshot {
  id          String   @id @default(uuid())
  orgId       String
  buildingId  String

  periodStart DateTime
  periodEnd   DateTime

  earnedIncomeCents       Int
  projectedIncomeCents    Int

  expensesTotalCents      Int
  maintenanceTotalCents   Int
  capexTotalCents         Int
  operatingTotalCents     Int

  netIncomeCents          Int
  netOperatingIncomeCents Int

  activeUnitsCount        Int

  computedAt DateTime
  createdAt  DateTime @default(now())
}
```

Migration name:

```
add_financial_snapshots_and_invoice_expense_category
```

### Snapshot Strategy

Snapshots exist **per building per month**.

Service behavior:

1. Break requested `[from, to)` period into month buckets.
2. For each month:
   - If snapshot exists → use it
   - If missing → compute and store snapshot
3. Sum monthly snapshots to return result.

### Snapshot Refresh

API supports:

```
forceRefresh=true
```

When true:

- Recompute snapshots for all months in the range
- Overwrite existing snapshot rows

UI must expose a **Refresh** button that triggers this.

---

## Backend Implementation

### Service

Create service:

```
apps/api/src/services/financials.ts
```

Main function:

```ts
getBuildingFinancials(orgId, buildingId, { from, to, forceRefresh })
```

Responsibilities:

1. Validate building exists
2. Enforce org scoping
3. Break range into months
4. Load or recompute snapshots
5. Aggregate monthly results
6. Return DTO

### Expense Aggregations

Also compute:

```
expensesByCategory[]
topContractorsBySpend[]
```

Structures:

```ts
{ category, totalCents }
{ contractorId, contractorName, totalCents }
```

Contractor spend uses maintenance invoices linked to jobs.

---

## API Routes

Create new route file:

```
apps/api/src/routes/financials.ts
```

Register in `server.ts`.

### Endpoint 1

```
GET /buildings/:id/financials
```

Query parameters:

- `from`
- `to`
- `forceRefresh`

Protected with:

- `withAuthRequired`

Must enforce org scope.

Returns:

```
BuildingFinancialsDTO
```

### Endpoint 2

```
POST /invoices/:id/set-expense-category
```

Body:

```json
{
  "expenseCategory": "UTILITIES"
}
```

Rules:

- Only managers (and optionally owners)
- Reject job-linked invoices (**409**)
- Enforce org scope

---

## DTOs

Add DTOs:

```
BuildingFinancialsDTO
ExpenseCategoryTotalDTO
ContractorSpendDTO
```

Fields include:

```
earnedIncomeCents
projectedIncomeCents
expensesTotalCents
maintenanceTotalCents
operatingTotalCents
capexTotalCents
netIncomeCents
netOperatingIncomeCents

maintenanceRatio
collectionRate
costPerUnitCents

expensesByCategory[]
topContractorsBySpend[]
```

---

## OpenAPI + Typed Client

Update:

```
apps/api/openapi.yaml
```

Update typed client:

```
packages/api-client/src/index.ts
```

Add methods:

```ts
api.financials.getBuildingFinancials(buildingId, params)
api.invoices.setExpenseCategory(invoiceId, category)
```

---

## Contract Tests

Add contract tests verifying:

- Response contains all numeric totals
- Arrays exist and are not undefined
- Ratios return numbers
- Zero division handled safely

---

## Backend Integration Tests

Add:

```
apps/api/src/__tests__/financials.test.ts
```

Test scenarios:

- Snapshot created on first request
- Second request uses cached snapshot
- `forceRefresh` recomputes snapshot
- Maintenance invoices auto-categorized
- Non-job invoices can be categorized
- Job invoices cannot be re-categorized
- Projected income prorates partial months
- Category breakdown sums equal `expensesTotal`

---

## Frontend Implementation

Add proxy route:

```
apps/web/pages/api/buildings/[id]/financials.js
```

Use:

```js
proxyToBackend()
```

### New Page

```
/manager/buildings/[id]/financials
```

Requirements:

**Display:**

- KPI cards:
  - Earned Income
  - Projected Income
  - Expenses
  - Maintenance
  - Operating
  - Capex
  - NOI
  - Collection Rate

- Tables:
  - Expenses by category
  - Top contractors by spend

- Include **Refresh** button triggering `forceRefresh=true`

- UI shows `DD-MM-YYYY`, API calls use ISO.

**Do not modify:**

```
apps/web/styles/managerStyles.js
```

---

## Money Handling Rules

All money must be stored and calculated as:

> **integer cents**

Never use floats.

---

## Deliverables

- [ ] Prisma migration
- [ ] Financial snapshot table
- [ ] Financial service
- [ ] API routes
- [ ] DTOs
- [ ] OpenAPI updates
- [ ] Typed client updates
- [ ] Contract tests
- [ ] Backend integration tests
- [ ] Manager financial dashboard
- [ ] Snapshot refresh capability
- [ ] All CI checks must pass

---

## Important Constraint

**Do NOT implement accounting features:**

- No general ledger
- No chart of accounts
- No double-entry bookkeeping
- No reconciliation
- No bank syncing

> This system is **building financial performance analytics** only.
