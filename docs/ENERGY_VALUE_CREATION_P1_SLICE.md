# P1 — Archetype Bridge + Surface Unification — Implementation Slice

> Parent spec: [ENERGY_VALUE_CREATION_SPEC.md](ENERGY_VALUE_CREATION_SPEC.md). This is the **first** phase — **no new data model, no energy model.** It proves the prescriptive UX and removes the duplicate-list risk before P2 (energy).
> Grounded in a code map on 2026-07-15 — file:line refs are current-as-of that read; re-verify before editing.

## Goal

Turn the *existing* renovation opportunities into an **archetype-aware, ranked action agenda**, rendered through **one shared component** in two places (building Reporting "Value creation" sub-tab = canonical; Finance → Planning workspace), and keep the existing simulator + `NPVScenariosPanel` **untouched** (they are layers 2–3 downstream — see spec §0).

## Honest scope boundary (what P1 does and does NOT show)

The prototype's cards show per-move **NPV / terminal-value-protected / subsidy**. Those require either the energy model (P2) or a per-item NPV-preview call (deferred, roadmap TASK-016). **P1 does not compute per-item NPV.** P1 cards show only what today's data + a pure preview can honestly produce:

| Card element | P1 source | Later |
|---|---|---|
| Ranking + fit reason | **new** `rankOpportunitiesForMandate` (pure) over `RepairReplaceItem` × dims | — |
| Capex | `RepairReplaceItem.estimatedReplacementCostChf` (existing) | net-of-subsidy in P4 |
| Recommendation / condition / depreciation / lease | existing DTO fields | — |
| OBLF uplift (preview) | **new** pure `oblfUpliftPreview()` = cost × passthrough ÷ usefulLifeMonths (matches simulator formula) | engine-exact in P3 |
| Building verdict banner (Invest/Defer/Neglect) | existing `GET /buildings/:id/npv-scenarios` → `strategyContext` | — |
| Per-move **NPV**, **terminal protected** | **not shown in P1** — the card's "Simulate →" opens the existing drawer where the full NPV + curve live | P2/P3 |
| Energy header + compliance timeline | **not in P1** (no energy model) | P2 |

Net: P1 is *ranking + framing + verdict + one honest cash number (OBLF preview) + the doorway to the real NPV*. The rich energy/NPV numbers land in P2/P3.

---

## Backend

### B1 — Enrich `computeRecommendation` (the verdict bridge) — `apps/api/src/routes/forecasting.ts:50`
Today it reads only `dims.capexTolerance` + `dims.saleReadiness` and has **no `opportunistic_repositioner` branch**. Enrich **additively**:
- Consume `horizon`, `appreciationPriority`, `modernizationPreference`, `incomePriority`, `liquiditySensitivity` in the fallback logic.
- Add an `opportunistic_repositioner` branch (→ `invest` when `modernizationPreference`/`capexTolerance` high).
- Keep the `FCI ≥ 30 → invest` override and the archetype-first rules exactly as-is.

⚠️ **3 call sites** — `forecasting.ts:327`, `cashflowPlans.ts:104`, `cashflowPlans.ts:138`. Enriching changes cashflow-plan verdicts too. **Guard with a characterization test** (`computeRecommendation.characterization.test.ts`) that pins the current verdict for a grid of `(archetype, dims, fci, scenarioNpvs)` **before** the refactor, so the enrichment only *adds* resolution for previously-underspecified inputs and never silently flips an existing verdict.

### B2 — Extract shared profile resolution — new `services/strategy/buildingStrategyResolver.ts`
`resolveStrategyContext` (`cashflowPlans.ts:93`) and the forecasting endpoint both resolve building→owner profiles inline with direct Prisma. Extract the **profile→{archetype, dims, roleIntent, source}** resolution (building profile → owner-portfolio fallback with the divergence rule → none) into one pure-ish resolver that takes repository results (keeps **G20**: no `prisma.*` in services — feed it via `getBuildingProfileByBuildingId` + a `buildingOwnerRepository` finder). Both `resolveStrategyContext` and the new agenda endpoint call it. *No behaviour change* — pure refactor, covered by existing cashflow-plan tests + a new resolver unit test.

### B3 — New pure ranker — new `services/strategy/opportunityRanking.ts`
```ts
export function rankOpportunitiesForMandate(
  items: RenovationOpportunity[],
  dims: StrategyDimensions | null,
  archetype: string | null,
): Array<RenovationOpportunity & { score: number; fitReason: string }>;

export function oblfUpliftPreview(item: RenovationOpportunity, passthroughPct?: number): number; // CHF/yr
```
- Score = weighted sum over signals derivable **today**: recommendation tier (`REPLACE>PLAN_REPLACEMENT>MONITOR>REPAIR`), `depreciationPct`, `lastConditionStatus`, `remainingLifeMonths`, `estimatedReplacementCostChf` (as a cost/payback proxy) — weighted by the mandate (the same shape as the prototype's `W` table). `dims == null` → neutral ordering = today's recommendation-priority sort (backward-compatible with the accordion's current order).
- `fitReason` = short per-mandate string (mirrors the prototype).
- Pure, unit-tested (`opportunityRanking.test.ts`): each archetype produces the expected top item on a fixture set; null-dims reproduces the existing sort.

### B4 — New endpoint `GET /buildings/:id/value-creation-agenda` — extend `apps/api/src/routes/forecasting.ts`
Composes existing services — **no new query for opportunities**:
```
guard: maybeRequireManager                      // MANAGER or OWNER read, matches reporting
query: ?mandate=<archetype?>                      // optional what-if override; default = resolved profile
→ items   = getBuildingRenovationOpportunities(prisma, orgId, id)        // existing
  profile = buildingStrategyResolver(...)                                 // B2
  archetype = mandate ?? profile.archetype                                // what-if or real
  ranked  = rankOpportunitiesForMandate(items, profile.dims, archetype)   // B3
  verdict = strategyContext from GET /npv-scenarios logic (reuse)         // existing
response: { strategyContext: { source, archetype, roleIntent, dims, verdict, rationale },
            opportunities: ranked.map(+ oblfUpliftPreview) }
```
The `?mandate=` param is what lets the panel's mandate switcher do **what-if** exploration while defaulting to the building's real profile — reconciling the prototype's switcher with real data.

### B5 — Wiring (per G2/G3)
- `openapi.yaml`: `ValueCreationAgendaDTO` + operation (mind `PUBLIC_UNSPECCED_BUDGET`).
- `packages/api-client`: method.
- `contracts.test.ts`: shape guard.
- Proxy: `apps/web/pages/api/buildings/[id]/value-creation-agenda.js` (copy the 4-line `renovation-opportunities.js` proxy).

---

## Frontend

### F1 — Shared agenda component — new `apps/web/components/cashflow/ValueCreationAgenda.jsx`
The canonical shared surface (spec §0.1). Props:
```
{ buildingId, defaultMandate?, onSimulate?, onPlanned?, dense? }
```
Renders: **mandate bar** (segmented archetype control, defaults to resolved profile, drives `?mandate=`), **verdict banner** (Invest/Defer/Neglect + rationale from `strategyContext`), **ranked opportunity cards** (capex, recommendation/condition badges via `statusVariants.js`, OBLF-preview KPI, `fitReason`), each with **"Simulate → Plan"** that calls `onSimulate([item], buildingId)` → opens the **existing** `RenovationSimulatorDrawer` (unchanged). Uses `useDetailResource`, `ResourceShell`, `Button`, `Badge`, `cn`, `formatChf`; tokens only (G23); en+fr i18n.

### F2 — Reporting sub-tab (canonical) — `apps/web/pages/admin-inventory/buildings/[id].js`
Three edits inside `BuildingPeriodAnalysis`:
- **`tab` state** (line 265): add `"valuecreation"` to the comment/allowed set.
- **`activePanel`** (line 766): add branch `tab === "valuecreation" ? valueCreationSlide : …` (keep `revexSlide` as final default).
- **sub-tab array** (line 798): append `["valuecreation", t("buildingsId.reporting.valueCreationTab")]` (with the "new" dot + subtle separator from the prototype).
- `valueCreationSlide` renders `<ValueCreationAgenda buildingId={buildingId} onSimulate={…} onPlanned={…} />` (drawer host already patternable from the workspace).
- Add the **bridge CTA** on `kpiSlide` ("These figures tell you how the asset performed → Value creation") that flips `setTab("valuecreation")`.

### F3 — Planning workspace unification — `apps/web/components/PlanningWorkspace.jsx` / `RenovationAccordion.jsx`
Keep the multi-building **tree** (its natural layout), but adopt the shared logic so there's no divergent second list:
- `RenovationAccordion` imports and applies `rankOpportunitiesForMandate` output ordering + `fitReason` (via the same endpoint or a shared client helper) and the shared **mandate bar** + card styling.
- The per-row / bulk **"Simulate →"** already delegates to `onSimulate` (accordion line 321) → unchanged simulator. Invariant holds: one ranker, one card style, one simulator, one plan.
- **Recommendation:** reporting = flat ranked agenda (single building, mandate-first); planning = tree + mandate bar (multi-building). Same primitives, context-appropriate layout. (If you'd rather planning *also* be the flat agenda, that's a small swap — flag it.)

### F4 — i18n
`buildingsId.reporting.valueCreationTab` + mandate labels + verdict/fit strings + bridge copy, en + Swiss-fr.

---

## Tests
- `computeRecommendation.characterization.test.ts` (pin current verdicts) **then** enrichment test (new dims resolve previously-tied cases).
- `opportunityRanking.test.ts` (per-archetype top item; null-dims = existing sort).
- `buildingStrategyResolver.test.ts` (building→owner→none precedence; divergence → defer).
- `valueCreationAgenda` endpoint contract test (shape + `?mandate=` override + `maybeRequireManager` guard).
- Existing cashflow-plan NPV tests must stay green through the B2 refactor.

## Guardrail checklist
- [ ] G20 — new services pure; DB via repositories (new `buildingOwnerRepository` finder if needed).
- [ ] G9 — reuse existing includes; no inline include trees.
- [ ] G2/G3 — DTO → OpenAPI → api-client → contract test → proxy in one PR.
- [ ] G23 — tokens only, no raw `slate-*`/`style={{}}`.
- [ ] i18n en+fr; no hardcoded labels.
- [ ] `PUBLIC_UNSPECCED_BUDGET` respected for the new route.

## Definition of done
Open a building → Reporting → **Value creation** sub-tab → see the ranked agenda defaulting to the building's real mandate; switch mandate → re-ranks/reframes (what-if); click **Simulate → Plan** → the **existing** drawer opens with that item and the full NPV/curve; "Plan this work" → cashflow plan (unchanged). Planning workspace shows the same cards/ranking. No per-item NPV or energy header yet (P2/P3).
