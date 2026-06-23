# Ancillary Costs v3 — Remediation Scope

Status: **implemented 2026-06-23** (WS1–WS5 delivered; WS6 was a no-op — the
mismatched bits were never built). Supersedes the data-flow assumptions
in `docs/ANCILLARY_COSTS_RECONCILIATION.md` (engine stays; routing/UI corrected).
Builds on shipped backend P1–P4 + v2 C1–C4.

## Delivery (2026-06-23)
- **WS1** — `Invoice.costNature CHARGE|DIRECT` + `Invoice.ancillaryCategoryId` FK
  (migration `20260623020000_add_invoice_cost_nature`). Empty-string FK bug fixed:
  `updateInvoice` coerces `unitId/buildingId/ancillaryCategoryId "" → null`; the
  `UpdateInvoiceSchema` preprocesses `"" → null` before `.uuid()`; the PATCH route
  now validates with the schema and forwards `costNature`/`ancillaryCategoryId`/
  `expenseTypeId`/`accountId`. Invoice detail page shows a nature-first classifier
  (charge → category + building, unit hidden; direct → building + unit).
- **WS2** — `bridgeChargeInvoiceToCostPool()` in `ancillaryReconciliationService`,
  called (best-effort) from `approveInvoiceWorkflow` when `costNature==='CHARGE'`.
  Resolves the period by invoice date, auto-creates an OPEN calendar-year period,
  idempotent on `sourceInvoiceId` (re-approval updates the entry).
- **WS3** — `getBuildingFinancials` adds cost-pool charges as `recoverableAncillaryCents`
  (folded into expenses/operating), de-duped against the ledger by source invoice
  and scoped to the window by invoice date. `getUnitPeriodReport` exposes the
  unit's `apportionedChargesCents` (passive).
- **WS4** — `apportionForLease` ventilates CONSUMPTION categories by surface area
  when no meters (flagged `usedConsumptionFallback`); `getBuildingDistribution`
  lazily seeds a row per billable category so the editor is never empty.
- **WS5** — unit page charges panel auto-selects the latest period (passive
  preview); settle stays explicit; surfaces the consumption→surface fallback.
- Tests: `ancillaryV3Remediation.test.ts` (5 cases); 91 green across the
  ancillary/invoice/financials suites; API typecheck clean.

## The corrected model (owner-confirmed)

Two **distinct tracks** for an incoming invoice — decided by its **nature**, set once at review:

1. **Recoverable charge (Nebenkosten)** — heating, hot water, water/waste, common
   electricity, caretaker, elevator, snow, grounds, waste tax, TV…
   → **building-level only** (never unit-attributed)
   → becomes a cost-pool `CostEntry` in the building's billing period
   → **ventilated** to units by the building's per-category distribution preset
   → flows into building reporting **and** each unit's décompte (paid vs apportioned actual → credit note / extra invoice).

2. **Direct cost** — repair / maintenance / capex / insurance / property tax…
   → attributed to **building and/or a specific unit** + a **payer (owner or tenant)**
   → handled by the **existing** expense/ledger + invoicing flow
   → **never** enters the cost pool or the décompte.

**Key rule:** the cost pool + qualification exist **only for charges**. A unit is selected
**only** for direct costs (an invoice concerning that specific unit). Charges are always
building-level and ventilated by preset.

## Owner decisions (2026-06-23)
- **Q1 Source of truth:** building/unit **reporting reads the cost pool** for charges (per period), de-duped by source invoice; direct costs stay ledger-based.
- **Q2 Entry point:** assigning a **charge category + building** on the invoice **is** the qualification (invoice page and cost-pool "qualify" become one action).
- **Q3 Nature split:** repairs/maintenance are **not** charges — never in the décompte; charges never carry a unit.
- **Q4 Status gate:** only **approved/validated** invoices become costs (the review gate is the validation; DRAFT/ingested-unreviewed excluded).
- **Tenant-billed direct costs:** default **(a)** — reuse the existing invoice/billing flow (attribute + mark payer; manager bills manually). No new one-click "bill to tenant/owner" action this round.

## Cleanest UI (no dual-taxonomy confusion)
Nature is the **first** field at the ingestion/review gate (and editable on the invoice page);
it gates the rest:
- **Step 1 — "What is this cost?"** → `Recoverable charge` | `Direct cost`.
- **Charge** → charge-category picker + building. **Unit field hidden.** On approval → cost-pool entry, ventilated by preset.
- **Direct cost** → expense-category + building and/or unit + payer. Existing flow; no cost pool.
- Charge categories = the BILLABLE `AncillaryCostCategory` set (already seeded). Direct costs = existing `expenseCategory`/`expenseType`.
- The PDF-ingestion AI may **pre-suggest** the nature + category.

## Current state / gaps (from 2026-06-23 analysis)
- Invoice-page assignment **looks non-persistent**: likely the "Save attribution" sends `unitId: ""` (empty string) when no unit is chosen → invalid FK → PATCH fails. Confirmed live: only the 2 cost-pool-qualified invoices carry a `buildingId`; none from the invoice page; 0 have `unitId`.
- Building reporting expenses come **only from the ledger** (`getBuildingFinancials` → `INVOICE_ISSUED` debit on EXPENSE accounts, scoped by `ledgerEntry.buildingId` at posting). The **cost pool never posts to the ledger and reporting never reads it** → qualified charges don't show. Assigning `buildingId` after posting does **not** backfill the ledger entry. Most incoming invoices are DRAFT (never posted).
- Distribution config is **empty** (`BuildingChargeDistribution` rows = 0) → apportionment falls back to category defaults; **HEATING defaults to CONSUMPTION → "requiresManual" → never ventilates** (no meters). GROUNDS/SNOW = SURFACE_AREA would work (units have areas).
- Unit page ventilation is **on-demand only** (C4 "Run a charges reconciliation" under Financials → Reconciliations). `getUnitPeriodReport` expenses are ledger-by-`unitId`; apportioned shares never shown passively.

## Remediation workstreams (implementation order)

### WS1 — Cost-nature classification  *(unblocks everything)*
- Schema: add `Invoice.costNature` enum `CHARGE | DIRECT` (nullable until classified) + migration (additive, RLS already on Invoice).
- Backend: `updateInvoice`/qualify accept `costNature`; validation. **Fix empty-string bug**: coerce `unitId: "" → null` (and `buildingId: "" → null`) in the PATCH path.
- Frontend: invoice review/detail (`apps/web/pages/manager/finance/invoices/[id].js`) — nature selector first, then conditional fields (charge → ancillary-category + building, hide unit; direct → expenseCategory + building/unit + payer). PDF-ingestion review gate gets the same classifier (optionally AI-prefilled).

### WS2 — Charge → cost-pool bridge  *(core)*
- On **approval** of a CHARGE invoice (building + ancillary charge category, no unit): create/update its `CostEntry` in the building's billing period; auto-resolve the period by invoice date, **auto-create** an OPEN period if none. Idempotent on `sourceInvoiceId` (already enforced one cost entry per source invoice).
- Make the invoice-page assignment use this same path (Q2 unify). The cost-pool "qualify from invoice" picker stays as the alternative entry point.
- Only approved invoices (Q4) create entries.

### WS3 — Reporting reads the cost pool  *(Q1)*
- `getBuildingFinancials`: add building cost-pool charges for the period to the expense view, **de-duped by `sourceInvoiceId`** so a charge isn't double-counted with any ledger entry. Direct costs stay ledger-based. Consider showing charges as a distinct "recoverable ancillary" line vs landlord expenses.
- `getUnitPeriodReport`: include the unit's **apportioned** charge share for the period (passive), separate from ledger `unitId` expenses.

### WS4 — Distribution presets always usable
- Auto-seed `BuildingChargeDistribution` for a building from category defaults on first use (or lazily in `getBuildingDistribution`), so the editor is never empty.
- **Consumption fallback:** when a category's key is CONSUMPTION but no meter data exists, fall back to SURFACE_AREA (flagged) instead of "requiresManual", so heating/water still ventilate. (True metering deferred.)

### WS5 — Passive per-unit ventilation display
- Unit page: show the unit's apportioned charge share for the current/selected period automatically (a read-only panel using `getUnitReconciliationPreview`), not only inside the on-demand reconciliation. Keep settle as the explicit action.

### WS6 — Retire mismatched bits from the earlier road
- Drop "unit-specific cost in the décompte" and the proposed **lease-expense-item category picker** (advances come from the rent charges line; charges are building-level only).
- Keep: cost pool, distribution config, reconciliation engine, credit notes, inspection rights, C3 charges-advance line.

## Out of scope / deferred
- Consumption metering (real per-unit readings).
- 3-yr-average advance estimate (advance currently = lease's defined charges).
- Credit-note PDF; tenant-portal self-service doc requests.
- One-click "bill direct cost to tenant/owner" (default (a): manual via existing flow).

## Acceptance (what "done" looks like)
1. At review, a manager classifies an invoice as Charge or Direct; the form shows only relevant fields; empty unit no longer breaks the save.
2. Approving a **charge** (building + category) makes it appear: in the building's cost pool, in **building reporting expenses**, ventilated to each unit per preset, and in each unit's décompte preview — **without** any separate "qualify" step.
3. A **direct cost** with a unit shows as that unit's expense via the existing flow and is **absent** from the cost pool/décompte.
4. Heating/water ventilate (surface fallback) even without meters; distribution editor is pre-populated.
5. The unit page shows the apportioned charge share passively; settle still issues a credit note / invoice.

## Key files (reference)
- API: `services/invoices.ts` (updateInvoice, empty-string fix, costNature), `services/ancillaryReconciliationService.ts` (qualify, apportion, distribution, unit preview), `services/financials.ts` (`getBuildingFinancials`, `getUnitPeriodReport` — cost-pool read), `routes/invoices.ts`, `routes/billingPeriods.ts`, ingestion review service.
- Web: `pages/manager/finance/invoices/[id].js` (nature classifier), PDF-ingestion review UI, `pages/manager/finance/billing-periods/[id].js`, `pages/admin-inventory/units/[id].js` (passive ventilation), `pages/admin-inventory/buildings/[id].js` (reporting reflects charges).
- Schema: `Invoice.costNature` (WS1); reuse `AncillaryCostCategory`, `BillingPeriod`, `CostEntry`, `BuildingChargeDistribution`, `ChargeReconciliation`, `CreditNote`.
