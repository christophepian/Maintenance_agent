# Ancillary Costs (Nebenkosten / Charges) — Billing & Reconciliation

Scope document for extending the charge-reconciliation feature to a legally complete
Swiss ancillary-cost model. Status: **scoping + Phase 1 in progress.**

## Background

The reconciliation feature already exists and works end-to-end (see
`apps/api/src/services/chargeReconciliationService.ts`, the `ChargeReconciliation` /
`ChargeReconciliationLine` models, and `/manager/charge-reconciliations`). It is a
**simplified MVP**: a manager manually types each lease's actual costs, advances are
derived by string-matching invoice line descriptions, and there is no building-level
cost pool, distribution keys, billable/non-billable gate, admin fee, flat-rate
calculation, credit notes, or inspection-rights workflow.

This document scopes the work to close those gaps. It is **additive** — it extends the
existing entities rather than replacing them.

## Two legal billing modes (recap)

- **Forfait (FLAT_RATE)** — fixed monthly amount based on the average actual cost of
  the preceding three years. No annual reconciliation, no statement (décompte); the
  landlord absorbs surplus/deficit. Already representable via `ChargeMode.FORFAIT`;
  these lines must **never** appear in a statement.
- **Acompte / Provision (ADVANCE)** — monthly estimated advance, reconciled once per
  billing period against actual incurred costs, producing a refund or a balance due,
  with the tenant's right to inspect supporting documents.

Mode is set **per cost category per lease** (`LeaseExpenseItem.mode`), e.g. heating on
advance, other charges flat-rate.

## Gap analysis (what exists vs. what's needed)

| Capability | Today | Target |
|---|---|---|
| Per-category billing mode | ✅ `LeaseExpenseItem.mode` | keep |
| Advance reconciliation MVP | ✅ `ChargeReconciliation` | extend |
| Charge split on rent invoices | ✅ `recurringBillingService` | keep |
| Canonical cost categories | ❌ free-form `ExpenseType` + string match | **`AncillaryCostCategory`** |
| Billable vs non-billable gate | ❌ implicit in account name | **`CostBillability` + validation** |
| Distribution keys | ❌ none | **`DistributionKey` + factor calc** |
| Building-level actual costs feeding décompte | ❌ manual per lease | **`BillingPeriod` + `CostEntry`** |
| Flat-rate 3-yr-average calc | ❌ none | **`calculateFlatRate()`** |
| Admin fee (cap 3%) | ❌ none | **`adminFeeRatePermille` + cap** |
| Refund as credit note | ❌ positive OUTGOING invoice | **credit-note path** |
| Inspection rights (docs, ~30d) | ❌ none | **`StatementDocRequest` + window** |

## Architecture & guardrail compliance

This feature follows the repo conventions enforced by `scripts/guardrails.sh`:

- **Repository pattern (G3/G9):** all Prisma access lives in `*Repository.ts` with a
  canonical `*_INCLUDE` constant; routes never inline `include: {}` or hit Prisma.
- **Migrations (G8):** never `prisma db push`. Additive migrations under
  `apps/api/prisma/migrations/<ts>_<name>/migration.sql`, applied by
  `npx prisma migrate deploy` at server startup (`server.ts start()`), since
  `render.yaml` changes are ignored for the existing service.
- **Validation:** zod schemas in `apps/api/src/validation/`, enforcing legal constraints.
- **State transitions:** go through `workflows/` + `transitions.ts` (as the existing
  reconciliation finalize/settle flow does).
- **Frontend:** manager UI uses `next-i18next` `t()` with EN+FR keys (G17), `cn()` for
  classNames (F-UI4), `Badge` + `statusVariants.js` for status colours (F-UI4a), and
  never wraps `ConfigurableTable` in a `Panel` (F-UI9).
- **Docs (G19):** this file lives only in `docs/` (not mirrored to
  `apps/web/public/docs/`), matching the `PLANNING_TAB_REARCHITECTURE.md` precedent.

## Data model

Legend: **[EXISTS]**, **[EXTEND]**, **[NEW]**.

```prisma
// ─── Enums [NEW] ───────────────────────────────────────────────
enum CostBillability { BILLABLE NON_BILLABLE }
enum DistributionKey { SURFACE_AREA UNIT_COUNT CONSUMPTION OCCUPANT_COUNT FIXED_SHARE }

// ─── Canonical taxonomy [NEW] ──────────────────────────────────
model AncillaryCostCategory {
  id            String          @id @default(uuid())
  orgId         String
  code          String          // HEATING_HOTWATER, WATER, ELEVATOR, CARETAKER, ADMIN_FEE…
  name          String
  billability   CostBillability @default(BILLABLE)  // NON_BILLABLE can never reach a tenant
  defaultKey    DistributionKey @default(SURFACE_AREA)
  isAdminFee    Boolean         @default(false)
  expenseTypeId String?         // bridge to existing chart of accounts
  accountId     String?
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  org           Org             @relation(fields: [orgId], references: [id], onDelete: Cascade)
  expenseType   ExpenseType?    @relation(fields: [expenseTypeId], references: [id], onDelete: SetNull)
  account       Account?        @relation(fields: [accountId], references: [id], onDelete: SetNull)
  leaseExpenseItems LeaseExpenseItem[]
  costEntries   CostEntry[]
  reconciliationLines ChargeReconciliationLine[]
  @@unique([orgId, code])
  @@index([orgId])
}

// ─── Lease config [EXTEND] ─────────────────────────────────────
// LeaseExpenseItem += categoryId (FK), distributionKey (override)
// Lease += areaM2, occupantCount, fixedSharePermille (distribution inputs)

// ─── Building cost pool [NEW] (Phase 2) ────────────────────────
model BillingPeriod {
  id                   String   @id @default(uuid())
  orgId                String
  buildingId           String
  startDate            DateTime
  endDate              DateTime
  status               String   @default("OPEN")  // OPEN | CLOSED
  adminFeeRatePermille Int      @default(0)        // ≤30 (3%) enforced in code
  createdAt            DateTime @default(now())
  org                  Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  building             Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  costEntries          CostEntry[]
  @@unique([buildingId, startDate, endDate])
  @@index([orgId])
}

model CostEntry {
  id              String   @id @default(uuid())
  billingPeriodId String
  categoryId      String                       // must be BILLABLE to apportion
  amountCents     Int
  sourceInvoiceId String?                       // INCOMING utility bill, for inspection right
  note            String?
  createdAt       DateTime @default(now())
  billingPeriod   BillingPeriod @relation(fields: [billingPeriodId], references: [id], onDelete: Cascade)
  category        AncillaryCostCategory @relation(fields: [categoryId], references: [id])
  sourceInvoice   Invoice? @relation("CostEntrySource", fields: [sourceInvoiceId], references: [id], onDelete: SetNull)
  @@index([billingPeriodId])
}

// ─── Reconciliation = "Statement" [EXTEND] ─────────────────────
// ChargeReconciliation += billingPeriodId?, adminFeeCents, issuedAt?, inspectionDeadline?, isRefund
// ChargeReconciliationLine += categoryId?, distributionKey?, distributionFactor?, buildingActualCents

model StatementDocRequest {           // [NEW] (Phase 4) inspection-rights workflow
  id               String   @id @default(uuid())
  reconciliationId String
  requestedAt      DateTime @default(now())
  status           String   @default("OPEN")  // OPEN | FULFILLED
  note             String?
  reconciliation   ChargeReconciliation @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)
  @@index([reconciliationId])
}
```

## Core service functions (math)

```typescript
// share of a building cost for one lease, given a distribution key
distributionFactor(lease, key, participants):
  SURFACE_AREA   -> lease.areaM2 / Σ areaM2
  UNIT_COUNT     -> 1 / participants.length
  OCCUPANT_COUNT -> lease.occupantCount / Σ occupantCount
  FIXED_SHARE    -> lease.fixedSharePermille / 1000
  CONSUMPTION    -> lease.meteredUnits / Σ meteredUnits      // needs meters (Phase 2+)

// FLAT_RATE: 3-yr average building cost × this lease's share, monthly. No décompte.
calculateFlatRate(categoryId, lease, priorPeriods[3], participants):
  avgAnnual = mean(priorPeriods.map(p => p.actual[categoryId]))
  return round(avgAnnual * distributionFactor(...) / 12)

// per ADVANCE category: advance paid vs apportioned actual share
reconcileAdvances(lease, period):
  for each CostEntry c in period where c.category.billable and lease has ADVANCE for c.category:
    factor      = distributionFactor(lease, keyFor(lease, c.category), participants)
    actualShare = round(c.amountCents * factor)
    advances    = advancesPaid(lease, c.category, period)
    line = { actualCostCents: actualShare, acomptePaidCents: advances,
             balanceCents: actualShare - advances, buildingActualCents: c.amountCents, factor }

// décompte for one lease+period
generateStatement(lease, period):
  lines    = reconcileAdvances(lease, period)
  subtotal = Σ line.actualCostCents
  adminFee = min(round(subtotal * period.adminFeeRatePermille/1000), round(subtotal * 0.03))  // cap 3%
  totalActual = subtotal + adminFee
  totalAdv    = Σ line.acomptePaidCents
  balance     = totalActual - totalAdv          // >0 tenant owes; <0 refund
  return { lines, adminFeeCents, totalActual, totalAdv, balance,
           isRefund: balance < 0, issuedAt: now, inspectionDeadline: now + 30d }
```

Settlement: `balance > 0` → OUTGOING invoice (existing path); `balance < 0` → **credit note**.

## Validation rules (legal constraints)

1. **Non-billable gate** — a `LeaseExpenseItem`/`CostEntry`/statement line whose
   category is `NON_BILLABLE` is rejected. Mortgage interest, amortization, building
   insurance, property tax, major repairs, and building self-management can never be
   apportioned to a tenant.
2. **Mode consistency** — a category is ACOMPTE *or* FORFAIT per lease; FORFAIT never
   appears in a statement; ADVANCE always does.
3. **Admin-fee cap** — `adminFeeRatePermille ≤ 30` and the computed fee ≤ 3% of
   recoverable actuals.
4. **Distribution integrity** — per category+period, Σ lease factors ≤ 1.0; FIXED_SHARE
   permille across leases ≤ 1000.
5. **Statement preconditions** — only for CLOSED periods with ≥1 billable `CostEntry`;
   never for FLAT_RATE-only leases.
6. **Inspection window** — statement carries `inspectionDeadline = issuedAt + 30d`; doc
   requests allowed until then.

## Default category seed (Swiss Nebenkosten)

Billable: `HEATING_HOTWATER` (consumption), `WATER_WASTEWATER` (consumption),
`COMMON_ELECTRICITY` (surface), `ELEVATOR` (unit), `CARETAKER_CLEANING` (surface),
`SNOW_REMOVAL` (surface), `GROUNDS` (surface), `WASTE_TAX` (occupants),
`TV_CABLE` (unit), `ADMIN_FEE` (surface, isAdminFee).
Non-billable: `MORTGAGE_INTEREST`, `AMORTIZATION`, `BUILDING_INSURANCE`,
`PROPERTY_TAX`, `MAJOR_REPAIRS`, `BUILDING_MANAGEMENT`.

## Phased delivery

- **Phase 1 — taxonomy + billable gate** *(in progress).* `CostBillability`,
  `DistributionKey`, `AncillaryCostCategory` (+ seed), `LeaseExpenseItem.categoryId`,
  repository/service/validation/routes, and the non-billable gate on lease expense
  items. Highest legal value; removes string-matching dependence.
- **Phase 2 — building cost pool + distribution keys.** `BillingPeriod`, `CostEntry`
  (auto-filled from INCOMING invoices), `distributionFactor`, auto-computed actual
  shares replacing manual entry. Biggest UX win.
- **Phase 3 — admin fee, credit notes, `calculateFlatRate()`.**
- **Phase 4 — inspection-rights workflow** (`StatementDocRequest`, 30-day window, doc refs).

## Open questions (confirm before later phases)

- Default distribution key per category — defaults proposed above; confirm.
- Consumption-based keys require per-unit meter readings — model now or defer?
- Credit-note representation — negative invoice vs. dedicated `CreditNote` entity?
