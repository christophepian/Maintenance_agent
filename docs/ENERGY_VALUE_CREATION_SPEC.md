# Energy-Aware Value Creation Module — Specification

> **Status:** Draft for review (2026-07-15). Deliverable of the "descriptive → prescriptive reporting" discussion.
> **Framing decision (user, 2026-07-15):** canton-agnostic **MuKEn** framing; regulatory constants researched + cited here for owner validation (see [Appendix A](#appendix-a--regulatory--engineering-constants-cited--validate)).
> **Surface decision (user, 2026-07-15):** **nothing on the planning/simulation page is scrapped.** The existing renovation simulator (cumulative-NPV curve + Invest/Defer/Neglect scenario cards) and `NPVScenariosPanel` are the *engine* this module plugs into (see [§0](#0-how-this-relates-to-the-existing-simulator--dont-scrap-it)). The opportunities list is **unified into one shared component** rendered in both the Reporting "Value creation" panel (canonical per-building) and the Finance → Planning workspace.
> **Related memories/docs:** `reporting_enhancements.md`, `project_levered_npv.md`, `project_renovation_simulator.md`, `project_strategy_fallback.md`, `project_property_data_fields.md`. Engine: `apps/api/src/services/npvService.ts`. Recommendation: `apps/api/src/routes/forecasting.ts:50`.

---

## 1. Thesis

Reporting today is **descriptive** — it answers *"how has the asset performed"* (NOI, occupancy, collection, imported actuals). It never answers *"how can it perform better next period, given who owns it."*

Almost all the machinery to close that gap already exists and is merely disconnected from reporting:

- **Investor archetypes are live** — `StrategyArchetype` = `exit_optimizer, yield_maximizer, value_builder, capital_preserver, opportunistic_repositioner`, each backed by a 10-field `StrategyDimensions` vector.
- **A renovation-aware, levered NPV engine exists** — `npvService.ts`: FCFE equity model, OBLF Art. 14 rent-uplift pass-through, Do-Nothing risk, and a **free per-scenario `terminalValueChf` input** that the Neglect scenario already haircuts (`Math.max(0, propertyValue − capexBacklog)`).
- **The intervention → cashflow-plan → NPV loop is already closed** (`CashflowOverride.{costChf, rentUpliftChfPerMonth, riskAvoidedChfPerYear}`).

What's missing is (a) a **bridge** that makes reporting archetype-aware and turns it into a ranked action agenda, and (b) the single most powerful new input in the Swiss regulatory context: an **energy grade** that drives *both* operating cost **and** terminal value via MuKEn/IDC compliance.

This module adds that energy dimension and wires it into the existing engine and reporting, producing per-owner, per-building **value-creation recommendations for the upcoming period**.

---

## 0. How this relates to the existing simulator — DON'T scrap it

The renovation simulator (`RenovationSimulatorDrawer.jsx` — the cumulative-NPV **curve** + scenario cards) and the levered `NPVScenariosPanel` are **kept and reused**. This module adds only the top prescription layer; everything downstream is the pipeline that already exists.

| Layer | Surface | Answers | Status under this module |
|---|---|---|---|
| **1. Prescription** | "Value creation" agenda (Reporting) + Planning workspace | *Which moves, in what order, why — for this mandate* | **New** — a ranked index over the opportunity engine |
| **2. Simulation** | `RenovationSimulatorDrawer` — cumulative-NPV curve + Invest/Defer/Neglect cards | *Prove one move; tune OBLF / discount / cap rate / vacancy* | **Kept**; gains envelope-intervention type + compliance terminal value |
| **3. Validation** | Cashflow plan + `NPVScenariosPanel` (levered, LTV/DSCR) | *Does the whole programme work at building level* | **Kept**; gains compliance terminal value |

- The agenda card's KPIs are a **precomputed summary** from the same `npvService` — not a second engine. Its **"Simulate → Plan"** CTA opens the existing simulator pre-loaded with that intervention → "Plan this work" → cashflow plan → `NPVScenariosPanel`.
- Energy changes the Invest/Defer/Neglect scenarios only by (a) adding **envelope interventions** to the "Invest" set and (b) substituting the **compliance-adjusted terminal value** — which makes the existing **Neglect** scenario *more* meaningful (terminal value now collapses at the compliance cliff, not just by capex backlog). The curve's structure is unchanged.

### 0.1 One opportunity model, two doorways (unification — user decision, 2026-07-15)
The Planning workspace already renders a **Renovation Opportunities** list + simulator; the Reporting "Value creation" panel is *also* a ranked-opportunities list. These are **not** two lists — they are **one shared component** (extend `components/cashflow/` / `RenovationOpportunitiesSection`) rendered in two contexts:

- **Reporting → Value creation** — *canonical* per-building prescription surface: archetype- and energy-aware, the "so what do we do" continuation of the numbers.
- **Finance → Planning** — the cross-building / portfolio planning workbench: the **same** opportunity cards, feeding the **same** simulator and plan; inherits the archetype + energy awareness for free.

Invariant: one opportunity DTO, one simulator, one cashflow plan — only the presentation/context differs. No divergent second list.

---

## 2. Why energy is the lever (and the Swiss nuance that makes it credible)

An energy upgrade drives value through **two channels**, both already expressible in `npvService`:

### Channel A — Operating cost, with the cost-pass-through correction
Naïvely: "upgrade the envelope, save X on heating." But under Swiss tenancy law, heating & hot water are **frais accessoires** billed to the tenant at cost — so the bill saving accrues to the **tenant**, not the owner. The owner's return on an energy upgrade is:

1. **OBLF Art. 14 rent uplift** — energy improvements are expressly a *plus-value* passable to rent (Art. 14 al. 2 OBLF); major works are presumed **50–70 %** value-adding. *Already modeled in the simulator.*
2. **Charge competitiveness** — lower Nebenkosten → higher effective-rent capacity, lower vacancy risk.
3. **Subsidy** — Le Programme Bâtiments grants reduce **net** capex (30–150 CHF/m² insulation; CHF 5k–20k heat pumps) — an input that materially improves NPV.
4. **Avoided forced capex / penalty** under the compliance regime (Channel B).

> Surfacing exactly this — *"the bill saving is the tenant's; your return is OBLF uplift + subsidy + risk avoided"* — is a differentiator precisely because it's the domain-correct version, not the naïve one.

> **LDTR caveat (GE/VD):** the *loi sur les démolitions, transformations et rénovations* caps rent increases after renovation to protect housing, and can override the OBLF uplift. The OBLF uplift must therefore be **config-capped per canton** (see §7.2, [Appendix A](#appendix-a--regulatory--engineering-constants-cited--validate)).

### Channel B — The compliance terminal-value cliff (the MuKEn/IDC lever)
Under MuKEn (canton-agnostic) and its sharpest instance, Geneva's **IDC** regime, a building above an energy threshold faces **mandatory works**, and at the extreme becomes **unsellable until brought into compliance** — a terminal-value event. The Geneva IDC "significant exceedance" trigger **tightens on a published schedule** (222 → 180 → 153 kWh/m²·yr across 2022 → 2027 → 2031), and MuKEn 2025 moves fossil-heating replacement from a 10 % renewable quota to **exclusive** renewables, phased per canton 2025–2028. These are dated, forecastable cliffs.

In NPV terms this is a **compliance-adjusted terminal value**: if projected grade/IDC at horizon end is below the sellability threshold and unremediated, haircut the terminal value — toward **zero** in the extreme. It's a one-input change to `terminalValueChf` per scenario, not new NPV math. The asymmetry (Neglect's terminal value collapses at the cliff; Invest preserves it + adds uplift) is what actually moves a `capital_preserver` or `value_builder` to act.

---

## 3. Architecture — reuse map

| Layer | Reuse (≈70 %) | New |
|---|---|---|
| NPV engine | `buildScenario` `terminalValueChf` slot; OBLF uplift; `computeRenovationNoiAdjustments`; `CashflowOverride` fields | `complianceTerminalValue()` helper feeding `terminalValueChf`; envelope-intervention → override mapping |
| Strategy | `StrategyArchetype`, `StrategyDimensions`, `resolveStrategyContext` fallback | enrich `computeRecommendation` to use full dimension set + compliance override |
| Config | `LegalSource`/`LegalVariable` (canton-scoped); `MarketPricePerZip` "modelled + manual override" pattern | `EnergyComplianceRule` config (per-canton thresholds + dates) |
| Data | `Building.{constructionDate,lastRenovationDate,ecaVolumeM3,yearBuilt,netAreaSqm,weightedAreaSqm}`; `Unit.{energyLabel,insulationQuality,heatingType,lastRenovationYear}`; `Asset.installedAt` | `BuildingEnergyProfile`, `EnvelopeComponent`, enums |
| Reporting | Building Reporting tab, renovation simulator, plan→NPV loop, `ReportingShared.jsx` | "Value creation / Next period" panel; envelope simulator preset |

**Design principle carried over:** keep the engine dumb. As today, callers **supply** `terminalValueChf`; the compliance haircut is computed in a new service, not inside `npvService`.

---

## 4. Data model

New models (Prisma). All money in **integer cents** where monetary (per audit backlog), areas as `Float`, all nullable-by-default except FKs. Follows the three-allowlist wiring (`validation/*` → `services/inventory` → `repositories/inventoryRepository`) and G2/G3 (update every consumer in one PR).

### 4.1 `BuildingEnergyProfile` (1:1 with `Building`)
```
id                     String   @id
orgId                  String
buildingId             String   @unique
heatedAreaSqm          Float?    // fallback chain: weightedAreaSqm → netAreaSqm → ecaVolumeM3/3.0
heatingSystemType      HeatingType?      // reuse existing enum (HEAT_PUMP/DISTRICT/GAS/OIL/ELECTRIC/UNKNOWN)
heatingInstalledYear   Int?
hotWaterType           HeatingType?
// --- computed + cached (recompute on component/field change) ---
modelledQhKwhM2        Float?    // space-heat demand estimate (SIA 380/1-style, see §5)
modelledIdcMjM2        Float?    // = Qh(+DHW) expressed as IDC, MJ/m²·yr
gradeEnvelope          EnergyLabel?      // reuse A–G enum
gradeOverall           EnergyLabel?
// --- authoritative override (beats modelled; MarketPricePerZip pattern) ---
source                 EnergyProfileSource @default(MODELLED)
certifiedIdcMjM2       Float?
certifiedGrade         EnergyLabel?
certificateRef         String?
certifiedAt            DateTime?
certificateExpiresAt   DateTime?
// --- compliance (computed against canton rule, §7) ---
complianceStatus       ComplianceStatus @default(UNKNOWN)
complianceCliffAt      DateTime?         // next date the building falls out of compliance if unremediated
createdAt / updatedAt
```

### 4.2 `EnvelopeComponent` (N per building)
```
id                 String @id
orgId              String
buildingId         String
kind               EnvelopeComponentKind   // WINDOWS | FACADE | ROOF | FLOOR | HEATING | HOT_WATER | VENTILATION
installedYear      Int?
areaSqm            Float?                   // for opaque/glazed elements; null for HEATING/HOT_WATER
uValueOverride     Float?                   // W/m²K; else derived from installedYear era-band (Appendix A)
condition          ItemCondition?           // optional link to condition-report signal
assetId            String?                  // optional link to an already-inventoried Asset (e.g. windows)
notes              String?
createdAt / updatedAt
```

### 4.3 New enums
```
EnvelopeComponentKind  WINDOWS FACADE ROOF FLOOR HEATING HOT_WATER VENTILATION
EnergyProfileSource    MODELLED CECB GEAK IDC_DECLARED
ComplianceStatus       UNKNOWN COMPLIANT AT_RISK NON_COMPLIANT
```
`EnergyLabel` (A–G) and `HeatingType` are **reused** from the existing schema.

### 4.4 Config: `EnergyComplianceRule` (canton-agnostic, data-driven)
Store as **`LegalVariable`** rows (canton-scoped infra already exists) or a dedicated small table keyed by canton. Shape (JSON):
```jsonc
{
  "canton": "GE",
  "metric": "IDC",                       // IDC | CECB_GRADE | QH
  "unit": "kWh/m2",
  "renovationTrigger": 125,              // above → renovation required
  "optimizationBand": [125, 153],        // request optimisation, no audit
  "significantExceedance": [             // forces works; tightens over time
    { "from": "2022-09-01", "value": 222 },
    { "from": "2027-01-01", "value": 180 },
    { "from": "2031-01-01", "value": 153 }
  ],
  "heatingReplacementRule": "EXCLUSIVE_RENEWABLE", // or "MIN_10PCT_RENEWABLE"
  "heatingRuleInForceFrom": "2025-01-01",
  "cecbMandatoryOnSale": false,
  "terminalHaircutModel": "FORCED_CAPEX" // FORCED_CAPEX | UNSELLABLE_ZERO
}
```
Ships with seeded defaults for GE/VD/FR/NE/ZH/BS (Appendix A), **all owner-validatable**; every value is config, never hardcoded in logic.

---

## 5. The IDC / grade estimator (`services/energyModelService.ts`, pure)

A steady-state, element-based bottom-up estimate in the spirit of **SIA 380/1** — explicitly an **estimate, labelled as such**, superseded by a certified value when `source ≠ MODELLED`.

```
Qh  ≈  ( Σ_elements Uᵢ·Aᵢ·G  +  Hᵥ·G )  −  gains(solar, internal)     [kWh/yr]
Qh/m² = Qh / heatedAreaSqm
IDC(MJ/m²) = (Qh/m² + Qww/m²) · 3.6         // + DHW allowance
grade = bandOf(Qh/m²)   // A–G thresholds, Appendix A
```
- `Uᵢ` from `EnvelopeComponent.uValueOverride` else the **era-band table** keyed on `installedYear` (Appendix A, Table 2).
- `Aᵢ` from component areas; when missing, estimate from `ecaVolumeM3` + typical envelope-to-volume ratios (documented default).
- `G` = degree-day / gain-utilisation factor by **canton climate** (config).
- Heating-system efficiency factor by `heatingSystemType` + age (heat pump COP vs oil/gas boiler).
- **Precedence:** `certifiedIdcMjM2`/`certifiedGrade` override the modelled figures entirely (mirror `MarketPricePerZip`).

Pure, unit-tested (`energyModelService.test.ts`): known-building fixtures reproduce expected grade bands within tolerance.

---

## 6. Financial effects → NPV wiring

### 6.1 Envelope intervention → `CashflowOverride` (Channel A)
An "envelope intervention" (e.g. *replace windows*, *insulate façade*, *swap oil → heat pump*) resolves to the existing override fields:
- `costChf` = works cost **− subsidy** (Programme Bâtiments, Appendix A Table 4).
- `rentUpliftChfPerMonth` = OBLF Art. 14 uplift = `plusValuePct · costChf · (interest + amortization + maintenance rate) / 12`, **capped by LDTR** where applicable (§7.2).
- `riskAvoidedChfPerYear` = expected forced-capex/penalty avoided (Do-Nothing already models this pattern).
- The intervention recomputes the target `EnvelopeComponent.uValue` → new `Qh` → new grade/IDC → new `complianceStatus` (feeds Channel B).

Reuses `computeRenovationNoiAdjustments` unchanged — Invest credits uplift after the work year, Defer pushes it, Neglect never gets it.

### 6.2 Compliance-adjusted terminal value (Channel B)
New pure helper `services/complianceTerminalValue.ts`:
```
complianceTerminalValueChf(basePropertyValueChf, projectedMetricByYear, rule, plannedRemediations, scenario)
```
For each scenario, at horizon end:
- **Compliant** (metric ≤ trigger, or remediation planned before the cliff) → full `propertyValueChf`.
- `terminalHaircutModel = FORCED_CAPEX` → `propertyValue − estimatedComplianceCapex` (a buyer prices in the mandatory works).
- `terminalHaircutModel = UNSELLABLE_ZERO` → `Math.max(0, propertyValue − forcedRemediationCost)`, → **0** in the extreme.

The result is passed as the scenario's `terminalValueChf` — the engine stays unchanged. Neglect's existing `capexBacklog` deduction and this compliance haircut compose (take the lower).

**Net effect on the three scenarios**

| Scenario | Terminal value | OBLF uplift | Risk borne |
|---|---|---|---|
| **Invest** (do the envelope) | full + grade uplift, less subsidised capex | credited post-work | none |
| **Defer** | at risk if cliff < horizon and deferral crosses it | pushed by deferYears | interim |
| **Neglect** | haircut → possibly 0 at the cliff | never | every year |

---

## 7. The prescriptive layer (archetype bridge)

### 7.1 Enrich `computeRecommendation` (`routes/forecasting.ts:50`)
Today it reads only `capexTolerance` and `saleReadiness`. Extend it to consume the **full** `StrategyDimensions` (`modernizationPreference`, `appreciationPriority`, `horizon`, `incomePriority`, `liquiditySensitivity`) and add a **compliance override** analogous to the existing `FCI ≥ 30 → invest` rule:

> **If a compliance cliff falls within the hold horizon and the terminal value at risk exceeds a threshold → force at least "plan remediation," regardless of archetype.** (Asymmetric, like FCI: the cost of ignoring a cliff dominates.)

Archetype interactions become meaningful:
- `capital_preserver` → cliff = headline; frames as *"protect the asset."*
- `value_builder` → grade jump + appreciation + uplift; *"improve long-term value."*
- `yield_maximizer` → OBLF uplift + charge competitiveness; *"income."*
- `exit_optimizer` → **timing**: cliff **before** `saleReadiness` horizon ⇒ must remediate to sell (buyer prices it in); cliff **after** ⇒ defer is legitimate.
- `opportunistic_repositioner` → currently no dedicated branch; energy repositioning (grade A/B target) is its natural home.

### 7.2 Output: the action agenda
Per building, a ranked list of value-creation moves for the upcoming period:
```
{ intervention, capexChfNetOfSubsidy, deltaGrade, deltaIdc,
  oblfUpliftChfPerYear (LDTR-capped), terminalValueProtectedChf,
  npvChf, paybackYears, profileFitTag, complianceDriver }
```
Ranking = NPV, with the compliance-driven items floated when a cliff is in-horizon.

---

## 8. Reporting surface (UI)

New **"Value creation"** panel/sub-tab on the building Reporting tab (mirrors `BuildingPeriodAnalysis` layout, uses `ReportingShared.jsx`, fully i18n en/fr, dark-aware tokens):

1. **Energy header** — modelled grade badge (A–G) + IDC estimate + **compliance traffic light** (green COMPLIANT / amber AT_RISK / red NON_COMPLIANT) + **cliff date** ("non-compliant from 2031"). "Estimate — enter CECB/IDC to refine" affordance (opens the manual-override form).
2. **Action agenda** — ranked cards, each archetype-tagged, with capex (net of subsidy), Δgrade, OBLF uplift (LDTR-noted), terminal value protected, NPV.
3. **Simulate → Plan** — card CTA pre-loads the renovation/envelope simulator; "Plan this work" → cashflow plan → NPV validates (existing loop; add the envelope-intervention type to the override creation path).

---

## 9. API surface

| Method / path | Purpose |
|---|---|
| `GET /buildings/:id/energy-profile` | modelled + certified profile, components, compliance status/cliff |
| `PUT /buildings/:id/energy-profile` | upsert heated area / heating / certified override (manager) |
| `GET /buildings/:id/envelope-components` · `POST` · `PUT /envelope-components/:id` · `DELETE` | envelope inventory CRUD |
| `POST /buildings/:id/energy-profile/recompute` | force re-estimate (idempotent) |
| `GET /buildings/:id/value-creation-agenda` | ranked, archetype-aware recommendation set |
| `GET /energy-compliance-rules?canton=GE` | resolve applicable rule (config) |

All specced in `openapi.yaml` + `packages/api-client` + `contracts.test.ts`; Next.js proxies added; mind the `PUBLIC_UNSPECCED_BUDGET`.

---

## 10. Guardrail / wiring checklist (per PR)

- [ ] Migrations only (`migrate dev`), zero drift verified; RLS line on new tables.
- [ ] G2/G3 — every consumer of new fields updated in the same PR (repo include → DTO mapper → validation → OpenAPI → api-client → contract test).
- [ ] G9 — canonical include constants (`BUILDING_ENERGY_INCLUDE`), no inline includes.
- [ ] G20 — no `prisma.*` in `energyModelService`/`complianceTerminalValue` (pure); DB access via `energyRepository`.
- [ ] i18n en + Swiss-fr for all new strings; no hardcoded labels.
- [ ] Tokens only (no raw `slate-*`/`style={{}}`) — G23.
- [ ] Tests: `energyModelService`, `complianceTerminalValue`, enriched `computeRecommendation`, endpoint contract tests.

---

## 11. Phasing

| Phase | Scope | New data model? | Value |
|---|---|---|---|
| **P1 — Archetype bridge + surface unification** ([full slice →](ENERGY_VALUE_CREATION_P1_SLICE.md)) | Enrich `computeRecommendation` to full dimensions; extract a shared agenda component and render it as the Reporting "Value creation" sub-tab **and** in the Planning workspace over **existing** renovation opportunities; keep the existing simulator + `NPVScenariosPanel` untouched. No per-item NPV / energy header yet | No | Proves prescriptive UX cheaply; removes the duplicate-list risk before the energy model lands |
| **P2 — Energy model** | `BuildingEnergyProfile` + `EnvelopeComponent` + estimator + grade/IDC + manual override; energy header on reporting | Yes | The grade + compliance status |
| **P3 — NPV cliff + simulator** | `complianceTerminalValue` → `terminalValueChf`; envelope intervention → override; envelope simulator preset; plan→NPV loop | No (reuses) | The differentiator: terminal-value asymmetry drives action |
| **P4 — Refinement** | CECB/IDC certified override precedence; Programme Bâtiments subsidy inputs; LDTR cap per canton; subsidy/rule seed data | No | Accuracy where real data exists |

---

## 12. Risks & caveats

1. **Estimate, not a certificate.** The modelled IDC/grade is an engineering approximation; always label it, and let a certified CECB/IDC override it. Do not imply CECB accuracy.
2. **Data acquisition is the real cost.** Age-based grading needs component install years. Mitigate by defaulting from `constructionDate`/`lastRenovationDate`, refining over time; the whole model degrades gracefully to "unknown" when data is thin.
3. **Canton rules move.** Thresholds/dates are config from day one (LegalVariable), owner-validated. MuKEn 2025 phase-in (2025–2028) varies by canton.
4. **Swiss cost pass-through.** The heating-bill saving is the tenant's; the owner's return is OBLF uplift + subsidy + risk avoided. Model it correctly or the tool loses credibility.
5. **OBLF abusiveness + LDTR (GE/VD).** Rent uplift is bounded by Art. 14 (non-abusive: interest + amortization + maintenance) and further capped by LDTR in Geneva/Vaud. Config-cap the uplift.
6. **Multi-owner buildings** — reuse the `resolveStrategyContext` divergence rule (divergent archetypes → cautious default).

---

## Appendix A — Regulatory & engineering constants (cited — VALIDATE)

> Every value below is a **seed default for owner validation**, not gospel. Sources are current as of research on 2026-07-15.

### Table 1 — Compliance thresholds

| Regime | Rule | Value / timeline | Source |
|---|---|---|---|
| **MuKEn 2014** — fossil-heating replacement | ≥10 % renewable or efficiency gain on boiler replacement; new system heat demand ≤ 90 % of prior consumption | 10 % (most cantons); **100 %** effectively in **BS, ZH, GE** | IEA MuKEn policy; sager.ch; Baker McKenzie |
| **MuKEn 2025 (CMR2025)** | Boiler replacement must use **exclusive** renewable / waste heat | Phased per canton **2025–2028** | Baker McKenzie; sager.ch |
| **Geneva IDC** — renovation trigger | Above → energy renovation required | **125 kWh/m²·yr (450 MJ/m²)** since 2022-09-01 | ge.ch; e-nno.ch |
| Geneva IDC — optimisation band | Optimisation requested, no audit | **125–153 kWh/m² (450–550 MJ)** | ge.ch |
| Geneva IDC — "significant exceedance" (forces works) | Tightens over time | **222 (800 MJ)** 2022→2026 · **180 (650 MJ)** 2027→2030 · **153 (550 MJ)** from 2031 | ge.ch; MLL News |
| **CECB/GEAK mandatory on sale** | Certain building types/sizes at ownership change | **VD, FR, NE** yes; **GE** uses IDC instead | neho.ch; Baker McKenzie |

### Table 2 — Default U-values by construction era (W/m²K) — for age-based grading

| Element | pre-1980 | ~1980 | ~2000 | ~2020 / MuKEn |
|---|---|---|---|---|
| Windows (glazing+frame) | 4.8 (single) | 3.0 | 1.9 | 1.0 |
| External wall | 1.2 | 0.8 | 0.5 | 0.19 |
| Roof | ~1.0 | 0.5 | 0.3 | 0.17 |
| Floor | ~1.0 | 0.6 | 0.4 | 0.25 |

Sources: sager.ch (λ/U primer); ScienceDirect EPC statistical analysis; SCCER-JASM building-efficiency dataset; era comparison tables. *Roof/floor rows are interpolated defaults — flag for validation.*

### Table 3 — Heat-demand benchmarks (space heating, kWh/m²·yr)

| Vintage | Qh/m² |
|---|---|
| pre-1970 (uninsulated MFH/SFH) | 170–200 |
| 1970s benchmark | ~100 |
| SIA renovated target | ~24 |
| SIA / Minergie new target | ~16 |

Sources: SCCER-JASM; SIA 380/1 / Minergie (IEA, climatepolicydatabase). *The 16/24 figures are SIA/Minergie targets — confirm exact metric basis before using as grade anchors.*

### Table 4 — Subsidies (Le Programme Bâtiments, 2026) & OBLF

| Item | Value | Source |
|---|---|---|
| Insulation façade/roof/floor | **30–150 CHF/m²** by canton (GE 140, UR 150, GL 140, VS 70, standard ~50–60) | vd.ch PB2026; subsidi.ch |
| Heat pump air/water (M-05) | ~CHF 5 000 (≤15 kW) + CHF 400/kW above | suissepac.ch; PB2026 |
| Heat pump ground/water (M-06) | ~CHF 20 000 (<20 kW) | suissepac.ch |
| Minimum grant threshold | often CHF 3 000 | subsidi.ch |
| **OBLF Art. 14** — value-adding share of major works | **50–70 %** presumed plus-value; energy works = plus-value (al. 2); non-abusive if covers interest+amortization+maintenance (al. 4) | Art. 14 OBLF; newsd.admin.ch; bail.ch |

---

## Sources
- [IEA — MuKEn](https://www.iea.org/policies/230-muken-model-prescriptions-of-the-cantons-regarding-energy) · [sager.ch MuKEn 2014](https://sager.ch/en/know/muken-2014-energy-efficiency-targets/) · [Baker McKenzie — Energy Performance Certificates & Minimum Standards (CH)](https://resourcehub.bakermckenzie.com/en/resources/global-sustainable-buildings/europe-middle-east-and-africa/switzerland/topics/energy-performance-certificates-and-minimum-energy-standards)
- [neho.ch — building energy certificate of the cantons](https://neho.ch/en/blog/energy-evaluating-building-energy-certificate-of-the-cantons) · [PostFinance — GEAK](https://www.postfinance.ch/en/blog/money-in-simple-terms/geak.html)
- [ge.ch — connaître la consommation d'énergie (IDC)](https://www.ge.ch/connaitre-consommation-energie-batiment-idc) · [ge.ch — que faire selon le résultat IDC](https://www.ge.ch/connaitre-consommation-energie-batiment-idc/que-faire-resultat-idc-votre-immeuble) · [e-nno.ch — IDC](https://www.e-nno.ch/post/mais-quest-ce-que-lidc-dont-on-entend-si-souvent-parler-a-geneve) · [MLL News — nouveau règlement genevois sur l'énergie](https://www.mll-news.com/nouveau-reglement-genevois-sur-lenergie-principales-modifications/?lang=fr)
- [sager.ch — λ, R, U values](https://sager.ch/en/was-sind-der-lambda-wert-%F0%9D%9D%80-r-wert-und-u-wert/) · [SCCER-JASM — energy efficiency in buildings](https://sccer-jasm.ch/JASMpapers/JASM_energyEfficiency_buildings.pdf) · [IEA — SIA / Minergie](https://www.iea.org/policies/648-high-efficiency-buildings-sia-building-code-and-minergie-label-family) · [ScienceDirect — Swiss EPC thermal performance](https://www.sciencedirect.com/science/article/abs/pii/S0378778818305875)
- [Art. 14 OBLF (justement.ch)](https://justement.ch/fr/doc/act/ch/221_213_11/art_14) · [admin.ch — investissements plus-value](https://www.newsd.admin.ch/newsd/message/attachments/59008.pdf) · [MLL News — rénovations énergétiques & loyers GE/VD](https://www.mll-news.com/renovations-energetiques-quel-impact-sur-les-loyers-dans-les-cantons-de-geneve-et-vaud/?lang=fr)
- [vd.ch — Programme Bâtiments 2026 (conditions PDF)](https://www.vd.ch/fileadmin/user_upload/themes/environnement/energie/fichiers_pdf/conditions.PB2026.v.1.1.pdf) · [subsidi.ch — subventions énergétiques CH 2026](https://subsidi.ch/ai.html) · [suissepac.ch — subvention PAC](https://suissepac.ch/subvention-pompe-a-chaleur-suisse)
