# Legal Knowledge & Decision Engine (LKDE) Epic

You are working in the monorepo described in PROJECT_STATE.md.
All code must comply with the guardrails and architecture described there.

Follow all guardrails G1–G10 and hardening rules H1–H6.

## Critical Guardrails (Non-negotiable)

### Database

- Never use `prisma db push`.
- Always use:

```bash
npx prisma migrate dev --name <migration_name>
```

- After schema changes run drift check:

```bash
npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```

- Expected output:

```
-- This is an empty migration.
```

- Run:

```bash
npx prisma generate
```

### Org scoping (very important)

- `Request` has no `orgId`.
- Therefore:
  - **Never filter Request by orgId.**
  - For request-scoped operations use:

```ts
resolveRequestOrg(prisma, requestId)
assertOrgScope(ctx.orgId, resolvedOrgId, "Request")
```

- This rule must be followed in all services and routes.

### Route protection

- All routes must use wrappers.
- Public GET routes are no longer allowed.
- Use:

```ts
withAuthRequired(...)
withRole(Role.MANAGER, ...)
```

- Examples:
  - `/requests/:id/legal-decision` → `withAuthRequired`
  - `/legal/rules` mutation → `withRole(Role.MANAGER, ...)`
- Do not implement inline auth checks.

### Canonical includes

- All Prisma queries used to return DTOs must use canonical include constants.
- Example pattern already used in repo:

```ts
JOB_INCLUDE
LEASE_INCLUDE
INVOICE_INCLUDE
```

- For this epic create:

```ts
REQUEST_LEGAL_DECISION_INCLUDE
RFP_INCLUDE
```

- DTO mappers must only read fields included by those includes.

### DTO discipline (G3)

- Never access relations not included in the query.

### CI determinism

- External APIs must never be called in tests.
- Legal ingestion must be implemented with mockable fetchers.
- Tests must inject stub fetchers.

### RFP behavior constraint

- RFP creation must be a sidecar workflow.
- It must:
  - **NOT** create a Job
  - **NOT** change Request status
  - **NOT** break the Request → Job lifecycle
- It only represents a procurement step.

---

## Epic Goal

Implement a **Legal Knowledge & Decision Engine (LKDE)** that:

1. Maintains a dynamic legal repository
2. Evaluates legal obligations for tenant requests
3. Computes asset depreciation signals
4. Produces explainable decisions with citations
5. Automatically creates an RFP when a legal obligation exists

> Legal obligation is only one signal; owner/manager retains final arbitration.

---

## Scope

### 1 — Legal Repository

Create models supporting:

- legal sources
- variables (dynamic values)
- legal rules
- evaluation logs

All must be versioned and auditable.

**Authority levels:**

- `STATUTE`
- `INDUSTRY_STANDARD`

Statutes produce **obligation** signals.
Industry standards (like depreciation schedules) produce **advisory** signals only.

**Precedence:**

Decision precedence:

1. Statutory law
2. Ordinances
3. Lease terms
4. Org / building policy
5. Industry standards

---

## Prisma Schema Changes

**Migration name:**

```
add_legal_engine_assets_depreciation_rfp
```

### Building

Add:

```prisma
canton          String?
cantonDerivedAt DateTime?
```

Canton is derived from postal code using a local dataset, never an external API.

Only derive if:

- `canton` is null
- postal code matches `^\d{4}$`
- mapping exists

Never overwrite manual values.

---

### Legal Repository Models

#### Enums

```prisma
enum LegalAuthority {
  STATUTE
  INDUSTRY_STANDARD
}

enum LegalRuleType {
  MAINTENANCE_OBLIGATION
  DEPRECIATION
  RENT_INDEXATION
  TERMINATION_DEADLINE
}

enum LegalObligation {
  OBLIGATED
  DISCRETIONARY
  TENANT_RESPONSIBLE
  UNKNOWN
}
```

#### LegalSource

Tracks external authorities.

Fields:

- `id`
- `name`
- `jurisdiction`
- `url`
- `updateFrequency`
- `fetcherType`
- `parserType`
- `status`
- `lastCheckedAt`
- `lastSuccessAt`
- `lastError`
- `createdAt`
- `updatedAt`

#### LegalVariable

Example variables:

- `REFERENCE_INTEREST_RATE`
- `CPI_INDEX`

Fields:

- `id`
- `key`
- `jurisdiction`
- `canton?`
- `unit`
- `description`
- `createdAt`
- `updatedAt`

#### LegalVariableVersion

- `id`
- `variableId`
- `effectiveFrom`
- `effectiveTo?`
- `valueJson`
- `sourceId`
- `fetchedAt`
- `createdAt`

#### LegalRule

- `id`
- `key`
- `ruleType`
- `authority`
- `jurisdiction`
- `canton?`
- `priority`
- `isActive`
- `createdAt`
- `updatedAt`

#### LegalRuleVersion

- `id`
- `ruleId`
- `effectiveFrom`
- `effectiveTo?`
- `dslJson`
- `citationsJson`
- `summary`
- `createdAt`

> Rules must be deterministic JSON DSL (no LLM reasoning).

#### LegalEvaluationLog

Stores decision audits.

- `id`
- `orgId`
- `buildingId?`
- `unitId?`
- `requestId?`
- `contextJson`
- `contextHash`
- `resultJson`
- `matchedRuleVersionIdsJson`
- `createdAt`

### Category Mapping

Request categories may not be stable.

Create mapping table:

#### LegalCategoryMapping

Fields:

- `id`
- `orgId?`
- `requestCategory`
- `legalTopic`
- `isActive`

Mapping priority:

1. org-specific
2. global default

---

### Asset Model

Introduce generic `Asset` model.

Existing `Appliance` remains temporarily.

#### AssetType enum

```prisma
enum AssetType {
  APPLIANCE
  FIXTURE
  FINISH
  STRUCTURAL
  SYSTEM
  OTHER
}
```

#### Asset

- `id`
- `orgId`
- `unitId`
- `type`
- `topic`
- `name`
- `assetModelId?`
- `installedAt?`
- `lastRenovatedAt?`
- `isActive`
- `createdAt`
- `updatedAt`

Examples of topics:

- `PAINT_WALLS`
- `FLOORING`
- `WINDOWS`
- `DISHWASHER`

---

### Depreciation Standard

#### DepreciationStandard

Fields:

- `id`
- `jurisdiction`
- `canton?`
- `authority`
- `assetType`
- `topic`
- `usefulLifeMonths`
- `notes`
- `sourceId?`
- `createdAt`
- `updatedAt`

> Authority must be `INDUSTRY_STANDARD`.

---

### RFP Models

#### Rfp

- `id`
- `orgId`
- `buildingId`
- `unitId?`
- `requestId?`
- `category`
- `legalObligation`
- `status`
- `inviteCount`
- `deadlineAt?`
- `awardedContractorId?`
- `createdAt`
- `updatedAt`

Statuses:

```
DRAFT
OPEN
CLOSED
AWARDED
CANCELLED
```

#### RfpInvite

- `id`
- `rfpId`
- `contractorId`
- `status`
- `createdAt`

Statuses:

```
INVITED
DECLINED
RESPONDED
```

#### RfpQuote

- `id`
- `rfpId`
- `contractorId`
- `amountCents`
- `notes`
- `submittedAt`
- `createdAt`

### Config Parameter

Add to building config:

```
rfpDefaultInviteCount Int?
```

Fallback to org-level default.

---

## Services

Create services in:

```
apps/api/src/services/
```

### depreciation.ts

```ts
computeDepreciationSignal(asset, asOfDate)
```

Return:

- `usefulLifeMonths`
- `ageMonths`
- `remainingLifePct`
- `fullyDepreciated`
- `basisAuthority`

### legalDecisionEngine.ts

Main entry:

```ts
evaluateRequestLegalDecision(orgId, requestId)
```

Steps:

1. resolve org scope via `resolveRequestOrg`
2. load request via canonical include
3. derive canton if needed
4. map `Request.category` → `legalTopic`
5. evaluate statutory rules
6. compute depreciation signal
7. produce `DecisionResult`
8. write `LegalEvaluationLog`

### rfps.ts

```ts
createRfpForRequest(requestId, decision)
```

- Must be idempotent.
- Contractor selection:
  - contractors matching request category
- Invite count:
  - `buildingConfig` → `orgConfig` fallback

### legalIngestion.ts

Implements fetchers for:

- `REFERENCE_INTEREST_RATE`
- `CPI_INDEX`

Requirements:

- fetchers must be injectable
- tests must stub them
- no external HTTP in CI

Provide manual trigger endpoint.

---

## Routes

Add new router:

```
routes/legal.ts
```

Register in `server.ts`.

### Decision Endpoint

```
GET /requests/:id/legal-decision
```

Protection:

- `withAuthRequired`

Returns:

- `LegalDecisionDTO`

If obligation = `OBLIGATED`:

- `createRfpForRequest(...)`

Ensure idempotency.

### RFP Endpoints

```
GET /rfps
GET /rfps/:id
```

Protected with `withAuthRequired`.

### Admin Endpoints

Protected with:

```ts
withRole(Role.MANAGER)
```

Routes:

- `/legal/sources`
- `/legal/variables`
- `/legal/rules`
- `/legal/category-mappings`
- `/legal/depreciation-standards`
- `/legal/evaluations`

---

## DTOs

Add DTOs:

- `LegalDecisionDTO`
- `DepreciationSignalDTO`
- `RfpDTO`
- `RfpInviteDTO`
- `RfpQuoteDTO`

Decision result must contain:

- `legalTopic`
- `legalObligation`
- `confidence`
- `reasons[]`
- `citations[]`
- `depreciationSignal?`
- `recommendedActions[]`
- `rfpId?`

---

## OpenAPI + Typed Client

Update:

- `apps/api/openapi.yaml`
- `packages/api-client`

Add client method:

```ts
api.legal.getRequestDecision(requestId)
```

---

## Frontend

Add pages:

- `/manager/legal`
- `/manager/legal/rules`
- `/manager/legal/mappings`
- `/manager/legal/depreciation`
- `/manager/legal/evaluations`
- `/manager/rfps`

Use Next proxy routes with `proxyToBackend`.

> Do not modify global manager styles.

---

## Tests

Add integration tests:

- `legalDecisionEngine.test.ts`
- `depreciation.test.ts`
- `rfpCreation.test.ts`

Test:

- obligation triggers RFP
- idempotent RFP creation
- depreciation signals
- rule precedence
- canton fallback

---

## Non-Goals

Do not implement:

- PDF legal document storage
- LLM legal reasoning
- deposit law
- dispute resolution workflows
- multi-country support

---

## Implementation Order

1. Prisma migration
2. canonical includes
3. asset + depreciation services
4. legal rule evaluation
5. decision endpoint
6. RFP creation
7. ingestion services
8. admin UI
