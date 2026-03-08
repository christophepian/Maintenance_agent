# Finance Audit: Payments, Expenses, and Charges

**Date:** 2026-03-08
**Purpose:** Audit existing backend and proxy layer before building frontend.

---

## 1. Payments

**Backend route:** ❌ **MISSING** — no `apps/api/src/routes/payments.ts` exists.

**Prisma model:** ❌ **MISSING** — there is no `Payment` model in `apps/api/prisma/schema.prisma`. The 44-model schema has no standalone payment entity.

**What exists instead:** The concept of "payment" is embedded in the **Invoice** model:
- `Invoice.paidAt` (DateTime?) — timestamp marking when paid
- `Invoice.status` = `PAID` — terminal status in the invoice lifecycle
- `Invoice.paymentReference` (String?) — e.g., QR-bill reference
- `Invoice.iban` (String?)

The workflow `apps/api/src/workflows/payInvoiceWorkflow.ts` transitions an invoice from `APPROVED → PAID`, setting `paidAt`. There is no separate payment record — paying is a status change on an invoice.

**Endpoints:** None dedicated. Invoice payment goes through `PATCH /invoices/:id` with status transition, or the pay-invoice workflow wired via the invoice route.

**DTO fields:** N/A — no PaymentDTO exists.

**Repository:** ❌ None (`paymentRepository` does not exist).

**Workflow:** The `payInvoiceWorkflow` is the closest equivalent, but it operates on invoices, not standalone payments.

**Frontend proxy:** ❌ **MISSING** — no `apps/web/pages/api/payments/` directory.

**Frontend page:** `apps/web/pages/manager/finance/payments.js` exists but is a **stub placeholder** — just renders "Placeholder for payment tracking."

**Gaps:**
- No `Payment` Prisma model — need to decide: create a standalone model, or derive payment views from Invoice (where `status = PAID`)
- No backend route for listing payments
- No proxy layer
- No payment DTO
- The frontend page is a placeholder

---

## 2. Expenses

**Backend route:** ❌ **MISSING** — no `apps/api/src/routes/expenses.ts` exists.

**Prisma model:** ❌ **No standalone Expense model.** Expenses are modeled as an **attribute of invoices**: the `Invoice` model has an `expenseCategory` field (nullable `ExpenseCategory` enum).

**`ExpenseCategory` enum** (from `schema.prisma`):
`MAINTENANCE`, `UTILITIES`, `CLEANING`, `INSURANCE`, `TAX`, `ADMIN`, `CAPEX`, `OTHER`

**What exists:**
1. **`POST /invoices/:id/set-expense-category`** — `apps/api/src/routes/financials.ts` allows tagging an invoice with an `ExpenseCategory`. But job-linked invoices are automatically classified as `MAINTENANCE` and cannot be re-categorized.
2. **`GET /buildings/:id/financials`** — `financials.ts` route returns `expensesByCategory` (an array of `{ category, totalCents }`) as part of the `BuildingFinancialsDTO`.
3. The financials service (`apps/api/src/services/financials.ts`) computes expense totals by querying paid invoices linked to jobs for units in a building — expenses are derived from invoices, not stored separately.

**Endpoints that touch expenses:**
- `GET /buildings/:id/financials` — aggregated expense data
- `POST /invoices/:id/set-expense-category` — tag an invoice
- `GET /financials/portfolio-summary` — includes aggregate `totalExpensesCents`

**DTO:** `ExpenseCategoryTotalDTO` = `{ category: ExpenseCategory; totalCents: number }` — embedded in `BuildingFinancialsDTO.expensesByCategory[]`

**Repository:** ❌ No dedicated expense repository.

**Workflow:** ❌ None — `setInvoiceExpenseCategory()` is a direct service call, not a workflow.

**Frontend proxy:** ❌ **MISSING** — no `apps/web/pages/api/expenses/` directory. The building financials proxy at `apps/web/pages/api/buildings/[id]/financials.js` serves aggregate expense data. The portfolio summary proxy at `apps/web/pages/api/financials/portfolio-summary.js` exists.

**Frontend page:** `apps/web/pages/manager/finance/expenses.js` exists but is a **stub placeholder** — "Placeholder for expense tracking."

**Gaps:**
- No way to list expenses as individual line items (only aggregated via building financials)
- `GET /invoices` does not support `expenseCategory` filter
- No proxy for expense-specific queries
- The frontend page is a placeholder
- Decision needed: create standalone Expense model, or build an expense list view on top of Invoice (where `expenseCategory IS NOT NULL`)

---

## 3. Charges

**Backend route:** ❌ **MISSING** — no `apps/api/src/routes/charges.ts` exists.

**Prisma model:** ❌ **No standalone Charge or LeaseCharge model.** The term "charges" appears in two distinct contexts:

**Context A — Lease charges** (Swiss _Nebenkosten_):
- `Lease.chargesItems` (Json?) — itemized list of ancillary charges
- `Lease.chargesTotalChf` (Int?) — total monthly charges in CHF
- `Lease.chargesSettlementDate` (String?) — settlement deadline
- These are part of the Lease model (40+ fields), not a separate entity.

**Context B — Rent estimation config charges:**
- `RentEstimationConfig.chargesBaseOptimistic/Pessimistic` — coefficients for estimating charges
- `RentEstimationConfig.heatingChargeAdjJson` — heating charge adjustments
- `RentEstimationConfig.serviceChargeAdjElevator/Concierge` — service charge adjustments
- These are configuration parameters, not transactional data.

**Endpoints:** None dedicated to charges. Lease charges are part of the `LeaseDTO` returned by lease endpoints.

**DTO:** No standalone `ChargeDTO`. Charge data is embedded in lease DTOs (`chargesItems`, `chargesTotalChf`, etc.).

**Repository:** ❌ None.

**Workflow:** ❌ None.

**Frontend proxy:** ❌ **MISSING** — no `apps/web/pages/api/charges/` directory.

**Frontend page:** `apps/web/pages/manager/finance/charges.js` exists but is a **stub placeholder** — "Placeholder for charge management."

**Gaps:**
- No backend concept of "charges" as standalone entities
- The lease model has embedded charge fields but no CRUD for individual charges
- No charge endpoints, proxy, or DTO
- Decision needed: should charges be a separate model (e.g., `LeaseCharge` with `type`, `amount`, `period`), or a UI view derived from lease data?

---

## 4. Shared Patterns Confirmed

**Proxy pattern** — from `apps/web/pages/api/invoices/[id].js`:
```js
import { proxyToBackend } from "../../../lib/proxy";
export default async function handler(req, res) {
  const { id } = req.query;
  await proxyToBackend(req, res, `/invoices/${id}`);
}
```
Uses `proxyToBackend()` from `apps/web/lib/proxy.js` which forwards all headers (including `Authorization`), preserves query params, and passes through status codes (per H3/F3).

**Finance list page pattern** — from `apps/web/pages/manager/finance/invoices.js`:
- Uses `AppShell` + `PageShell` + `PageHeader` + `PageContent` + `Panel` layout
- Imports `styles` from `managerStyles.js` (locked per G8/F8)
- Fetches via `fetch("/api/invoices?view=summary", { headers: authHeaders() })`
- Uses `useState`/`useEffect`/`useMemo`/`useCallback` for state
- Status filter tabs pattern with counts
- `StatusBadge` component with color map
- `formatDate()` and `formatCurrency()` helpers defined locally
- Error/loading states

---

## Summary Table

| Area | Backend Route | Prisma Model | Endpoints | DTO | Repository | Workflow | Frontend Proxy | Frontend Page | Status |
|------|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|---|
| **Payments** | ❌ | ❌ | None (Invoice.paidAt only) | ❌ | ❌ | `payInvoiceWorkflow` (on Invoice) | ❌ | Placeholder | **Everything missing** — payment = invoice status change today |
| **Expenses** | ❌ | ❌ (Invoice.expenseCategory) | `POST /invoices/:id/set-expense-category`, aggregated in `/buildings/:id/financials` | Aggregate only | ❌ | ❌ | ❌ | Placeholder | **No list/CRUD** — only aggregate views via building financials |
| **Charges** | ❌ | ❌ (Lease.chargesItems embedded) | None standalone | ❌ | ❌ | ❌ | ❌ | Placeholder | **Everything missing** — charges are embedded JSON on Lease |

---

## Key Architectural Decision Needed Before Building Frontend

All three areas can go one of two directions:

1. **Derive from existing data** (no schema change): Build frontend views that query invoices with filters (e.g., payments = invoices where `status = PAID`; expenses = invoices where `expenseCategory IS NOT NULL`; charges = lease `chargesItems` flattened). This means adding query param support to `GET /invoices` (e.g., `expenseCategory`, `paidAfter`, `paidBefore`, `buildingId`).

2. **Create standalone models** (schema change, violates G1 cost): Add `Payment`, `Expense`, and/or `LeaseCharge` models. More flexible long-term but heavier lift and requires migration.
