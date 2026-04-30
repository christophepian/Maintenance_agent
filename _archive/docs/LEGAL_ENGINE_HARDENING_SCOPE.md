# Legal Engine Hardening — Implementation Scope

> **Created 2026-04-12.** Scoped from gap assessment of current legal engine vs.
> hardening epic (F-P0-002, F-P0-004) and new tenant claim analysis capability.
>
> **Goal:** Dramatically improve the quality, depth, and actionability of legal
> analysis results for both landlords and tenants — moving from binary
> "OBLIGATED / UNKNOWN" verdicts to specific, case-law-backed claim assessments
> with CHF amounts, applicable precedents, and step-by-step guidance.

---

## 0. Current State (as of 2026-04-12)

### What works (committed in git HEAD)

| Component | Lines | Status |
|---|---|---|
| `legalDecisionEngine.ts` | 654 | Evaluates obligations via DSL rules + depreciation |
| `legalIngestion.ts` | 1149 | 5 fetchers: BWO rate, BFS CPI, ASLOCA depreciation (~300 items), ASLOCA rent reductions (55 case-law entries), Fedlex metadata |
| `legalVariableIngestion.ts` | 185 | Idempotent variable upsert, 15 tests |
| `legalService.ts` | 300 | CRUD for variables, rules, mappings, evaluations, depreciation standards |
| `evaluateLegalRoutingWorkflow.ts` | 174 | Canton derivation → ingestion → evaluation → auto-RFP |
| `legal.ts` (routes) | 681 | ~25 endpoints: decision, RFPs, sources, variables, rules, mappings, evaluations |
| `legalEngine.test.ts` | 529 | Integration tests: CRUD, decision, idempotency, validation |
| Schema | 8 models, 6 enums | LegalVariable, LegalRule, LegalEvaluationLog, LegalCategoryMapping, LegalSource, DepreciationStandard + versions |

### What doesn't work

| Issue | Impact |
|---|---|
| **⚠️ Working tree divergence** — legal.ts, legalDecisionEngine.ts, evaluateLegalRoutingWorkflow.ts, legalIncludes.ts, legalIngestion.ts, legalSourceRepository.ts, validation/legal.ts are 0 bytes on disk | API crashes on startup |
| DSL condition evaluator doesn't resolve `LegalVariable` values (S-P0-002-02 planned, not done) | Reference rate + CPI ingested but never used in decisions |
| No defect-to-reduction matching — 55 ASLOCA entries ingested but never matched against tenant complaints | Binary obligation only; no rent reduction % returned |
| No NLP or keyword extraction from `Request.description` | Free-text complaints ignored |
| No tenant-facing claim output (reduction %, CHF, legal basis, next steps) | Superficial results |
| 10 of 11 frontend proxy files empty; 3 of 4 manager legal pages empty | UI non-functional |
| No api-client types for legal domain | All calls untyped |

---

## Phase A — Wire What Exists

> **Goal:** Restore functionality, complete the last planned roadmap slice, and
> make the existing 55 ASLOCA rent reduction rules queryable.
>
> **Estimated effort:** 1–2 days

### Slice A-1: Restore zeroed files from git HEAD

**Type:** fix
**Status:** prerequisite (must be first)

**Files to restore:**
- `apps/api/src/routes/legal.ts`
- `apps/api/src/services/legalDecisionEngine.ts`
- `apps/api/src/services/legalIncludes.ts`
- `apps/api/src/services/legalIngestion.ts`
- `apps/api/src/repositories/legalSourceRepository.ts`
- `apps/api/src/validation/legal.ts`
- `apps/api/src/workflows/evaluateLegalRoutingWorkflow.ts`
- `apps/api/src/__tests__/legalEngine.test.ts`
- `apps/api/src/server.ts` (contains legal route registration + BG jobs)
- `apps/api/src/http/router.ts` (Router class used by legal.ts)

**Acceptance criteria:**
- [ ] `git checkout HEAD -- <files>` restores all zeroed files
- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] API server starts on port 3001 without crashes
- [ ] `curl localhost:3001/legal/evaluations` returns 200
- [ ] All 529+ legal engine tests pass

**Implementation:** Single `git checkout HEAD --` command. Verify compilation and test pass.

---

### Slice A-2: Wire LegalVariable values into DSL condition evaluation (S-P0-002-02)

**Type:** wire
**Depends on:** A-1
**ROADMAP ID:** S-P0-002-02

**Context:** `evaluateSingleCondition()` in `legalDecisionEngine.ts` supports
`topic_match`, `always_true/false`, `AND/OR`, and legacy `field/op/value`. It
does **not** resolve LegalVariable records from the DB.

**Changes:**

1. **New condition type `variable_compare`** in `evaluateSingleCondition()`:
   ```ts
   // DSL format:
   // { type: "variable_compare", variableKey: "REFERENCE_INTEREST_RATE",
   //   path: "rate", op: "gt", value: 1.5 }
   ```
   - Query `LegalVariable` by key + jurisdiction "CH"
   - Prefer canton-scoped version, fall back to FEDERAL (canton = null)
   - Get latest `LegalVariableVersion` where `effectiveFrom <= now` and
     `effectiveTo IS NULL OR >= now`
   - Navigate `valueJson` via `path` (e.g., `"rate"` → `valueJson.rate`)
   - Compare using existing `op` logic (eq, gt, gte, lt, in)

2. **Async condition evaluation** — `evaluateDslConditions()` must become
   `async` since DB lookups are needed. Update call chain:
   - `evaluateStatutoryRules()` already async ✓
   - `evaluateDslConditions()` → `async`
   - `evaluateSingleCondition()` → `async`

3. **Log resolved variables** — Add `resolvedVariables` map to
   `LegalEvaluationLog.resultJson`:
   ```json
   { "resolvedVariables": { "REFERENCE_INTEREST_RATE": { "rate": 1.75 } } }
   ```

**Files modified:**
- `apps/api/src/services/legalDecisionEngine.ts`

**Acceptance criteria:**
- [ ] DSL conditions referencing `LegalVariable` keys resolve to live DB values
- [ ] Canton-scoped lookups fall back to national scope if no canton-specific value
- [ ] `LegalEvaluationLog.resultJson` records the resolved variable values
- [ ] Integration test: seed a `LegalVariable` row, create a rule referencing it,
      evaluate, assert correct outcome
- [ ] Existing 529 tests still pass (backwards compatible)

**New test file:** `apps/api/src/__tests__/legalVariableResolve.test.ts`

---

### Slice A-3: Expose rent reduction rules in decision output

**Type:** extend
**Depends on:** A-1

**Context:** The 55 ASLOCA rent reduction entries are ingested as `LegalRule`
rows with `ruleType = MAINTENANCE_OBLIGATION` and DSL containing:
```json
{
  "type": "RENT_REDUCTION",
  "defect": "Lave-vaisselle en panne",
  "category": "Défauts",
  "reductionPercent": 3,
  "basis": "jurisprudence",
  "source": "ASLOCA/Lachat"
}
```

Currently, `evaluateStatutoryRules()` filters by `ruleType: "MAINTENANCE_OBLIGATION"`
and `authority: "STATUTE"`, which **excludes** ASLOCA rules (authority = `INDUSTRY_STANDARD`).

**Changes:**

1. **New query in `evaluateStatutoryRules()`** — After evaluating STATUTE rules,
   run a second query for `authority: "INDUSTRY_STANDARD"` + `ruleType: "MAINTENANCE_OBLIGATION"`
   rules matching the same topic. Collect matched rent reduction entries.

2. **New DTO field `matchedReductions`** on `LegalDecisionDTO`:
   ```ts
   matchedReductions: Array<{
     ruleKey: string;
     defect: string;
     category: string;
     reductionPercent: number;
     reductionMax?: number;
     citation: string;
   }>;
   ```

3. **Populate `matchedReductions`** from DSL `type: "RENT_REDUCTION"` rules
   where the category/topic matches.

**Files modified:**
- `apps/api/src/services/legalDecisionEngine.ts` — add INDUSTRY_STANDARD query + DTO field

**Acceptance criteria:**
- [ ] `GET /requests/:id/legal-decision` returns `matchedReductions[]` in the response
- [ ] Reductions only appear when the request's legal topic matches
- [ ] Each reduction includes `ruleKey`, `defect`, `reductionPercent`, `citation`
- [ ] Existing tests unchanged (backwards compatible — new field additive)

---

## Phase B — Defect Matching Engine

> **Goal:** Build a service that takes free-text tenant complaints and
> fuzzy-matches them against the 55 ASLOCA rent reduction entries, producing
> ranked matches with confidence scores.
>
> **Estimated effort:** 3–5 days

### Slice B-1: Keyword extraction from complaint text

**Type:** build
**Depends on:** A-1

**New file:** `apps/api/src/services/defectClassifier.ts`

**Design:**

Build a deterministic keyword-based classifier (no LLM dependency) that extracts
structured signals from `Request.description`:

```ts
export interface DefectSignals {
  /** Detected defect keywords with source positions */
  keywords: Array<{ term: string; category: string; weight: number }>;
  /** Inferred severity: mild | moderate | severe | critical */
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  /** Affected area indicators */
  affectedArea: {
    roomCount?: number;       // "3 pièces", "4.5p"
    percentAffected?: number; // "80% de la pièce"
    rooms: string[];          // ["chambre", "séjour", "cuisine"]
  };
  /** Duration indicators */
  duration: {
    months?: number;
    ongoing: boolean;
    seasonal: boolean;        // heating defect Oct–Apr
  };
  /** Raw category inference before legal topic mapping */
  inferredCategories: string[];
}

export function extractDefectSignals(description: string, category?: string | null): DefectSignals;
```

**Keyword dictionary structure** (built from the 55 ASLOCA entries + Swiss tenancy vocabulary):

| Category | Keywords (FR/DE/EN) |
|---|---|
| Température | chauffage, heizung, heating, 18°C, froid, cold, kalt, eau chaude, warmwasser |
| Humidité | moisissure, schimmel, mould, mold, humidité, feuchtigkeit, moisture, champignon |
| Dégâts d'eau | infiltration, inondation, überschwemmung, flood, fuite, leak, leck, plafond mouillé |
| Rénovations | travaux, renovation, umbau, chantier, construction, bruit, noise, lärm, poussière |
| Immissions | bruit, noise, lärm, odeur, smell, geruch, fumée, smoke, rauch, vibration |
| Défauts | panne, defekt, broken, lave-vaisselle, dishwasher, ascenseur, elevator, lift, interphone |
| Autres | conciergerie, hauswart, caretaker, parquet, ceiling, plafond, mur, wand, wall |

**Severity detection rules:**
- `critical`: "inhabitable", "sans eau", "50%+", "grave"
- `severe`: "80% de la pièce", "gravement", "pourrissement", "majeur"
- `moderate`: "traces", "taches", "insuffisant", "endommagé"
- `mild`: "léger", "petit", "mineur", "slight"

**Acceptance criteria:**
- [ ] `extractDefectSignals("Il y a de la moisissure noire sur le mur de la chambre depuis 3 mois")` returns `{ keywords: [{term: "moisissure", category: "Humidité", ...}], severity: "moderate", affectedArea: { rooms: ["chambre"] }, duration: { months: 3, ongoing: true } }`
- [ ] Handles FR, DE, EN input
- [ ] Returns empty signals for non-defect text (no false positives)
- [ ] 30+ unit tests covering each category

**New test file:** `apps/api/src/__tests__/defectClassifier.test.ts`

---

### Slice B-2: Fuzzy matching against ASLOCA rent reduction rules

**Type:** build
**Depends on:** B-1

**New file:** `apps/api/src/services/defectMatcher.ts`

**Design:**

Match extracted `DefectSignals` against the 55 ASLOCA `RENT_REDUCTION` rules
in the DB:

```ts
export interface DefectMatch {
  ruleKey: string;
  ruleId: string;
  defect: string;          // ASLOCA defect description
  category: string;        // ASLOCA category
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number; // 0–100
  matchReasons: string[];  // Why this matched
  citation: { article: string; text: string };
}

export interface MatchResult {
  matches: DefectMatch[];  // Sorted by confidence desc
  bestMatch: DefectMatch | null;
  totalConfidence: number; // Weighted aggregate
  unmatchedSignals: string[]; // Keywords that didn't match any rule
}

export async function matchDefectsToRules(
  signals: DefectSignals,
  canton?: string | null,
): Promise<MatchResult>;
```

**Matching algorithm:**

1. **Load RENT_REDUCTION rules** from `LegalRule` where `isActive = true` and
   DSL contains `type: "RENT_REDUCTION"`.

2. **Score each rule** against the signals:
   - **Category match** (signals.inferredCategories ∩ rule.category): +30 pts
   - **Keyword overlap** (Jaccard similarity of signal keywords vs rule defect text): +40 pts
   - **Severity alignment** (signal severity matches rule's implied severity from reduction %):
     - `reductionPercent > 30` → expects severe/critical signals: +15 pts if match
     - `reductionPercent < 10` → expects mild/moderate: +15 pts if match
   - **Area match** (rule mentions rooms and signals.affectedArea.rooms overlap): +15 pts

3. **Filter** matches below `confidence < 20`.

4. **Sort** by confidence descending, return top 5.

**Acceptance criteria:**
- [ ] "Moisissure dans la chambre" matches `CH_RENT_RED_MOULD_LIGHT` (10%) with high confidence
- [ ] "Moisissure grave, 80% de la pièce" matches `CH_RENT_RED_ROOM_SEVERE_MOULD` (80%)
- [ ] "Lave-vaisselle en panne" matches `CH_RENT_RED_DISHWASHER` (3%)
- [ ] "Bruit de chantier sous les fenêtres" matches both `CH_RENT_RED_WORKS_BELOW_HEAVY` (30%) and `CH_RENT_RED_WORKS_BELOW_LIGHT` (10%)
- [ ] Returns empty matches for "The lightbulb in my closet is out" (not a legal defect)
- [ ] 25+ unit tests

**New test file:** `apps/api/src/__tests__/defectMatcher.test.ts`

---

### Slice B-3: Lease-aware rent reduction calculation

**Type:** build
**Depends on:** B-2

**New file:** `apps/api/src/services/rentReductionCalculator.ts`

**Design:**

Given matched defects + the tenant's lease, compute CHF reduction amounts:

```ts
export interface RentReductionResult {
  /** Net monthly rent from lease */
  netRentChf: number;
  /** Best-match reduction */
  primaryReduction: {
    defect: string;
    reductionPercent: number;
    reductionMax?: number;
    monthlyReductionChf: number;
    monthlyReductionMaxChf?: number;
    ruleKey: string;
  };
  /** Additional applicable reductions (multi-defect) */
  additionalReductions: Array<{
    defect: string;
    reductionPercent: number;
    monthlyReductionChf: number;
    ruleKey: string;
  }>;
  /** Aggregate total (capped per Swiss practice) */
  totalReductionPercent: number;
  totalReductionChf: number;
  /** Cap applied (Swiss case law: total rarely exceeds 100%, typical cap ~70% for habitability) */
  capApplied: boolean;
  capNote?: string;
}

export async function calculateRentReduction(
  matches: DefectMatch[],
  leaseId: string,
): Promise<RentReductionResult | null>;
```

**Business rules:**
- Look up `Lease` by ID, extract `netRentChf`
- If `reductionMax` is present, return both min and max CHF values
- Multi-defect: sum percentages but cap at 70% (Swiss judicial practice —
  above 70% the tenant typically has grounds for lease termination, not reduction)
- Seasonal adjustments: heating defects only count Oct–Apr (6/12 months)

**Acceptance criteria:**
- [ ] Given netRent = 2000, defect = dishwasher (3%) → monthlyReductionChf = 60
- [ ] Given netRent = 2000, defect = severe mould (80%) → cap at 70% = 1400
- [ ] Multi-defect: dishwasher (3%) + elevator (10%) = 13% → 260 CHF
- [ ] Returns `null` if no active lease found
- [ ] Handles garageRentChf and otherServiceRentChf exclusion (reductions apply to `netRentChf` only)

**New test file:** `apps/api/src/__tests__/rentReductionCalculator.test.ts`

---

## Phase C — Structured Claim Analysis

> **Goal:** Compose the defect matcher + rent calculator + legal engine into a
> complete tenant claim analysis service with actionable output.
>
> **Estimated effort:** 3–5 days

### Slice C-1: Tenant claim analysis service

**Type:** build
**Depends on:** B-3, A-3

**New file:** `apps/api/src/services/tenantClaimAnalysis.ts`

**Design:**

The top-level composition service that produces a complete claim assessment:

```ts
export interface TenantClaimAnalysisDTO {
  // ─── Request context ───
  requestId: string;
  requestDescription: string;
  category: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  canton: string | null;

  // ─── Defect classification ───
  defectSignals: DefectSignals;

  // ─── Legal assessment ───
  legalObligation: LegalObligation;
  legalTopic: string | null;
  confidence: number;

  // ─── Matched defects (from ASLOCA case law) ───
  matchedDefects: Array<{
    rank: number;
    ruleKey: string;
    defect: string;
    category: string;
    reductionPercent: number;
    reductionMax?: number;
    matchConfidence: number;
    matchReasons: string[];
  }>;

  // ─── Financial impact ───
  rentReduction: RentReductionResult | null;

  // ─── Legal basis ───
  legalBasis: Array<{
    article: string;
    text: string;
    authority: string;
    relevance: string; // "Defines landlord obligation to maintain" etc.
  }>;

  // ─── Depreciation context ───
  depreciationSignal: DepreciationSignalDTO | null;

  // ─── Actionable guidance ───
  tenantGuidance: {
    summary: string;            // "You are likely entitled to a rent reduction of 10–15%"
    nextSteps: string[];        // Human-readable ordered steps
    deadlines: string[];        // "Notify landlord in writing within 30 days"
    escalation: string;         // "If unresolved, contact the conciliation authority (Schlichtungsbehörde)"
  };

  landlordObligations: {
    summary: string;            // "Repair is legally required under CO 256/259a"
    requiredActions: string[];
    timeline: string;           // "Reasonable delay — typically 30 days for non-urgent"
  };

  // ─── Audit ───
  evaluationLogId: string;
  analysedAt: string;
}

export async function analyseClaimForRequest(
  orgId: string,
  requestId: string,
): Promise<TenantClaimAnalysisDTO>;
```

**Orchestration flow:**
1. Load request (with unit → building → lease chain)
2. Extract defect signals from `request.description`
3. Run legal decision engine (existing `evaluateRequestLegalDecision`)
4. Run defect matcher against extracted signals
5. Find active lease for the unit's tenant → calculate rent reduction
6. Build legal basis array from matched rules' citations
7. Generate tenant guidance based on obligation + reduction
8. Generate landlord obligations based on obligation + depreciation
9. Log to `LegalEvaluationLog` (extended contextJson)

**Files modified:**
- `apps/api/src/services/tenantClaimAnalysis.ts` (new)
- `apps/api/src/services/legalDecisionEngine.ts` (export helper functions)

**Acceptance criteria:**
- [ ] Given a request with description "Moisissure dans la chambre depuis 3 mois",
      returns matchedDefects with `CH_RENT_RED_MOULD_LIGHT`, rentReduction with CHF amount,
      and tenantGuidance with concrete next steps
- [ ] Returns `rentReduction: null` if no active lease found (still provides legal analysis)
- [ ] `legalBasis` includes CO 259d citation for rent reduction cases
- [ ] `tenantGuidance.escalation` mentions conciliation authority (Schlichtungsbehörde)
- [ ] Logs complete analysis to LegalEvaluationLog

**New test file:** `apps/api/src/__tests__/tenantClaimAnalysis.test.ts`

---

### Slice C-2: Claim analysis API endpoint + workflow

**Type:** build
**Depends on:** C-1

**New file:** `apps/api/src/workflows/analyseClaimWorkflow.ts`

**Design:**

```ts
export interface AnalyseClaimInput {
  requestId: string;
}

export interface AnalyseClaimResult {
  analysis: TenantClaimAnalysisDTO;
}

export async function analyseClaimWorkflow(
  ctx: WorkflowContext,
  input: AnalyseClaimInput,
): Promise<AnalyseClaimResult>;
```

**Workflow steps:**
1. Validate request exists and belongs to org
2. Ingest latest legal sources (non-blocking, same pattern as evaluateLegalRoutingWorkflow)
3. Call `analyseClaimForRequest()`
4. Emit `CLAIM_ANALYSED` domain event
5. Return analysis DTO

**Route registration** in `legal.ts`:

```
GET /requests/:id/claim-analysis
```

- Auth: `requireOrgViewer` (manager, owner can view any request's analysis)
- Also accessible from tenant portal: `GET /tenant-portal/requests/:id/claim-analysis`
  (uses `requireTenantSession`, validates request belongs to tenant)

**Files modified:**
- `apps/api/src/workflows/analyseClaimWorkflow.ts` (new)
- `apps/api/src/workflows/index.ts` (export)
- `apps/api/src/routes/legal.ts` (register GET endpoint)
- `apps/api/src/routes/tenantPortal.ts` (register tenant portal endpoint)

**Acceptance criteria:**
- [ ] `GET /requests/:id/claim-analysis` returns full `TenantClaimAnalysisDTO`
- [ ] 404 if request not found, 403 if org mismatch
- [ ] Tenant portal endpoint only accessible by request's own tenant
- [ ] Domain event `CLAIM_ANALYSED` emitted with requestId + obligation + reduction %
- [ ] Integration test with seeded request + lease

---

### Slice C-3: Multi-defect aggregation and temporal context

**Type:** extend
**Depends on:** C-1

**Context:** Real tenant complaints often describe multiple concurrent issues.
Swiss case law allows cumulative rent reductions.

**Changes to `tenantClaimAnalysis.ts`:**

1. **Multi-defect detection** — When `defectSignals.keywords` span multiple
   ASLOCA categories, match against each category separately and aggregate.

2. **Temporal modifiers:**
   - If `defectSignals.duration.months > 0` and defect is ongoing,
     calculate back-dated reduction (Swiss law: reduction applies from
     date of notification, per CO 259d)
   - If defect is seasonal (e.g., heating), pro-rate: `reductionPercent × (6/12)`
     for Oct–Apr period

3. **Severity escalation** — If the same defect category has multiple rules
   at different severities (e.g., `CH_RENT_RED_MOULD_LIGHT` 10% vs
   `CH_RENT_RED_ROOM_SEVERE_MOULD` 80%), use the severity signals to select
   the appropriate one.

**New DTO fields on `TenantClaimAnalysisDTO`:**
```ts
temporalContext: {
  defectOngoingSince?: string;    // ISO date if extractable
  durationMonths?: number;
  seasonalAdjustment: boolean;
  proRatedPercent?: number;       // adjusted % after seasonal pro-rating
  backdatedReductionChf?: number; // total back-dated amount
};
```

**Acceptance criteria:**
- [ ] "Le chauffage ne fonctionne pas depuis décembre" (heating, Dec → Apr) → 5/12 seasonal pro-rate
- [ ] "Moisissure dans la chambre et lave-vaisselle en panne" → two defects aggregated
- [ ] Severity selection: description with "80%" triggers severe rule, without → mild
- [ ] Back-dated calculation: 3 months × reduction% × netRent

---

## Phase D — Frontend & API Client

> **Goal:** Make the legal engine accessible via typed API client and
> functional UI pages.
>
> **Estimated effort:** 2–3 days

### Slice D-1: API client types for legal domain

**Type:** build
**Depends on:** C-2

**New file:** `packages/api-client/src/legal.ts`

**Exports:**
```ts
// DTOs
export interface LegalDecisionDTO { ... }
export interface TenantClaimAnalysisDTO { ... }
export interface LegalSourceDTO { ... }
export interface LegalRuleDTO { ... }
export interface LegalVariableDTO { ... }
export interface LegalCategoryMappingDTO { ... }
export interface LegalEvaluationDTO { ... }
export interface DepreciationStandardDTO { ... }

// Fetch methods
export function fetchLegalDecision(requestId: string): Promise<LegalDecisionDTO>;
export function fetchClaimAnalysis(requestId: string): Promise<TenantClaimAnalysisDTO>;
export function fetchLegalSources(): Promise<LegalSourceDTO[]>;
export function fetchLegalVariables(): Promise<LegalVariableDTO[]>;
export function fetchLegalRules(): Promise<LegalRuleDTO[]>;
export function fetchCategoryMappings(): Promise<LegalCategoryMappingDTO[]>;
export function fetchMappingCoverage(): Promise<CoverageResult>;
export function fetchEvaluations(params?: EvaluationParams): Promise<PaginatedResult<LegalEvaluationDTO>>;
export function triggerIngestion(sourceId?: string): Promise<IngestionResult[]>;
```

**Acceptance criteria:**
- [ ] All DTO types match backend response shapes
- [ ] Fetch methods handle errors consistently with existing api-client patterns
- [ ] Exported from `packages/api-client/src/index.ts`

---

### Slice D-2: Wire frontend proxy files

**Type:** wire
**Depends on:** D-1

**Files to implement** (all currently 0 bytes):
- `apps/web/pages/api/legal/variables.js` → proxy to `/legal/variables`
- `apps/web/pages/api/legal/rules.js` → proxy to `/legal/rules`
- `apps/web/pages/api/legal/category-mappings.js` → proxy to `/legal/category-mappings`
- `apps/web/pages/api/legal/category-mappings/[id].js` → proxy to `/legal/category-mappings/:id`
- `apps/web/pages/api/legal/category-mappings/coverage.js` → proxy to `/legal/category-mappings/coverage`
- `apps/web/pages/api/legal/depreciation-standards.js` → proxy to `/legal/depreciation-standards`
- `apps/web/pages/api/legal/evaluations.js` → proxy to `/legal/evaluations`
- `apps/web/pages/api/legal/sources/[id].js` → proxy to `/legal/sources/:id`
- `apps/web/pages/api/legal/rules/[id]/versions.js` → proxy to `/legal/rules/:id/versions`
- `apps/web/pages/api/legal/ingest.js` → proxy to `/legal/ingest`
- `apps/web/pages/api/requests/[id]/legal-decision.js` → proxy to `/requests/:id/legal-decision`
- `apps/web/pages/api/requests/[id]/claim-analysis.js` → proxy to `/requests/:id/claim-analysis` (new)

**Pattern** (same as existing `sources.js`):
```js
import { proxyToBackend } from "../../../lib/proxy";
export default async function handler(req, res) {
  await proxyToBackend(req, res, "/legal/variables");
}
```

**Acceptance criteria:**
- [ ] All 12 proxy files implemented with correct backend paths
- [ ] `curl localhost:3000/api/legal/variables` returns 200 with data

---

### Slice D-3: Manager legal dashboard

**Type:** build
**Depends on:** D-2

**Files to implement:**
- `apps/web/pages/manager/legal.js` — Dashboard overview (evaluation stats, recent decisions, coverage gaps)
- `apps/web/pages/manager/legal/evaluations.js` — Evaluation log browser with filters
- `apps/web/pages/manager/legal/rules.js` — Rule browser + CRUD

**Dashboard (`legal.js`) sections:**
1. **Quick stats** — Total evaluations, OBLIGATED %, coverage gaps
2. **Recent evaluations** — Table with request #, building, obligation, confidence, date
3. **Coverage gaps** — Categories without legal topic mapping
4. **Ingestion status** — Last source check times, error sources

**Acceptance criteria:**
- [ ] Dashboard loads and displays real data from API
- [ ] Evaluation list supports pagination + filtering by obligation/category
- [ ] Rules page shows rules with their latest version DSL
- [ ] Uses Tailwind classes (no inline styles — F8 guardrail)

---

### Slice D-4: Tenant claim analysis UI

**Type:** build
**Depends on:** D-2

**File:** `apps/web/pages/tenant/requests.js` (extend existing)

**Design:** Add a "Legal Analysis" panel to the request detail view in the
tenant portal. Shows:

1. **Obligation badge** — OBLIGATED (green), DISCRETIONARY (yellow), TENANT_RESPONSIBLE (red), UNKNOWN (gray)
2. **Matched defects** — Cards showing defect description, reduction %, confidence
3. **Rent reduction estimate** — "Estimated reduction: CHF 60–200/month" (if lease linked)
4. **Your next steps** — Ordered checklist from `tenantGuidance.nextSteps`
5. **Legal basis** — Expandable citations (CO 259d, etc.)
6. **Request analysis button** — Triggers `GET /api/requests/:id/claim-analysis` on demand

**Acceptance criteria:**
- [ ] Panel renders when tenant clicks "Legal Analysis" on their request
- [ ] Shows loading state while analysis runs
- [ ] Displays matched defects with confidence badges
- [ ] Shows CHF reduction amount when lease is linked
- [ ] Shows guidance steps in plain language
- [ ] Handles error states gracefully (no lease, no matches)

---

## Phase E — Depth Improvements (Future)

> These are enhancements for after Phases A–D are complete. Listed for
> roadmap positioning only.

### E-1: Canton-specific rule seeding
Seed cantonal rules for VD (Vaud), GE (Geneva), ZH (Zürich) — the three cantons
with highest tenant density and most divergent local rules. VD requires Formular B
for initial rent notification (F-P2-004). GE has rent control tribunal (Tribunal
des baux). ZH uses standard conciliation procedure.

### E-2: Precedent case database
Build a searchable database of Tribunal Federal (BGer) and cantonal court
decisions related to rent reductions. Each entry: case ref, date, defect category,
ruled reduction %, summary. Match against tenant claims to show "Similar cases
resulted in X% reduction."

### E-3: LLM-assisted defect classification (F-P3-002 prerequisite)
When the LLM Classification epic (F-P3-002) lands, wire it as an alternative
classifier alongside the keyword-based one. LLM handles ambiguous descriptions
("there's something growing on the wall"), multilingual input, and photo analysis.
Use keyword-based as fallback and confidence calibration.

### E-4: Proactive defect monitoring
Cross-reference `LegalEvaluationLog` entries per building to detect patterns:
"Building X has had 5 mould complaints in 12 months — systemic humidity issue."
Surface as a manager dashboard alert.

### E-5: Automated notification drafting
Generate the formal defect notification letter (Mängelanzeige) for the tenant
to send to the landlord, pre-filled with defect details, legal basis, requested
reduction, and 30-day response deadline. Available as downloadable PDF.

---

## Implementation Order Summary

```
A-1  Restore zeroed files ─────────────────────── prerequisite
 │
 ├── A-2  Variable resolver (S-P0-002-02) ──────── 0.5 day
 ├── A-3  Rent reduction rules in output ────────── 0.5 day
 │
 └── B-1  Keyword extraction ────────────────────── 1.5 days
      │
      └── B-2  Fuzzy defect matching ────────────── 1.5 days
           │
           └── B-3  Lease-aware reduction calc ──── 1 day
                │
                ├── C-1  Claim analysis service ─── 2 days
                │    │
                │    ├── C-2  API endpoint ──────── 0.5 day
                │    └── C-3  Multi-defect + temporal 1 day
                │
                └── D-1  API client types ──────── 0.5 day
                     │
                     ├── D-2  Frontend proxies ──── 0.5 day
                     ├── D-3  Manager dashboard ─── 1.5 days
                     └── D-4  Tenant analysis UI ── 1.5 days
```

**Total estimated effort:** 12–15 days (Phases A–D)

**Critical path:** A-1 → B-1 → B-2 → B-3 → C-1 → C-2 (7–8 days)

---

## Testing Strategy

| Phase | Test type | Count (est.) |
|---|---|---|
| A-2 | Integration (variable resolver) | 8–10 |
| A-3 | Unit (reduction output) | 5 |
| B-1 | Unit (keyword extraction) | 30+ |
| B-2 | Unit (fuzzy matching) | 25+ |
| B-3 | Unit (rent calculation) | 15+ |
| C-1 | Integration (claim analysis) | 10+ |
| C-2 | Integration (API endpoint) | 5+ |
| C-3 | Unit (multi-defect + temporal) | 10+ |

All tests must pass with `maxWorkers: 1` (serial integration tests — G10 guardrail).

---

## ROADMAP.json Entries to Update

| Existing ID | Update |
|---|---|
| S-P0-002-02 | Status → `in-progress` when A-2 starts |
| F-P3-002 | Note dependency on B-1 classifier interface |

| New IDs to create |
|---|
| F-LEH-001 (Legal Engine Hardening — Claim Analysis) — epic container for B/C/D |
| S-LEH-001-01 through S-LEH-001-12 — individual slices |

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Keyword classifier misses non-French/German complaints | Add EN keywords in B-1; plan LLM fallback in E-3 |
| ASLOCA reduction data is from 2007 — outdated? | Reductions are case-law precedents (still cited); note age in `citation` |
| Multi-defect aggregation caps are judicial practice, not statute | Document clearly as "typical range"; don't present as guaranteed |
| Working tree corruption re-occurs | Git hook to verify file sizes > 0 on pre-commit |
| Lease not linked to request (no `leaseId` on Request) | Resolve via unit → active lease chain (Request.unitId → Lease where status=ACTIVE + unitId) |
