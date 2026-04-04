# Cashflow Planning Epic — Implementation Prompts

This file contains four sequential implementation slices. Run them in order. Each slice
is self-contained and includes its own inspection, architecture, and definition-of-done
instructions. Do not start a later slice until the earlier one passes its DoD.

---

## Context for all slices

**What this feature is:**
A cashflow planning layer that bridges the backward-looking accounting statements in
`/manager/finance` and the forward-looking CapEx projections in
`/manager/inventory?tab=forecast`. It lets property managers and owners build named
scenarios — "what happens to my cash position if I defer the boiler to 2028 and assume
3% rent growth?" — and ultimately approve a plan that unlocks RFP generation.

**Key design decisions captured in discovery:**
- **Baseline = raw depreciation schedule** (install date + useful life), NOT the timing
  advisor's advance/defer recommendations. Advisor suggestions become explicit what-ifs
  when a user applies them as overrides on a plan. This keeps the baseline stable.
- **Income model**: annual growth-rate percentage applied to projected lease income.
  Lease-level modeling and vacancy rates are out of scope for v1 (vacancy is negligible
  in CH).
- **Monthly granularity**: cashflow buckets are month-by-month, not annual.
- **Building-level + portfolio rollup**: same disclosure pattern as the inventory
  forecast tab (per-building detail, portfolio aggregate at the top).
- **Opening balance is optional**: if not set, the UI shows net flows only with a
  "add opening balance for full cashflow view" banner. The onboarding epic that loads
  initial financial state is a separate, later epic — do not block on it.
- **Scenarios are thin deltas**: a plan stores overrides (per-asset timing shifts,
  income growth rate) applied on top of live data. Projections are recomputed on load.
  Stale detection: a `lastComputedAt` timestamp warns if the underlying forecast has
  changed since last view.
- **Plan statuses**: `DRAFT → SUBMITTED → APPROVED`. Approval unlocks — but does not
  auto-fire — RFP generation.
- **RFP generation rule**: one RFP per trade group per bundle (from the bundling
  optimizer's `tradeGroups` field); one RFP per item for unbundled replacements. The
  manager explicitly triggers each RFP with a system-suggested send date
  (3–6 months before the scheduled replacement year).

**Critical implementation notes for all slices:**

> **Slice 1 — read `capexProjectionService` carefully before writing the cashflow
> service.** The bundling optimizer and timing recommendation output shapes are
> non-trivial. The cashflow service must consume them correctly — do not simplify or
> re-derive what they already compute.

> **Slice 4 — inspect the RFP module shape before writing anything.** The "Before
> writing code" section is deliberately explicit about this. The idempotency check
> (`cashflowPlanId + groupKey`) must align with the actual `Rfp` model structure. Do
> not assume the RFP shape — read the route, workflow, and schema first.

> **Opening balance (onboarding epic) is intentionally out of scope in all four
> slices.** The banner pattern in Slice 2 ensures the feature is fully useful without
> it. Do not introduce an opening balance onboarding flow anywhere in this epic. Place
> any related backlog notes in `PROJECT_STATE.md` §Backlog only.

---

## Slice 1 of 4 — Data model, cashflow service, and base API

Read `PROJECT_OVERVIEW.md` first (entry point), then
`apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` (lookup), then `PROJECT_STATE.md`
(canonical reference), `docs/AUDIT.md`, and `apps/api/blueprint.js`. Obey all guardrails
exactly. Preserve existing behaviour unless explicitly required for this slice.

### Before writing code

1. Read `apps/api/prisma/schema.prisma` and note every existing model related to
   financials (`BuildingFinancialSnapshot`, `LedgerEntry`, `Invoice`, `Lease`) and
   forecasting (`Asset`, `AssetModel`, `AssetIntervention`). Record the exact field
   names you will reference from these models.
2. Read `apps/api/src/services/capexProjectionService.ts` and
   `apps/api/src/services/assetHealthService.ts`. Understand:
   - What `yearlyBuckets` and `timingRecommendations` contain.
   - How replacement cost is derived (historical + benchmark blend).
   - What `tradeGroups` and `bundlingAdvice` contain in the projection output.
3. Read `apps/api/src/repositories/inventoryRepository.ts` to understand the canonical
   asset include shape.
4. Read `apps/api/src/services/financialsService.ts` (or wherever
   `BuildingFinancialSnapshot` is populated) to understand how `earnedIncomeCents`,
   `projectedIncomeCents`, `expensesTotalCents`, and `capexTotalCents` are computed.
5. Output a short implementation plan before writing any code:
   - Which existing service methods you will call from the new cashflow service.
   - Whether any existing service needs a new method or only the new service is added.
   - The exact schema additions you will make and why.

### Architecture rules

- Keep routes thin.
- Put orchestration in `cashflowPlanWorkflow.ts` (new file).
- Keep Prisma access in `cashflowPlanRepository.ts` (new file).
- Status transition rules (`DRAFT → SUBMITTED → APPROVED`) must live in
  `apps/api/src/workflows/transitions.ts` alongside all other transition maps.
- Emit domain events only from workflows (not services or routes).
- If an API contract is added, update OpenAPI + api-client + contract tests together.
- Do not create a second CapEx projection calculation — call `capexProjectionService`
  directly; apply overrides on top of its output.
- Do not create a second income projection calculation — derive from Lease records
  (active/signed) using a compounded annual growth rate.

### Slice name: `cashflow-planning-data-model`

**Goal:** Introduce the `CashflowPlan` and `CashflowOverride` Prisma models, a
`cashflowPlanningService` that computes monthly cashflow buckets, and REST endpoints
for CRUD on plans and overrides.

**Primary workflows affected:** `cashflowPlanWorkflow.ts` (new)

### Schema additions

Add to `apps/api/prisma/schema.prisma`:

```prisma
model CashflowPlan {
  id                  String             @id @default(cuid())
  orgId               String
  buildingId          String?            // null = portfolio-level plan
  name                String
  status              CashflowPlanStatus @default(DRAFT)
  incomeGrowthRatePct Float              @default(0)   // annual %, compounded
  openingBalanceCents BigInt?            // optional; set via onboarding epic later
  horizonMonths       Int                @default(60)  // projection window
  lastComputedAt      DateTime?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  building  Building?         @relation(fields: [buildingId], references: [id])
  overrides CashflowOverride[]

  @@index([orgId])
  @@index([orgId, buildingId])
}

model CashflowOverride {
  id             String               @id @default(cuid())
  planId         String
  assetId        String
  originalYear   Int
  overriddenYear Int
  createdAt      DateTime             @default(now())

  plan  CashflowPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  asset Asset        @relation(fields: [assetId], references: [id])
}

enum CashflowPlanStatus {
  DRAFT
  SUBMITTED
  APPROVED
}
```

Generate and apply the migration:
```bash
cd apps/api && npx prisma migrate dev --name add_cashflow_plan
```

### New files — in this order

1. `apps/api/src/repositories/cashflowPlanRepository.ts`
   - Export `CASHFLOW_PLAN_INCLUDE` constant (plan + overrides + building name).
   - `findById(id, orgId)` — org-scoped fetch.
   - `findAll(orgId, buildingId?)` — list, optional building filter.
   - `create(data)`, `update(id, orgId, data)`.
   - `addOverride(planId, orgId, assetId, originalYear, overriddenYear)`.
   - `removeOverride(overrideId, planId, orgId)`.

2. `apps/api/src/services/cashflowPlanningService.ts`
   - `computeMonthlyCashflow(plan, orgId): Promise<MonthlyBucket[]>`
     - Historical actuals (last 12 months): pull from `BuildingFinancialSnapshot`
       records for the plan's building (or aggregate across all org buildings if
       portfolio-level). Use `earnedIncomeCents` and `expensesTotalCents` as actuals.
     - Projected income (forward months): sum `projectedIncomeCents` from active/signed
       Lease records for the building, then apply `incomeGrowthRatePct` compounded
       annually. If no leases exist, fall back to the last 3-month average of
       `earnedIncomeCents`.
     - Projected opex (forward months): 3-month trailing average of
       `expensesTotalCents - capexTotalCents` from snapshots, held flat.
     - Scheduled CapEx events: call `capexProjectionService` for the building's asset
       list. For each projected item, use the raw `scheduledYear` from depreciation
       math as the default month anchor (July of that year — mid-year assumption for
       simplicity). Apply any `CashflowOverride` records to shift items to their
       `overriddenYear`. Split annual CapEx cost into a single monthly event (point
       expense), not spread.
     - Compute `cumulativeBalanceCents` starting from `openingBalanceCents` (or 0 if
       null, flagged in a `hasOpeningBalance: false` field on the result).
   - Export `MonthlyBucket` type:
     ```typescript
     interface MonthlyBucket {
       year: number;
       month: number;           // 1–12
       isActual: boolean;       // true for historical months
       projectedIncomeCents: bigint;
       projectedOpexCents: bigint;
       scheduledCapexCents: bigint;
       netCents: bigint;
       cumulativeBalanceCents: bigint;
       capexItems: CapexEventItem[];  // assets scheduled this month
     }
     interface CapexEventItem {
       assetId: string;
       assetName: string;
       estimatedCostCents: bigint;
       isOverridden: boolean;   // true if a CashflowOverride moved it here
       tradeGroup: string;
       bundleId: string | null; // bundling optimizer bundle reference, if any
     }
     ```

3. `apps/api/src/workflows/cashflowPlanWorkflow.ts`
   - `createPlan(input)`: validate, call repository create, emit `cashflow_plan.created`.
   - `updatePlan(input)`: validate, call repository update, set `lastComputedAt = null`
     to signal stale (recomputed on next GET).
   - `addOverride(input)`: validate asset belongs to plan's building/org, call repo,
     set `lastComputedAt = null`.
   - `removeOverride(input)`: call repo remove, set `lastComputedAt = null`.
   - `submitPlan(input)`: assert `DRAFT → SUBMITTED` via `transitions.ts`, emit event.
   - `approvePlan(input)`: assert `SUBMITTED → APPROVED` via `transitions.ts`, emit
     `cashflow_plan.approved`.
   - Add `VALID_CASHFLOW_PLAN_TRANSITIONS` to `apps/api/src/workflows/transitions.ts`.

4. `apps/api/src/routes/cashflowPlans.ts`
   - `GET /cashflow-plans` — list for org, optional `?buildingId=`.
   - `POST /cashflow-plans` — create plan.
   - `GET /cashflow-plans/:id` — fetch plan; call `computeMonthlyCashflow` and include
     result as `cashflow: MonthlyBucket[]` in response. Set `lastComputedAt` on plan.
   - `PUT /cashflow-plans/:id` — update name / incomeGrowthRatePct / openingBalance.
   - `POST /cashflow-plans/:id/overrides` — add timing override.
   - `DELETE /cashflow-plans/:id/overrides/:overrideId` — remove override.
   - `POST /cashflow-plans/:id/submit` — workflow submit.
   - `POST /cashflow-plans/:id/approve` — workflow approve.
   - `GET /cashflow-plans/:id/rfp-candidates` — only callable when status=APPROVED;
     returns list of CapEx items grouped by trade group (from bundling optimizer output),
     each with a `suggestedRfpSendDate` (3 months before `scheduledYear-07-01` or
     `overriddenYear-07-01`). Does not create RFPs — that is Slice 4.
   - Register route in `apps/api/src/server.ts`.
   - All mutating endpoints: `requireRole(req, res, 'MANAGER')`.
   - All read endpoints: `maybeRequireManager` is acceptable for GETs.

5. DTOs / OpenAPI / api-client / tests — update together:
   - Add all new endpoints to `apps/api/openapi.yaml`.
   - Add `cashflowPlans` to `packages/api-client/src/index.ts`.
   - Add a contract test for `GET /cashflow-plans/:id` asserting the `cashflow` array
     shape and required fields to
     `apps/api/src/__tests__/contracts.test.ts`.

### Auth

No new roles. `MANAGER` can create/update/submit/approve. Read endpoints allow manager
role. No tenant or contractor access.

### In scope

- `CashflowPlan` and `CashflowOverride` schema + migration.
- `CashflowPlanStatus` enum in schema.
- `cashflowPlanRepository.ts` with canonical include.
- `cashflowPlanningService.ts` with monthly bucket computation.
- `cashflowPlanWorkflow.ts` with status transitions.
- `cashflowPlans.ts` route with all endpoints listed above.
- OpenAPI, api-client, contract test.

### Out of scope

- Any UI (Slice 2 and 3).
- RFP creation (Slice 4).
- Owner-level approval UI (Slice 4).
- Opening balance onboarding (separate epic).
- Portfolio-level plan aggregation UI.

### Definition of done

- `npx tsc --noEmit` — 0 errors.
- `npm test` — all existing tests pass; new contract test passes.
- `npm run blueprint` — docs sync cleanly.
- `GET /cashflow-plans/:id` returns a valid `cashflow` array with monthly buckets.
- `POST /cashflow-plans/:id/submit` rejects if status is not `DRAFT`.
- `POST /cashflow-plans/:id/approve` rejects if status is not `SUBMITTED`.
- `GET /cashflow-plans/:id/rfp-candidates` returns 403 if status is not `APPROVED`.
- All new endpoints are in `openapi.yaml` and `api-client`.

---

## Slice 2 of 4 — Cashflow planning UI — baseline view

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`, `docs/AUDIT.md`, and `apps/api/blueprint.js`. Obey all
guardrails exactly. Preserve existing behaviour.

### Before writing code

1. Read `apps/web/pages/manager/inventory.js` — specifically the portfolio overview
   section and the 5-year CapEx bar chart. This is the visual and structural reference
   for the new cashflow page: stat cards at the top, chart below, per-building detail
   underneath.
2. Read `apps/web/pages/manager/finance/index.js`. Note the tab structure, the
   per-building table, and the date range filter pattern. The cashflow page should feel
   consistent with this page.
3. Read `apps/web/pages/api/forecasting/` proxy files to understand the pattern for
   proxying new endpoints.
4. Check `apps/web/lib/` for any shared chart wrapper already used on the inventory
   forecast page. Reuse it; do not install a new charting library.
5. Output a short implementation plan:
   - Page route you will create.
   - Which API endpoints from Slice 1 this page will call.
   - Chart type and data mapping.
   - Where the page fits in the manager navigation.

### Architecture rules

- Next.js Pages Router only. No App Router.
- All backend calls go through `apps/web/pages/api/` proxies using `proxyToBackend()`.
- No inline styles or JS style objects. Tailwind classes + `globals.css` `@layer`
  components only.
- Layout: `AppShell → PageShell → PageHeader → PageContent → Panel`. Follow exactly.
- Reuse existing shared UI components (`Panel`, `StatCard`, `Badge`, chart wrappers).
- Do not add a new charting library. Reuse whatever renders the CapEx bar chart on the
  inventory forecast tab.

### Slice name: `cashflow-planning-baseline-ui`

**Goal:** Create `/manager/cashflow` — a new page showing the baseline cashflow view
for a building (or portfolio rollup) using the plan data from Slice 1. No scenario
editing yet (Slice 3). Read-only view of the computed monthly cashflow.

### New files — in this order

1. `apps/web/pages/api/cashflow-plans/index.js`
   `apps/web/pages/api/cashflow-plans/[id].js`
   `apps/web/pages/api/cashflow-plans/[id]/overrides.js`
   `apps/web/pages/api/cashflow-plans/[id]/submit.js`
   `apps/web/pages/api/cashflow-plans/[id]/approve.js`
   `apps/web/pages/api/cashflow-plans/[id]/rfp-candidates.js`
   — All use `proxyToBackend()`. No logic in proxy files.

2. `apps/web/pages/manager/cashflow/index.js`
   **Portfolio / plan list view.**
   - Lists all cashflow plans for the org.
   - "New plan" button opens a creation modal (building selector, plan name,
     income growth rate %, optional opening balance in CHF).
   - Plan cards show: plan name, building (or "Portfolio"), status badge, last
     computed date with stale warning if `lastComputedAt` is more than 7 days old or
     if the underlying forecast has a newer `computedAt`.
   - Clicking a plan navigates to `/manager/cashflow/[id]`.
   - Consistent with `/manager/finance` tab/page structure.

3. `apps/web/pages/manager/cashflow/[id].js`
   **Plan detail / cashflow view.**

   **Top section — summary stat cards** (same pattern as inventory forecast):
   - Total projected income (next 12 months, CHF)
   - Total projected CapEx (over horizon, CHF)
   - Peak monthly CapEx (worst month, CHF + date)
   - Lowest cumulative balance (if opening balance set: CHF + month; if not set: "—")
   - Plan status badge

   **"No opening balance" banner** (shown when `openingBalanceCents` is null):
   > "Opening balance not set — showing net flows only. Add an opening balance to see
   > full cashflow position."
   > [Add opening balance] button → inline edit on the plan.

   **Main chart — monthly cashflow waterfall/bar chart:**
   - X-axis: months (rolling 60-month window: 12 historical + 48 projected).
   - Historical months: actual income (green bar) vs actual expenses (red bar).
   - Projected months: projected income (lighter green) vs projected opex (lighter red)
     vs scheduled CapEx events (amber, stacked on opex).
   - Overlay line: cumulative balance (only shown if opening balance is set).
   - Hover tooltip: income, opex, CapEx items (asset name + cost), net, balance.
   - Clear visual break between historical (solid) and projected (hatched or lighter).

   **CapEx event list** (below chart):
   - Table of upcoming CapEx items from the baseline, sorted by scheduled month.
   - Columns: Asset, Building, Scheduled month, Estimated cost (CHF), Trade group,
     Bundled? (yes/no), Tax treatment (deductible / capitalized).
   - No editing in this slice (Slice 3 adds override capability).

   **Per-building breakdown** (portfolio plans only):
   - Collapsible rows, one per building, showing that building's contribution to the
     portfolio cashflow totals. Same pattern as inventory forecast buildings tab.

   **Plan actions** (shown based on status):
   - DRAFT: [Submit for approval] button → POST `.../submit`.
   - SUBMITTED: [Approve] button (manager role only) → POST `.../approve`.
   - APPROVED: Shown in Slice 4.

### Navigation

Add "Cashflow" link to the manager finance navigation (alongside Overview, Invoices,
Payments, etc.) pointing to `/manager/cashflow`.

### Auth

Manager role required. No tenant or contractor access to these pages.

### In scope

- Proxy files for all cashflow plan API endpoints.
- Plan list page at `/manager/cashflow`.
- Plan detail page at `/manager/cashflow/[id]` with chart and CapEx event list.
- Opening balance banner and inline edit.
- Submit / Approve action buttons.
- Navigation link in finance section.

### Out of scope

- Scenario editing or override UI (Slice 3).
- RFP generation UI (Slice 4).
- Opening balance onboarding flow (separate epic).

### Definition of done

- `npx next build` — 0 errors.
- `npx next lint --max-warnings 0` — clean.
- `npm run blueprint` — docs sync cleanly.
- `/manager/cashflow` lists plans and allows creation.
- `/manager/cashflow/[id]` renders chart with historical + projected months.
- Opening balance banner shown when balance is null.
- Submit and Approve buttons work and update status badge.
- No inline styles, no JS style objects anywhere in new files.
- All API calls go through proxy files using `proxyToBackend()`.

---

## Slice 3 of 4 — Scenario engine (what-if overrides)

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`, `docs/AUDIT.md`, and `apps/api/blueprint.js`. Obey all
guardrails exactly. Preserve existing behaviour.

### Before writing code

1. Re-read `apps/web/pages/manager/cashflow/[id].js` (from Slice 2). Identify the CapEx
   event list table and the plan header area — these are the two places override UI will
   be added.
2. Re-read `apps/api/src/services/cashflowPlanningService.ts` (from Slice 1). Confirm
   how `CashflowOverride` records are already applied in `computeMonthlyCashflow`.
3. Read `apps/api/src/services/capexProjectionService.ts` and note
   `timingRecommendations` — these are the pre-computed advisor suggestions that users
   can apply as a one-click override.
4. Output a short implementation plan:
   - Which existing UI components need extending.
   - How "apply recommendation" will map an advisor suggestion to a `CashflowOverride`.
   - How stale detection will surface to the user.

### Architecture rules

All architecture rules from Slice 1 apply. No new ones.

### Slice name: `cashflow-planning-scenarios`

**Goal:** Let users modify a plan in DRAFT status by applying CapEx timing overrides
(shift an asset's replacement year) and adjusting the income growth rate. Show the
impact on the cashflow chart immediately. Surface stale-plan warnings.

### Files to modify — in this order

1. `apps/web/pages/manager/cashflow/[id].js`

   **CapEx event list — add override controls** (DRAFT status only):
   - Each row in the CapEx event list gets a "Shift year" inline control:
     a year picker (current year ± 3 years) that fires
     `POST .../overrides` with `{ assetId, originalYear, overriddenYear }`.
   - Overridden rows show a "Reset" link that fires
     `DELETE .../overrides/:overrideId`.
   - Overridden rows are visually distinguished (e.g. italic text + undo icon).
   - After any override add/remove: re-fetch `GET .../[id]` to recompute and
     refresh the chart.

   **"Apply recommendation" button per CapEx row:**
   - If the capexProjectionService's `timingRecommendations` includes a suggestion for
     this asset (advance or defer), show a chip:
     `"Advisor: defer to 2028 → save CHF 1,200 tax"`.
   - Clicking it fires `POST .../overrides` pre-filled with the recommended year.
   - This is the only way advisor recommendations affect the plan — they are never
     applied automatically.

   **Plan header — income growth rate control** (DRAFT status only):
   - Inline editable field: "Income growth rate: [  2.0  ] % / year".
   - On blur / enter: fires `PUT .../[id]` with updated `incomeGrowthRatePct`.
   - Re-fetches and refreshes chart.

   **Stale plan warning banner:**
   - If the plan's `lastComputedAt` is older than 7 days, show:
     > "The underlying asset forecast may have changed since this plan was last
     > computed. Reload to refresh."
     > [Reload] button → re-fetches `GET .../[id]`.
   - Once SUBMITTED or APPROVED, plan is read-only — no override controls shown.

2. No backend changes required in this slice. All backend capability (adding/removing
   overrides, updating income growth rate, recomputing on GET) was built in Slice 1.

### In scope

- Override controls in the CapEx event list (DRAFT only).
- "Apply recommendation" chip using advisor suggestions.
- Income growth rate inline edit (DRAFT only).
- Stale plan warning banner.
- Read-only view for SUBMITTED / APPROVED plans.

### Out of scope

- Saving multiple named scenarios within one plan (one plan = one scenario for v1).
- Income scenario modeling beyond a single growth rate.
- Vacancy rate assumptions.
- Any new backend changes.

### Definition of done

- `npx next build` — 0 errors.
- `npx next lint --max-warnings 0` — clean.
- Adding or removing a timing override re-renders the chart with updated cashflow.
- Changing the income growth rate re-renders the chart.
- "Apply recommendation" pre-populates the override with the advisor's suggested year.
- Override rows are visually distinguished from baseline rows.
- SUBMITTED / APPROVED plans show no editable controls.
- Stale warning appears when `lastComputedAt` is > 7 days old.

---

## Slice 4 of 4 — Approval workflow and RFP integration

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`, `docs/AUDIT.md`, and `apps/api/blueprint.js`. Obey all
guardrails exactly. Preserve existing behaviour.

### Before writing code

1. Read the existing RFP module thoroughly:
   - `apps/api/src/routes/rfp.ts` (or equivalent) — understand the RFP creation
     endpoint shape, required fields, and any existing status model.
   - The RFP-related Prisma models in `apps/api/prisma/schema.prisma`.
   - The RFP frontend pages in `apps/web/pages/manager/`.
   - The api-client exports for RFP.
2. Read `apps/api/src/services/capexProjectionService.ts` — re-examine
   `bundlingAdvice[].tradeGroups` and `bundlingAdvice[].assetBreakdown`. These drive
   the RFP grouping logic.
3. Read `GET /cashflow-plans/:id/rfp-candidates` (built in Slice 1). Confirm the
   response shape and the `suggestedRfpSendDate` field.
4. Output a short implementation plan:
   - How a `bundlingAdvice` entry maps to one or more RFPs (one per `tradeGroup`).
   - How unbundled items map to individual RFPs.
   - What fields on a new RFP are pre-filled from the cashflow plan data.
   - Where in the existing RFP UI the new RFPs will appear.
   - Whether any RFP schema change is needed to record the originating
     `cashflowPlanId`.

### Architecture rules

All architecture rules from Slice 1 apply. Additionally:
- RFP creation must go through the existing RFP workflow (do not bypass it).
- A new `cashflowPlanId` field on `Rfp` (nullable) links the RFP back to the plan.
  If this requires a migration, run it cleanly — no `db push`.
- Do not change existing RFP creation flows. Only add the new entry point.

### Slice name: `cashflow-planning-approval-rfp`

**Goal:** After a plan is APPROVED, let the manager see the RFP candidates grouped
by trade group, and explicitly trigger creation of one RFP per group with pre-filled
scope and suggested send date. Link created RFPs back to the originating plan.

### Files to modify — in this order

1. `apps/api/prisma/schema.prisma`
   - Add nullable `cashflowPlanId String?` to the `Rfp` model.
   - Add the back-relation on `CashflowPlan`: `rfps Rfp[]`.
   - Migration: `npx prisma migrate dev --name link_rfp_cashflow_plan`.

2. `apps/api/src/routes/cashflowPlans.ts`
   - Add `POST /cashflow-plans/:id/rfp-candidates/:groupKey/create-rfp`.
   - `groupKey` is a stable key identifying one trade-group bundle (e.g.
     `"2026-PLUMBING"` derived from `bundleId + tradeGroup`).
   - Handler: resolve the assets for that group from the plan's approved CapEx items,
     call the existing RFP workflow with pre-filled:
     - `buildingId` from the plan.
     - `title`: e.g. `"Boiler replacement + water heater — 2026 (Plumbing)"`.
     - `scopeDescription`: asset names + estimated costs from `CapexEventItem`.
     - `suggestedSendDate` from the rfp-candidates endpoint.
     - `cashflowPlanId` linking back to this plan.
   - Returns the created RFP id + URL.
   - Requires status = APPROVED; returns 400 otherwise.

3. `apps/api/openapi.yaml` + `packages/api-client/src/index.ts`
   — Add the new endpoint. Add `cashflowPlanId` to the RFP DTO.

4. `apps/web/pages/manager/cashflow/[id].js`
   - **Approved plan — RFP panel** (new section, shown only when status = APPROVED):
     - Heading: "RFP Candidates".
     - Cards, one per trade group from `/rfp-candidates`:
       - Trade group name + asset list.
       - Estimated total cost (CHF).
       - Suggested send date (formatted, e.g. "Send by April 2026").
       - Status: "Not yet created" (grey) / "RFP created" (green, with link).
     - [Create RFP] button on each card:
       - Fires `POST .../rfp-candidates/:groupKey/create-rfp`.
       - On success: updates card status to "RFP created" with a link to the RFP
         detail page in the existing RFP module.
       - Disabled after RFP is created (idempotent — one RFP per group per plan).
   - Approval / submission buttons from Slice 2 remain unchanged.

5. No changes to existing RFP creation flow, RFP list pages, or RFP detail pages.
   The new RFPs will appear in the existing RFP list automatically as they share the
   same model.

### In scope

- Nullable `cashflowPlanId` on `Rfp` model + migration.
- `POST /cashflow-plans/:id/rfp-candidates/:groupKey/create-rfp` endpoint.
- RFP panel UI on approved plan page.
- OpenAPI + api-client update.

### Out of scope

- Changing the existing RFP UI, workflow, or status model.
- Automatic RFP firing on approval.
- Owner-level approval UI (owner portal is a future epic).
- Email/notification to contractors on RFP creation (existing notification flow handles
  this once the RFP is created in the normal way).

### Definition of done

- `npx tsc --noEmit` — 0 errors.
- `npx next build` — 0 errors.
- `npx next lint --max-warnings 0` — clean.
- `npm test` — all existing tests pass.
- `npm run blueprint` — docs sync cleanly.
- An approved plan shows the RFP candidates panel with one card per trade group.
- [Create RFP] fires creation and updates card to "RFP created" with link.
- Created RFPs appear in the existing RFP list page.
- Attempting `create-rfp` on a non-APPROVED plan returns 400.
- Creating the same group's RFP twice does not create a duplicate (idempotent check
  on `cashflowPlanId + groupKey`).
- `cashflowPlanId` is present on the RFP DTO and in `openapi.yaml`.

---

## After all four slices

Run the quality-check prompt at `.github/prompts/quality-check.md` to verify the full
codebase health after this epic. Pay particular attention to:
- New model count in `PROJECT_STATE.md` document integrity table.
- New route module (`cashflowPlans.ts`) listed in `ARCHITECTURE_LOW_CONTEXT_GUIDE.md`.
- New migration count.
- `contracts.test.ts` port registry in `CONTRIBUTING.md`.
- `docs/FRONTEND_INVENTORY.md` updated with new cashflow pages.
