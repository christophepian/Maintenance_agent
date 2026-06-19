# Planning Tab Rearchitecture — Scoping Document

**Date:** 2026-06-19  
**Status:** Delivered — all 7 steps shipped 2026-06-19 (commits 590d241, fb41318)

---

## 1. Problem Statement

The Planning tab at `/manager/finance?tab=planning` has four stacked panels with overlapping concerns:

| Panel | Problem |
|---|---|
| `NOITrendPanel` (Historical NOI) | Duplicates Reporting (portfolio + building views already exist) |
| `CapexSchedulePanel` (Forward CapEx) | Same underlying data as Renovation Opportunities, different visual; two surfaces for one concept |
| `NPVScenariosPanel` | Orphaned from plan data — assumptions set independently, not saved, not linked to any plan |
| `CashflowPlansList` + `RenovationOpportunitiesSection` | Output and input treated as peers rather than in a sequenced flow |

---

## 2. Target Mental Model

```
DISCOVER          →     PLAN          →     DECIDE
──────────────────────────────────────────────────────
Renovation              CashflowPlan        NPV Scenarios
Opportunities           (capex schedule     (computed from
(accordion)             + assumptions)      the plan)
                             ↑
                    "Plan this work" from simulator
```

Sequencing: arbitrage asset decisions → build a cashflow plan → set macro assumptions on the plan → NPV yields the Invest / Defer / Neglect verdict.

---

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Building selector after removing NOITrendPanel | Compact `<select>` dropdown at top of Planning tab |
| Q2 | Portfolio plans / multi-building NPV | Multi-select buildings; plan aggregates across selected buildings; `CashflowPlan.buildingId` stays nullable |
| Q3 | Verdict badge on plans list | **Yes, show it.** Cache as `lastVerdictScenario` on the plan — computed on first NPV load, stored, list reads the field at zero cost |
| Q4 | `deferYears` saved vs ephemeral | Save on the plan as a plan assumption; still editable in DRAFT |
| Q5 | `NPVScenariosPanel` reuse | Parameterise with `fetchUrl` + `mode` props: `"interactive"` (current, sliders visible) vs `"plan"` (sliders hidden, URL is plan endpoint, re-fetches when assumptions saved above) |

---

## 4. Proposed Structure

### 4A. Planning tab (simplified)

**Remove:**
- `NOITrendPanel`
- `CapexSchedulePanel`
- `NPVScenariosPanel`

**Replace with:**

```
Planning tab
│
├── Building selector  (compact <select>, multi-select, "All buildings" default)
│
├── Section 1: Renovation Opportunities
│   └── RenovationAccordion
│       Building row: name · total at-risk CHF · N assets · next due year
│       └── [expanded] Unit rows
│             └── [expanded] Asset rows
│                 Depreciation bar · rec badge · condition · estimated due year · Simulate →
│       Checkboxes propagate up (asset → unit → building)
│       Bulk "Simulate N →" at building and unit level
│       [CapEx schedule is implicit: assets sorted by remainingLifeMonths asc]
│
└── Section 2: Plans
    CashflowPlansList with verdict badge per card
    Each card: name · building(s) · status · verdict badge (Invest / Defer / Neglect / —)
    "Open plan →" → /manager/cashflow/[id]
    "New plan" CTA
```

### 4B. Plan detail page (`/manager/cashflow/[id]`) — extended

Existing sections stay (stat cards, cashflow chart, capex event table, RFP candidates). Add two new sections:

**New: Assumptions panel**

Editable in DRAFT, read-only in SUBMITTED/APPROVED.

| Field | Stored on plan | Default | Notes |
|---|---|---|---|
| `discountRatePct` | ✓ new | 4.0% | DCF discount rate |
| `capRatePct` | ✓ new | 5.0% | Terminal value cap rate |
| `deferYears` | ✓ new | 3 | Defer scenario window |
| `propertyValueChf` | ✓ new | null | Optional; null = no terminal value |
| `incomeGrowthRatePct` | already exists | 0% | Already editable |

**New: NPV Verdict panel**

`NPVScenariosPanel` in `"plan"` mode:
- `fetchUrl = /api/cashflow-plans/:id/npv-scenarios`
- Sliders hidden (assumptions live in the panel above)
- "Recalculate" button re-fetches after assumptions are saved
- On fetch response, backend saves `lastVerdictScenario` on the plan
- Same card layout (Invest / Defer / Neglect), best-outcome highlight, strategy rationale if profile exists

---

## 5. Schema Changes

### 5A. `CashflowPlan` — new fields

```prisma
model CashflowPlan {
  // ... existing fields ...
  discountRatePct      Float   @default(4)    /// DCF discount rate for NPV computation
  capRatePct           Float   @default(5)    /// Terminal value cap rate
  deferYears           Int     @default(3)    /// Defer scenario: push near-term capex by N years
  propertyValueChf     Float?                 /// Optional market value for terminal value modelling
  lastVerdictScenario  String?                /// Cached NPV result: "invest" | "defer" | "neglect"
  lastVerdictAt        DateTime?              /// When the verdict was last computed
}
```

Migration: `npx prisma migrate dev --name add_npv_assumptions_and_verdict_to_cashflow_plan`

All new fields have defaults or are nullable — **non-breaking, no backfill needed**.

### 5B. No other schema changes

`CashflowOverride`, `BuildingStrategyProfile`, `AssetIntervention` unchanged.

---

## 6. Backend Changes

### 6A. Update `CashflowPlan` include + DTO + validation

Per **G2/G3** — in the same PR as the migration:
1. `cashflowPlanRepository.ts` — `CASHFLOW_PLAN_INCLUDE` (scalar fields, no new join)
2. `cashflowPlans.ts` — `serializePlan()` to include new fields
3. `validation/cashflowPlans.ts` — extend `UpdateCashflowPlanSchema` with the 4 new assumption fields
4. `PUT /cashflow-plans/:id` route — pass new fields through `updatePlanWorkflow` → `updateCashflowPlan()`

### 6B. New endpoint: `GET /cashflow-plans/:id/npv-scenarios`

Route: `routes/cashflowPlans.ts`  
Auth: `maybeRequireManager`

```
1. Fetch plan (CASHFLOW_PLAN_INCLUDE)
2. Resolve building scope:
   - buildingId set → single building
   - buildingId null → all active buildings in org (portfolio plan)
3. Call computeNpvScenarios() from npvService.ts with plan's saved assumptions
   (discountRatePct, incomeGrowthRatePct, horizonMonths/12, deferYears, propertyValueChf)
4. For building-scoped plans: look up BuildingStrategyProfile → computeRecommendation()
   For portfolio plans: no strategy profile (skip strategyContext)
5. Stamp plan.lastVerdictScenario + plan.lastVerdictAt (best-effort update, don't block response)
6. Return same shape as GET /buildings/:id/npv-scenarios
```

Proxy: `apps/web/pages/api/cashflow-plans/[id]/npv-scenarios.js`

### 6C. Portfolio NPV aggregation

When `buildingId` is null, `npvService.ts` needs to aggregate:
- Sum NOI across all org buildings (from active leases, same as `computeMonthlyCashflow` does)
- Sum capex projection across all buildings (already done in `computeMonthlyCashflow` — extract the pattern)
- Single DCF on the aggregate cashflows

This is the most complex new backend piece. `npvService.ts` currently takes a single building's data. The cleanest extension: `computeNpvScenarios()` accepts `buildingIds: string[]` instead of `buildingId: string`; single-building case passes a 1-element array.

### 6D. `RenovationAccordion` data

No new endpoint needed. Reuses `GET /api/buildings/:id/renovation-opportunities` per building. For multi-building display, the accordion fires one request per selected building in parallel.

---

## 7. Frontend Changes

### 7A. Planning tab (`finance/index.js`)

- Remove `NOITrendPanel`, `CapexSchedulePanel`, `NPVScenariosPanel` imports + render
- Replace the `planningBuildingId` single state with `selectedBuildingIds: string[]`
- Add `<BuildingSelector>` (compact multi-select `<select multiple>` or a checkbox dropdown) — fetches building list from `/api/buildings`
- Replace `RenovationOpportunitiesSection` with `<RenovationAccordion selectedBuildingIds={...} />`
- `CashflowPlansList` — add verdict badge (reads `lastVerdictScenario` from plan data, no extra fetch)

### 7B. Plan detail page (`cashflow/[id].js`)

**Assumptions panel:**
- Inline editable fields for the 4 new assumption fields
- `useAction()` for save pending state
- On save success → trigger NPV panel refresh

**NPV Verdict panel:**
- `<NPVScenariosPanel fetchUrl={/api/cashflow-plans/${id}/npv-scenarios} mode="plan" />`
- In `"plan"` mode: sliders hidden, "Recalculate" button shown, no QS param rebuilding needed

### 7C. `NPVScenariosPanel.js` — add `fetchUrl` + `mode` props

Current signature: `NPVScenariosPanel({ buildingId })`

New signature: `NPVScenariosPanel({ buildingId, fetchUrl, mode = "interactive" })`

Behaviour:
- `mode="interactive"` (default): existing behaviour unchanged — builds URL from `buildingId` + slider state, sliders visible
- `mode="plan"`: uses `fetchUrl` as-is, sliders hidden, "Recalculate" button triggers re-fetch, no local assumption state

This is a minimal, backwards-compatible change. The `NPVScenariosPanel` on the Planning tab is removed entirely (not changed), so the `"interactive"` mode becomes unused — but we leave it in until a cleanup pass.

### 7D. New `RenovationAccordion` component

`apps/web/components/RenovationAccordion.jsx`

```
Props: selectedBuildingIds: string[]

Per building (parallel fetch):
  Building row: chevron · name · N at-risk · total CHF · next due year
  [expanded] Unit rows (grouped from the flat opportunities list)
    Unit row: chevron · unit number · N assets
    [expanded] Asset rows:
      checkbox | asset name | topic | depreciation bar | rec badge | condition | due year | Simulate →

State: expandedBuildings: Set, expandedUnits: Set, selectedAssetIds: Set
Bulk CTA: appears when selectedAssetIds.size > 0 → "Simulate N →" → opens RenovationSimulatorDrawer
```

Due year per asset: `new Date().getFullYear() + Math.ceil(item.remainingLifeMonths / 12)` — already available in the DTO, no backend change.

---

## 8. What This Does NOT Change

- `RenovationSimulatorDrawer.jsx` — already correct (no AssetIntervention creation)
- `CashflowOverride` + "Add to cashflow plan" flow — already working
- `/manager/cashflow/[id]` existing sections — cashflow chart, capex event table, RFP candidates unchanged
- `computeMonthlyCashflow()` — unchanged
- `AssetIntervention` creation — only at job completion (already correct)

---

## 9. Build Sequence

Each step is independently shippable and does not break what came before:

| Step | What | Files touched |
|---|---|---|
| 1 | Schema migration + include/DTO/validation update | `schema.prisma`, migration, `cashflowPlanRepository.ts`, `cashflowPlans.ts`, `validation/cashflowPlans.ts` |
| 2 | Assumptions panel on plan detail page | `cashflow/[id].js`, `PUT /cashflow-plans/:id` extension |
| 3 | `computeNpvScenarios()` multi-building support | `npvService.ts` |
| 4 | `GET /cashflow-plans/:id/npv-scenarios` endpoint + proxy | `routes/cashflowPlans.ts`, new proxy file |
| 5 | NPV Verdict panel on plan detail page | `NPVScenariosPanel.js` (add props), `cashflow/[id].js` |
| 6 | `RenovationAccordion` component | New `RenovationAccordion.jsx` |
| 7 | Planning tab cleanup | `finance/index.js` — remove 3 panels, add selector, wire accordion + verdict badges |

Steps 1–5 are invisible to the Planning tab. Step 6 is additive. Step 7 is the visible cutover.

---

## 10. Risks & Guardrails

- **G2/G3:** Step 1 must update include constant, DTO, validation, and serialiser in the same PR — no partial migrations
- **G1/G8:** `prisma migrate dev`, never `db push`
- **Double-QS bug:** the new proxy `cashflow-plans/[id]/npv-scenarios.js` takes no query params — use bare `proxyToBackend(req, res, path)` with no manual QS appending
- **`formatChf()` prefix:** never write `CHF ${formatChf(...)}` — `formatChf` already includes the prefix
- **Portal re-use:** `RenovationSimulatorDrawer` uses `createPortal` to `document.body` — `RenovationAccordion` just calls `setSimItems(bundle)` as today; no change to portal behaviour
- **Multi-building NPV scope creep:** if portfolio NPV aggregation proves complex, Step 3 can ship with building-only support and portfolio plans show a "Select a single building to compute NPV" notice — does not block Steps 4–7
