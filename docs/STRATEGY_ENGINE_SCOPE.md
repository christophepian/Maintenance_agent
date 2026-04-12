# Real Estate Strategy Engine — Implementation Scope

> **Amended 2026-04-12 (v1).** Reconciled against project context: integration points with
> existing schema, corrected folder structure, tax-profile reuse, MaintenanceOpportunity as
> a DTO (not a new model), roadmap positioning.
>
> **Amended 2026-04-12 (v2).** BRD reconciliation: added building setup inputs (§3.4),
> strategy display screen (§4.3), recommendation acceptance tracking (§3.1, §14.3),
> "when to choose alternative" explanation field (§11), short/long-term impact labels
> per option (§11, §15.2), performance SLAs (§19), and success metrics (§24).
>
> See §22 (Roadmap Alignment) and §23 (Implementation Prerequisites) — read those first
> if you're deciding whether/when to start.

---

## Goal

Build a strategy-driven decision layer on top of the existing property management platform. The system captures owner intent, classifies strategy, scores maintenance and capex decisions against that strategy, and produces explainable recommendations. It is aimed initially at private owners and small property managers.

---

## 0. Integration Context (read before §3)

The following existing infrastructure is directly relevant and must be consumed rather than re-implemented.

| Existing entity | Relevance to this spec |
|---|---|
| `User` (role=OWNER) | `OwnerProfile` references a User — not a separate identity |
| `Building`, `BuildingConfig` | `BuildingStrategyProfile.buildingId` links to existing Building |
| `BuildingOwner` | Owner ↔ building relationship already modelled |
| `Request` | `MaintenanceOpportunity` is a DTO view over Request + Asset data |
| `Asset`, `AssetIntervention` | Condition state and intervention history for opportunities |
| `DepreciationStandard` | Source of truth for `estimatedUsefulLifeYears` |
| `ReplacementBenchmark` | Source of truth for `estimatedCost` ranges (lowChf/medianChf/highChf) |
| `TaxRule`, `TaxRuleVersion`, `TaxClassification` | Existing tax classification layer — `DecisionTaxProfile` must consume this |
| `CashflowPlan`, `CashflowOverride` | Phase 3 financial engine must integrate with, not replace, this |
| `RequestUrgency` enum | Maps to opportunity urgency (LOW/MEDIUM/HIGH/EMERGENCY) |

**Architecture invariant:** All new backend code must follow `routes → workflows → services → repositories → Prisma`. The `src/domain/` folder structure proposed in the original spec does not match the existing project and is replaced in §13.

---

## 1. Product scope

### 1.1 In scope for v1

* Property-level goal capture via a short onboarding flow
* Internal strategy scoring model
* Primary and secondary strategy archetype assignment
* Maintenance / repair / replace recommendation engine
* Financial scenario comparison for decision options
* Explainable recommendation output
* Basic overrides by user
* Admin-configurable defaults in code/config, not a user-facing full rules builder

### 1.2 Out of scope for v1

* Full portfolio optimization
* ML-based personalization
* Automatic strategy changes from observed behavior
* Dynamic tax engine by jurisdiction beyond configured assumptions (use existing TaxRule/TaxRuleVersion)
* Deep tenant pricing optimization
* Full work-order / accounting ERP replacement
* Generative free-form planning as core decision logic

### 1.3 Design principle

* Keep financial calculations objective
* Keep user strategy simple and human-readable
* Apply strategy through weights and thresholds, not by changing core facts

---

## 2. User-facing positioning

### 2.1 User-facing goal labels

Internal archetypes should not be shown directly in most UI.

| Internal archetype         | User-facing label       |
| -------------------------- | ----------------------- |
| exit_optimizer             | Prepare for sale        |
| yield_maximizer            | Maximize income         |
| value_builder              | Improve long-term value |
| capital_preserver          | Keep things stable      |
| opportunistic_repositioner | Upgrade and reposition  |

### 2.2 Primary UX promise

"We help you make better property decisions based on your goals."

---

## 3. Domain model

### 3.1 Core entities

#### OwnerProfile

Strategy baseline for an owner. Links to the existing `User` record (role = OWNER) — does not create a parallel identity.

```ts
export type StrategyArchetype =
  | 'exit_optimizer'
  | 'yield_maximizer'
  | 'value_builder'
  | 'capital_preserver'
  | 'opportunistic_repositioner';

export interface OwnerProfile {
  id: string;
  ownerId: string;          // FK → User.id (role = OWNER)
  createdAt: string;
  updatedAt: string;
  onboardingVersion: string;
  source: 'questionnaire' | 'advisor_set' | 'imported' | 'default';
  userFacingGoalLabel: string;
  dimensions: StrategyDimensions;
  archetypeScores: ArchetypeScores;
  primaryArchetype: StrategyArchetype;
  secondaryArchetype?: StrategyArchetype;
  confidence: 'low' | 'medium' | 'high';
  contradictionScore: number;
}
```

#### BuildingStrategyProfile

Effective strategy at building level. Links to the existing `Building` model.

```ts
export interface BuildingStrategyProfile {
  id: string;
  buildingId: string;       // FK → Building.id
  ownerProfileId: string;   // FK → OwnerProfile.id
  roleIntent: 'sell' | 'income' | 'long_term_quality' | 'reposition' | 'stable_hold' | 'unspecified';
  buildingDimensions: Partial<StrategyDimensions>;
  effectiveDimensions: StrategyDimensions;
  archetypeScores: ArchetypeScores;
  primaryArchetype: StrategyArchetype;
  secondaryArchetype?: StrategyArchetype;
  confidence: 'low' | 'medium' | 'high';
  overrides: BuildingStrategyOverrides;
}
```

#### StrategyDimensions

All normalized to 0–100.

```ts
export interface StrategyDimensions {
  horizon: number;
  incomePriority: number;
  appreciationPriority: number;
  capexTolerance: number;
  volatilityTolerance: number;
  liquiditySensitivity: number;
  saleReadiness: number;
  stabilityPreference: number;
  modernizationPreference: number;
  disruptionTolerance: number;
}
```

#### ArchetypeScores

```ts
export interface ArchetypeScores {
  exit_optimizer: number;
  yield_maximizer: number;
  value_builder: number;
  capital_preserver: number;
  opportunistic_repositioner: number;
}
```

#### BuildingStrategyOverrides

```ts
export interface BuildingStrategyOverrides {
  forcePrimaryArchetype?: StrategyArchetype;
  planningHorizonYears?: number;
  capexBudgetConstraint?: number;
  maxTenantDisruption?: 'none' | 'low' | 'medium' | 'high';
  mustMaintainSaleReadiness?: boolean;
}
```

#### MaintenanceOpportunity

> **Important:** `MaintenanceOpportunity` is a **DTO / application-layer view** over existing
> `Request` + `Asset` data. It is NOT a new Prisma model in v1. The recommendation engine
> consumes this shape, but it is assembled from existing records — no new migration needed
> for this entity alone.
>
> `urgency` maps to `RequestUrgency` (LOW/MEDIUM/HIGH/EMERGENCY).
> `conditionState` is computed from `AssetIntervention` history or set as an enrichment field
> on the opportunity DTO by the recommendation workflow.
> `complianceRisk` is sourced from the existing legal auto-routing result on the Request.

```ts
export interface MaintenanceOpportunity {
  id: string;               // = Request.id
  requestId: string;        // FK → Request.id (source record)
  assetId?: string;         // FK → Asset.id (if opportunity is asset-linked)
  buildingId: string;       // inherited via Request → Unit → Building
  category:
    | 'roof'
    | 'hvac'
    | 'facade'
    | 'plumbing'
    | 'electrical'
    | 'interior'
    | 'common_area'
    | 'energy_system'
    | 'safety'
    | 'other';
  title: string;
  description?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  conditionState: 'good' | 'fair' | 'poor' | 'failed';
  complianceRisk: 'none' | 'low' | 'medium' | 'high';
  tenantImpact: 'none' | 'low' | 'medium' | 'high';
  createdAt: string;
}
```

#### DecisionOption

Candidate ways to handle an opportunity. This is a **new persisted Prisma model**.
`estimatedCost` should be pre-populated from `ReplacementBenchmark` (medianChf) where a
matching `assetType + topic` exists. `estimatedUsefulLifeYears` should come from
`DepreciationStandard.usefulLifeMonths / 12`.

```ts
export interface DecisionOption {
  id: string;
  opportunityId: string;    // = Request.id
  optionType: 'defer' | 'repair' | 'replace_like_for_like' | 'upgrade' | 'transform';
  title: string;
  description?: string;
  estimatedCost: number;
  estimatedUsefulLifeYears: number;
  implementationMonths: number;
  tenantDisruptionScore: number; // 0-100
  riskReductionScore: number; // 0-100
  complianceCoverageScore: number; // 0-100
  saleAttractivenessScore: number; // 0-100
  rentUpliftScore: number; // 0-100
  opexReductionScore: number; // 0-100
  lifecycleExtensionScore: number; // 0-100
  modernizationImpactScore: number; // 0-100
  uncertaintyScore: number; // 0-100
  taxProfile: DecisionTaxProfile;
  financialProjection: FinancialProjection;
}
```

#### DecisionTaxProfile

> **Important:** This DTO must be **derived from existing `TaxRuleVersion` records**, not
> computed independently. The existing `TaxClassification` enum (`WERTERHALTEND` = fully
> deductible / `WERTVERMEHREND` = capitalized / `MIXED`) maps directly to the split
> between `deductibleImmediatelyAmount` and `capitalizableAmount`. The financial engine
> must query `TaxRule` + `TaxRuleVersion` (filtered by `assetType`, `topic`, `jurisdiction`,
> `effectiveFrom`) to populate this shape. Do not introduce a parallel tax table.

```ts
export interface DecisionTaxProfile {
  // Populated by reading TaxRuleVersion for the asset/topic
  deductibleImmediatelyAmount: number;   // WERTERHALTEND portion of cost
  capitalizableAmount: number;            // WERTVERMEHREND portion of cost
  annualDepreciationAmount: number;       // from DepreciationStandard.usefulLifeMonths
  year1TaxShield: number;
  totalTaxShield: number;
  taxShieldTimingScore: number; // 0-100, higher = more front-loaded
}
```

#### FinancialProjection

Calculated objectively and independently of strategy.

> **Note for Phase 3:** When integrating with the existing `CashflowPlan` model, this
> projection should be derivable from (or storable in) `CashflowPlan` with an override
> set attached to the specific `DecisionOption`. Do not design Phase 3 as a replacement.

```ts
export interface FinancialProjection {
  analysisHorizonYearsBase: number;
  initialOutflow: number;
  annualCashflows: number[];
  residualValueImpact: number;
  npvBase: number;
  irrBase?: number;
  paybackYears?: number;
  cashflowYear1: number;
  cashflowYears1to3: number;
  cashflowYears1to5: number;
  totalValueCreation: number;
}
```

#### RecommendationResult

New persisted model. Stores the outcome of an evaluation run for auditability.
`userDecision` is set after the user acts on the recommendation — it enables the
recommendation acceptance rate metric (§24).

```ts
export interface RecommendationResult {
  opportunityId: string;     // = Request.id
  evaluatedAt: string;
  selectedOptionId: string;  // FK → DecisionOption.id
  rankedOptions: RankedDecisionOption[];
  explanation: RecommendationExplanation;
  // Set by user after receiving the recommendation
  userDecision?: 'accepted' | 'rejected' | 'deferred' | 'pending';
  userDecidedAt?: string;
  userFeedback?: string;     // optional free-text from trust feedback prompt
}

export interface RankedDecisionOption {
  optionId: string;
  totalScore: number;
  financialScore: number;
  strategicScore: number;
  feasibilityScore: number;
  penalties: Array<{ code: string; points: number; reason: string }>;
  // User-facing impact labels (short/long term) — populated by explanationService
  shortTermImpact: string;   // e.g. "Higher cash outflow this year"
  longTermImpact: string;    // e.g. "Extends useful life by ~15 years"
}

export interface RecommendationExplanation {
  summary: string;
  bullets: string[];
  tradeoffs: string[];
  profileAlignment: string[];
  // When would the user be better served by the runner-up option instead?
  whenToChooseAlternative?: string;
}
```

---

### 3.2 Net-new Prisma models required

The following models must be added via Prisma migrations (G1/G2 apply):

| New model | Notes |
|---|---|
| `OwnerStrategyProfile` | Stores `OwnerProfile` data. FK → `User.id`. |
| `BuildingStrategyProfile` | Stores effective building-level strategy. FK → `Building.id`, `OwnerStrategyProfile.id`. |
| `StrategyQuestionnaireAnswer` | Stores raw questionnaire answers, versioned. FK → `OwnerStrategyProfile.id`. |
| `MaintenanceDecisionOption` | Persists `DecisionOption` data. FK → `Request.id`. |
| `RecommendationResult` | Persists recommendation outcomes. FK → `Request.id`, `MaintenanceDecisionOption.id`. |

New Prisma enums:
- `StrategyArchetype` — 5 values as typed above
- `DecisionOptionType` — defer / repair / replace_like_for_like / upgrade / transform
- `StrategySource` — questionnaire / advisor_set / imported / default
- `RoleIntent` — sell / income / long_term_quality / reposition / stable_hold / unspecified
- `UserDecisionStatus` — accepted / rejected / deferred / pending
- `BuildingConditionRating` — poor / fair / good / very_good (maps to simple 1–4 scale shown in onboarding)

**No changes** to `Request`, `Asset`, `TaxRule`, `Building`, `User`, `CashflowPlan`.

---

### 3.3 Existing infrastructure reused (no schema change needed)

| Existing | How it's used |
|---|---|
| `RequestUrgency` enum | Maps to opportunity urgency |
| `TaxRule` + `TaxRuleVersion` | Populates `DecisionTaxProfile` |
| `TaxClassification` enum | Maps to deductible vs. capitalizable split |
| `DepreciationStandard.usefulLifeMonths` | Source for `estimatedUsefulLifeYears` |
| `ReplacementBenchmark.medianChf` | Default `estimatedCost` for options |
| `Asset.assetModelId` + `AssetModel` | Links opportunity to asset type/topic for benchmark lookup |
| `BuildingOwner` | Guards which owners can set strategy for which buildings |
| `OrgConfig` | Admin-level defaults for strategy weights can be stored here or in a new config file |

---

### 3.4 Building setup inputs

> **Source: BRD FR5/FR6.** Before a building can receive strategy-aware recommendations,
> the user should provide a minimal set of building facts. Some of these already exist on
> the `Building` model (`yearBuilt`, `address`, `canton`); the new fields (`conditionRating`,
> `buildingType`, `approxUnits`) belong on `BuildingStrategyProfile`, not on `Building`,
> since they are strategy context — not factual property data.

#### User-provided fields (strategy onboarding, not operational setup)

| Field | Type | Maps to |
|---|---|---|
| Building type | residential / mixed / commercial | `BuildingStrategyProfile.buildingType` (new string field) |
| Approximate units or m² | integer | `BuildingStrategyProfile.approxUnits` (new Int?, optional) |
| Year built / last renovation | year integer | Already on `Building.yearBuilt`; read-only here |
| Current condition | 1 (poor) – 4 (very good) | `BuildingStrategyProfile.conditionRating` (new `BuildingConditionRating` enum field) |
| Building role intent | sell soon / income / long-term hold / upgrade | `BuildingStrategyProfile.roleIntent` — **user-set, not computed** |

#### Condition rating → feasibility modifier

The `conditionRating` field feeds directly into the feasibility modifier logic (§7.2):
- `poor` → heavy weight on risk-reduction features; penalise `defer` options
- `fair` → moderate penalty on `defer` for non-cosmetic categories
- `good` / `very_good` → no automatic modifier applied

#### Role intent — user-set, not derived

The `roleIntent` field is **explicitly chosen by the user** during building setup, not
computed from questionnaire answers. The questionnaire and the role intent are independent
inputs that are then combined by `combineDimensions()` (§7.1). This makes the building-level
intent transparent and overridable without re-running the questionnaire.

---

## 4. Questionnaire design

### 4.1 v1 onboarding flow

Use 5 screens maximum. This is a **strategy-specific onboarding flow** — distinct from the
general operational onboarding wizard planned in F-P2-001 (add building, add unit, create lease).
Both can coexist; a user completing F-P2-001 should be offered the strategy questionnaire as
an optional next step.

#### Screen 1 — Main goal

Question: What is your main goal for this property?

* Prepare for sale in the next few years
* Maximize steady income
* Improve long-term value
* Keep things stable and low-risk
* Upgrade and reposition

#### Screen 2 — Hold period

Question: How long do you expect to keep this property?

* Less than 3 years
* 3 to 5 years
* 5 to 10 years
* More than 10 years

#### Screen 3 — Renovation appetite

Question: How comfortable are you with larger renovation projects?

* Avoid them whenever possible
* Only when clearly necessary
* Comfortable with selective projects
* Comfortable with major upgrades
* Comfortable with major repositioning

#### Screen 4 — Cash sensitivity

Question: How important is it to avoid large surprise expenses?

* Extremely important
* Very important
* Moderately important
* Slightly important
* Not a major concern

#### Screen 5 — Disruption tolerance

Question: How much disruption can this property tolerate if the result is better long term?

* Almost none
* Low
* Moderate
* Significant
* High

### 4.2 Optional advanced questions

These can be shown later in settings.

* Vacancy vs rent tradeoff
* Energy / modernization posture
* Sale-readiness importance
* Market downturn reaction
* Maintenance philosophy

### 4.3 Strategy display screen (post-questionnaire)

> **Source: BRD FR4.** After the questionnaire is submitted and the profile is computed,
> the user must see a confirmation screen before proceeding. This is not optional — it
> is the primary trust-building moment of the onboarding flow.

The screen displays:

* "Your current strategy: **[user-facing label]**" — one of the five labels from §2.1
* A 2–3 sentence plain-language explanation of what that archetype means in practice
* If a secondary archetype exists: "With a secondary lean toward: **[label]**"
* Confidence indicator (low / medium / high) shown as a subtle label, not a percentage
* A single CTA: "Continue to set up your property" (proceeds to building setup, §3.4)
* A secondary link: "Change my answers" (returns to questionnaire start)

This screen must not expose dimension scores, archetype score numbers, or internal model
terms. It sets the user's mental model for all subsequent recommendations.

#### Example explanation text by archetype

| Archetype | Explanation shown to user |
|---|---|
| value_builder | "You're focused on growing the long-term worth of your property. We'll favour investments that extend asset life and improve quality over quick fixes." |
| exit_optimizer | "You're preparing this property for sale. We'll prioritise decisions that improve presentation and reduce buyer risk, with a short payback horizon." |
| yield_maximizer | "You want steady, reliable income. We'll favour options that protect cash flow and avoid costly surprises over major upgrade projects." |
| capital_preserver | "Stability matters most to you. We'll recommend low-risk, predictable options that avoid large disruptions or uncertain outcomes." |
| opportunistic_repositioner | "You're ready to invest significantly to reposition this property. We'll favour upgrades with strong long-term upside, even if the upfront cost is higher." |

---

## 5. Answer encoding

All answer choices should map to integers 1–5.
Normalize to 0–100 using:

```ts
export function normalize1to5(value: number): number {
  return ((value - 1) / 4) * 100;
}

export function reverseScore(score: number): number {
  return 100 - score;
}
```

---

## 6. Scoring model

### 6.1 Questionnaire answer storage

```ts
export interface StrategyQuestionnaireAnswers {
  mainGoal: 1 | 2 | 3 | 4 | 5;
  holdPeriod: 1 | 2 | 3 | 4;
  renovationAppetite: 1 | 2 | 3 | 4 | 5;
  cashSensitivity: 1 | 2 | 3 | 4 | 5;
  disruptionTolerance: 1 | 2 | 3 | 4 | 5;
  vacancyRentTradeoff?: 1 | 2 | 3 | 4 | 5;
  modernizationPosture?: 1 | 2 | 3 | 4 | 5;
  saleReadinessImportance?: 1 | 2 | 3 | 4 | 5;
  downturnReaction?: 1 | 2 | 3 | 4 | 5;
  maintenancePhilosophy?: 1 | 2 | 3 | 4 | 5;
}
```

### 6.2 Dimension derivation

Use weighted averages. Missing optional values should be ignored.

```ts
export function weightedAverage(items: Array<{ value: number; weight: number }>): number {
  const valid = items.filter(x => Number.isFinite(x.value));
  const totalWeight = valid.reduce((sum, x) => sum + x.weight, 0);
  if (!totalWeight) return 0;
  return valid.reduce((sum, x) => sum + x.value * x.weight, 0) / totalWeight;
}
```

#### Example dimension formulas

```ts
export function deriveStrategyDimensions(a: StrategyQuestionnaireAnswers): StrategyDimensions {
  const hold = normalizeHoldPeriod(a.holdPeriod);
  const renovation = normalize1to5(a.renovationAppetite);
  const cash = normalize1to5(a.cashSensitivity);
  const disruption = normalize1to5(a.disruptionTolerance);
  const goal = a.mainGoal;

  const goalIncome = goal === 2 ? 100 : goal === 4 ? 40 : goal === 3 ? 60 : goal === 5 ? 50 : 30;
  const goalAppreciation = goal === 3 ? 100 : goal === 5 ? 85 : goal === 1 ? 70 : goal === 4 ? 30 : 40;
  const goalSale = goal === 1 ? 100 : goal === 2 ? 20 : goal === 3 ? 25 : goal === 4 ? 15 : 20;
  const goalStability = goal === 4 ? 100 : goal === 2 ? 70 : goal === 3 ? 45 : goal === 1 ? 25 : 20;

  const modernization = a.modernizationPosture ? normalize1to5(a.modernizationPosture) : (goal === 3 ? 70 : goal === 5 ? 80 : 40);
  const saleReadiness = a.saleReadinessImportance ? normalize1to5(a.saleReadinessImportance) : goalSale;
  const vacancyTradeoff = a.vacancyRentTradeoff ? normalize1to5(a.vacancyRentTradeoff) : 50;
  const downturn = a.downturnReaction ? normalize1to5(a.downturnReaction) : 50;
  const maintenance = a.maintenancePhilosophy ? normalize1to5(a.maintenancePhilosophy) : renovation;

  return {
    horizon: hold,
    incomePriority: weightedAverage([
      { value: goalIncome, weight: 0.6 },
      { value: reverseScore(vacancyTradeoff), weight: 0.25 },
      { value: reverseScore(renovation), weight: 0.15 },
    ]),
    appreciationPriority: weightedAverage([
      { value: goalAppreciation, weight: 0.5 },
      { value: modernization, weight: 0.25 },
      { value: renovation, weight: 0.25 },
    ]),
    capexTolerance: weightedAverage([
      { value: renovation, weight: 0.55 },
      { value: modernization, weight: 0.15 },
      { value: reverseScore(cash), weight: 0.30 },
    ]),
    volatilityTolerance: weightedAverage([
      { value: disruption, weight: 0.4 },
      { value: vacancyTradeoff, weight: 0.3 },
      { value: downturn, weight: 0.3 },
    ]),
    liquiditySensitivity: weightedAverage([
      { value: cash, weight: 0.7 },
      { value: reverseScore(renovation), weight: 0.15 },
      { value: reverseScore(downturn), weight: 0.15 },
    ]),
    saleReadiness,
    stabilityPreference: weightedAverage([
      { value: goalStability, weight: 0.5 },
      { value: reverseScore(vacancyTradeoff), weight: 0.3 },
      { value: reverseScore(disruption), weight: 0.2 },
    ]),
    modernizationPreference: modernization,
    disruptionTolerance: disruption,
  };
}
```

```ts
export function normalizeHoldPeriod(value: 1 | 2 | 3 | 4): number {
  switch (value) {
    case 1: return 0;
    case 2: return 25;
    case 3: return 70;
    case 4: return 100;
  }
}
```

### 6.3 Archetype scoring

```ts
export function deriveArchetypeScores(d: StrategyDimensions): ArchetypeScores {
  return {
    exit_optimizer: clampScore(
      0.30 * reverseScore(d.horizon) +
      0.20 * d.saleReadiness +
      0.15 * d.appreciationPriority +
      0.10 * d.capexTolerance +
      0.15 * reverseScore(d.liquiditySensitivity) +
      0.10 * reverseScore(d.stabilityPreference)
    ),
    yield_maximizer: clampScore(
      0.30 * d.incomePriority +
      0.20 * d.stabilityPreference +
      0.20 * d.liquiditySensitivity +
      0.15 * reverseScore(d.capexTolerance) +
      0.15 * reverseScore(d.disruptionTolerance)
    ),
    value_builder: clampScore(
      0.30 * d.horizon +
      0.25 * d.appreciationPriority +
      0.20 * d.capexTolerance +
      0.15 * d.modernizationPreference +
      0.10 * reverseScore(d.liquiditySensitivity)
    ),
    capital_preserver: clampScore(
      0.25 * d.horizon +
      0.25 * d.liquiditySensitivity +
      0.20 * d.stabilityPreference +
      0.15 * reverseScore(d.volatilityTolerance) +
      0.15 * reverseScore(d.disruptionTolerance)
    ),
    opportunistic_repositioner: clampScore(
      0.25 * d.capexTolerance +
      0.20 * d.appreciationPriority +
      0.20 * d.volatilityTolerance +
      0.15 * d.modernizationPreference +
      0.10 * reverseScore(d.liquiditySensitivity) +
      0.10 * d.disruptionTolerance
    ),
  };
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

### 6.4 Primary and secondary archetypes

```ts
export function selectArchetypes(scores: ArchetypeScores): {
  primary: StrategyArchetype;
  secondary?: StrategyArchetype;
  confidence: 'low' | 'medium' | 'high';
} {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<[StrategyArchetype, number]>;
  const [primaryKey, primaryScore] = entries[0];
  const [secondaryKey, secondaryScore] = entries[1];
  const gap = primaryScore - secondaryScore;

  return {
    primary: primaryKey,
    secondary: gap <= 10 ? secondaryKey : undefined,
    confidence: gap >= 13 ? 'high' : gap >= 6 ? 'medium' : 'low',
  };
}
```

### 6.5 Contradiction scoring

```ts
export function deriveContradictionScore(d: StrategyDimensions): number {
  let points = 0;

  if (d.horizon < 25 && d.modernizationPreference > 75) points += 8;
  if (d.horizon < 25 && d.capexTolerance > 75) points += 6;
  if (d.liquiditySensitivity > 75 && d.capexTolerance > 75) points += 8;
  if (d.stabilityPreference > 75 && d.disruptionTolerance > 75) points += 7;
  if (d.saleReadiness > 75 && d.horizon > 75) points += 4;

  return points;
}
```

---

## 7. Building-level effective profile

### 7.1 Combination rule

Portfolio or owner profile should act as prior. Building role should adjust it.

```ts
export function combineDimensions(
  owner: StrategyDimensions,
  building: Partial<StrategyDimensions>,
  ownerWeight = 0.65,
  buildingWeight = 0.35,
): StrategyDimensions {
  const keys = Object.keys(owner) as Array<keyof StrategyDimensions>;
  const result = {} as StrategyDimensions;
  for (const key of keys) {
    const buildingValue = building[key] ?? owner[key];
    result[key] = clampScore(owner[key] * ownerWeight + buildingValue * buildingWeight);
  }
  return result;
}
```

### 7.2 Feasibility modifiers

Actual building facts can adjust recommendation scoring, but should not fully overwrite strategy classification.

Possible modifiers:

* poor physical condition (derived from `AssetIntervention` recency)
* legal compliance issue (derived from `Request.status = RFP_PENDING` or `LegalEvaluationLog`)
* tenant sensitivity (derived from active `Occupancy` count on the building)
* energy inefficiency (derived from `Unit.energyLabel`)
* constrained annual budget (from `BuildingStrategyOverrides.capexBudgetConstraint`)
* planned sale date (from `BuildingStrategyOverrides`)

---

## 8. Financial engine requirements

### 8.1 Principle

The financial engine must produce objective outputs independent of user profile.

### 8.2 Required financial outputs per option

* initial outflow
* annual cash flows for base horizon
* year 1 cash flow
* year 1 tax shield
* total tax shield
* payback period
* NPV at base discount rate
* residual value impact
* opex reduction estimate
* rent uplift estimate
* uncertainty score

### 8.3 Profile-sensitive levers allowed

These may vary by strategy profile in the recommendation layer, not in the raw factual layer.

* evaluation horizon
* risk penalty
* payback mismatch penalty
* short-term cashflow weight
* tax timing weight

Do not vary by profile:

* tax law (consume `TaxRule`/`TaxRuleVersion` — do not hardcode)
* engineering useful life (consume `DepreciationStandard` — do not hardcode)
* compliance necessity
* baseline cost estimate (seed from `ReplacementBenchmark` where available)

### 8.4 Tax profile derivation

> The `DecisionTaxProfile` for a given option is computed by:
> 1. Identifying the `assetType` and `topic` for the opportunity's asset
> 2. Querying `TaxRuleVersion` for the current effective version matching `assetType + topic + jurisdiction`
> 3. Applying `TaxClassification` to split the option cost:
>    - `WERTERHALTEND` → fully `deductibleImmediatelyAmount`
>    - `WERTVERMEHREND` → fully `capitalizableAmount`
>    - `MIXED` → apply `deductiblePct` from `TaxRuleVersion`
> 4. Computing depreciation from `DepreciationStandard.usefulLifeMonths`
>
> The `taxShieldTimingScore` is then derived from the ratio of `year1TaxShield` to `totalTaxShield`.

---

## 9. Decision scoring engine

### 9.1 Feature extraction

Convert each decision option into normalized evaluation features.

```ts
export interface DecisionFeatures {
  complianceNeed: number;
  riskReduction: number;
  shortTermCashflow: number;
  mediumTermCashflow: number;
  totalValueCreation: number;
  taxTimingBenefit: number;
  taxTotalBenefit: number;
  paybackFit: number;
  lifecycleExtension: number;
  modernizationBenefit: number;
  saleAttractiveness: number;
  incomeUplift: number;
  stabilitySupport: number;
  upfrontCostPenalty: number;
  disruptionPenalty: number;
  uncertaintyPenalty: number;
}
```

### 9.2 Strategy weight matrix

```ts
export interface DecisionWeightVector {
  complianceNeed: number;
  riskReduction: number;
  shortTermCashflow: number;
  mediumTermCashflow: number;
  totalValueCreation: number;
  taxTimingBenefit: number;
  taxTotalBenefit: number;
  paybackFit: number;
  lifecycleExtension: number;
  modernizationBenefit: number;
  saleAttractiveness: number;
  incomeUplift: number;
  stabilitySupport: number;
  upfrontCostPenalty: number;
  disruptionPenalty: number;
  uncertaintyPenalty: number;
}
```

#### Default weights by archetype

```ts
export const DECISION_WEIGHTS: Record<StrategyArchetype, DecisionWeightVector> = {
  exit_optimizer: {
    complianceNeed: 1.0,
    riskReduction: 0.7,
    shortTermCashflow: 0.7,
    mediumTermCashflow: 0.4,
    totalValueCreation: 0.8,
    taxTimingBenefit: 0.7,
    taxTotalBenefit: 0.3,
    paybackFit: 1.0,
    lifecycleExtension: 0.2,
    modernizationBenefit: 0.4,
    saleAttractiveness: 1.0,
    incomeUplift: 0.4,
    stabilitySupport: 0.5,
    upfrontCostPenalty: 0.8,
    disruptionPenalty: 0.6,
    uncertaintyPenalty: 0.6,
  },
  yield_maximizer: {
    complianceNeed: 1.0,
    riskReduction: 0.8,
    shortTermCashflow: 1.0,
    mediumTermCashflow: 0.8,
    totalValueCreation: 0.6,
    taxTimingBenefit: 0.8,
    taxTotalBenefit: 0.5,
    paybackFit: 0.9,
    lifecycleExtension: 0.5,
    modernizationBenefit: 0.4,
    saleAttractiveness: 0.3,
    incomeUplift: 1.0,
    stabilitySupport: 0.8,
    upfrontCostPenalty: 1.0,
    disruptionPenalty: 0.8,
    uncertaintyPenalty: 0.7,
  },
  value_builder: {
    complianceNeed: 1.0,
    riskReduction: 0.9,
    shortTermCashflow: 0.4,
    mediumTermCashflow: 0.7,
    totalValueCreation: 1.0,
    taxTimingBenefit: 0.4,
    taxTotalBenefit: 0.7,
    paybackFit: 0.7,
    lifecycleExtension: 1.0,
    modernizationBenefit: 0.9,
    saleAttractiveness: 0.6,
    incomeUplift: 0.7,
    stabilitySupport: 0.6,
    upfrontCostPenalty: 0.5,
    disruptionPenalty: 0.5,
    uncertaintyPenalty: 0.5,
  },
  capital_preserver: {
    complianceNeed: 1.0,
    riskReduction: 1.0,
    shortTermCashflow: 0.6,
    mediumTermCashflow: 0.6,
    totalValueCreation: 0.5,
    taxTimingBenefit: 0.5,
    taxTotalBenefit: 0.4,
    paybackFit: 0.7,
    lifecycleExtension: 0.8,
    modernizationBenefit: 0.5,
    saleAttractiveness: 0.3,
    incomeUplift: 0.5,
    stabilitySupport: 1.0,
    upfrontCostPenalty: 0.8,
    disruptionPenalty: 1.0,
    uncertaintyPenalty: 1.0,
  },
  opportunistic_repositioner: {
    complianceNeed: 0.8,
    riskReduction: 0.7,
    shortTermCashflow: 0.3,
    mediumTermCashflow: 0.7,
    totalValueCreation: 1.0,
    taxTimingBenefit: 0.3,
    taxTotalBenefit: 0.6,
    paybackFit: 0.5,
    lifecycleExtension: 0.8,
    modernizationBenefit: 1.0,
    saleAttractiveness: 0.7,
    incomeUplift: 0.9,
    stabilitySupport: 0.2,
    upfrontCostPenalty: 0.3,
    disruptionPenalty: 0.2,
    uncertaintyPenalty: 0.3,
  },
};
```

### 9.3 Blended profile weights

Blend primary and secondary archetype when a secondary exists.

```ts
export function deriveEffectiveWeights(
  primary: StrategyArchetype,
  secondary?: StrategyArchetype,
  secondaryMix = 0.25,
): DecisionWeightVector {
  if (!secondary) return DECISION_WEIGHTS[primary];

  const result = {} as DecisionWeightVector;
  const keys = Object.keys(DECISION_WEIGHTS[primary]) as Array<keyof DecisionWeightVector>;
  for (const key of keys) {
    result[key] = DECISION_WEIGHTS[primary][key] * (1 - secondaryMix)
      + DECISION_WEIGHTS[secondary][key] * secondaryMix;
  }
  return result;
}
```

### 9.4 Option scoring

```ts
export function scoreDecisionOption(
  features: DecisionFeatures,
  weights: DecisionWeightVector,
): number {
  return clampScore(
    features.complianceNeed * weights.complianceNeed +
    features.riskReduction * weights.riskReduction +
    features.shortTermCashflow * weights.shortTermCashflow +
    features.mediumTermCashflow * weights.mediumTermCashflow +
    features.totalValueCreation * weights.totalValueCreation +
    features.taxTimingBenefit * weights.taxTimingBenefit +
    features.taxTotalBenefit * weights.taxTotalBenefit +
    features.paybackFit * weights.paybackFit +
    features.lifecycleExtension * weights.lifecycleExtension +
    features.modernizationBenefit * weights.modernizationBenefit +
    features.saleAttractiveness * weights.saleAttractiveness +
    features.incomeUplift * weights.incomeUplift +
    features.stabilitySupport * weights.stabilitySupport -
    features.upfrontCostPenalty * weights.upfrontCostPenalty -
    features.disruptionPenalty * weights.disruptionPenalty -
    features.uncertaintyPenalty * weights.uncertaintyPenalty
  );
}
```

### 9.5 Hard constraints before scoring

Some decisions should be ruled out or heavily penalized.

* compliance-critical issue cannot recommend defer without override
* critical failure cannot recommend cosmetic-only action
* planned sale within 12 months should heavily penalize long-payback projects unless compliance-driven
* budget breach should penalize or mark as infeasible

---

## 10. Recommendation generation flow

```ts
export interface RecommendationContext {
  buildingProfile: BuildingStrategyProfile;
  opportunity: MaintenanceOpportunity;
  options: DecisionOption[];
  annualCapexBudget?: number;
  plannedSaleDate?: string;
}
```

### Algorithm

1. Validate opportunity and options
2. Apply hard constraints
3. Extract normalized features per option
4. Derive effective strategy weights
5. Score each option
6. Rank options
7. Generate explanation
8. Persist result

---

## 11. Explanation engine requirements

Every recommendation must include:

* top recommendation summary
* 2–4 bullets tying choice to owner goal
* key tradeoff acknowledged
* at least one reason an alternative ranked lower
* **when the alternative would be the better choice** (new — see §3.1)
* **short-term and long-term impact label** per ranked option (new — populates `RankedDecisionOption`)

### Short-term vs long-term impact labels

Each ranked option must carry two plain-language labels (not financial figures):

| Field | Purpose | Example |
|---|---|---|
| `shortTermImpact` | What happens in year 1 (cash, disruption) | "Higher cash outflow this year" / "Minimal immediate cost" |
| `longTermImpact` | What this means over the planning horizon | "Extends useful life by ~15 years" / "Risk of repeat failure within 3–5 years" |

These labels are generated by `explanationService` from the option's features and the
`FinancialProjection`. They appear on each alternative card in the UI, not just the
primary recommendation.

### "When to choose the alternative" field

`whenToChooseAlternative` is a single sentence explaining the specific condition under which
the second-ranked option would be the better choice for this user. It should always be
strategy-aware, not just financial.

Examples:
- "If your sale timeline moves within the next 18 months, a repair now would be the smarter choice."
- "If budget pressure increases significantly, deferring remains a viable option until the next inspection."
- "If you decide to reduce tenant disruption tolerance, a like-for-like replacement would score higher."

This field should be `undefined` only when there is no meaningful alternative (single-option
evaluation — should not happen in practice given hard-constraint minimum of 2 options).

### Example explanation template

```ts
export function buildExplanation(params: {
  primaryArchetype: StrategyArchetype;
  selectedOption: DecisionOption;
  runnerUp?: DecisionOption;
  features: DecisionFeatures;
}): RecommendationExplanation {
  return {
    summary: 'Replace now is the best fit for your long-term value strategy.',
    bullets: [
      'This option creates more long-term value than a short-term repair.',
      'It reduces future failure risk and extends useful life significantly.',
      'Although the upfront cost is higher, it better fits your willingness to invest in durable improvements.',
    ],
    tradeoffs: [
      'It requires higher near-term spending than a repair option.',
    ],
    profileAlignment: [
      "Your goal emphasizes improving long-term value over minimizing this year's cash outflow.",
    ],
    whenToChooseAlternative:
      'If you need to limit spending this year, the repair option is worth revisiting — it scores well on short-term cashflow for your profile.',
  };
}
```

### Short/long-term label generation (per ranked option)

```ts
export function buildOptionImpactLabels(
  option: DecisionOption,
  projection: FinancialProjection,
): { shortTermImpact: string; longTermImpact: string } {
  // shortTermImpact: driven by cashflowYear1 and tenantDisruptionScore
  // longTermImpact: driven by lifecycleExtensionScore and totalValueCreation
  // Labels are plain English — no raw numbers exposed to the user
}
```
```

---

## 12. Configurability strategy

### 12.1 What should be configurable

Via code config, admin panel, or feature flags:

* question text and answer labels
* score weights
* archetype formulas
* hard constraint thresholds
* budget penalty coefficients
* explanation templates
* jurisdiction-specific tax assumption modules (via existing `TaxRule` + `LegalSource` infrastructure)

### 12.2 What should not be user-configurable in v1

* arbitrary formula builder
* per-user custom weight editing
* free-form rule authoring
* changing tax rules directly in consumer UI

Reason: complexity and trust risk.

---

## 13. System architecture

### 13.1 Layer structure

Follow the existing project architecture without exception:

```
routes → workflows → services → repositories → Prisma → PostgreSQL
```

- **Routes** — thin HTTP handlers in `apps/api/src/routes/`
- **Workflows** — orchestration in `apps/api/src/workflows/`
- **Services** — domain logic in `apps/api/src/services/`
- **Repositories** — Prisma access in `apps/api/src/repositories/` with canonical include constants (G9)
- **Pure scoring functions** — can live in `apps/api/src/services/strategy/` as a subfolder of services, framework-agnostic, fully unit-testable

> The `src/domain/` folder structure from the original spec does not match the existing
> project and is **not used**. Scoring logic goes in `services/`, type definitions go in
> `packages/api-client/src/` alongside existing DTOs.

### 13.2 New services

| Service | Responsibility |
|---|---|
| `strategyProfileService.ts` | Questionnaire processing, dimension/archetype scoring, profile persistence |
| `decisionScoringService.ts` | Feature extraction, weight application, hard constraints, option ranking |
| `recommendationService.ts` | Orchestration of scoring → explanation → persistence |
| `explanationService.ts` | Template-driven explanation generation |
| `financialModelService.ts` | NPV, IRR, payback, tax shield computation; reads `TaxRuleVersion`, `DepreciationStandard`, `ReplacementBenchmark` |

### 13.3 New routes

| Route module | Endpoints |
|---|---|
| `apps/api/src/routes/strategy.ts` | POST /strategy/owner-profile, POST /strategy/building-profile, GET /strategy/owner-profile/:ownerId |
| `apps/api/src/routes/recommendations.ts` | POST /recommendations/evaluate, GET /recommendations/:opportunityId |

### 13.4 New workflows

| Workflow | Triggers |
|---|---|
| `strategyProfileWorkflow.ts` | On questionnaire submission |
| `recommendationWorkflow.ts` | On evaluate request; reads building profile, scores options, persists result |

### 13.5 Suggested folder additions (within existing structure)

```txt
apps/api/src/
  routes/
    strategy.ts          (new)
    recommendations.ts   (new)
  workflows/
    strategyProfileWorkflow.ts   (new)
    recommendationWorkflow.ts    (new)
  services/
    strategyProfileService.ts    (new)
    decisionScoringService.ts    (new)
    recommendationService.ts     (new)
    explanationService.ts        (new)
    financialModelService.ts     (new)
    strategy/                    (new subfolder — pure scoring functions)
      scoring.ts
      archetypes.ts
      contradictions.ts
      weights.ts
      hardConstraints.ts
  repositories/
    strategyProfileRepository.ts    (new)
    decisionOptionRepository.ts     (new)
    recommendationRepository.ts     (new)
  config/
    decisionWeights.ts   (new — DECISION_WEIGHTS constant; admin-configurable via env/feature flag)
    hardConstraints.ts   (new)
apps/web/pages/
  owner/
    strategy.js          (new — questionnaire + goal display)
  manager/
    recommendations.js   (new — recommendation cards per request)
packages/api-client/src/
  strategy.ts            (new DTO types)
  recommendations.ts     (new DTO types)
```

---

## 14. API contracts

### 14.1 Create owner profile

```http
POST /api/strategy/owner-profile
```

Request:

```json
{
  "ownerId": "owner_123",
  "answers": {
    "mainGoal": 3,
    "holdPeriod": 4,
    "renovationAppetite": 4,
    "cashSensitivity": 2,
    "disruptionTolerance": 3
  }
}
```

Response:

```json
{
  "profile": {
    "primaryArchetype": "value_builder",
    "secondaryArchetype": "opportunistic_repositioner",
    "confidence": "medium",
    "dimensions": {
      "horizon": 100,
      "incomePriority": 38,
      "appreciationPriority": 86,
      "capexTolerance": 74,
      "volatilityTolerance": 52,
      "liquiditySensitivity": 29,
      "saleReadiness": 25,
      "stabilityPreference": 33,
      "modernizationPreference": 70,
      "disruptionTolerance": 50
    },
    "archetypeScores": {
      "exit_optimizer": 33,
      "yield_maximizer": 36,
      "value_builder": 81,
      "capital_preserver": 44,
      "opportunistic_repositioner": 68
    }
  }
}
```

### 14.2 Create building strategy profile

```http
POST /api/strategy/building-profile
```

### 14.3 Get recommendation for opportunity

```http
POST /api/recommendations/evaluate
```

Request:

```json
{
  "buildingId": "b_123",
  "opportunityId": "opp_456",
  "options": ["opt_1", "opt_2", "opt_3"]
}
```

Response:

```json
{
  "selectedOptionId": "opt_2",
  "rankedOptions": [
    {
      "optionId": "opt_2",
      "totalScore": 82,
      "shortTermImpact": "Higher cash outflow this year",
      "longTermImpact": "Extends useful life by ~20 years"
    },
    {
      "optionId": "opt_1",
      "totalScore": 64,
      "shortTermImpact": "Lower immediate cost",
      "longTermImpact": "Risk of repeat failure within 5 years"
    },
    {
      "optionId": "opt_3",
      "totalScore": 41,
      "shortTermImpact": "No cost this year",
      "longTermImpact": "Compliance risk remains unresolved"
    }
  ],
  "explanation": {
    "summary": "Replace now is the best fit for your long-term value strategy.",
    "bullets": [
      "This option extends useful life materially.",
      "It creates stronger long-term value than a short-term repair.",
      "The recommendation fits your preference for durable upgrades over minimal fixes."
    ],
    "tradeoffs": [
      "Upfront cost is higher this year."
    ],
    "profileAlignment": [
      "You prioritized long-term improvement over minimizing immediate spending."
    ],
    "whenToChooseAlternative": "If you need to limit spending this year, the repair option is worth revisiting — it scores well on short-term cashflow for your profile."
  },
  "userDecision": "pending"
}
```

### 14.4 Record user decision on recommendation

```http
PATCH /api/recommendations/:resultId/decision
```

Request:

```json
{
  "userDecision": "accepted",
  "userFeedback": "Makes sense given our renovation plans."
}
```

Response: `200 OK` with updated `RecommendationResult`.

---

## 15. UI requirements

### 15.1 Onboarding

* max 5 question screens + 1 strategy display screen (§4.3) + 1 building setup screen (§3.4)
* radio-button answers only on question screens
* one optional "advanced preferences" link
* show user-facing labels, not internal model terms
* follows existing AppShell → PageShell → PageHeader → PageContent → Panel layout (F-UI1/F-UI2)
* all text in English only (F-UI7)
* **total onboarding flow must be completable in under 2 minutes** (NFR — §19)

### 15.2 Strategy display screen (post-questionnaire)

A dedicated screen shown immediately after questionnaire submission (before building setup).

Must show:
* "Your current strategy: **[user-facing label]**" as the dominant heading
* 2–3 sentence plain-language explanation of the archetype (see §4.3 table)
* Secondary archetype if present: "With a secondary lean toward: **[label]**"
* Confidence label (low / medium / high) — subtle, not prominent
* CTA: "Continue" → building setup
* Link: "Change my answers" → back to questionnaire

Must NOT show:
* Dimension scores or numerical values
* Archetype score breakdown
* Internal model terms (exit_optimizer, etc.)

### 15.3 Building setup screen

Follows the strategy display screen. Collects the inputs from §3.4.

Must show:
* Building type selector (residential / mixed / commercial)
* Approximate number of units (optional number input)
* Current condition selector (4-point scale: Poor / Fair / Good / Very good)
* Building role intent selector (Sell soon / Income generator / Long-term hold / Upgrade candidate)
* Pre-filled: year built (from `Building.yearBuilt` if available)
* CTA: "Save and continue"

### 15.4 Recommendation card

Must show:

* recommendation title and `optionType` in plain language
* **primary recommendation** — prominently labelled
* **why this is recommended** — `explanation.summary` + `bullets`
* **key tradeoff** — `explanation.tradeoffs`
* **estimated cost** (from `ReplacementBenchmark` or manually entered) with range if available (low / median / high CHF)
* **short-term impact** and **long-term impact** labels — two distinct visual elements
* **alternative options** (2–3) — each showing title, total score, shortTermImpact, longTermImpact
* **"When to choose the alternative"** — `explanation.whenToChooseAlternative` shown as a contextual note under the alternatives
* **user decision CTA** — "Follow this recommendation" / "I'll do something else" / "Decide later"
* On decision: show confirmation and timestamp; allow user to add a note

**Decision flow must reach a result in under 60 seconds** (NFR — §19).

### 15.5 Decision history (Phase 2)

A list view per building showing:
* Past recommendations received
* Date evaluated
* Option chosen (system recommendation or user override)
* User decision status (accepted / rejected / deferred)
* User feedback note if provided

### 15.6 Settings

Allow users to change property goal later (re-run questionnaire).
Allow users to update building condition and role intent at any time.
Do not expose raw weights or dimension scores.

---

## 16. Test plan

### 16.1 Unit tests

* normalization functions
* dimension derivation
* archetype scoring
* contradiction scoring
* profile blending
* feature scoring
* hard constraints
* tax profile derivation (mock `TaxRuleVersion` query)
* cost seeding from `ReplacementBenchmark` (mock repository)

### 16.2 Snapshot tests

* questionnaire answer set → expected profile
* opportunity + options + profile → expected ranked order

### 16.3 Scenario tests

Include at least these scenarios:

1. sell in 3 years + cosmetic upgrade vs full replacement
2. income-focused owner + major HVAC failure
3. long-term value owner + energy retrofit
4. low-risk owner + façade issue with tenant disruption
5. opportunistic owner + distressed common areas

### 16.4 Explainability tests

Ensure explanation always includes:

* one strategic reason
* one financial reason or tradeoff
* no contradictory wording

### 16.5 Contract tests

Update `contracts.test.ts` in the same PR as any DTO change (G10). Add contract assertions for:

* `POST /strategy/owner-profile` → required fields in response
* `POST /recommendations/evaluate` → `selectedOptionId` + `explanation.summary` present

---

## 17. Implementation phases

> **Sequencing note:** Phases 1–2 can start independently of the broader roadmap.
> Phase 3 depends on `CashflowPlan` infrastructure being mature (roadmap F-P1-003).
> See §22 for roadmap alignment.

### Phase 1 — Core profile engine

* questionnaire schema + `OwnerStrategyProfile` migration
* normalization + dimension scoring (pure functions, unit tested)
* archetype scoring + persistence
* `BuildingStrategyProfile` model + combination logic
* `POST /strategy/owner-profile` and `POST /strategy/building-profile` routes
* Owner portal: questionnaire UI

### Phase 2 — Decision scoring MVP

* `MaintenanceDecisionOption` migration
* feature extraction from `DecisionOption`
* archetype weight matrix (config-backed)
* hard constraints
* ranked recommendations + `RecommendationResult` persistence with `userDecision` field
* `shortTermImpact` / `longTermImpact` label generation per option
* `whenToChooseAlternative` explanation field
* basic explanation templates
* `POST /recommendations/evaluate` route
* `PATCH /recommendations/:resultId/decision` route
* Manager + Owner portal: recommendation card UI (§15.4) on request detail page
* Owner portal: decision history list (§15.5)
* Building setup screen (§15.3) wired to `BuildingStrategyProfile` with `conditionRating` and user-set `roleIntent`
* **Vacancy / renovation decision type** (Phase 2 extension): extend `MaintenanceOpportunity` category enum to include `vacancy` and `renovation` — allows the recommendation engine to handle vacant unit repositioning decisions, not just maintenance. Hard constraints must be reviewed for applicability to this category.

### Phase 3 — Finance integration

* `financialModelService.ts` reading `TaxRuleVersion`, `DepreciationStandard`, `ReplacementBenchmark`
* NPV / payback / tax shield computation
* `FinancialProjection` population per option
* Integration with `CashflowPlan` for horizon scenarios (requires F-P1-003 to be done)

### Phase 4 — Building overrides and admin config

* per-building role intent
* config-backed thresholds via `config/decisionWeights.ts` and `config/hardConstraints.ts`
* feature flags

### Phase 5 — Portfolio layer

* cross-building strategy view
* capital allocation suggestions
* portfolio role balancing

---

## 18. Acceptance criteria for v1

A v1 implementation is complete when:

* a user can answer 5 onboarding questions
* the system computes dimensions and archetypes
* a building receives an effective strategy profile
* a maintenance opportunity with 2+ options can be evaluated
* the system returns a ranked recommendation
* the system explains the recommendation in human-readable terms
* compliance-critical options are never incorrectly deferred without explicit override
* the same input always yields the same recommendation
* `TaxRuleVersion` data is consumed (not hardcoded) for tax calculations

---

## 19. Non-functional requirements

* deterministic results
* fully testable pure scoring functions
* versioned scoring config (via `onboardingVersion` field on `OwnerStrategyProfile`)
* auditability: `RecommendationResult` persisted with full input snapshot
* explainability of every recommendation
* jurisdiction-aware tax hooks via existing `TaxRule`/`TaxRuleVersion` infrastructure
* all new models include `orgId` (F7 guardrail — no single-org assumptions in new code)
* G1: all new models via `npx prisma migrate dev`, never `db push`
* G9: all new repositories export canonical include constants
* G10: contract tests updated in same PR as any DTO change

**Performance SLAs (from BRD NFR1/NFR3):**

| Flow | Target |
|---|---|
| Full onboarding (questionnaire → strategy display → building setup) | < 2 minutes end-to-end |
| Decision flow: user submits opportunity → receives ranked recommendation | < 60 seconds |
| Recommendation generation (server-side compute) | < 2 seconds response time |
| Strategy profile computation (pure scoring functions) | < 100ms (no DB dependency) |

The 2-second server target means financial projection computation must not block on
slow external queries — `TaxRuleVersion` and `DepreciationStandard` lookups should be
cached at the service level (in-process cache or memoised per request, not Redis in v1).

---

## 20. Copilot implementation prompt starter

Use this as the first implementation prompt.

```txt
Implement Phase 1 of the Strategy Engine for the Maintenance Agent monorepo.

Architecture: follow routes → workflows → services → repositories → Prisma (no src/domain/ folder).
All new Prisma models must be added via `npx prisma migrate dev`.

Step 1 — Pure scoring functions (no DB, no framework):
Create apps/api/src/services/strategy/ with:
- scoring.ts: normalize1to5, reverseScore, normalizeHoldPeriod, weightedAverage, clampScore,
  deriveStrategyDimensions, deriveArchetypeScores, selectArchetypes, deriveContradictionScore,
  combineDimensions
- archetypes.ts: StrategyArchetype type, ArchetypeScores, StrategyDimensions interfaces
- weights.ts: DECISION_WEIGHTS constant for 5 archetypes, deriveEffectiveWeights
Unit test all pure functions in apps/api/src/__tests__/strategyScoring.test.ts.

Step 2 — Schema:
Add to schema.prisma: OwnerStrategyProfile, BuildingStrategyProfile, StrategyQuestionnaireAnswer.
OwnerStrategyProfile.ownerId → User.id. BuildingStrategyProfile.buildingId → Building.id.
Both must include orgId. Run npx prisma migrate dev --name add_strategy_profiles.

Step 3 — Repository + Service + Route:
- strategyProfileRepository.ts with canonical include constants
- strategyProfileService.ts calling pure scoring functions and persisting via repository
- strategyProfileWorkflow.ts orchestrating service calls
- routes/strategy.ts: POST /strategy/owner-profile, POST /strategy/building-profile

Step 4 — Update packages/api-client with new DTO types.
Step 5 — Update contracts.test.ts with assertions for the two new endpoints.
```

---

## 21. Final product rule

The product should feel simple to the user and sophisticated in the engine. If a design choice increases user configurability but reduces explainability or consistency, prefer the simpler UI and keep complexity in code/config.

---

## 22. Roadmap alignment

This feature is not currently in ROADMAP.json. It should be added as a new feature with the following positioning:

| This spec's component | Closest roadmap item | Relationship |
|---|---|---|
| Phase 1 (profile engine) | None — net new | Independent, can start at any time |
| Phase 2 (decision scoring) | F-P4-004 "Proactive Asset Health Signals" | Subsumes and extends F-P4-004; F-P4-004 can be deferred or treated as the data-layer prerequisite |
| Phase 3 (finance integration) | F-P1-003 "BuildingFinancialSnapshot Engine" + F-P4-001 "Cost Attribution" | Phase 3 must come after F-P1-003 is complete; its NPV output feeds into the same data layer as F-P4-003 (NOI Dashboard) |
| Questionnaire onboarding | F-P2-001 "Self-Service Onboarding Wizard" | Different scope: F-P2-001 is operational setup; this is goal-setting. Can be integrated as a step within F-P2-001 in the same phase. |
| Phase 5 (portfolio) | (deferred; no roadmap item yet) | Does not conflict with any current roadmap item |

**Recommended roadmap phase:** Phase 2 (Month 3–6 window) for Phases 1–2 of this spec.
Phase 3 of this spec belongs in Phase 4 (Month 8–14) after cashflow infrastructure is in place.

---

## 23. Implementation prerequisites

Before starting each phase, the following must be true:

**Phase 1 (profile engine):**
- No blockers. Can start immediately.
- Ensure `User` table has seeded OWNER-role users in the dev DB before testing.

**Phase 2 (decision scoring):**
- `Asset` and `AssetIntervention` records must exist in the dev DB (they do — 99+ assets seeded per PROJECT_STATE.md).
- `DepreciationStandard` must be seeded (274 standards exist per PROJECT_STATE.md).
- `ReplacementBenchmark` must be seeded (model exists; verify seed data exists before using as cost source).

**Phase 3 (finance integration):**
- `TaxRule` + `TaxRuleVersion` must have entries for the asset categories being evaluated.
  Check `SELECT COUNT(*) FROM "TaxRuleVersion"` before starting.
- `CashflowPlan` (F-P1-003) should be implemented first or in parallel — Phase 3 integration
  with it is optional for initial delivery but required for full fidelity.

**All phases:**
- G1: no `db push` under any circumstance
- G7: CI must remain green (tsc + tests + build) throughout
- F7: all new models include `orgId`
- F-UI7: all UI text in English only
