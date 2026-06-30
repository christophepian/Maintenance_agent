# Architecture & Scaling Audit — 2026-06-30

Architecture / scaling / front-end-UX audit of the monorepo, plus the record of
what was acted on. Distinct from `docs/AUDIT.md` (bug findings) and
`docs/CRITICAL_AUDIT_2026-06-23.md` (governance). Findings verified against the
code at the time of writing; re-verify before acting on a stale item.

## How findings are tiered

- **Tier 1** — will actually block scaling (latency, pool saturation, multi-tenant correctness).
- **Tier 2** — maintainability / correctness debt (god files, layer leakage, overfetch, indexes).
- **Tier 3** — front-end UX & front-end scaling.

---

## Tier 1 — scaling blockers

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| 1 | Portfolio financials fan-out: `getPortfolioSummary` ran the per-building engine once per building; `getPortfolioMonthlyBreakdown` did it **serially** once per month | `services/financials.ts:570`, `:669` | **Partially done** — see "Shipped" below; deep batch deferred |
| 2 | OCR runs **synchronously inside the HTTP request** (5–30s, no timeout, single Node process) | `routes/rentalApplications.ts:154`; `services/scanners/localOcrScanner.ts` (2,192 lines), Azure scanner (1,944) | Open — **recommended next** |
| 3 | Multi-tenancy by relation-chain instead of denormalized `orgId` — `InvoiceLineItem`, `RequestEvent`, `AssetIntervention`, `RfpQuote`, `CostEntry` (+~26 more) have no direct `orgId`; scoped only via parent → join-or-leak risk + slow | schema.prisma (per-model `@@index` shows parent-only) | Open |
| 4 | Money representation split: **14** `…Chf Float` vs **13** `…Chf Int` vs **39** `…Cents Int`; valuations/mortgage are floats that feed NPV/DSCR/LTV math | `grep -nE '\w+Chf\s+Float' schema.prisma` | Open |

## Tier 2 — maintainability / correctness debt

- **God files mixing concerns:** `financials.ts` (1,930), `importedStatementService.ts` (1,649), `leases.ts` (1,616), `invoices.ts` (1,088). Real duplication: charge apportionment lives in `leases.ts` + `ancillaryReconciliationService.ts` + `financials.ts`; "create an invoice" has no single canonical entry point (4 sites).
- **Layer leakage in routes (G22 baseline of 5):** `correspondence.ts` and `conditionReports.ts` do full CRUD directly via Prisma in the handler. Worth burning down (real features, not dev scaffolding).
- **Overfetch:** `*_FULL_INCLUDE` (6+ joins) used on list endpoints; no `*_LIST_INCLUDE`/`*_DETAIL_INCLUDE` split; no `take`/`skip` pagination on big list queries.
- **Missing composite indexes:** `Invoice(orgId,status)`, `Request(status,createdAt)`+`(assignedContractorId)`, `Job(status)`+`(completedAt)`, `Lease(orgId,status)`, `Unit(orgId,isVacant)`, `Invoice(dueDate)`/`(paidAt)`.

## Tier 3 — front-end UX & scaling

- **Monolithic pages:** `admin-inventory/buildings/[id].js` = 3,286 lines / **95 useState**; `units/[id].js` = 2,002 / **78 useState**. Slow hydration, whole-page re-renders.
- **Fetch waterfall** in `buildings/[id].js` (`loadBuilding` → serial `await loadUnits()` → `loadBuildingConfig()` → `loadApprovalRules()` → `loadLeaseTemplates()`) — should be one `Promise.all`.
- **300-file proxy layer:** **251 of 300** files in `pages/api/` are ≤8-line passthroughs to `proxyToBackend`; the ~20 with real logic are the only ones that need to be files. Candidate for a single `[...slug].js` catch-all.
- **Almost no code-splitting:** only 2 `next/dynamic` (both the chart, correctly). chart.js / lucide-react tree-shake fine.

## Explicitly de-prioritized (low real impact)

- "O(n) router regex scan" — 40 routes × a regex is microseconds; **not** a bottleneck.
- String status fields → enums; intentional immutable JSON columns — leave them.

---

## Shipped this session (PR #1, branch `perf/portfolio-financials-concurrency`)

Targets Tier-1 #1. **No financial figure changes** — guarded by a new
characterization test.

**Layer 0 — safety net** (`a9a9a3a`)
- `src/__tests__/portfolioBreakdown.characterization.test.ts` — seeds 2 buildings, pins the invariants any refactor must keep: portfolio totals == Σ per-building rows; `monthlyBreakdown[m]` == an independent per-month portfolio summary.
- `src/utils/concurrency.ts` — `mapWithConcurrency(items, limit, fn)` (order-preserving, bounded) + unit tests.

**Layer 1 — parallelize the serial monthly loop** (`a9a9a3a`)
- `getPortfolioMonthlyBreakdown` 12-iteration serial `for await` → bounded-concurrent (limit 3). Order preserved, formulas untouched.

**Layer 2 — dedupe + bound** (`09d1b3b`)
- `getBuildingFinancials` fetched the active unit-id list **3× per building** → now once, threaded into `getReceivables`/`getPayables`.
- `getPortfolioSummary`'s **unbounded** `Promise.allSettled` over all buildings → bounded `mapWithConcurrency` (limit 4); failed building still skipped + logged; totals unchanged.

**Verification:** `tsc` clean; financials + characterization + concurrency suites green (33 tests); full suite 1166 passed. The single `healthContract` failure is **pre-existing on `main`** (reproduced with this branch's change stashed) — consistent with the known "strict quality gate red on main from pre-existing drift".

---

## Backlog (prioritized)

1. **Tier-1 #2 async OCR boundary** — return `202` + job id, drain in background like the email queue (`flushPendingEmails`). Self-contained; biggest "visible production hang" risk. *Decision needed:* in-process queue (fits existing pattern) vs a real queue; the upload API contract flips sync→poll, so the frontend upload flow changes too.
2. **Tier-1 #1 deep batch (deferred from this session)** — batch the per-building *fresh-compute* path: ~8 plural `*ForBuildings` repo fns (`WHERE buildingId IN (...)` + `groupBy`) + a batched snapshot-write path. **Subtlety:** the snapshot cache returns a deliberately "lite" DTO (receivables/payables/maintenanceRatio = 0 for cached buildings), so portfolio totals depend on that exact shape — any batch must reproduce it. The characterization test added this session is the gate. ~1.5–2 days, own review cycle.
3. **Tier-1 #3 `orgId` denormalization** — high-traffic financial children first (`InvoiceLineItem`, `CostEntry`, `RfpQuote`); migration + backfill via the relation chain. Correctness + multi-tenant safety.
4. **Tier-1 #4 money → integer cents** on valuation/mortgage fields, all consumers (schema → repo includes → DTO → validation → OpenAPI → contract tests → frontend formatters).
5. **Tier-3 frontend** — `buildings/[id].js` fetch waterfall → `Promise.all` + per-tab split; collapse the 251 boilerplate proxies into one catch-all.
