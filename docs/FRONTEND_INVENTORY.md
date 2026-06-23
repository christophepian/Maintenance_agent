# Frontend Page Inventory

> **Generated** 2026-06-23 by `scripts/gen-frontend-inventory.js` — do not hand-edit.
> Re-run with `npm run inventory` after adding/removing pages.

---

## Summary

| Persona / area | UI pages |
|---|---|
| manager | 51 |
| owner | 19 |
| tenant | 11 |
| (root) | 10 |
| contractor | 9 |
| admin-inventory | 2 |
| admin | 1 |
| capture | 1 |

**Totals:** 104 UI pages · 289 API proxy files (`apps/web/pages/api/`).

Empty-state / loading-state columns are heuristic (token/component grep), useful as a coverage signal, not a guarantee.

---

## Full Page List

### manager (51)

| Route | Empty state | Loading state |
|---|---|---|
| /manager | — | yes |
| /manager/assets | — | — |
| /manager/billing-schedules | yes | yes |
| /manager/buildings/[id]/financials | — | yes |
| /manager/cashflow | — | — |
| /manager/cashflow/[id] | yes | yes |
| /manager/charge-reconciliations | yes | yes |
| /manager/charge-reconciliations/[id] | — | yes |
| /manager/condition-reports/[id] | — | yes |
| /manager/contractor-billing-schedules | yes | yes |
| /manager/contractor-billing-schedules/[id] | — | yes |
| /manager/correspondence | yes | yes |
| /manager/correspondence/[id] | — | yes |
| /manager/correspondence/new | — | — |
| /manager/dashboard-v2 | — | yes |
| /manager/emails | yes | yes |
| /manager/finance | yes | yes |
| /manager/finance/billing-entities | — | — |
| /manager/finance/billing-entities/[id] | yes | yes |
| /manager/finance/billing-periods | yes | yes |
| /manager/finance/billing-periods/[id] | yes | yes |
| /manager/finance/charges | yes | yes |
| /manager/finance/chart-of-accounts | yes | yes |
| /manager/finance/expenses | — | yes |
| /manager/finance/imports/[id] | — | yes |
| /manager/finance/invoices | yes | yes |
| /manager/finance/invoices/[id] | yes | yes |
| /manager/finance/invoices/new | — | — |
| /manager/finance/ledger | — | yes |
| /manager/finance/payments | — | yes |
| /manager/inventory | yes | yes |
| /manager/leases | yes | yes |
| /manager/leases/[id] | — | yes |
| /manager/people | yes | yes |
| /manager/people/owners/[id] | — | yes |
| /manager/people/tenants | yes | yes |
| /manager/people/tenants/[id] | — | yes |
| /manager/people/vendors | yes | yes |
| /manager/people/vendors/[id] | — | yes |
| /manager/properties | — | — |
| /manager/rent-adjustments | yes | yes |
| /manager/rent-adjustments/[id] | — | yes |
| /manager/rental-applications/[applicationId] | — | yes |
| /manager/requests | yes | yes |
| /manager/requests/[id] | yes | yes |
| /manager/rfps | yes | yes |
| /manager/rfps/[id] | yes | yes |
| /manager/settings | yes | yes |
| /manager/vacancies | yes | yes |
| /manager/vacancies/[unitId]/applications | — | yes |
| /manager/work-requests | — | — |

### owner (19)

| Route | Empty state | Loading state |
|---|---|---|
| /owner | — | yes |
| /owner/approvals | yes | yes |
| /owner/billing-entities | — | — |
| /owner/finance | yes | yes |
| /owner/finance/invoices/[id] | yes | yes |
| /owner/invoices | yes | yes |
| /owner/jobs | yes | yes |
| /owner/properties | yes | yes |
| /owner/reporting | — | yes |
| /owner/requests/[id] | yes | yes |
| /owner/rfps | — | — |
| /owner/rfps/[id] | yes | yes |
| /owner/settings | yes | yes |
| /owner/settings/strategy | — | yes |
| /owner/strategy | — | — |
| /owner/vacancies | — | — |
| /owner/vacancies/[unitId]/candidates | — | yes |
| /owner/vacancies/[unitId]/fill | — | yes |
| /owner/work-requests | yes | yes |

### tenant (11)

| Route | Empty state | Loading state |
|---|---|---|
| /tenant/assets | — | — |
| /tenant/condition-reports | yes | yes |
| /tenant/condition-reports/[id] | — | yes |
| /tenant/inbox | yes | yes |
| /tenant/invoices/[id] | — | yes |
| /tenant/leases/[id] | — | yes |
| /tenant/letters | yes | yes |
| /tenant/letters/[id] | — | yes |
| /tenant/myhome | — | yes |
| /tenant/requests | yes | yes |
| /tenant/settings | — | — |

### (root) (10)

| Route | Empty state | Loading state |
|---|---|---|
| /apply | — | yes |
| /index | — | — |
| /listings | — | yes |
| /login | — | yes |
| /reset-password | — | yes |
| /set-password | — | yes |
| /tenant | — | — |
| /tenant-chat | — | yes |
| /tenant-dev-login | yes | yes |
| /tenant-form | yes | yes |

### contractor (9)

| Route | Empty state | Loading state |
|---|---|---|
| /contractor | — | yes |
| /contractor/estimates | — | — |
| /contractor/invoices | — | yes |
| /contractor/jobs | yes | yes |
| /contractor/jobs/[id] | — | yes |
| /contractor/rfps | — | yes |
| /contractor/rfps/[id] | — | yes |
| /contractor/settings | — | — |
| /contractor/status-updates | — | — |

### admin-inventory (2)

| Route | Empty state | Loading state |
|---|---|---|
| /admin-inventory/buildings/[id] | yes | yes |
| /admin-inventory/units/[id] | yes | yes |

### admin (1)

| Route | Empty state | Loading state |
|---|---|---|
| /admin/users | yes | yes |

### capture (1)

| Route | Empty state | Loading state |
|---|---|---|
| /capture/[token] | — | yes |
