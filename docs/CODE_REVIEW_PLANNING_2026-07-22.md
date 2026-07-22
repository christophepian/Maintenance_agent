# Code Review — Financial Planning Feature (2026-07-22)

**Scope reviewed:** Phase 3 Financial Planning (NPV Scenarios · Forward CapEx · Renovation
Simulator · Cashflow Plans). Repo `Maintenance_Agent` @ `main` `07d4d8c`.
~30 files / ~7,800 LOC. Backend engine (`npvService`, `capexProjectionService`, `financeMath`,
`debtService`, `routes/cashflowPlans`, `forecasting.computeRecommendation`, validation,
workflow, repository), supporting services (`assetInventory`, `replacementCostService`,
`taxClassificationService`), frontend (`NPVScenariosPanel`, `RenovationSimulatorDrawer`,
`RenovationAccordion`, `CashflowPlansList`, `cashflow/[id].js`, Planning tab, proxy), and 12 test suites.

**Overall: Good — Ready with remediation.** 0 Critical, 7 High, 13 Medium, 8 Low/Info.

This document is the tracking artifact for the remediation sweep on branch
`fix/planning-review-remediation`. It is archived to `_archive/` once all items are closed.

---

## Findings (CR-IDs)

### High
- **CR-001 · Security/Isolation** — `findBuildingIdForAsset` reads Asset by `id` with no `orgId`. `cashflowPlanRepository.ts:219-228`. Cross-tenant read → RFP could target another org's building. Fix: scope by `orgId`.
- **CR-002 · Correctness** — `computeDepreciation` divides by `usefulLifeMonths` which can be `0` → `NaN` propagates into capex/NPV. `assetInventory.ts:109`. Fix: guard `> 0`.
- **CR-003 · Performance/Scalability** — Portfolio NPV `Promise.all` over *all active buildings*, unbounded concurrency. `npvService.ts:796` + `cashflowPlans.ts:421-425`. Fix: bound concurrency.
- **CR-004 · Performance** — Compounding N+1 in `getBuildingRenovationOpportunities → getRepairReplaceAnalysis → estimateReplacementCost/resolveUsefulLife`; batch helpers unused. `assetInventory.ts:503-660`. Fix: batch + memoize.
- **CR-005 · Performance/Frontend** — `RenovationAccordion` fetches every building on mount at once, no lazy-load/AbortController. `RenovationAccordion.jsx:205-212`.
- **CR-006 · Correctness/Frontend** — `useEffect` dependency array changes length by mode. `NPVScenariosPanel.js:295-305`.
- **CR-007 · Reliability/Frontend** — `handleAddToPlan` fail-fast `Promise.all` → partial plan; post-unmount setState. `RenovationSimulatorDrawer.jsx:496-567`.

### Medium
- **CR-008 · Correctness** — Portfolio FCI = mean of ratios, not value-weighted. `npvService.ts:905-906`.
- **CR-009 · Modeling** — Gross rent used as NOI with no opex, silently. `npvService.ts:492-499`.
- **CR-010 · Design** — GET endpoints perform writes (`lastComputedAt`, verdict cache). `cashflowPlans.ts:233,481`.
- **CR-011 · Security** — `String(e)` leaked into error `detail`. `cashflowPlans.ts` 500 handlers.
- **CR-012 · Isolation** — `buildingOwner.findMany` missing `orgId`. `cashflowPlans.ts:122`.
- **CR-013 · Frontend race** — Slider refetch, no debounce/AbortController. `NPVScenariosPanel.js:305`.
- **CR-014 · Dead code** — `npvRefreshKey` never incremented. `cashflow/[id].js:481`.
- **CR-015 · Frontend** — `IncomeGrowthRateEditor` Enter + onBlur double-submit. `cashflow/[id].js`.
- **CR-016 · a11y** — Modals/overlays/SVG chart lack roles/focus-trap/Escape/alt.
- **CR-017 · i18n** — `RenovationSimulatorDrawer`, `RenovationAccordion` hardcoded English (G17).
- **CR-018 · Error handling** — Silent `catch {}` with no logging. `assetInventory.ts:519,660`.
- **CR-019 · Reliability** — Fire-and-forget `emit()` can drop domain events. `cashflowPlanWorkflow.ts`.
- **CR-020 · Testing** — Core engine + feature route have no numeric/functional tests; multi-owner divergence untested.

### Low / Info
- **CR-021** IRR footgun on multi-sign-change series. `financeMath.ts`.
- **CR-022** 11× `no-explicit-any` + 3 unused imports (lint).
- **CR-023** Duplicated constants (`STALE_THRESHOLD_MS`, `dueYear`, default tax rate).
- **CR-024** Design-token drift (raw Tailwind palette).
- **CR-025** `new Date()` TZ coupling / no clock injection.
- **CR-026** Proxy doesn't `encodeURIComponent(id)` / allow-list methods.
- **CR-027** `monthsBetween` day-granularity approximation. `assetInventory.ts:91`.
- **CR-028** Non-null assertions on reloads. `cashflowPlanWorkflow.ts:167,190`.

---

## Remediation plan (highest → lowest priority)

Each item: implement → run relevant unit tests (+ affected integration suite) → commit → push.

| # | CR | Status |
|---|----|--------|
| 1 | CR-002 NaN guard | ☐ |
| 2 | CR-001 orgId scope findBuildingIdForAsset | ☐ |
| 3 | CR-003 bound portfolio fan-out | ☐ |
| 4 | CR-004 N+1 batch + memoize | ☐ |
| 5 | CR-006 useEffect stable deps | ☐ |
| 6 | CR-007 handleAddToPlan transactional + unmount guard | ☐ |
| 7 | CR-005 lazy-fetch accordion + AbortController | ☐ |
| 8 | CR-011 error-detail leak | ☐ |
| 9 | CR-008 portfolio FCI weighting | ☐ |
| 10 | CR-009 gross-rent NOI flag | ☐ |
| 11 | CR-012 buildingOwner orgId | ☐ |
| 12 | CR-018 silent-catch logging | ☐ |
| 13 | CR-013 slider AbortController + debounce | ☐ |
| 14 | CR-014 npvRefreshKey wire/remove | ☐ |
| 15 | CR-015 double-submit guard | ☐ |
| 16 | CR-010 GET-time writes → recompute | ☐ |
| 17 | CR-019 event emit reliability | ☐ |
| 18 | CR-020 missing tests (engine + route + divergence) | ☐ |
| 19 | CR-016 a11y (dialog/focus-trap/chart alt) | ☐ |
| 20 | CR-017 i18n 2 components | ☐ |
| 21 | CR-021 IRR guard/doc | ☐ |
| 22 | CR-022 lint any-types + unused imports | ☐ |
| 23 | CR-023 dedup constants | ☐ |
| 24 | CR-024 design-token migration | ☐ |
| 25 | CR-025 clock injection | ☐ |
| 26 | CR-026 proxy hardening | ☐ |
| 27 | CR-027 monthsBetween day-granularity | ☐ |
| 28 | CR-028 non-null assertions | ☐ |

**Progress log:** (appended per item as work proceeds)
</content>
