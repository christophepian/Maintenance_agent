# Swiss Renovation Tax Classification — Implementation Prompts

## Suggested Execution Order

1. Prompt 1 — Discovery
2. Prompt 2 — Canonical catalog
3. Prompt 3 — Backend read model
4. Prompt 4 — UI
5. Prompt 5 — Timing guidance
6. Prompt 6 — Docs/tests
7. Prompt 7 — Finalize
8. Optional — Wireframe/prototype

---

## Prompt 1 — Discovery and Implementation Plan

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Before writing code:
1. Inspect the current building / property / unit renovation-related pages and identify exactly where asset lifecycle, inventory, maintenance, or depreciation-related UI is rendered.
2. Inspect any existing manager/admin inventory pages and shared components already used for:
   - asset inventory
   - depreciation / useful life
   - building components
   - maintenance planning
   - intervention logging
   - tax or financial insights
3. Inspect the backend source of truth for:
   - asset types / categories
   - depreciation standards
   - installedAt / usefulLife / age / remaining life
   - maintenance or renovation records
   - building-level aggregation
4. Inspect the current API routes, repositories, workflows, DTOs, and OpenAPI definitions related to:
   - inventory
   - assets
   - buildings / units
   - maintenance / interventions
   - financial or analytics read models
5. Review blueprint.js so you do not duplicate existing lifecycle, depreciation, or planning UI / API shape / shared component logic.
6. Output a short implementation plan before coding, including:
   - where asset lifecycle / depreciation data is currently computed
   - whether current pages already receive enough data
   - whether Swiss renovation tax classification should be modeled as backend canonical data, frontend presentation logic, or both
   - whether a backend DTO / read-model extension is needed
   - where the canonical mapping of Swiss maintenance jobs should live

Architecture rules:
- Keep routes thin.
- Put orchestration in workflows.
- Keep Prisma access in repositories.
- Keep status rules in transitions.
- Emit domain events only from workflows.
- If an API contract changes, update DTO / include / OpenAPI / api-client / tests together.
- Reuse existing shared UI patterns/components where possible.
- Do not create a second lifecycle/depreciation or renovation-classification system if one already exists.

**Slice name:** `swiss-renovation-tax-classification-foundation`

**Goal:**
Create the foundation for a Swiss renovation decision-support feature that:
- maps common renovation / maintenance jobs to Swiss tax categories
- distinguishes value-preserving vs value-enhancing vs mixed vs energy/environment
- supports accounting/tax-oriented decision support for privately owned rental buildings
- reuses existing asset lifecycle / depreciation standards where possible
- preserves existing inventory and intervention behavior

**Primary workflow affected:**
read-model / planning only unless existing workflows already support this cleanly

**In scope for this discovery step:**
- Find existing lifecycle/depreciation logic
- Find best canonical place for Swiss renovation mapping
- Identify whether property-level planning UI already exists
- Propose minimal-change implementation path

**Out of scope for this step:**
- No schema changes yet
- No UI implementation yet
- No new business rules yet
- No speculative refactors

**Required output before code:**
- Current lifecycle/depreciation data shape found
- Existing related UI pattern/components found
- Whether backend changes are needed or UI-only is sufficient
- Best files/modules to change
- Any relevant open audit items
- Short implementation plan

---

## Prompt 2 — Add the Canonical Swiss Renovation Classification Source of Truth

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

You are implementing the next slice after discovery.

Use the implementation plan already established. Do not re-architect unless required for consistency with the repo.

**Slice name:** `swiss-renovation-tax-classification-catalog`

**Goal:**
Add a canonical, reusable Swiss renovation classification catalog for privately owned rental buildings.

**Business objective:**
The system must be able to classify common building works into one of:
- VALUE_PRESERVING
- VALUE_ENHANCING
- MIXED
- ENERGY_ENVIRONMENT

It must also support accounting/tax-oriented treatment guidance:
- immediate deduction likely
- capitalization likely
- split treatment likely
- useful explanatory notes / fallback behavior

**Important:**
This is not a final tax engine and must not claim legal certainty.
It is a structured decision-support catalog.

**Architecture requirements:**
- Keep routes thin.
- Keep domain logic in a canonical backend module / service / workflow layer, not duplicated in the frontend.
- If similar static standards/config already exist for depreciation/useful life, reuse that pattern.
- Do not hardcode the mapping in multiple places.
- Prefer a typed canonical catalog / helper used by API read models and frontend consumers.
- Preserve existing behavior.

**Implement a canonical mapping for at least these common renovation jobs and their usual Swiss treatment:**

### Facade / exterior
1. exterior repainting of façade → VALUE_PRESERVING → immediately deductible likely
2. façade cleaning → VALUE_PRESERVING → immediately deductible likely
3. façade recladding replacing simple repainting → MIXED → split treatment likely
4. natural-stone façade renovation → VALUE_PRESERVING → immediately deductible likely
5. façade thermal insulation → ENERGY_ENVIRONMENT → immediately deductible likely

### Windows / openings
6. repair or like-for-like window replacement → VALUE_PRESERVING
7. upgraded energy-efficient window replacement → ENERGY_ENVIRONMENT
8. new unheated entrance vestibule / windbreak for efficiency → ENERGY_ENVIRONMENT
9. new awnings / new sun blinds where none existed or enhanced amenity → VALUE_ENHANCING
10. repair / like-for-like replacement of awnings / sun blinds → VALUE_PRESERVING
11. new shutters / roller shutters primarily for thermal benefit → ENERGY_ENVIRONMENT
12. repair / like-for-like replacement of shutters / roller shutters → VALUE_PRESERVING

### Roof / terrace / balcony
13. terrace waterproofing + replacement finish → MIXED
14. terrace / balcony repair like-for-like → VALUE_PRESERVING
15. thermal insulation of terrace floor → ENERGY_ENVIRONMENT
16. roof repair / like-for-like reroofing → VALUE_PRESERVING
17. roof thermal insulation improvement → ENERGY_ENVIRONMENT
18. attic conversion into habitable space → VALUE_ENHANCING

### Interior finishes
19. interior repainting / plaster repair / like-for-like wall & ceiling work → VALUE_PRESERVING
20. interior insulation of façade walls / cellar ceiling → ENERGY_ENVIRONMENT
21. floor finish replacement like-for-like, including modest modernization → VALUE_PRESERVING
22. significantly higher-spec interior finishes → MIXED

### Garage / stairs / common areas
23. garage door repair or like-for-like replacement → VALUE_PRESERVING
24. garage door upgrade adding new automation / enhanced functionality → MIXED
25. stair / stairwell repair like-for-like → VALUE_PRESERVING
26. replacing simple stairs with substantially upgraded construction → MIXED
27. new elevator installation → VALUE_ENHANCING
28. elevator repair / service / like-for-like replacement → VALUE_PRESERVING

### Bathroom / kitchen / appliances
29. bathroom fixture replacement like-for-like → VALUE_PRESERVING
30. bathroom full modernization with comfort enhancement → MIXED
31. kitchen repair or like-for-like replacement → VALUE_PRESERVING
32. kitchen replacement with meaningful upgrade in standard → MIXED
33. first-time installation of a proper fitted kitchen → VALUE_ENHANCING or MIXED depending on existing system; encode with a note and conservative default
34. appliance replacement like-for-like (fridge, oven, dishwasher, washer/dryer replacing existing installed units) → VALUE_PRESERVING
35. first-time appliance installation where none existed → VALUE_ENHANCING

### MEP / utilities
36. water / wastewater line repair like-for-like → VALUE_PRESERVING
37. new water / wastewater lines adding capability → VALUE_ENHANCING
38. electrical repair / like-for-like rewiring replacement → VALUE_PRESERVING
39. new electrical installations adding new capability → VALUE_ENHANCING
40. heating system repair / like-for-like replacement → VALUE_PRESERVING
41. energy-saving heating improvements (pipe insulation, thermostatic valves, metering, efficiency upgrades) → ENERGY_ENVIRONMENT
42. heating enhancements without efficiency rationale (additional radiators, decorative fireplace) → VALUE_ENHANCING
43. boiler replacement like-for-like → VALUE_PRESERVING
44. larger or functionally enhanced boiler upgrade → MIXED
45. district heating connection replacing existing system for efficiency → ENERGY_ENVIRONMENT
46. ventilation / AC repair like-for-like → VALUE_PRESERVING
47. measures reducing need for cooling / improving efficiency → ENERGY_ENVIRONMENT

### Laundry / exterior / grounds
48. washer/dryer repair or like-for-like replacement in common laundry → VALUE_PRESERVING
49. first-time washer/dryer installation → VALUE_ENHANCING
50. ordinary garden / grounds maintenance → VALUE_PRESERVING
51. new landscaping / amenity upgrade / luxury exterior works → VALUE_ENHANCING

**For each catalog entry include fields along these lines, adapted to existing project conventions:**
- code
- label
- aliases / searchable terms
- buildingSystem or assetTopic if useful
- taxCategory
- accountingTreatment
- typicalDeductibility
- notes
- examples
- confidence or guidance level if there is an existing pattern for this type of metadata
- whether the item can be asset-linked
- whether the item is timing-sensitive for tax planning

**Implementation requirements:**
- Reuse existing enums/patterns where possible
- If new enum/constants are required, place them canonically
- Add a typed helper for looking up a classification by asset type / renovation type / normalized label
- Add robust fallback behavior when no mapping exists
- Keep wording neutral: "likely", "typical", "usual treatment", not legal guarantees
- Preserve backward compatibility

**Required output before code:**
- Canonical file(s) chosen for the catalog
- Lookup strategy
- Any existing types/enums reused
- Any API/read-model implications
- Short implementation plan

**Definition of done:**
- Canonical Swiss renovation catalog exists in one place
- Lookup helper exists and is typed
- No duplicate catalog copies are introduced
- Existing behavior preserved
- Tests added for representative mappings and fallbacks

---

## Prompt 3 — Expose Classification in the Backend Read Model

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Implement the backend read-model slice that exposes Swiss renovation classification and accounting guidance to the frontend.

Use the canonical catalog already added. Do not duplicate classification logic in route handlers or frontend files.

**Slice name:** `swiss-renovation-tax-classification-read-model`

**Goal:**
Extend the relevant property / building / unit / asset planning endpoint(s) so the frontend can render renovation classification and tax/accounting guidance consistently.

**Primary workflow affected:**
read-model only

**Files to modify — in this order:**
1. repositories / query builders for the relevant inventory / property / asset read model
2. route handlers only if endpoint response needs to expose additional fields
3. DTOs / OpenAPI / api-client / tests if API contract changes
4. any shared read-model transformers

**What the frontend should receive for each relevant planned or suggested renovation item:**
- classification code / key
- human label
- taxCategory
- accountingTreatment
- typicalDeductibility
- notes
- examples or explanation text if that fits existing API conventions
- whether it is timing-sensitive
- linked asset id / asset type if applicable
- whether classification is derived from asset type, user-selected job type, or free text fallback
- fallback state when no mapping is found

**If there is already a building asset lifecycle read model:**
- prefer enriching that existing read model instead of creating a second parallel endpoint

**If there is already a renovation / intervention DTO:**
- extend the canonical DTO rather than inventing a separate shape

**Implementation requirements:**
- Keep routes thin
- Keep lookup/orchestration out of routes
- Keep repository access in repositories
- If contract changes, update DTO / OpenAPI / api-client / tests together
- Preserve backwards compatibility when fields are absent
- Do not compute Swiss classification in the frontend if the backend can provide it canonically
- Gracefully handle unmapped jobs with a clear fallback object rather than throwing

**Required output before code:**
- Which endpoint/read model will be extended
- Current response shape
- Proposed added fields
- Whether this is backward compatible
- Files to change
- Short plan

**Definition of done:**
- Relevant endpoint returns canonical renovation classification info
- DTOs/OpenAPI/api-client/tests updated together if contract changed
- Unmapped items fail gracefully
- Existing consumers continue to work

---

## Prompt 4 — Build the Renovation Decision-Support UI

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Implement the frontend UI for Swiss renovation decision support using the backend canonical read model and existing shared visual patterns.

**Slice name:** `swiss-renovation-decision-support-ui`

**Goal:**
Add a property-level dashboard/panel that helps owners or managers understand:
- what renovation jobs are usually value-preserving vs value-enhancing
- whether a job is usually immediately deductible, capitalized, mixed, or energy/environment
- how the work should usually be accounted for
- whether timing is likely to matter for taxation
- how this interacts with asset useful life and replacement planning

**Primary workflow affected:**
none; read-only planning UI

**Before coding:**
1. Inspect existing dashboard / property detail / inventory detail pages to determine best insertion point.
2. Inspect shared UI components for:
   - progress bars / lifecycle meters
   - badges / status pills
   - grouped panels / tables / cards
   - asset detail rows
   - warning / fallback states
3. Reuse existing manager inventory depreciation visual language where possible.

**In scope:**
- A decision-support panel or tab for a building/property
- A renovation table/list/cards showing:
  - renovation job
  - linked asset/system
  - tax category
  - accounting treatment
  - deductible/capitalized/mixed indicator
  - timing sensitivity
  - notes / explanation
  - useful-life context if linked to an asset
- Clear fallback for unmapped jobs
- Consistent visual language with existing depreciation/useful-life UI
- Non-legal, guidance-oriented wording

**Out of scope:**
- No legal/tax filing workflow
- No manual override workflow unless already supported
- No redesign of unrelated inventory pages
- No duplication of lifecycle/depreciation UI

**UI requirements:**
- Make the classification easy to understand at a glance
- Use badges/pills for:
  - Value preserving
  - Value enhancing
  - Mixed
  - Energy / environment
- Show accounting treatment in plain language, such as:
  - "Usually expensed in current year"
  - "Usually capitalized"
  - "Usually split between maintenance and improvement"
  - "Usually deductible as energy/environment measure"
- Show a concise note for ambiguity-sensitive items
- If linked to an asset with lifecycle data, show:
  - install date
  - useful life
  - age / time in service
  - remaining useful life
  - fully depreciated / end-of-life indicator
- Gracefully handle:
  - missing installedAt
  - missing useful life standard
  - missing Swiss mapping
- Preserve existing grouping/filtering/intervention behavior on relevant pages

**Preferred features:**
- Filter by tax category
- Filter by timing sensitivity
- Filter by linked asset system
- Search by renovation job

**Required output before code:**
- Target page/component
- Existing shared UI patterns reused
- Data fields consumed from backend
- Whether any additional frontend-only helper is needed
- Files to change
- Short implementation plan

**Definition of done:**
- Users can clearly see usual Swiss classification for common renovation jobs
- UI is consistent with existing lifecycle/depreciation patterns
- Missing data fails gracefully
- Existing inventory behavior still works

---

## Prompt 5 — Timing Guidance Without Full Income Data

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Implement a guidance-oriented timing panel for renovation decisions that does not require the owner's full taxable income.

**Slice name:** `swiss-renovation-timing-guidance`

**Goal:**
Provide useful timing guidance under uncertainty, not precise tax optimization.

**Business principle:**
Because the system usually does not know the owner's full taxable income, the UI must avoid pretending to compute exact tax-optimal timing. Instead, it should help the user understand:
- whether timing likely matters a lot or a little
- whether the project is mostly deductible vs mostly capitalized
- whether the project is likely better aligned with a high-income year
- whether timing is not very tax-sensitive because treatment is capitalized
- whether operational urgency may outweigh timing considerations

**Important:**
Do not build a fake exact tax engine.
Use decision-support wording and scenario ranges.

**In scope:**
- Add a timing guidance card/panel for each renovation project or grouped plan
- Show guidance such as:
  - "Timing likely matters a lot"
  - "Timing likely matters moderately"
  - "Timing likely matters little"
- Base this on:
  - tax category
  - accounting treatment
  - deductible share if known
  - mixed vs capitalized treatment
  - linked asset urgency / end-of-life status
- Add neutral language such as:
  - "Usually more relevant to schedule in a higher-income year"
  - "Timing is often less tax-sensitive because the work is usually capitalized"
  - "Operational risk may justify proceeding even if timing is not ideal"

**Optional if there is already a suitable pattern:**
- Add scenario chips:
  - Low-tax-year
  - Medium-tax-year
  - High-tax-year
- Show directional guidance rather than exact tax amounts unless an existing scenario engine already exists

**Do not require:**
- full owner taxable income
- exact marginal rate
- canton-specific simulation unless already present in the codebase

**Implementation requirements:**
- Reuse existing asset urgency / lifecycle signals where possible
- Do not compute exact personal tax outcomes
- Keep wording cautious and decision-support oriented
- Preserve existing behavior
- Prefer a shared helper for timing guidance instead of scattering conditions across components

**Required output before code:**
- Where timing guidance logic will live
- Inputs available from current data
- Any required helper/component
- Files to change
- Short implementation plan

**Definition of done:**
- Users can tell whether timing materially matters even without full income data
- Guidance does not overclaim certainty
- Asset urgency and tax classification are shown together coherently

---

## Prompt 6 — Classification Docs, Guardrails, and Tests

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Implement documentation and internal discoverability for the Swiss renovation classification system so future contributors do not duplicate or drift from the canonical source.

**Slice name:** `swiss-renovation-classification-docs-and-guardrails`

**Goal:**
Document where the Swiss renovation classification catalog lives, how it should be used, and how new job types should be added.

**In scope:**
- Add/update blueprint/docs references so the classification source of truth is discoverable
- Document:
  - canonical file/module location
  - classification categories
  - accounting treatment meanings
  - fallback behavior
  - how frontend consumers should use the backend read model
  - how to add new renovation jobs safely
- Mention that the mapping is decision-support guidance, not legal certainty
- Mention that frontend must not duplicate the catalog or infer a separate classification system

**Also add tests covering:**
- representative value-preserving cases
- representative value-enhancing cases
- representative mixed cases
- representative energy/environment cases
- unknown/unmapped fallback
- UI rendering fallbacks where applicable

**Required output before code:**
- Files to update
- Docs sections to add
- Test coverage plan
- Short implementation plan

**Definition of done:**
- Docs/blueprint reference the canonical Swiss renovation classification source
- Tests cover representative mappings and fallbacks
- Future contributors can extend the system without duplicating logic

---

## Prompt 7 — End-to-End Polish and Verification

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Perform the final integration and verification pass for the Swiss renovation classification feature.

**Slice name:** `swiss-renovation-classification-finalize`

**Goal:**
Ensure the full feature is coherent, minimal, and consistent with the architecture.

**Checklist:**
1. Confirm there is only one canonical renovation classification catalog.
2. Confirm routes remain thin.
3. Confirm repositories only do data access.
4. Confirm any orchestration/classification logic lives in canonical backend helper/service/workflow layer.
5. Confirm frontend reuses backend classification data rather than recomputing.
6. Confirm lifecycle/depreciation UI patterns are reused where appropriate.
7. Confirm unknown jobs / missing install dates / missing useful life / missing mappings fail gracefully.
8. Confirm existing inventory/grouping/filter/intervention behavior still works.
9. Confirm docs and blueprint references are updated if required.
10. Run and fix:
    - `npx tsc --noEmit`
    - `npm test`
    - `npm run blueprint`

**Required output before code changes:**
- Short final verification plan
- Remaining issues/risk list, if any

**Definition of done:**
- Typecheck clean
- Tests pass
- Blueprint/docs sync clean
- Feature works without duplicate logic
- Existing behavior preserved

---

## Optional Prompt — Build a Wireframe/Prototype Page First

Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md (lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js. Obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.

Create a low-risk prototype of the Swiss renovation decision-support UI using mocked data wired through existing page/component patterns before integrating with live backend data.

**Goal:**
Validate layout, grouping, and visual language for:
- renovation job classification
- accounting treatment
- timing sensitivity
- linked asset useful-life state

**Requirements:**
- Reuse existing UI patterns/components
- Do not add a second data model
- Keep prototype isolated behind a clearly non-production route, story, or feature flag consistent with the codebase
- Make it easy to swap mocked data for canonical backend data later
- Keep styling aligned with the app

**Output before coding:**
- Target prototype location
- Shared components reused
- Mock data shape aligned to intended canonical API shape
- Files to change
- Short implementation plan
