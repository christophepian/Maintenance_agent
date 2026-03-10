# Frontend Page Inventory

Updated: 2026-03-12 (frontend-debt-cleanup slice)

---

## Summary

| Persona | Page count | API proxy count | Has empty state | Has loading state |
|---------|-----------|-----------------|-----------------|-------------------|
| manager | 34 | ~60 | Y | Y |
| contractor | 6 | 4 | Y | Y |
| tenant | 8 | ~12 | Y | Y |
| owner | 8 | ~6 | Y | Y |
| public | 2 | 2 | Y | Y |
| shared/api | 8 | ~35 | — | — |

**Totals:** 66 UI pages · 119 API proxy files

---

## Full Page List

### Manager Pages (34)

| Path | Type | Uses proxyToBackend | Has empty state | Last modified | Status |
|------|------|--------------------|-----------------|----|--------|
| /manager/index | UI — dashboard | N/A | yes | 2026-03-08 | active |
| /manager/requests | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/work-requests | UI — redirect | N/A | — | 2026-02-27 | active (→ /manager/requests) |
| /manager/assets | UI — redirect | N/A | — | 2026-03-08 | active (→ /admin-inventory) |
| /manager/properties | UI — redirect | N/A | — | 2026-03-08 | active (→ /admin-inventory) |
| /manager/emails | UI — list | N/A | yes | 2026-03-04 | suspect (dev-only, not in prod nav) |
| /manager/reports | UI — coming-soon | N/A | — | 2026-03-12 | active (coming-soon stub) |
| /manager/rfps | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/settings | UI — form | N/A | — | 2026-03-04 | active |
| /manager/legal | UI — hub | N/A | — | 2026-03-08 | active |
| /manager/legal/depreciation | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/legal/evaluations | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/legal/mappings | UI — list | N/A | yes | 2026-03-06 | active |
| /manager/legal/rules | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/finance/index | UI — hub | N/A | — | 2026-03-08 | active |
| /manager/finance/billing-entities | UI — list | N/A | yes (via component) | 2026-02-12 | active |
| /manager/finance/charges | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/finance/expenses | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/finance/invoices | UI — list | N/A | yes | 2026-03-04 | active |
| /manager/finance/ledger | UI — placeholder | N/A | — | 2026-02-08 | active (placeholder) |
| /manager/finance/payments | UI — list | N/A | yes | 2026-03-08 | active |
| /manager/leases/index | UI — list | N/A | yes | 2026-03-02 | active |
| /manager/leases/[id] | UI — detail | N/A | yes | 2026-03-08 | active |
| /manager/leases/templates | UI — list | N/A | yes | 2026-03-04 | active |
| /manager/people/index | UI — hub | N/A | — | 2026-02-08 | active |
| /manager/people/tenants | UI — list | N/A | yes | 2026-03-09 | active |
| /manager/people/tenants/[id] | UI — detail | N/A | yes | 2026-03-08 | active |
| /manager/people/vendors | UI — list | N/A | yes | 2026-03-09 | active |
| /manager/people/owners | UI — coming-soon | N/A | — | 2026-03-12 | active (coming-soon stub) |
| /manager/people/vendors/[id] | UI — detail | N/A | yes | 2026-03-08 | active |
| /manager/rental-applications/[applicationId] | UI — detail | N/A | yes | 2026-03-08 | active |
| /manager/vacancies/index | UI — list | N/A | yes | 2026-03-04 | active |
| /manager/vacancies/[unitId]/applications | UI — detail | N/A | yes | 2026-03-08 | active |
| /manager/buildings/[id]/financials | UI — detail | N/A | yes | 2026-03-08 | active |

### Contractor Pages (6)

| Path | Type | Uses proxyToBackend | Has empty state | Last modified | Status |
|------|------|--------------------|-----------------|----|--------|
| /contractor/index | UI — dashboard | N/A | yes | 2026-03-04 | active |
| /contractor/jobs | UI — list | N/A | yes | 2026-03-08 | active |
| /contractor/jobs/[id] | UI — detail | N/A | yes | 2026-03-08 | active |
| /contractor/invoices | UI — list | N/A | yes | 2026-03-08 | active |
| /contractor/estimates | UI — placeholder | N/A | — | 2026-02-08 | active (coming soon) |
| /contractor/status-updates | UI — redirect | N/A | — | 2026-03-08 | active (→ /contractor/jobs) |

### Owner Pages (8)

| Path | Type | Uses proxyToBackend | Has empty state | Last modified | Status |
|------|------|--------------------|-----------------|----|--------|
| /owner/index | UI — dashboard | N/A | yes | 2026-03-08 | active |
| /owner/approvals | UI — list | N/A | yes | 2026-03-04 | active |
| /owner/invoices | UI — list | N/A | yes | 2026-03-08 | active |
| /owner/jobs | UI — list | N/A | yes | 2026-03-02 | active |
| /owner/billing-entities | UI — list | N/A | yes (via component) | 2026-02-12 | active |
| /owner/vacancies | UI — list | N/A | yes | 2026-03-08 | active |
| /owner/vacancies/[unitId]/candidates | UI — detail | N/A | yes | 2026-03-04 | active |
| /owner/vacancies/[unitId]/fill | UI — wizard | N/A | yes | 2026-03-04 | active |

### Tenant Pages (8)

| Path | Type | Uses proxyToBackend | Has empty state | Last modified | Status |
|------|------|--------------------|-----------------|----|--------|
| /tenant | UI — login | N/A | — | 2026-03-04 | active |
| /tenant-form | UI — form | N/A | — | 2026-03-08 | active |
| /tenant-chat | UI — chat | N/A | — | 2026-03-04 | active |
| /tenant/inbox | UI — list | N/A | yes | 2026-03-08 | active |
| /tenant/invoices | UI — list | N/A | yes | 2026-03-02 | active |
| /tenant/leases/index | UI — list | N/A | yes | 2026-03-04 | active |
| /tenant/leases/[id] | UI — detail | N/A | yes | 2026-03-04 | active |
| /tenant/assets | UI — coming-soon | N/A | — | 2026-03-12 | active (coming-soon stub) |

### Public / Shared Pages (8)

| Path | Type | Uses proxyToBackend | Has empty state | Last modified | Status |
|------|------|--------------------|-----------------|----|--------|
| /_app | framework | N/A | — | 2026-02-08 | active |
| /index | hub | N/A | — | 2026-03-12 | active |
| /login | UI — form | N/A | — | 2026-03-08 | active |
| /apply | UI — wizard | N/A | yes | 2026-03-02 | active |
| /listings | UI — list | N/A | yes | 2026-03-02 | active |
| /admin-inventory | UI — list | N/A | yes | 2026-03-04 | active |
| /admin-inventory/asset-models | UI — list | N/A | yes | 2026-03-04 | active |
| /admin-inventory/buildings/index | UI — list | N/A | yes | 2026-03-08 | active |
| /admin-inventory/buildings/[id] | UI — detail | N/A | yes | 2026-03-09 | active |
| /admin-inventory/units/[id] | UI — detail | N/A | yes | 2026-03-07 | active |

---

## Flagged Pages

### ⚠️ Suspect (Orphaned / Dev-only)

| Page | Concern | Recommendation |
|------|---------|----------------|
| /manager/emails | Dev-only email outbox viewer — behind "Dev Tools" nav section, not visible in production | Guard with `DEV_IDENTITY_ENABLED` check or remove from production builds |
| /manager/finance/ledger | Placeholder since 2026-02-08, no implementation | Implement or remove nav link |
| /contractor/estimates | "Coming soon" stub since 2026-02-08 | Implement or hide from nav |

### 🔁 Duplicates

| Page A | Page B | Overlap | Recommendation |
|--------|--------|---------|----------------|
| /contractors (root) | /manager/people/vendors | ✅ **RESOLVED** — /contractors deleted, next.config.js redirect in place | — |
| /manager/finance/billing-entities | /owner/billing-entities | Both wrap same `BillingEntityManager` component with different AppShell role | Acceptable — persona-specific wrapper |

### 🔀 Redirect Pages (legacy aliases)

| Source | Target | Notes |
|--------|--------|-------|
| /manager/assets | /admin-inventory | Legacy path |
| /manager/properties | /admin-inventory | Legacy path |
| /manager/operations/inventory | /admin-inventory | ✅ Moved to next.config.js redirect (page deleted) |
| /manager/operations/contractors | /manager/people/vendors | ✅ Moved to next.config.js redirect (page deleted) |
| /manager/operations/tenants | /manager/people/tenants | ✅ Moved to next.config.js redirect (page deleted) |
| /manager/work-requests | /manager/requests | Preserved query params |
| /contractor/status-updates | /contractor/jobs | Feature merged |

---

## Proxy Standardization Audit

### Infrastructure

The shared proxy utility at `apps/web/lib/proxy.js` (`proxyToBackend`) handles all 5 checks:

| Check | Status | How |
|-------|--------|-----|
| ① Uses proxyToBackend | ✅ baseline | — |
| ② Forwards Authorization header | ✅ | Clones all request headers (strips host/connection) |
| ③ Binary response handling | ✅ | Auto-detects `application/pdf` & `image/png`; also accepts `binary` option |
| ④ Query param passthrough | ✅ | Splits URL at `?` and appends raw query string unchanged |
| ⑤ Transparent error status codes | ✅ | `res.status(upstreamRes.status)` — all 4xx/5xx pass through |

### Proxy Files Using `proxyToBackend` (119 of 119) — All Pass ✅

All files using `proxyToBackend()` automatically pass all 5 checks. Patterns include:
- **Simple passthrough** (~85 files): `proxyToBackend(req, res, "/path")`
- **Dynamic ID routes** (~25 files): `proxyToBackend(req, res, "/path/" + req.query.id)`
- **Catch-all routes** (5 files): Joins array segments from `[...id]`
- **Binary-aware** (3 files): `proxyToBackend(req, res, path, { binary: true })`
- **Custom headers** (4 files): Contractor routes inject `X-Dev-Role: CONTRACTOR`
- **Multipart** (2 files): Uses `bodyParser: false` config + raw stream forwarding
- **Transform proxy** (1 file): `requests/approve.js` — POST→PATCH with fixed body via `{ method: "PATCH" }` option
- **Legacy compat** (1 file): `requests.js` — maps `text` → `description` in POST body before forwarding

### ✅ Non-Conforming Proxy Files — All Resolved

Migrated in frontend-debt-cleanup slice (2026-03-12):
- `pages/api/requests.js` — was 97 lines → now 14 lines using `proxyToBackend`; preserves `text→description` compat
- `pages/api/requests/approve.js` — was 58 lines → now 22 lines using `proxyToBackend` with `{ method: "PATCH" }`
- `pages/api/work-requests.js` — was already conforming (6 lines, uses `proxyToBackend`)

### Minor Observations

- `pages/api/invoices.js` and `pages/api/invoices/index.js` both proxy to `/invoices` — Next.js resolves to the more specific one, but `invoices.js` is effectively dead code.

---

## Page Archetypes

| Archetype | Description | Example pages | Required elements |
|-----------|-------------|---------------|-------------------|
| **List page** | Fetches and displays a filterable collection | /manager/requests, /manager/leases/index, /manager/people/tenants, /contractor/jobs | Loading state, empty state, data table/cards, optional filters, optional action button |
| **Detail page** | Shows a single entity with related data and actions | /manager/leases/[id], /contractor/jobs/[id], /manager/people/tenants/[id], /manager/people/vendors/[id] | Header with title, status badge, tabbed or sectioned content, action buttons, error/not-found state |
| **Dashboard** | Summary metrics with quick-action links | /manager/index, /contractor/index, /owner/index | KPI stat cards, recent items list, quick-action buttons, collapsible sections |
| **Wizard** | Multi-step form flow for complex creation | /apply (3-step rental), /owner/vacancies/[unitId]/fill | Step indicator, back/next navigation, per-step validation, progress persistence |
| **Settings page** | CRUD for configuration values | /manager/settings | Form fields, save/cancel buttons, success/error feedback message |
| **Hub page** | Navigation gateway to sub-pages | /manager/finance/index, /manager/people/index, /manager/legal | Card-grid or link-list to child routes, no data fetching |
| **Redirect page** | Legacy URL alias → canonical path | /manager/work-requests, /manager/assets, /manager/properties | `router.replace()` on mount, preserves query params |
| **Placeholder** | Stub for planned feature | /manager/reports, /manager/finance/ledger, /contractor/estimates, /tenant/assets | "Coming soon" or placeholder text, no data fetching |

### Archetype Conformance

#### List pages (expected: loading state + empty state + data rendering)

| Page | Loading | Empty | Filters | Conforms |
|------|---------|-------|---------|----------|
| /manager/requests | ✅ | ✅ | ✅ status, search | ✅ |
| /manager/leases/index | ✅ | ✅ | ❌ | ✅ |
| /manager/leases/templates | ✅ | ✅ | ❌ | ✅ |
| /manager/people/tenants | ✅ | ✅ | ✅ search | ✅ |
| /manager/people/vendors | ✅ | ✅ | ✅ search | ✅ |
| /manager/finance/charges | ✅ | ✅ | ✅ tabs | ✅ |
| /manager/finance/expenses | ✅ | ✅ | ✅ category | ✅ |
| /manager/finance/invoices | ✅ | ✅ | ✅ status | ✅ |
| /manager/finance/payments | ✅ | ✅ | ✅ tabs | ✅ |
| /manager/legal/rules | ✅ | ✅ | ❌ | ✅ |
| /manager/legal/evaluations | ✅ | ✅ | ✅ obligation, category | ✅ |
| /manager/legal/depreciation | ✅ | ✅ | ✅ search, type | ✅ |
| /manager/legal/mappings | ✅ | ✅ | ❌ | ✅ |
| /manager/rfps | ✅ | ✅ | ✅ status tabs | ✅ |
| /manager/emails | ✅ | ✅ | ❌ | ✅ |
| /manager/vacancies/index | ✅ | ✅ | ❌ | ✅ |
| /contractor/jobs | ✅ | ✅ | ✅ status | ✅ |
| /contractor/invoices | ✅ | ✅ | ✅ status | ✅ |
| /owner/approvals | ✅ | ✅ | ❌ | ✅ |
| /owner/invoices | ✅ | ✅ | ✅ status | ✅ |
| /owner/jobs | ✅ | ✅ | ✅ status | ✅ |
| /owner/vacancies | ✅ | ✅ | ❌ | ✅ |
| /listings | ✅ | ✅ | ❌ | ✅ |

**Result:** All list pages conform — every one has loading state + empty state.

#### Detail pages (expected: header + sections + status + actions + not-found)

| Page | Header | Sections | Status badge | Actions | Not-found | Conforms |
|------|--------|----------|-------------|---------|-----------|----------|
| /manager/leases/[id] | ✅ | ✅ tabs | ✅ | ✅ | ✅ | ✅ |
| /manager/people/tenants/[id] | ✅ | ✅ tabs | ❌ | ✅ | ✅ | ⚠️ no status badge |
| /manager/people/vendors/[id] | ✅ | ✅ tabs | ❌ | ✅ | ✅ | ⚠️ no status badge |
| /contractor/jobs/[id] | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| /manager/rental-applications/[applicationId] | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| /admin-inventory/buildings/[id] | ✅ | ✅ tabs | ❌ | ✅ | ✅ | ⚠️ no status badge (entity has no status) |
| /admin-inventory/units/[id] | ✅ | ✅ tabs | ✅ | ✅ | ✅ | ✅ |

#### Dashboards (expected: KPIs + recent items + quick actions)

| Page | KPI cards | Recent items | Quick actions | Conforms |
|------|-----------|-------------|---------------|----------|
| /manager/index | ✅ | ✅ | ✅ | ✅ |
| /contractor/index | ✅ | ✅ | ✅ | ✅ |
| /owner/index | ✅ | ✅ | ✅ | ✅ |

---

## Empty State Style Audit (Manager Pages)

All manager list pages already implement empty states. Current styling approaches:

| Pattern | Pages using it | Notes |
|---------|---------------|-------|
| Tailwind `className="text-sm text-slate-500"` | requests, leases, templates, legal/*, rfps, emails, people/*, vacancies | Most common — lightweight inline text |
| `managerStyles` via `style={styles.headingFlush}` | finance/charges, finance/expenses | Uses shared style object |
| `Panel` wrapper + Tailwind text | depreciation, mappings | Wraps empty text in a Panel card |
| `className="bg-white rounded-lg border p-8 text-center"` | leases/index | Full card empty state with CTA |

**Recommendation:** Standardize all manager list page empty states to use `styles.emptyState` + `styles.emptyStateText` from managerStyles.js for consistency. This requires adding those two style definitions to managerStyles.js and updating pages that use ad-hoc patterns.

---

<!-- reviewed 2026-03-12 -->
