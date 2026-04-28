# Responsive Audit — 2026-04-28

Slice: `ui-responsive-audit-and-remediation`

---

## Scope

All UI pages under `apps/web/pages/**/*.js` (excluding `api/`) and shared components under `apps/web/components/**/*.js`.

Reference patterns applied:
- **F-UI9** — dual-render (sm:hidden card list + hidden sm:block table)
- **F-UI11** — ScrollableTabs (tab-strip overflow collapse → "More" bottom sheet)

---

## Wave 1 — Audit Findings

### F-UI11: Bare `tab-strip` → Must Use `ScrollableTabs` (22 pages)

All pages below use `<div className="tab-strip">` directly. Per F-UI11, every tab strip must
use `<ScrollableTabs activeIndex={...}>` so overflow tabs collapse into a "More" bottom sheet
on narrow viewports instead of clipping off-screen.

| # | File | Line | Active-tab pattern | Severity |
|---|------|------|--------------------|----------|
| 1 | `manager/index.js` | 66 | `active` (integer) | HIGH |
| 2 | `manager/requests.js` | 1280 | `activeTab` (integer) | HIGH |
| 3 | `manager/finance/index.js` | 136 | `activeTabKey` (string key, FINANCE_TABS) | HIGH |
| 4 | `manager/finance/chart-of-accounts.js` | 245 | `activeTab` (integer) | MEDIUM |
| 5 | `manager/finance/ledger.js` | 278 | `tab` (string key, LEDGER_TABS) | MEDIUM |
| 6 | `manager/leases/index.js` | 526 | `activeTab` (integer) | MEDIUM |
| 7 | `manager/inventory.js` | 281 | `activeTab` (integer) | MEDIUM |
| 8 | `manager/people/index.js` | 381 | `activeTab` (integer or string, needs check) | MEDIUM |
| 9 | `manager/people/tenants/[id].js` | 197 | `activeTab` (string name) | MEDIUM |
| 10 | `manager/people/vendors/[id].js` | 251 | `activeTab` (string name) | MEDIUM |
| 11 | `manager/rfps.js` | 153 | `activeTab` (string key, STATUS_TABS) | MEDIUM |
| 12 | `manager/settings.js` | 369 | `activeTab` (integer) | MEDIUM |
| 13 | `manager/billing-schedules.js` | 110 | `activeTab` (integer) | MEDIUM |
| 14 | `manager/rent-adjustments/index.js` | 173 | `activeTab` (integer) | MEDIUM |
| 15 | `manager/charge-reconciliations/index.js` | 148 | `activeTab` (integer) | MEDIUM |
| 16 | `manager/contractor-billing-schedules/index.js` | 333 | `activeTab` (integer) | MEDIUM |
| 17 | `manager/requests/[id].js` | 768 | `activeTab` (string key) | MEDIUM |
| 18 | `manager/vacancies/index.js` | 198 | always index 0 | LOW |
| 19 | `owner/index.js` | 77 | `activeTab` (string key) | HIGH |
| 20 | `owner/requests/[id].js` | 600 | `activeTab` (string key) | MEDIUM |
| 21 | `contractor/jobs.js` | 205 | `activeTab` (integer) | MEDIUM |
| 22 | `contractor/invoices.js` | 412 | `activeTab` (string key, STATUS_TABS) | MEDIUM |

**Fix pattern:** replace `<div className="tab-strip">...</div>` with
`<ScrollableTabs activeIndex={N}>...</ScrollableTabs>`.
Add import: `import ScrollableTabs from "../../components/mobile/ScrollableTabs"` (adjust depth).

---

### F-UI9: Tables Without Mobile Dual-Render (9 pages)

Pages below have `<table className="inline-table">` (or similar) with no corresponding
`sm:hidden` mobile card list. Per F-UI9, every table visible on mobile must have a
`sm:hidden` card-list alternative.

| # | File | Table lines | Current mobile handling | Severity |
|---|------|------------|------------------------|----------|
| 1 | `owner/approvals.js` | 448, 498, 654 | None | HIGH |
| 2 | `manager/rfps/[id].js` | 282, 345, 422 | `hidden sm:table-cell` column hiding only — no card | MEDIUM |
| 3 | `manager/finance/index.js` | 237 | None | MEDIUM |
| 4 | `manager/cashflow/[id].js` | 142 | None | MEDIUM |
| 5 | `manager/charge-reconciliations/[id].js` | varies | None | MEDIUM |
| 6 | `manager/finance/invoices/[id].js` | 448 | None | MEDIUM |
| 7 | `manager/people/tenants/[id].js` | 336, 381, 506, 547 | None | MEDIUM |
| 8 | `manager/people/vendors/[id].js` | varies | None | MEDIUM |
| 9 | `contractor/rfps/[id].js` | varies | None | LOW |

**Fix pattern:** wrap each table in `<div className="hidden sm:block">` and add a sibling
`<div className="sm:hidden divide-y divide-slate-100">` card list above it with 2–4 essential
fields per row.

---

### Already-Compliant Pages (no action needed)

**Tab strips using ScrollableTabs correctly:**
- `owner/approvals.js` — uses `ScrollableTabs` (tabs compliant; table needs F-UI9 above)
- `admin-inventory/buildings/[id].js` — uses `ScrollableTabs`
- `admin-inventory/units/[id].js` — uses `ScrollableTabs`

**Tables with F-UI9 dual-render correctly applied:**
- `manager/requests.js` — ConfigurableTable + `mobileCard` prop ✓
- `manager/leases/index.js` — ConfigurableTable + `mobileCard` ✓
- `manager/rfps.js` — ConfigurableTable + `mobileCard` ✓
- `manager/billing-schedules.js` — ConfigurableTable + `mobileCard` ✓
- `manager/charge-reconciliations/index.js` — ConfigurableTable + `mobileCard` ✓
- `manager/contractor-billing-schedules/index.js` — ConfigurableTable + `mobileCard` ✓
- `manager/rent-adjustments/index.js` — ConfigurableTable + `mobileCard` ✓
- `manager/inventory.js` — ConfigurableTable + `mobileCard` ✓
- `manager/finance/invoices.js` — ConfigurableTable + `mobileCard` ✓
- `manager/finance/payments.js` — ConfigurableTable + `mobileCard` ✓
- `manager/finance/expenses.js` — ConfigurableTable + `mobileCard` ✓
- `manager/finance/chart-of-accounts.js` — `sm:hidden` card lists ✓
- `manager/finance/ledger.js` — `sm:hidden` card lists ✓
- `manager/finance/charges.js` — `sm:hidden` card lists ✓
- `manager/index.js` (buildings table) — `sm:hidden` card list ✓
- `manager/people/index.js` — `sm:hidden` card lists ✓
- `manager/people/tenants.js` — ConfigurableTable + `mobileCard` ✓
- `manager/people/owners.js` — ConfigurableTable + `mobileCard` ✓
- `manager/people/vendors.js` — ConfigurableTable + `mobileCard` ✓
- `manager/leases/[id].js` — `sm:hidden` card list ✓
- `manager/leases/templates.js` — ConfigurableTable + `mobileCard` ✓
- `manager/settings.js` — `sm:hidden` card lists ✓
- `manager/vacancies/index.js` — `sm:hidden` card list ✓
- `manager/vacancies/[unitId]/applications.js` — `sm:hidden` card list ✓
- `manager/requests/[id].js` — `sm:hidden` card lists ✓
- `owner/properties.js` — `sm:hidden` card lists ✓
- `owner/work-requests.js` — `sm:hidden` card lists ✓
- `owner/invoices.js` — ConfigurableTable + `mobileCard` ✓
- `owner/finance.js` — ConfigurableTable + `mobileCard` ✓
- `owner/requests/[id].js` — `sm:hidden` card list ✓
- `owner/vacancies/[unitId]/candidates.js` — `sm:hidden` card list ✓
- `contractor/rfps.js` — ConfigurableTable + `mobileCard` ✓
- `admin-inventory/buildings/[id].js` — `sm:hidden` card lists ✓
- `admin-inventory/units/[id].js` — `sm:hidden` card lists ✓

---

### Uncertain / Manual-Verification-Required

- `manager/cashflow/index.js` — card-based layout (no inline-table); appears responsive but
  uses `CashflowPlansList` component. Visually verify overflow on card content at 375 px.
- `owner/reporting.js` — no tables found; content is card/section based. Appears responsive.
  Verify KPI grid stacking on narrow viewport.
- `owner/strategy.js` / `owner/settings/strategy.js` — no tables found; mixed card layout.
  Verify form fields stack correctly.
- `tenant/requests.js` — in the F-UI9 completed list per PROJECT_STATE.md; confirm `sm:hidden`
  card list is present (verified: ✓).
- Pages with no tables and no tabs (login, apply, listings, capture) — out of scope for F-UI9/F-UI11.

---

## Wave 2 — Remediation Order

**Phase A — High priority (ScrollableTabs, tab-strip overflow):**
Rows 1, 2, 3, 19 from the F-UI11 table.

**Phase B — Medium priority (remaining tab-strips + key tables):**
All remaining F-UI11 rows + F-UI9 rows 1–8.

**Phase C — Low priority (defer with reason):**
- F-UI9 row 9 (`contractor/rfps/[id].js`) — contractor detail page; low traffic on mobile.
  Defer to next dedicated contractor-mobile pass. Table is read-only (no actions).
