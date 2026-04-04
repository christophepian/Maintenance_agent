# Swiss Renovation Classification — Delta Analysis

> Generated 2026-04-02 against current workspace state.

## Executive Summary

**The codebase already has ~70–80% of the infrastructure** these prompts target. There is a fully functional tax classification system, Swiss progressive bracket calculator, CapEx projection engine with timing recommendations, asset depreciation lifecycle, and UI showing timing advisor chips. The primary net-new work is the **51-job renovation catalog** abstraction and a **renovation decision-support UI panel**.

---

## Prompt-by-Prompt Delta

### Prompt 1 — Discovery

| Discovery Question | Answer from Codebase |
|-|-|
| Where is lifecycle/depreciation computed? | `apps/api/src/services/assetInventory.ts` → `computeDepreciation()` |
| Where is tax classification computed? | `apps/api/src/services/taxClassificationService.ts` → `classifyAsset()` |
| Where are Swiss tax brackets? | `apps/api/src/services/swissTaxBrackets.ts` (Federal, ZH, GE) |
| Where is CapEx projection + timing? | `apps/api/src/services/capexProjectionService.ts` (695 lines) |
| Where is asset health forecast? | `apps/api/src/services/assetHealthService.ts` |
| Where are tax rules stored? | `apps/api/src/repositories/taxRuleRepository.ts` + Prisma `TaxRule` / `TaxRuleVersion` models |
| Where is depreciation UI? | `apps/web/components/DepreciationStandards.js` (465 lines, ASLOCA-based) |
| Where is timing advisor UI? | `apps/web/pages/manager/cashflow/[id].js` → CapExTimeline component |
| What API endpoints exist? | `GET /forecasting/asset-health`, `GET /forecasting/capex-projection` (routes in `apps/api/src/routes/forecasting.ts`) |

**Verdict: Discovery is pre-answered. Skip to Prompt 2.**

---

### Prompt 2 — Canonical Swiss Renovation Classification Catalog

#### What Already Exists

| Component | File | Status |
|-|-|-|
| `TaxClassification` enum | `schema.prisma` | ✅ Has `WERTERHALTEND`, `WERTVERMEHREND`, `MIXED` |
| `TaxRule` + `TaxRuleVersion` models | `schema.prisma` | ✅ Full versioned rule model |
| Classification service | `taxClassificationService.ts` | ✅ canton → federal → heuristic fallback |
| Seed data | `taxRuleSeed.ts` | ✅ 42 federal rules + 22 canton overrides |
| Heuristic fallback | `taxClassificationService.ts` | ✅ Per-AssetType defaults |

#### What's Missing (Net-New for Prompt 2)

| Gap | Severity | Details |
|-|-|-|
| **`ENERGY_ENVIRONMENT` enum** | 🔴 Schema change | Prompts require 4 categories; schema only has 3. Requires Prisma migration. |
| **51-job renovation catalog** | 🔴 Primary artifact | Existing data maps `(AssetType, topic)` pairs. Prompts want 51 labeled renovation *job descriptions* with codes, aliases, searchable terms, building system, accounting treatment, timing sensitivity, examples. This abstraction layer does not exist. |
| **`accountingTreatment` field** | 🟡 Metadata gap | Existing rules have `deductiblePct` + `confidence` + `notes`, but no structured `accountingTreatment` enum ("IMMEDIATE_DEDUCTION" / "CAPITALIZED" / "SPLIT" / "ENERGY_DEDUCTION"). |
| **Timing-sensitivity flag** | 🟡 Metadata gap | No per-rule `isTimingSensitive` field. |
| **Aliases / searchable terms** | 🟡 Metadata gap | No aliases/search capability on rules. |
| **Examples / explanation text** | 🟡 Metadata gap | Only `notes` (single string), no structured `examples`. |

#### Recommendation

The existing `TaxRule` system is the *right canonical source* but maps at the `(AssetType, topic)` level. The 51-job catalog is a higher-level abstraction that should either:
- **(A)** Live as a typed static catalog (`swissRenovationCatalog.ts`) that references existing `TaxRule` data and adds the extra metadata, or
- **(B)** Extend the `TaxRule` seed data with the 51 jobs as additional rules.

Option A is cleaner — it avoids schema changes beyond adding `ENERGY_ENVIRONMENT`, and the catalog can compose existing classification service lookups with job-level metadata.

---

### Prompt 3 — Backend Read Model

#### What Already Exists

| Component | File | Status |
|-|-|-|
| `CapExPortfolioProjection` response | `capexProjectionService.ts` | ✅ Returns per-asset `taxClassification`, `deductiblePct`, `taxConfidence`, `taxSource` |
| `AssetHealthForecast` response | `assetHealthService.ts` | ✅ Portfolio + per-building health buckets |
| `TimingRecommendation` interface | `capexProjectionService.ts` | ✅ Rich: `estimatedTaxSavingChf`, `scheduledYearMarginalPct`, `bracketSource`, etc. |
| Forecasting routes | `routes/forecasting.ts` | ✅ Both endpoints registered |
| Frontend proxies | `pages/api/forecasting/` | ✅ Both proxy files exist |
| API client DTOs | `packages/api-client/src/index.ts` | ⚠️ Has `TimingRecommendationDTO` but simplified (no bracket fields) |

#### What's Missing (Net-New for Prompt 3)

| Gap | Severity | Details |
|-|-|-|
| **Renovation-job metadata in DTO** | 🟡 Extension | If 51-job catalog is added, the read model needs to expose `accountingTreatment`, `timingSensitive`, `examples` per item |
| **`isUnmapped` fallback flag** | 🟢 Minor | Heuristic fills in data but no explicit fallback marker |
| **API client DTO sync** | 🟡 | `TimingRecommendationDTO` in api-client is simpler than the backend `TimingRecommendation` interface — needs sync |

---

### Prompt 4 — Renovation Decision-Support UI

#### What Already Exists

| Component | File | Status |
|-|-|-|
| Manager inventory page (4 tabs) | `pages/manager/inventory.js` | ✅ Buildings, Assets, Decisions, Depreciation |
| `DepreciationStandards` component | `components/DepreciationStandards.js` | ✅ 465 lines, ASLOCA groups, useful-life bars |
| `AssetInventoryPanel` component | `components/AssetInventoryPanel.js` | ✅ Unit-level asset panel with depreciation |
| Cashflow timing advisor | `pages/manager/cashflow/[id].js` | ✅ Shows "advance/defer → save CHF X" chips |
| Panel / badge / table patterns | Various layout components | ✅ Reusable |

#### What's Missing (Net-New for Prompt 4)

| Gap | Severity | Details |
|-|-|-|
| **Renovation classification panel/tab** | 🔴 Primary UI | No UI anywhere shows "this job is VALUE_PRESERVING / usually immediately deductible" |
| **Tax category badges** | 🟡 New UI element | Need pills for Value Preserving / Value Enhancing / Mixed / Energy & Environment |
| **Accounting treatment display** | 🟡 New UI element | "Usually expensed in current year" etc. |
| **Filter by tax category** | 🟡 New feature | No filtering exists |
| **Search by renovation job** | 🟡 New feature | No search exists |
| **Per-building renovation dashboard** | 🟡 New UI | Nothing at building level shows renovation classification |

#### Note on the Forecast Tab

The Forecast tab (with CapEx projection, bundling, timing recommendations) was previously built but **lost due to external file edits**. The backend for it (`capexProjectionService.ts`, `assetHealthService.ts`, `forecasting.ts` route) is intact. The Forecast tab restoration is a separate task from the renovation classification UI, but both could live on the same inventory page as separate tabs.

---

### Prompt 5 — Timing Guidance Without Full Income Data

#### What Already Exists

| Component | File | Status |
|-|-|-|
| Timing recommendation engine | `capexProjectionService.ts` | ✅ Scans 50-95% depreciation, ±2yr window |
| Swiss bracket calculator | `swissTaxBrackets.ts` | ✅ Federal + ZH + GE + flat fallback |
| `computeTimingPairSavings()` | `swissTaxBrackets.ts` | ✅ Real CHF savings from bracket effects |
| Owner `marginalTaxRate` | `schema.prisma` → User model | ✅ Configurable per owner |
| Income projection | `capexProjectionService.ts` | ✅ Uses `BuildingFinancialSnapshot` or lease rents |
| Timing advisor UI | `cashflow/[id].js` | ✅ Shows advance/defer + savings |

#### What's Missing (Net-New for Prompt 5)

| Gap | Severity | Details |
|-|-|-|
| **Qualitative "timing matters" labels** | 🟡 New helper | Existing system gives numeric CHF savings, not "matters a lot / moderately / little" |
| **Standalone timing panel** | 🟡 New UI | Timing recs only available within cashflow plan context |
| **Scenario chips** (low/med/high tax year) | 🟢 Nice-to-have | Not critical |
| **"Operational urgency vs timing" messaging** | 🟡 New feature | System doesn't weigh asset urgency against tax timing |

#### Important Design Consideration

The existing system **already uses income data** (from financial snapshots or lease rents as proxy). Prompt 5 asks for guidance **without** full income data. The existing flat-rate fallback partially addresses this, but the prompts want a fundamentally different approach: qualitative sensitivity labels based on tax category and deductible share, not numeric tax calculations. This is complementary to — not a replacement for — the existing timing engine.

---

### Prompt 6 — Docs, Guardrails, and Tests

#### What Already Exists

| Component | File | Status |
|-|-|-|
| Architecture docs | `ARCHITECTURE_LOW_CONTEXT_GUIDE.md` | ✅ References taxClassificationService, capexProjectionService, taxRuleRepository |
| Contract test: asset-health | `assetHealthForecast.test.ts` | ✅ 190 lines, full DTO shape |
| Blueprint generation | `scripts/generate-roadmap.js` | ✅ Pre-commit hook |
| Audit tracking | `docs/AUDIT.md` | ✅ 94 findings tracked |

#### What's Missing (Net-New for Prompt 6)

| Gap | Severity | Details |
|-|-|-|
| **Unit tests: `taxClassificationService`** | 🔴 Major gap | No test file exists |
| **Unit tests: `swissTaxBrackets`** | 🔴 Major gap | No test file exists |
| **Unit tests: `capexProjectionService`** | 🔴 Major gap | No test file exists |
| **Contract test: `GET /forecasting/capex-projection`** | 🟡 Gap | Only asset-health has a contract test |
| **Renovation catalog tests** | 🔴 Needed | Once catalog exists, needs representative mapping + fallback tests |
| **Guardrail docs** | 🟡 Gap | No docs on how to extend tax rules or add renovation jobs |

---

### Prompt 7 — Final Verification

Status: N/A until Prompts 2–6 are implemented. Verification infrastructure (`tsc`, `npm test`, `npm run blueprint`) is all in place.

---

## Net-New Work Summary

| Priority | Item | Estimated Scope | Depends On |
|-|-|-|-|
| 🔴 P0 | Add `ENERGY_ENVIRONMENT` to `TaxClassification` enum | Prisma migration | — |
| 🔴 P0 | Create 51-job renovation catalog (`swissRenovationCatalog.ts` or similar) | ~400 lines | ENERGY_ENVIRONMENT enum |
| 🟡 P1 | Add `accountingTreatment` / `timingSensitive` metadata | ~50 lines | Catalog |
| 🟡 P1 | Typed lookup helpers (by code, by asset type, by search term) | ~100 lines | Catalog |
| 🟡 P1 | Extend CapEx read model to surface renovation metadata | ~50 lines | Catalog + helpers |
| 🟡 P1 | Sync `TimingRecommendationDTO` in api-client with backend | ~20 lines | — |
| 🔴 P0 | Build renovation decision-support UI tab/panel | ~400 lines | Read model |
| 🟡 P1 | Qualitative timing sensitivity helper | ~80 lines | Catalog |
| 🟡 P1 | Timing sensitivity UI integration | ~100 lines | Helper + UI panel |
| 🔴 P0 | Unit tests for tax services + renovation catalog | ~300 lines | Catalog |
| 🟡 P1 | Contract test for `GET /forecasting/capex-projection` | ~150 lines | — |
| 🟢 P2 | Architecture docs update | ~30 lines | All above |

**Estimated total net-new code: ~1,700 lines** (excluding the existing ~2,500 lines of infrastructure that's already built).

---

## Existing Infrastructure That Can Be Reused Directly

| System | Lines | Reuse |
|-|-|-|
| `taxClassificationService.ts` | ~120 | Lookup engine — extend, don't replace |
| `taxRuleRepository.ts` | ~293 | Data access — reuse as-is |
| `taxRuleSeed.ts` | ~600 | Expand with new rules or keep separate |
| `capexProjectionService.ts` | ~695 | Timing engine — reuse as-is |
| `swissTaxBrackets.ts` | ~356 | Bracket calculator — reuse as-is |
| `assetHealthService.ts` | ~212 | Health forecast — reuse as-is |
| `assetInventory.ts` | ~250+ | Depreciation lifecycle — reuse as-is |
| `replacementCostService.ts` | ~200+ | Cost estimates — reuse as-is |
| `forecasting.ts` (route) | ~55 | API routes — extend or add |
| `DepreciationStandards.js` | ~465 | UI pattern — reuse visual language |
| `AssetInventoryPanel.js` | ~200+ | UI pattern — reuse visual language |

---

## Risk / Decision Points

1. **Schema migration required** — Adding `ENERGY_ENVIRONMENT` to `TaxClassification` requires `prisma migrate dev`. Low risk (additive enum value), but must follow G1/G8 database rules.

2. **Catalog placement** — Should the 51 jobs live as:
   - (A) Static typed catalog file (like `swissTaxBrackets.ts`) — **recommended**, avoids schema changes beyond the enum
   - (B) Additional `TaxRule` seed records — more data-driven but heavier
   - (C) New Prisma model — over-engineered for a static reference table

3. **Prompt 5 vs existing timing engine** — The prompts explicitly say "do not build a fake exact tax engine" and "do not require full owner taxable income." The existing system (`capexProjectionService` + `swissTaxBrackets`) *does* compute exact tax savings using bracket data. These are complementary: the existing engine for owners who have configured `marginalTaxRate`, and Prompt 5's qualitative guidance for everyone else.

4. **UI home** — The renovation panel could be:
   - A new tab on the inventory page (alongside Buildings, Assets, Decisions, Depreciation, and the restored Forecast tab)
   - A section within the building detail page
   - Both (summary on inventory, detail on building page)
