# Accounting Bridge — Imported Balance Sheet ↔ Reporting ↔ Analytical View

Scope document for connecting the **imported balance sheet** (position / stock) to the
**building reporting** (performance / flow), and for adding a dedicated **analytical
accounting view**. Status: **scoped, not started (2026-06-25).**

This is **additive** — it extends existing entities and services rather than replacing
them. No model is removed.

| WS | Title | Surface | Status |
|---|---|---|---|
| A | Opening-balance continuity (receivables/payables roll-forward) | Reporting (flow) | ✅ shipped 2026-06-25 (`daf9714`) |
| B | Building "Financial position" sub-tab | Building page (stock) | ✅ shipped 2026-06-25 (`bf2feb4`) |
| E | Year-end closing journals (real equity bridge) | Ledger / accounting | in progress |
| D | CAPEX capitalization + straight-line depreciation | Ledger + asset register | scoped |
| C | Analytical accounting view (equity bridge + BS trend) | Accounting section | scoped |
| F | Per-tenant opening receivables (manual entry, aging, settlement) | Reporting + units | scoped |

**Build order: E → D → C → F** (closing makes the bridge real; depreciation feeds both
statements; the analytical view then surfaces real equity + depreciation; per-tenant AR last).

### Locked decisions (2026-06-25, owner)
- **Depreciation (WS-D):** CAPEX invoices **capitalize** to a fixed-asset on the balance
  sheet, then **straight-line depreciate over the asset's useful life** (reuse existing
  `usefulLifeYears`). **Building shell held at cost** (not depreciated).
- **Per-tenant opening AR (WS-F):** **manual per-tenant entry UI** (amount + due date) at
  switchover; the account-level import lump is the **control total** to reconcile against.
- **Closing (WS-E):** automated **Dec-31** closing journal moving the period result into
  **retained earnings (account 2900)**, **reversible** to reopen a period. (Supersedes the
  earlier D1-a "display-residual only" — that stays as the fallback view when a year is open.)

---

## 0. Framing — the two statements and the bridge between them

The two surfaces in question are **two different financial statements**, and the whole
design follows from keeping them distinct:

| | Imports → Ledger balance sheet | Building Reporting tab |
|---|---|---|
| Page | `/manager/finance?tab=imports` → `/manager/finance/ledger` | `/admin-inventory/buildings/[id]?tab=Reporting` |
| Statement | **Stock / position** (assets & liabilities *at a date*) | **Flow / performance** (income, expenses, NOI *over a period*) |
| Writes | self-balancing journal, `sourceType: BALANCE_SHEET_IMPORT`, dated `periodEnd` | — (reads only) |
| Reads | `getBalanceSheet()` ([`ledgerService.ts:392`](../apps/api/src/services/ledgerService.ts#L392)) — **all** `LedgerEntry` for the building, `date ≤ asOf`, ASSET/LIABILITY accounts only | `getBuildingFinancials()` ([`financials.ts:194`](../apps/api/src/services/financials.ts#L194)) — `LedgerEntry` filtered to `INVOICE_ISSUED`/`INVOICE_PAID` + lease projections |

### Current linkage

- **Data layer — partial & silent.** Both write to / read from the same `LedgerEntry`
  table, scoped by `buildingId`. So `getBalanceSheet(asOf)` *does* accumulate operational
  entries on top of the import (the "build upon the past" premise — works for the
  balance-sheet view).
- **UX layer — none.** The Reporting tab filters by `sourceType`, so the
  `BALANCE_SHEET_IMPORT` journal is invisible to it; and the building page has **no
  balance-sheet surface** (the balance sheet lives only at the org-level ledger page).
  From the user's chair, imports and the building page are disconnected.

### Reporting *is* the income statement that bridges BS(Y-1) → BS(Y)

Conceptually:

> **Opening equity (import) + period result (Reporting) − distributions = closing equity (BS Y).**

Reporting is the middle term — but today it is **not yet a clean P&L** that reconciles the
bridge. Three precise gaps, from [`financials.ts:382-392`](../apps/api/src/services/financials.ts#L382-L392):

1. **Hybrid cash/accrual.** `netIncomeCents = collectedIncomeCents − expensesTotalCents`
   — income is **cash** (`INVOICE_PAID` bank debit), expenses are **accrued**
   (`INVOICE_ISSUED`). A bridge-grade income statement must be pure accrual on both
   sides; otherwise the *change in receivables* leaks out of the bridge. The accrual
   revenue figure exists (`accruedIncomeCents`) but isn't what the headline is built from.
2. **Capex contamination.** `expensesTotalCents` includes `CAPEX` invoices, so capex
   depresses "net income." Capex is a **balance-sheet** event (capitalize an asset);
   the P&L line that belongs there is **depreciation**, which is not computed. NOI
   already strips capex back out, which is why NOI is the cleaner figure.
3. **No closing entry → the bridge is unclosed.** `getBalanceSheet()` drops all
   REVENUE/EXPENSE accounts ([`ledgerService.ts:459`](../apps/api/src/services/ledgerService.ts#L459)),
   and nothing posts the period result into equity/retained-earnings. As soon as
   operations happen, `getBalanceSheet`'s `differenceCents` (assets − liabilities)
   drifts from zero by ~the accumulated post-import net result. **That residual *is* the
   retained earnings the income statement should have closed into.** Confirmed: no
   retained-earnings / closing logic exists in the codebase (grep: only a test name).

This reframes WS-C: the analytical view's backbone is the **equity bridge** (opening →
result → distributions → closing), not just "show the balance sheet next to performance."

---

## 1. Gap analysis (what exists vs. what's needed)

| Capability | Today | Target |
|---|---|---|
| Building balance sheet (position) | ✅ `getBalanceSheet()` (org ledger page only) | surface on the building page (WS-B) |
| Opening balances seed the ledger | ✅ `BALANCE_SHEET_IMPORT` journal | keep |
| Reporting continues from imported receivables | ❌ receivables = outgoing `ISSUED` invoices only | roll forward from imported 1100/2000 (WS-A) |
| Arrears includes day-one open items | ❌ invisible (no invoice behind imported arrears) | include imported open items (WS-A) |
| Equity bridge / retained-earnings reconciliation | ❌ surfaces as `differenceCents` "imbalance" | explicit equity-movement view (WS-C, fork D1) |
| Balance-sheet trend over time | ❌ point-in-time only | daily/period position series (WS-C, fork D2) |
| Depreciation / capex capitalization | ❌ none | **out of scope** (note as known limitation) |

---

## 2. Decisions to confirm before build (forks)

> These are owner/architecture decisions, not implementation details. Resolve before WS-C.

- **D1 — Equity bridge: display-as-residual vs. real closing entry.**
  - *(a) Display-as-residual (recommended first step):* expose `getBalanceSheet`'s
    `differenceCents` as **"Current-period result (unclosed)"** and show the bridge
    arithmetically. Cheap, non-destructive, reversible, no new journals.
  - *(b) Real closing journal:* introduce a year-end closing entry moving
    revenue/expense balances into a retained-earnings equity account so BS(Y) actually
    carries the result. Correct long-term, but it mutates the ledger and needs a
    reversal/period-lock story. Defer to a later phase.
  - **Recommendation:** ship (a) now; gate (b) behind its own scoping pass.
- **D2 — Balance-sheet trend storage.** Extend `BuildingDailySnapshot` (already computed
  daily, see [`project_reporting`]) with position columns (net assets / cash / debt), or
  compute on-the-fly via repeated `getBalanceSheet(asOf)` calls. Snapshot is cheaper to
  chart; on-the-fly avoids a migration. **Recommendation:** snapshot columns (additive,
  nullable) to match the existing NOI-series pattern.
- **D3 — Opening receivables representation (WS-A).** *Resolved during build (2026-06-25)
  after inspecting settlement mechanics.* The imported balance sheet posts AR/AP as an
  **account-level lump** on 1100/2000 — **no tenant, no unit, no due date, and no payable
  invoice behind it** (`postInvoicePaid` requires an invoice to credit 1100). Consequences:
  - Option (ii) "materialize as invoice-like records" is **not feasible from the import
    alone** — the import has no per-tenant breakdown to attribute invoices to.
  - Option (i) "read ledger position and fold into the due-date arrears buckets" is also
    wrong — the lump has no due dates, so it cannot be aged.
  - **Chosen (i, bounded):** read the opening AR/AP **filtered to
    `sourceType: BALANCE_SHEET_IMPORT`** on accounts 1100/2000 as of the report date, and
    surface it as a **distinct, un-aged "opening balance (from import)" figure** added to
    the receivables/payables *totals* — **never** mixed into the dueDate arrears buckets.
    Source-filtering makes de-dup automatic (invoice activity is a different `sourceType`),
    so there is no double-count. **Known limitation:** opening items are not aged and
    cannot be settled per-tenant until a future per-tenant AR-import or manual-clear flow
    exists (tracked in §4).

---

## 3. Build order

### WS-A — Opening-balance continuity ✅ shipped 2026-06-25 (`daf9714`)

**Problem:** A tenant who owed CHF X at switchover is captured in the import on account
1100, but with no invoice behind it the building's arrears-aging widget shows zero — day-one
arrears vanish, contradicting the "carry on with operations" premise.

**Approach (D3-i, bounded — see fork D3 for why):** read the imported opening AR (account
1100) and AP (2000) position **filtered to `sourceType: BALANCE_SHEET_IMPORT`** as of the
report date, and expose it as new DTO fields `openingReceivablesCents` /
`openingPayablesCents`. Surface as a **distinct, un-aged "opening balance (from import)"
line** added to the receivables/payables totals — **never** folded into the dueDate arrears
buckets. Source-filtering makes de-dup automatic (no double-count vs invoice activity).

**Touch points:** `financialsRepository` (new `aggregateOpeningBalanceFromImport` — **not**
raw Prisma in the service, per G20), `financials.ts` `getBuildingFinancials` (compute both,
point-in-time, in cached **and** fresh paths), `BuildingFinancialsDTO` (+2 fields), the
building Reporting tab (new labeled line + EN/FR keys). No migration — computed live, not
cached on `BuildingFinancialSnapshot`.

### WS-B — Building "Financial position" sub-tab ✅ shipped 2026-06-25 (`bf2feb4`)

Add a third Reporting sub-tab on `/admin-inventory/buildings/[id]?tab=Reporting`
(alongside Period Analysis + Performance Canvas) that calls the existing building-scoped
`getBalanceSheet(buildingId, asOf)`. Read-only; two-column Actifs/Passifs with contra-asset
deduction lines (reuse the `/manager/finance/ledger` Balance Sheet tab presentation).
Show the `differenceCents` line per D1(a) as "Current-period result (unclosed)".

**Touch points:** reuse existing `GET /ledger/balance-sheet?buildingId=&asOf=`
([`routes/ledger.ts:92`](../apps/api/src/routes/ledger.ts#L92)) — already MANAGER+OWNER
auth. New web proxy `apps/web/pages/api/buildings/[id]/balance-sheet.js` **or** reuse the
existing `apps/web/pages/api/ledger/balance-sheet.js` proxy with a `buildingId` query (no
new backend route → no OpenAPI budget impact). New presentational component under
`apps/web/components/reporting/`.

### WS-C — Analytical accounting view

Lives in the accounting section (manager finance), the accountant's lens — richer than the
owner's. Backbone = the **equity bridge**:

```
Opening equity (import)
  + period result (Reporting, accrual-basis)
  − distributions
  = closing equity (BS Y)   [reconciles to differenceCents per D1]
```

Plus:
- **Balance-sheet trend** (D2) — position over time, matching the NOI-trend SVG pattern.
- **Account-level movement** — opening → movements → closing per account (trial-balance
  delta), seeded by the import's opening journal. Reuse `getTrialBalance`.
- **Working-capital / debt position** — AR, AP, cash, mortgage (reconcile against the
  levered-NPV `Mortgage` table — see [`project_levered_npv`]).

This is also the natural home for the **family-office KPI backlog** (NAV, LTV, DSCR) which
need the liability/equity side the import captures — see [`reporting_enhancements`].

---

### WS-E — Year-end closing journals (real equity bridge)

Makes the BS(Y-1)→BS(Y) bridge real: at fiscal year-end, post a closing journal moving the
net of all REVENUE/EXPENSE account balances into **retained earnings (2900)**, so
`getBalanceSheet` reconciles (differenceCents → ~0) and equity carries the period result.

- **Model `FiscalPeriodClose`** (orgId, buildingId, fiscalYear, periodEnd, status
  OPEN→CLOSED, closingJournalId, retainedEarningsCents, closedAt/closedBy, reversedAt).
  `@@unique([orgId, buildingId, fiscalYear])`.
- **Service `fiscalCloseService`**: `closeFiscalYear(buildingId, year)` — sum REVENUE −
  EXPENSE ledger balances for [Jan-1..Dec-31], post one self-balancing journal
  (`sourceType: "YEAR_END_CLOSE"`) zeroing each P&L account into 2900; `reopenFiscalYear`
  posts the **reversing** journal and flips status. Idempotent (guarded by the unique row).
- **Repo** `fiscalPeriodCloseRepository` + ledger reads via existing repo (no service Prisma).
- **getBalanceSheet impact:** none structurally — once closed, P&L nets to zero so the
  residual disappears naturally; the WS-B "unclosed result" strip only shows for OPEN years.
- **Routes** `POST /ledger/close-year`, `POST /ledger/reopen-year`, `GET /ledger/closes`
  → **new OpenAPI entries** (don't grow the unspecced budget). MANAGER-only.
- **UI:** a "Year-end close" control in the accounting/ledger area + status surfaced on WS-B.
- **Account 2900** ensured in COA seed (already present in sample imports).

### WS-D — CAPEX capitalization + straight-line depreciation

Removes the "capex wrongly in net income" + "asset values never decline" gaps.

- **Model `FixedAsset`** (orgId, buildingId, unitId?, name, sourceInvoiceId?,
  acquisitionDate, costCents, usefulLifeYears, method=STRAIGHT_LINE, salvageCents=0,
  accumulatedDepreciationCents, status ACTIVE/DISPOSED). Optional link to the existing
  asset-inventory item for `usefulLifeYears`.
- **Capitalization:** on approval of a `CAPEX` invoice, instead of (or in addition to)
  expensing, post `Dr Fixed assets (15xx) / Cr Bank|Payables` and create a `FixedAsset`.
  *Reporting note:* `getBuildingFinancials` must stop counting capitalized capex as a P&L
  expense (it already separates `capexTotalCents`; ensure capitalized capex is excluded from
  `netIncomeCents`, replaced by depreciation).
- **Depreciation:** `depreciationService` computes annual straight-line
  `(cost − salvage)/usefulLifeYears`; a periodic job (mirror `BuildingDailySnapshot` job in
  `server.ts`) posts `Dr Depreciation expense (68xx) / Cr Accumulated depreciation (149x
  contra-asset)` monthly/annually; idempotent per asset per period.
- **Building shell:** held at cost — no shell FixedAsset, no shell depreciation.
- **COA:** ensure fixed-asset (15xx), accumulated-depreciation contra (149x), depreciation-
  expense (68xx) accounts.
- **Routes** `GET /fixed-assets?buildingId=`, `POST /fixed-assets/run-depreciation` →
  new OpenAPI entries. **UI:** fixed-asset register + depreciation line in reporting.

### WS-F — Per-tenant opening receivables (manual entry, aging, settlement)

Refines WS-A from an un-aged lump to real, ageable, settleable per-tenant opening items.

- **Model `OpeningReceivable`** (orgId, buildingId, leaseId/unitId, tenantName, amountCents,
  dueDate, status OPEN/SETTLED, settledInvoiceId?, sourceImportStatementId?). Manager enters
  these at switchover.
- **Control total:** sum of `OpeningReceivable` for a building must reconcile to the
  account-level import lump (WS-A figure) — show a variance indicator until they match.
- **Aging:** fold OpeningReceivable into `getArrearsAging` / building arrears by `dueDate`
  (so day-one arrears age correctly) — extend the existing bucket logic.
- **Settlement:** mark settled when paid (or generate a catch-up invoice so it flows through
  the normal payment path). De-dupe vs the WS-A ledger lump so totals don't double-count.
- **Routes** `GET/POST /opening-receivables`, `POST /opening-receivables/:id/settle` →
  new OpenAPI entries. **UI:** entry table on the building/units page; replaces the WS-A
  un-aged strip once entered.

## 4. Still out of scope (after this expansion)

- Consumption metering, multi-building-per-PDF imports — tracked elsewhere.
- Building-shell depreciation / cantonal tax-rate depreciation (WS-D holds shell at cost).
- Configurable fiscal year-end (WS-E hard-codes Dec-31; revisit if a non-calendar org appears).

---

## 5. Conformance with project good practices

This doc and the work it scopes must satisfy the standing guardrails
(see [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md), [PROJECT_STATE.md](../PROJECT_STATE.md)):

- **Backend layering (G20 / G22).** No new raw `prisma.*` in services or routes. WS-A's
  ledger reads go through a **new `financialsRepository` function**, called by the service.
  The ratchet baselines (24 svc files / 212 calls; 5 route files / 41 calls) must not rise.
- **OpenAPI sync.** WS-B reuses the existing `GET /ledger/balance-sheet` route → **zero
  new public unspecced routes**; the `PUBLIC_UNSPECCED_BUDGET` (111) does not rise. Any
  new public route introduced (none planned) must ship with an `openapi.yaml` entry, not
  an allowlist addition.
- **Design tokens (G23).** All new JSX uses semantic tokens (no raw `slate-*`/`bg-white`/
  inline `style={{}}`); dark-mode-aware; real exceptions marked `/* no-token: <reason> */`.
- **i18n.** All strings via `t()`, EN + Swiss-FR (`en/*.json` + `fr/*.json`). Reuse the
  `reporting.*` / `costPool.*` namespace conventions.
- **Migrations.** Any new column (D2 snapshot columns) is **additive/nullable, RLS-enabled**,
  applied via `server.ts start()` `migrate deploy`. Never `prisma db push`.
- **Snapshot cache.** WS-A must bust `BuildingFinancialSnapshot` when an opening figure
  changes (statement approval), consistent with the payment-time cache-bust pattern.
- **Frontend proxies.** Per-endpoint proxy files (no catch-all), per the cost-pool rule.
- **Tests / gates.** `tsc --noEmit` = 0; jest green; `code-quality-report.sh --strict`
  no regression vs `docs/quality-baseline.json`; `npm run guardrails` + `check-docs.js`
  (G21) green. New service logic gets unit tests (mirror `balanceSheet.unit.test.ts`).
- **Known gotchas to honor.** `formatChf()` already includes the "CHF " prefix (never
  `CHF {formatChf()}`); proxy routes must not rebuild the query string (double-QS bug);
  Prisma TS inference — filter by scalar `unitId`, never relation-filter + relation-select.
- **Doc governance.** On delivery, update `MEMORY.md` + the relevant project memory, and
  record commits in this doc's status table (matching the ancillary-costs doc pattern).

---

## 6. Related

- [`project_reporting`] — building/owner/unit reporting architecture (the flow side).
- [`project_pdf_ingestion`] — import pipeline + `getBalanceSheet` (the stock side).
- [`project_levered_npv`] — `Mortgage` table to reconcile debt position against (WS-C).
- [`reporting_enhancements`] — family-office KPI backlog (NAV/LTV/DSCR) unlocked by WS-C.
