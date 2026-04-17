# Implementation Queue — Ready to Execute

> Generated: 2026-04-17  
> Source of truth: `ROADMAP.json` (promoted tickets)  
> Each ticket below is fully specified and unblocked.

**Ranked by user value (highest first):**

| # | Ticket | Scope | Effort |
|---|--------|-------|--------|
| 1 | [DT-017](#dt-017--clickable-table-rows--action-button-column) | Clickable rows + action column across all hub tables | M |
| 2 | [DT-117](#dt-117--tenant-photo-upload-in-request-creation-form) | Tenant photo upload inline in request form | S |
| 3 | [DT-119](#dt-119--owner-finance-accordion-deeplink-from-dashboard) | Accordion deeplink + dashboard link update | S |
| 4 | [DT-115](#dt-115--wire-categorymappings-into-manager-settings-legal-tab) | Wire CategoryMappings into settings Legal tab | XS |
| 5 | [DT-118](#dt-118--owner-rfp-list-clickable-rows-to-detail-page) | Owner RFP list clickable rows | XS |
| 6 | [INT-023](#int-023--pre-fill-invoice-creation-from-lease-tenant-fields) | Pre-fill invoice modal from lease tenant address | S |
| 7 | [INT-018](#int-018--vacancies-view-segmented-control-by-pipeline-stage) | Vacancies segmented control by pipeline stage | M |
| 8 | [INT-020](#int-020--tenant-selection-dropdown-fallback-in-candidate-dropzones) | Candidate dropzone dropdown fallback | S |
| 9 | [INT-011](#int-011--in-page-iframe-preview-for-all-attached-documents) | In-page iframe preview for attached documents | M |
| 10 | [DT-013](#dt-013--manager-reports-page-scaffold) | Manager /reports page scaffold + Overview KPI tab | M |
| 11 | [DT-021](#dt-021--repair-vs-replace-sensitivity-input) | Repair vs replace sensitivity input (UI only) | S |
| 12 | [DT-015](#dt-015--remaining-route-layer-violations) | Extract remaining direct Prisma calls from routes | M |

---

## DT-017 — Clickable table rows + action button column

**What exists today:** `manager/requests.js` and `manager/inventory.js` pass `onRowClick` to `ConfigurableTable`. All other manager hub pages with tabular data have no row-click behaviour. "View" CTAs currently sit as text links in the last column.

**What this adds:** Row-click navigation on all remaining hub tables. Replaces the "View" CTA link in the last column with a unified action button (chevron icon or "•••" placeholder) using `stopPropagation`, consistent with the requests page pattern.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly. Preserve existing behaviour unless explicitly required for
consistency.

Before writing code:
1. Read apps/web/pages/manager/requests.js — this is the reference implementation for
   onRowClick + stopPropagation on action buttons. Identify the exact pattern used.
2. Read apps/web/components/ConfigurableTable.js — confirm the onRowClick prop signature
   (row => void), how cursor-pointer is applied, and how stopPropagation should be applied
   to cells that contain action buttons.
3. For each of the following pages, identify:
   - the current "View" CTA or navigation link in the last column
   - the destination route it navigates to
   - whether ConfigurableTable or an inline <table> is used
   Pages: apps/web/pages/manager/rfps.js, billing-schedules.js, work-requests.js,
   assets.js, emails.js, properties.js.
   Skip pages that already have onRowClick (requests.js, inventory.js) and pure-form
   pages (settings.js, reports.js).
4. Output a short implementation plan: which pages need changes, what destination each
   row-click should navigate to, and whether any page uses a raw <table> that would
   require switching to ConfigurableTable or adding inline click handlers.

Architecture rules:
- No backend changes. This is frontend-only.
- Keep routes thin. No business logic in pages.
- Reuse ConfigurableTable.onRowClick exactly as used in requests.js.
- If a page uses a raw <table> (not ConfigurableTable), add an onClick handler directly
  to the <tr> element with cursor-pointer; do not refactor to ConfigurableTable unless it
  is the cleanest approach.
- Action buttons inside a row must call e.stopPropagation() before their own handler.
- Do not remove or relocate any existing action buttons. The action column remains.
  The only change to the action column is: replace plain text "View" links with a
  consistent icon button (e.g. chevron-right SVG or "→") that still navigates to the
  same destination.

Slice name: clickable-table-rows
Goal: Add onRowClick navigation to all manager hub tables that currently lack it.
Replace "View" CTA text links in the last column with a small icon-only action button
that uses stopPropagation. Leave a comment // ACTION_PLACEHOLDER in the action column
of pages where the specific per-row actions have not been defined yet, so they can be
filled in per-page in a follow-up.

Primary workflow affected: none — read-only navigation

Files to modify — in this order:
1. apps/web/pages/manager/rfps.js
2. apps/web/pages/manager/billing-schedules.js
3. apps/web/pages/manager/work-requests.js
4. apps/web/pages/manager/assets.js (if it has a tabular list)
5. apps/web/pages/manager/properties.js (if it has a tabular list)
Only modify pages that have tabular data with a "View" link or missing row click.

Auth: no changes

In scope:
- onRowClick on all hub table rows that navigate to a detail page
- Replace "View" text CTA in last column with an icon-only button using stopPropagation
- Consistent cursor-pointer + hover on clickable rows
- Comment ACTION_PLACEHOLDER where per-row action menu is not yet defined

Out of scope:
- No new action menus or dropdowns
- No changes to requests.js or inventory.js (already done)
- No backend changes
- No redesign of page layout or table columns
- No tab navigation changes

Implementation requirements:
- Use router.push() (Next.js useRouter) for navigation from onRowClick.
- The action button in the last column is icon-only with aria-label="View [entity]".
- stopPropagation must be called in the onClick of the action button wrapper, not on
  the icon SVG itself.
- Follow F-UI4 styling: no inline styles, use cn() for conditional classes.
- Do not introduce new CSS classes; use existing cursor-pointer and hover:bg-slate-50
  Tailwind utilities.

Required output before code:
- List of pages being modified with their row-click destination routes
- Confirmation of whether each uses ConfigurableTable or raw <table>
- Any page where the destination route is ambiguous

Definition of done:
- npx tsc --noEmit — 0 errors
- Clicking any row in the listed pages navigates to the correct detail route
- Action buttons in the row still work and do not trigger row navigation
- Existing column layout and content unchanged
- aria-label present on all icon-only action buttons
```

---

## DT-117 — Tenant photo upload in request creation form

**What exists today:** `AttachmentsSection` in `apps/web/pages/tenant/requests.js` (line ~187) is a self-contained component that uploads photos **after** the request is submitted. The request creation form is a separate section lower in the same file. Files chosen before submission are not attached to the new request.

**What this adds:** A photo attachment input inside the request creation form. After `POST /api/tenant-portal/requests` returns the new `requestId`, the handler immediately uploads any pending files to `/api/tenant-portal/maintenance-attachments/${requestId}` before closing the form.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly. Preserve existing behaviour unless explicitly required for
consistency or safety.

Before writing code:
1. Read apps/web/pages/tenant/requests.js in full.
   - Identify the request creation form: its state variables, the handleSubmit function,
     the POST call to /api/tenant-portal/requests, and where the form closes after success.
   - Identify the AttachmentsSection component in the same file: how it calls
     POST /api/tenant-portal/maintenance-attachments/${requestId}, the FormData shape
     it uses, and what error handling it applies.
2. Read apps/web/pages/api/tenant-portal/maintenance-attachments/[requestId].js
   to confirm the proxy route for POST (multipart/form-data upload).
3. Read apps/web/pages/api/tenant-portal/maintenance-attachments/[requestId]/[id].js
   or equivalent to understand the GET/download proxy if needed.
4. Output a short implementation plan:
   - Exact location in the form where the file input should appear
   - Exact POST sequence: create request → get requestId → upload files → close form
   - Error handling: what happens if upload fails after request is already created
   - Whether AttachmentsSection needs to change at all (answer: no — it remains for
     the post-submission view; the new input is a separate simpler control in the form)

Architecture rules:
- No backend changes. Both routes already exist.
- Keep routes thin. No business logic in pages.
- Do not extract a new component unless the same upload-in-form pattern appears in more
  than one place. For now, inline the file input and upload logic directly in the
  existing form handler.
- Use requireTenantSession pattern already established in the page.
- Emit no domain events from the frontend.

Slice name: tenant-inline-photo-upload
Goal: Allow tenants to attach photos/files to a maintenance request at creation time,
not only after submission.

Primary workflow affected: none — tenant maintenance attachment upload already exists

Files to modify — in this order:
1. apps/web/pages/tenant/requests.js
   - Add pendingFiles state (useState<File[]>([]))
   - Add a file input (<input type="file" multiple accept="image/*,.pdf">) inside the
     request creation form, styled consistently with the AttachmentsSection upload button
   - In handleSubmit, after receiving the new requestId, loop over pendingFiles and POST
     each to /api/tenant-portal/maintenance-attachments/${requestId} using FormData
   - Clear pendingFiles on form success or cancel
   - If any upload fails, show an inline error (do not block the request that was
     already created; the tenant can still upload from AttachmentsSection afterwards)
   - Show a small file list preview (filename + size) of selected files before submit

Auth: no changes (uses existing tenant session cookie flow)

In scope:
- File input inside the request creation form
- Upload each file sequentially after request is created
- File name + size preview in the form (no thumbnail needed)
- Clear selection on form reset
- Non-blocking error: if upload fails, show "Request created; photo upload failed.
  You can retry from the request detail." — do not undo the request creation

Out of scope:
- No upload progress bar (show a simple spinner or "Uploading…" text)
- No drag-and-drop
- No file type server-side validation changes
- No changes to AttachmentsSection component (remains for post-submission use)
- No new proxy routes

Implementation requirements:
- Maximum 3 files selectable in one submission (add maxFiles guard with user-visible
  error if exceeded).
- File size validation: reject files > 10 MB client-side with a clear inline message.
- accept="image/*,.pdf" consistent with AttachmentsSection.
- The upload loop runs sequentially (await each) to avoid race conditions.
- Use the same tenantFetch() helper already used elsewhere in the file.
- Style the file input and file list using existing Tailwind utilities (filter-input,
  text-xs text-slate-600 etc.); no new CSS classes.

Required output before code:
- Exact line in requests.js where the file input should be inserted in the form JSX
- The precise POST call shape (FormData field names) matching the proxy
- How upload errors are surfaced without blocking the form close sequence

Definition of done:
- npx tsc --noEmit — 0 errors (N/A — JS file, but no type regressions in TS peers)
- Tenant can select files, submit the form, and photos are attached to the new request
- If no files selected, form submits exactly as before
- Upload failure shows a non-blocking message; request is still created
- Existing AttachmentsSection (post-submission upload) still works unchanged
- File input is accessible: has an aria-label and is keyboard-reachable
```

---

## DT-013 — Manager reports page scaffold

**What exists today:** `apps/web/pages/manager/reports.js` renders a single "Coming Soon" placeholder panel with no data. `manager/index.js` already fetches summary data from `/api/requests?view=summary`, `/api/jobs?view=summary`, and `/api/invoices?view=summary`. `owner/reporting.js` is the rich reference for KPI card layout.

**What this adds:** Replace the placeholder with a hub-style page (F-UI1) with four tabs: Overview (live KPI cards) | Contractors (stub) | Cost Analysis (stub) | Timelines (stub). Only the Overview tab fetches real data in this slice.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly. Preserve existing behaviour unless explicitly required for
consistency.

Before writing code:
1. Read apps/web/pages/manager/reports.js — understand the current page structure
   (AppShell, PageShell, PageHeader, PageContent, Panel wrapping the Coming Soon div).
2. Read apps/web/pages/manager/index.js — identify the three fetch calls
   (/api/requests?view=summary, /api/jobs?view=summary, /api/invoices?view=summary)
   and the shape of data each returns. Note the KpiCard usage pattern.
3. Read apps/web/pages/owner/reporting.js — understand the KpiCard layout, section
   structure, and month/year selector. Do NOT copy the owner reporting logic wholesale;
   use it only as a visual reference for the KPI row pattern.
4. Read apps/web/pages/manager/_template_hub.js — this is the canonical hub page
   template to follow for tab layout and URL persistence.
5. Read apps/web/components/ui/KpiCard.js (or wherever KpiCard is defined) to confirm
   the prop API.
6. Output a short implementation plan:
   - Four tab definitions (keys and labels)
   - Exact fetch calls for the Overview tab and the derived KPI values
   - Where tab state is persisted (URL query param ?tab=)
   - Which tabs are stubs vs live data in this slice

Architecture rules:
- No backend changes. Summary endpoints already exist.
- Keep routes thin. No business logic in pages.
- Follow F-UI1 hub page layout exactly: tab strip as direct child of PageContent before
  the Panel; Panel wraps tab panels; one px-4 py-4 wrapper per tab panel.
- Reuse KpiCard from components/ui/. No new stat card components.
- Use URL-based tab persistence (?tab=overview etc.) with useRouter.
- Stub tabs render a consistent coming-soon message: use the existing .coming-soon
  CSS class pattern if present, or a plain empty-state div.

Slice name: manager-reports-scaffold
Goal: Replace the Coming Soon placeholder in /manager/reports with a hub page with
four tabs. Only the Overview tab is live in this slice; the rest are stubs.

Primary workflow affected: none — read-only

Files to modify — in this order:
1. apps/web/pages/manager/reports.js — full rewrite of the page component

Auth: no changes (MANAGER role, existing auth flow)

In scope:
- Hub page with tabs: Overview | Contractors | Cost Analysis | Timelines
- URL-based tab persistence (?tab=overview is default)
- Overview tab: four KPI cards —
    - Open Requests (count of non-closed requests from /api/requests?view=summary)
    - Active Jobs (count of non-completed jobs from /api/jobs?view=summary)
    - Pending Invoices (count of ISSUED invoices from /api/invoices?view=summary)
    - Avg. Days to Completion (computed from jobs with completedAt — show "—" if
      insufficient data rather than showing 0)
- Contractors, Cost Analysis, Timelines tabs: stub panels with a clear
  "Coming in a future update" empty state; do NOT show the old Coming Soon badge
- Page header: title="Reports", subtitle="Portfolio analytics and performance"
- Loading state per tab (not page-level)

Out of scope:
- Charts, sparklines, trend arrows — deferred to DT-001/002/003
- Date range selector — deferred
- Export/download — deferred
- Owner-scoped data — this is the manager view only
- Any backend changes

Implementation requirements:
- Overview KPI values are derived client-side from the summary list endpoints
  (count, filter by status). Do not add new aggregate backend endpoints.
- If a fetch fails, show an ErrorBanner in the Overview tab only; do not crash the page.
- KpiCard isLoading prop must be used while fetching.
- Use cn() for all conditional className logic (no template literals).
- The four tab keys must be: overview, contractors, cost-analysis, timelines.
- Stub tabs must show a panel with bodyClassName default (padded), not bodyClassName="p-0".

Required output before code:
- The exact data shape returned by each summary endpoint (fields available)
- Derived KPI calculations (which field, which status values to count/filter)
- Tab key list and default tab

Definition of done:
- npx tsc --noEmit — 0 errors
- /manager/reports loads without errors
- Overview tab shows four KPI cards with live data (or — when data unavailable)
- ?tab= query param persists on navigation
- Contractors / Cost Analysis / Timelines tabs render stub empty states
- Existing manager sidebar link to /manager/reports still works
- npm test — all existing tests pass (no new tests required for this slice)
```

---

## DT-021 — Repair vs replace: sensitivity input

**What exists today:** The Decisions tab in `manager/inventory.js` already renders a complete repair vs replace table driven by `GET /units/:id/repair-replace-analysis`. The backend returns `cumulativeRepairCostChf`, `estimatedReplacementCostChf`, `repairToReplacementRatio`, `breakEvenMonths`, `recommendation`, and `recommendationReason` for each asset. The 4-tier recommendation logic (REPAIR / MONITOR / PLAN_REPLACEMENT / REPLACE) is implemented in `apps/api/src/services/assetInventory.ts`.

**What this adds:** A per-asset sensitivity input in the decisions table. The manager can enter a hypothetical "next repair cost (CHF)" and see the verdict recalculate immediately — client-side only, no new API call.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly. Preserve existing behaviour unless explicitly required for
consistency.

Before writing code:
1. Read apps/web/pages/manager/inventory.js — find the Decisions tab section (search
   for activeTab === 2 or "Decisions"). Understand the full table structure, the
   RECOMMENDATION_STYLES map, and how item.recommendation is currently displayed.
2. Read apps/api/src/services/assetInventory.ts — read the getRepairReplaceAnalysis
   function and RepairReplaceItem interface (lines ~195–360). Understand exactly which
   fields are needed to recalculate the verdict client-side:
   - cumulativeRepairCostChf
   - estimatedReplacementCostChf
   - depreciationPct
   The recommendation tiers are:
     REPLACE if depPct >= 100 OR ratio >= 0.6 OR breakEvenMonths === 0
     PLAN_REPLACEMENT if depPct >= 85 OR ratio >= 0.4
     MONITOR if depPct >= 65 OR ratio >= 0.25
     REPAIR otherwise
   Where ratio = (cumulativeRepairCostChf + hypotheticalCost) / estimatedReplacementCostChf
3. Output a short implementation plan:
   - Where in the table the sensitivity input appears (inline in the Repairs column,
     or as an expandable row below each asset row)
   - How the recalculated verdict is displayed (replace the badge inline, or show
     a secondary "if repaired for X: verdict" line)
   - State shape (Map<assetId, hypotheticalCostChf>)

Architecture rules:
- No backend changes. All recalculation is client-side using existing response fields.
- Do not duplicate the recommendation logic in a second place. Define a single
  pure function clientSideVerdict(item, hypotheticalCostChf) at the top of the
  inventory.js file (or extract to lib/assetDecision.js if reuse is likely).
- Keep routes thin. No business logic in pages beyond the pure verdict helper.
- Emit no domain events.

Slice name: repair-replace-sensitivity
Goal: Add a per-asset CHF input to the Decisions tab so managers can ask
"if I repair this for CHF X, does the recommendation change?" Recalculates
the verdict badge and ratio column client-side immediately on input change.

Primary workflow affected: none — read-only UI enhancement

Files to modify — in this order:
1. apps/web/pages/manager/inventory.js
   - Add state: const [sensitivityInputs, setSensitivityInputs] = useState({})
     (keyed by assetId, value is a CHF number or empty string)
   - Add pure helper function clientSideVerdict(item, hypotheticalCostChf) that
     mirrors the 4-tier logic from assetInventory.ts
   - In the decisions table, add a compact CHF input field in the Repairs column
     (below the cumulative cost value): label "If next repair costs CHF:"
   - When a value is entered, recompute: projectedRatio, projectedVerdict, show
     a secondary badge "→ VERDICT" next to the current recommendation badge
   - Clear sensitivity inputs when a new unit is selected

Auth: no changes

In scope:
- CHF number input per asset row (integer, min 0, no decimal needed)
- Real-time recalculation: projectedRatio + projected recommendation tier
- Secondary verdict display: e.g. "→ MONITOR" badge next to the current badge
- Clear inputs when unit selector changes
- Graceful no-op if estimatedReplacementCostChf is null (hide input or show
  "No replacement cost estimate — sensitivity unavailable")

Out of scope:
- No backend changes
- No new API calls
- No sensitivity range slider (single point input is sufficient)
- No saving/persisting the hypothetical values
- No changes to the existing recommendation column for assets with no input

Implementation requirements:
- clientSideVerdict must exactly mirror the tier thresholds in assetInventory.ts.
  Copy the threshold constants as named constants (REPLACE_RATIO = 0.6, etc.)
  with a comment referencing the backend source of truth file so they stay in sync.
- Input is type="number" min="0" step="100" placeholder="0".
- Use cn() for all conditional class logic on badge colours.
- The sensitivity input must have aria-label="Hypothetical next repair cost in CHF".
- Do not change the existing table column structure. The sensitivity input is additive
  content within the existing Repairs column cell.

Required output before code:
- Exact fields from RepairReplaceItem used in clientSideVerdict
- The 4-tier threshold values confirmed from assetInventory.ts
- Where in the JSX the input and secondary badge will be placed

Definition of done:
- npx tsc --noEmit — 0 errors
- Entering a CHF value in any row immediately updates the secondary verdict badge
- Changing the unit selector clears all sensitivity inputs
- Assets without a replacement cost estimate show "Sensitivity unavailable"
- Existing recommendation badges, ratio display, and break-even column are unchanged
- npm test — all existing tests pass
```

---

## DT-015 — Remaining route-layer violations

**What exists today:** Six route files still contain direct `prisma.*` calls in violation of G4 (no Prisma in routes). Counts per file:

| File | Calls | Operations |
|---|---|---|
| `routes/auth.ts` | 12 | findUnique, findMany, findFirst, create |
| `routes/requests.ts` | 5 | findUnique, update, delete |
| `routes/tenants.ts` | 3 | findUnique |
| `routes/config.ts` | 2 | findFirst |
| `routes/maintenanceAttachments.ts` | 2 | findUnique |
| `routes/contractor.ts` | 1 | findUnique |

**What this adds:** Each call is extracted to the appropriate service or repository. Routes become thin wrappers: parse input → call service/repo → return response.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly. Preserve existing behaviour exactly — no behaviour changes,
only extraction.

Before writing code:
1. Read each of the six route files in full:
   - apps/api/src/routes/auth.ts
   - apps/api/src/routes/requests.ts
   - apps/api/src/routes/tenants.ts
   - apps/api/src/routes/config.ts
   - apps/api/src/routes/maintenanceAttachments.ts
   - apps/api/src/routes/contractor.ts
2. For each direct prisma.* call, identify:
   - Which handler it lives in (GET/POST/PATCH etc. for which route)
   - Whether an appropriate service or repository already exists for this domain
     (e.g. requestRepository.ts, tenantRepository.ts, contractorRepository.ts)
   - Whether the call should go into an existing service function or a new one
3. Read apps/api/src/repositories/ — list existing repository files and check if
   the needed operations already have canonical include constants defined.
4. Specifically for auth.ts: determine whether the prisma calls are part of auth
   bootstrapping (register/login/refresh) — if so, note whether a userService.ts
   or authService.ts already exists or should be created.
5. Output a short implementation plan:
   - For each of the six files: the extraction target (existing vs new service/repo)
   - Whether any new file needs to be created
   - Any canonical include constant that needs to be defined (G9)

Architecture rules:
- Routes → workflows → services → repositories → Prisma. No skipping.
- For reads: move prisma calls to the appropriate repository. Use or define a canonical
  include constant (G9). Repository functions take (prisma, orgId, ...) as parameters.
- For writes/mutations: move to the appropriate service or workflow if orchestration is
  needed; move to repository if it is a pure DB operation.
- Do NOT change the HTTP contract (same paths, same status codes, same response shapes).
- Do NOT change auth logic, session handling, or JWT validation.
- After each file is extracted, run npx tsc --noEmit to catch type errors before moving
  to the next file.
- G2: If adding fields to a repository include, update all consumers (DTO mappers, etc.)
- G9: Define a canonical include constant for any new repository query. No ad-hoc includes.

Slice name: route-layer-extraction
Goal: Remove all direct prisma.* calls from the six listed route files by extracting
them to services or repositories. Zero behaviour changes.

Primary workflow affected: none — refactor only

Files to modify — in this order (easiest to hardest):
1. apps/api/src/routes/contractor.ts → extract 1 findUnique to contractorRepository.ts
2. apps/api/src/routes/config.ts → extract 2 findFirst to a configService.ts or
   orgConfigRepository.ts (check if one exists first)
3. apps/api/src/routes/maintenanceAttachments.ts → extract 2 findUnique to
   maintenanceAttachmentRepository.ts (check if it exists; create if not)
4. apps/api/src/routes/tenants.ts → extract 3 findUnique to tenantRepository.ts
5. apps/api/src/routes/requests.ts → extract 5 calls (findUnique, update, delete)
   to requestRepository.ts or requestService.ts
6. apps/api/src/routes/auth.ts → extract 12 calls to userRepository.ts or
   authService.ts (create this file if it does not exist; keep JWT logic in the route)
For each file: repository/service first → then update route → then tsc --noEmit.

Auth: no auth logic changes. JWT validation, password hashing, token generation stay
in auth.ts or authService.ts. Only the raw prisma DB calls move.

In scope:
- Extract every direct prisma.* call from all six files to services/repositories
- Define canonical include constants (G9) for any new repository queries
- Update DTO interfaces and mappers if the include shape changes (G2/G3)
- Each extraction is a pure behaviour-preserving refactor

Out of scope:
- No new endpoints
- No HTTP contract changes (paths, status codes, response shapes)
- No auth logic changes
- No OpenAPI changes unless a DTO shape changes (unlikely for a pure extract)
- No test changes unless a test imports directly from a route file that is being changed

Implementation requirements:
- Every new repository function must export a typed include constant.
- Use Prisma.XGetPayload<{ include: typeof X_INCLUDE }> for return types.
- Do not introduce any try/catch in repositories — let errors propagate to the route
  (routes already have catch blocks).
- After all six files are done, run the full extraction validation:
    npx tsc --noEmit
    npm test
    npm run blueprint

Required output before code:
- For each of the six files: the specific prisma calls, the extraction target
  (existing or new file), and whether a canonical include exists or needs defining
- List of new files to be created (if any)
- Any DTO or include constants that need updating

Definition of done:
- npx tsc --noEmit — 0 errors
- npm test — all existing tests pass
- npm run blueprint — docs sync cleanly
- grep -r "prisma\.\w\+\.\(findMany\|findFirst\|findUnique\|create\|update\|delete\)" \
  apps/api/src/routes/auth.ts apps/api/src/routes/requests.ts \
  apps/api/src/routes/tenants.ts apps/api/src/routes/config.ts \
  apps/api/src/routes/maintenanceAttachments.ts apps/api/src/routes/contractor.ts
  returns zero results
- HTTP behaviour of all modified endpoints is identical (same status codes,
  same response shapes, same error messages)
```

---

## DT-115 — Wire CategoryMappings into manager settings Legal tab

**What exists today:** `apps/web/components/CategoryMappings.js` is a fully built component — coverage indicator, per-category cards, toggle/edit/reset, add-mapping form, and all API calls to `/api/legal/category-mappings/coverage`. It is never imported or rendered anywhere.

**What this adds:** Mount `CategoryMappings` inside the Legal Sources tab on `manager/settings.js` — approximately 20 lines of change.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Read apps/web/pages/manager/settings.js in full.
   - Identify the tab strip and how tabs are controlled (state variable, conditional rendering).
   - Find the "Legal" tab panel (or nearest equivalent label). Note the exact JSX section
     where legal document sources or category mapping content should appear.
   - Note any existing placeholder content in that tab to remove.
2. Read apps/web/components/CategoryMappings.js — confirm the component accepts no required
   props (it is self-contained; makes its own fetch calls). Note the component's export name.
3. Output a short implementation plan:
   - The exact tab label/key under which CategoryMappings should be mounted
   - Whether a placeholder needs to be removed
   - The import line to add

Architecture rules:
- No backend changes. The component handles all its own API calls.
- No props to pass — CategoryMappings is self-contained.
- Follow F-UI1 hub page rules. Do not add new CSS classes.

Slice name: settings-category-mappings-wire-up
Goal: Mount the pre-built CategoryMappings component in the Legal tab of manager/settings.js.

Files to modify — in this order:
1. apps/web/pages/manager/settings.js
   - Add import: import CategoryMappings from "../../components/CategoryMappings";
   - In the Legal tab panel, replace any placeholder content with <CategoryMappings />

Auth: no changes

In scope:
- Import and render CategoryMappings in the Legal tab
- Remove any "Coming soon" / placeholder text in that tab section

Out of scope:
- No changes to CategoryMappings.js itself
- No new API routes
- No layout changes to settings.js beyond the Legal tab panel

Required output before code:
- The exact tab key and JSX location where CategoryMappings will be inserted
- Whether any placeholder text exists that needs removing

Definition of done:
- npx tsc --noEmit — 0 errors
- /manager/settings navigates to the Legal tab and renders CategoryMappings with its
  coverage indicator, category cards, and mapping form
- No other settings tabs are affected
```

---

## DT-118 — Owner RFP list: clickable rows to detail page

**What exists today:** `apps/web/pages/owner/rfps/index.js` renders a table of RFPs for the owner. `apps/web/pages/owner/rfps/[id].js` is the detail page. Rows in the index list are not clickable — there is no `onRowClick` or navigation on the table rows.

**What this adds:** Row-click navigation from the RFP list to the individual RFP detail page (`/owner/rfps/[id]`). Consistent with the established pattern: `cursor-pointer`, `hover:bg-slate-50`, and an icon-only action button in the last column using `stopPropagation`.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Read apps/web/pages/owner/rfps/index.js in full.
   - Identify the table rendering: whether it uses ConfigurableTable or a raw <table>.
   - Note the current last-column content (any action button, link, or nothing).
   - Find the route each row should navigate to: /owner/rfps/[rfp.id].
2. Read apps/web/pages/owner/rfps/[id].js briefly to confirm it is a valid detail page
   that accepts an id from router.query.
3. Output a short implementation plan:
   - Raw <table> vs ConfigurableTable
   - Exact JSX location for onClick on <tr>
   - Whether any existing last-column content needs stopPropagation

Architecture rules:
- No backend changes. Frontend-only.
- Use useRouter from next/router for navigation.
- If raw <table>: add onClick={() => router.push('/owner/rfps/' + rfp.id)} directly
  on the <tr> element. Add className={cn("cursor-pointer", existing classes)}.
- Any clickable content inside the row (links, buttons) must call e.stopPropagation()
  before its own handler.
- Icon-only buttons must have aria-label.
- Follow F-UI4: no inline styles, use cn() for conditional classes.

Slice name: owner-rfp-clickable-rows
Goal: Make RFP list rows clickable, navigating to /owner/rfps/[id].

Files to modify — in this order:
1. apps/web/pages/owner/rfps/index.js
   - Add useRouter import if not present
   - Add onClick to each table row pointing to /owner/rfps/ + rfp.id
   - Add cursor-pointer + hover:bg-slate-50 to the row className
   - If a last-column action exists, ensure it calls e.stopPropagation()
   - If no last-column action exists, add a minimal chevron-right icon button
     with aria-label="View RFP" and stopPropagation, as ACTION_PLACEHOLDER

Auth: no changes

In scope:
- Row-click navigation to /owner/rfps/[id]
- cursor-pointer + hover styling on rows
- stopPropagation on any inline actions
- icon-only action button with aria-label if last column is empty

Out of scope:
- No changes to the RFP detail page
- No backend changes
- No new columns or filter changes

Required output before code:
- Confirm raw <table> or ConfigurableTable
- Confirm destination route (/owner/rfps/[rfp.id])
- Note any existing action in last column that needs stopPropagation

Definition of done:
- npx tsc --noEmit — 0 errors
- Clicking any row navigates to the correct /owner/rfps/[id] page
- Existing action buttons/links in the row still work and do not trigger row navigation
- aria-label present on any icon-only buttons added
```

---

## DT-119 — Owner finance: accordion deeplink from dashboard

**What exists today:** `apps/web/pages/owner/finance.js` has an accordion pattern. `expandedId` state controls which invoice row is open. `toggleAccordion(id)` sets/unsets it. The owner dashboard (`apps/web/pages/owner/index.js`) links to `/owner/invoices?invoiceId=...` (a separate invoice list page) when an invoice card is clicked — not to `/owner/finance`. Context is lost: the user must remember which invoice to find.

**What this adds:** Two changes:
1. `owner/finance.js` reads a `?open=<invoiceId>` query param on mount and pre-sets `expandedId` to that value, scrolling the accordion row into view.
2. Owner dashboard invoice links are updated from `/owner/invoices?invoiceId=...` to `/owner/finance?open=<invoiceId>`, landing the user directly on the expanded accordion row.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Read apps/web/pages/owner/finance.js in full.
   - Find expandedId state and toggleAccordion. Note how expandedId is set on mount (currently null).
   - Find where invoice.id is used as the key on each accordion row div (key={invoice.id}).
   - Note that the fetch useEffect runs on mount — the ?open= param must be applied
     after or alongside the fetch, once invoices are loaded and the row exists in the DOM.
2. Read apps/web/pages/owner/index.js.
   - Find every <Link> or href that references /owner/invoices?invoiceId=...
   - These are the links to update to /owner/finance?open=<invoiceId>.
3. Output a short implementation plan:
   - Where in finance.js the query param is read (useRouter + useEffect after load)
   - How scroll-into-view is triggered (useRef on the expanded row, or document.getElementById)
   - Exact lines in index.js to update

Architecture rules:
- No backend changes. Frontend-only.
- Use useRouter from next/router (already imported in finance.js or add it).
- Read router.query.open in a useEffect that depends on [invoices, router.query.open]:
  when invoices are loaded and router.query.open is set, call setExpandedId(router.query.open).
- Scroll-into-view: after expandedId is set from query param, scroll the row into view.
  Use a ref map (refs keyed by invoice.id) or document.getElementById with the invoice.id
  as the element id. Call element.scrollIntoView({ behavior: 'smooth', block: 'start' }).
- Do not break the existing manual toggleAccordion click behaviour.
- Follow F-UI4: no inline styles, use cn() for conditional classes.

Slice name: owner-finance-accordion-deeplink
Goal: Allow direct deeplinks to expanded invoice rows on /owner/finance via ?open=<invoiceId>.
Update owner dashboard invoice links to use this deeplink.

Files to modify — in this order:
1. apps/web/pages/owner/finance.js
   - Add useRouter import
   - Add a ref map: const rowRefs = useRef({})
   - On each accordion row div: add ref={el => rowRefs.current[invoice.id] = el} and
     id={invoice.id} (for the scroll target)
   - Add useEffect([invoices, router.query.open]): if router.query.open and invoices loaded,
     setExpandedId(router.query.open), then scroll the ref into view
2. apps/web/pages/owner/index.js
   - Find all hrefs/Links pointing to /owner/invoices?invoiceId= and change them to
     /owner/finance?open=<invoiceId>

Auth: no changes

In scope:
- Read ?open= query param after invoices load; set expandedId and scroll into view
- Update owner dashboard invoice card links to /owner/finance?open=<id>
- Manual toggleAccordion still works identically

Out of scope:
- No changes to /owner/invoices (it stays as-is for other uses)
- No backend changes
- No URL history push/replace (the query param is consumed, not cleared)
- No animation beyond the existing accordion transition

Required output before code:
- Exact location of the useEffect that should read router.query.open
- The lines in index.js that reference /owner/invoices?invoiceId= (with line numbers)
- Whether useRouter is already imported in finance.js

Definition of done:
- npx tsc --noEmit — 0 errors
- Navigating to /owner/finance?open=<id> opens that accordion row and scrolls it into view
- Owner dashboard invoice cards navigate to /owner/finance?open=<id>
- Manual toggle still works; clicking the same row again collapses it
- No regressions on filter or date controls
```

---

## INT-023 — Pre-fill invoice creation from lease tenant fields

**What exists today:** `apps/web/pages/manager/leases/[id].js` has a "Create Invoice" modal (`showInvoiceModal` state, ~line 1224). The modal collects: Invoice Type, Amount (CHF), Description. It posts to `handleAction("invoices", { type, amountChf, description })`. The `lease` object is already loaded on the page and contains: `lease.tenantName`, `lease.tenantAddress`, `lease.tenantZipCity`, `lease.tenantEmail`. The backend `POST /leases/:id/invoices` route already creates the invoice linked to the lease.

**What this adds:** The invoice creation modal pre-fills the Description field with a suggestion using the tenant's name, and sends the tenant's address fields (`tenantAddress`, `tenantZipCity`) along with the invoice creation request so the invoice is pre-populated with the correct billing address. Check whether the backend `POST /leases/:id/invoices` already accepts address fields — if not, add them.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Read apps/web/pages/manager/leases/[id].js.
   - Find the showInvoiceModal section (~line 1224) and handleCreateInvoice function (~line 467).
   - Note the fields currently posted: type, amountChf, description.
   - Note which lease fields are available: lease.tenantName, lease.tenantAddress,
     lease.tenantZipCity, lease.tenantEmail, lease.tenantPhone.
2. Read apps/api/src/routes/invoices.ts (or leases.ts — whichever handles POST /leases/:id/invoices).
   - Find the invoice creation handler for this route.
   - Check whether it already accepts billingAddress, billingCity, recipientName fields (or similar).
   - Note the exact field names accepted in the request body.
3. Read apps/api/src/repositories/invoiceRepository.ts (or equivalent) and the Invoice model
   in prisma/schema.prisma.
   - Find which fields on Invoice correspond to billing address / recipient.
   - Note their exact Prisma field names.
4. Output a short implementation plan:
   - Whether the backend route needs new fields added or already accepts them
   - What the frontend should send (field names matching backend)
   - The pre-fill strategy: which lease fields map to which invoice fields

Architecture rules:
- If the backend does NOT yet accept address fields: add them to the route handler,
  workflow (if used), and repository (no new migration needed if the Invoice model
  already has those columns — check schema.prisma first).
- If the Invoice model does NOT have address columns: add a migration. Use
  npx prisma migrate dev --name add-invoice-billing-address.
- Follow all G2/G3 rules: update include constants, DTO mappers, and OpenAPI if fields change.
- Routes → workflows → services → repositories. No prisma calls in routes.
- Frontend: use the existing lease object (already loaded) — do not add a new fetch.

Slice name: lease-invoice-prefill
Goal: When creating an invoice from a lease, pre-fill recipient name and billing address
from the lease tenant fields (tenantName, tenantAddress, tenantZipCity). The manager
can override before submitting.

Primary workflow affected: lease invoice creation

Files to modify — in this order:
Backend (only if address fields are missing from the invoice creation endpoint):
1. apps/api/src/routes/leases.ts (or invoices.ts) — add recipientName, billingAddress,
   billingCity to the body parsing for POST /leases/:id/invoices
2. apps/api/src/workflows/invoiceWorkflow.ts (or equivalent) — pass fields through
3. apps/api/src/repositories/invoiceRepository.ts — include fields in create call
4. prisma/schema.prisma + migration — only if fields don't exist on Invoice model

Frontend:
5. apps/web/pages/manager/leases/[id].js
   - Add state: invoiceRecipient (pre-filled from lease.tenantName), invoiceAddress
     (from lease.tenantAddress), invoiceCity (from lease.tenantZipCity)
   - Pre-fill these states when showInvoiceModal opens (via useEffect or on button click)
   - Add editable inputs for Recipient, Address, Postal / City in the modal
   - Include these fields in the handleCreateInvoice POST body

Auth: no changes (MANAGER role, existing auth flow)

In scope:
- Pre-fill recipient name + billing address from lease fields when modal opens
- Manager can edit all pre-filled values before submitting
- Fields are sent to the backend and stored on the Invoice record
- Use tenantName → recipient, tenantAddress → billing street, tenantZipCity → billing city
  (NOT the building address — the lease's tenant-specific address fields)

Out of scope:
- No changes to the invoice PDF template in this slice (address display in PDF is separate)
- No pre-fill for invoice Amount — manager always sets this manually
- No changes to the invoice creation flow for invoices not created from leases
- No new invoice list columns

Required output before code:
- Whether the backend POST /leases/:id/invoices accepts address fields today (yes/no)
- The exact Invoice model field names for billing address/recipient in schema.prisma
- Whether a migration is needed
- The three pre-fill mappings: lease field → invoice field

Definition of done:
- npx tsc --noEmit — 0 errors
- Opening the invoice modal from a lease pre-fills Recipient, Address, City from the lease
- Editing and submitting the modal saves all fields on the Invoice record
- npx prisma migrate diff confirms zero drift
- npm test — all existing tests pass
```

---

## INT-018 — Vacancies view: segmented control by pipeline stage

**What exists today:** `apps/web/pages/manager/vacancies/index.js` shows two panels on a single page: "Tenant Selections" (active RentalOwnerSelection records, statuses: AWAITING_SIGNATURE / FALLBACK_1 / FALLBACK_2 / EXHAUSTED / SIGNED / VOIDED) and "Vacant Units — Open for Applications" (units with no active tenant). The page is already within the Inventory tab strip as "Vacancies". There is no way to filter by pipeline stage.

**What this adds:** A segmented control at the top of the page (below the tab strip, above the panels) to switch between three views:
- **Open for Applications** — shows the "Vacant Units" panel
- **Tenant Selection** — shows active RentalOwnerSelection records in AWAITING_SIGNATURE / FALLBACK_1 / FALLBACK_2 / EXHAUSTED status
- **Awaiting Signature** — shows selections in AWAITING_SIGNATURE status only

The same segmented control pattern is then applied to the owner vacancies view if one exists.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Read apps/web/pages/manager/vacancies/index.js in full.
   - Understand the two data sources: /api/vacant-units (units) and /api/manager/selections (selections).
   - Note the SELECTION_LABELS map and which statuses map to which pipeline stage.
   - Find the tab strip (Links to Buildings / Vacancies / Assets / etc.) — confirm the
     segmented control goes BELOW it, not replacing it.
2. Read apps/web/pages/manager/finance/index.js (or manager/finance.js) — the reference
   implementation for the segmented control (?tab=invoices pattern). Identify exactly how
   the segmented control is rendered: tab-strip class? button group? URL query param?
3. Check if there is an owner vacancies page (apps/web/pages/owner/vacancies*) — if it
   exists, read it and plan the same segmented control there.
4. Output a short implementation plan:
   - The three segment labels and keys
   - Which data each segment shows (reusing already-loaded data, no new fetches)
   - Whether URL query param (?view=) is used for persistence
   - Whether an owner page also needs the control

Architecture rules:
- No backend changes. All filtering is client-side on already-fetched data.
- Use a URL query param (?view=applications|selection|signature) for segment persistence.
  Default to "applications" if no param is set.
- The segmented control is styled consistently with the finance page pattern (or the
  closest existing segmented control in the codebase).
- Do not remove or restructure the existing tab strip (Buildings / Vacancies / etc.).
- Reuse existing data: filter the already-loaded selections array client-side.
  Do not add new API calls.

Slice name: vacancies-segmented-pipeline
Goal: Add a segmented control within the Vacancies page to filter between pipeline stages.
No new panels or layouts — just show/hide existing content based on the active segment.

Files to modify — in this order:
1. apps/web/pages/manager/vacancies/index.js
   - Add useRouter import (if not present)
   - Read router.query.view; default to "applications"
   - Add a segmented control below the tab strip with three buttons:
     "Open for Applications" | "Tenant Selection" | "Awaiting Signature"
   - "Open for Applications": show the "Vacant Units" panel, hide Tenant Selections panel
   - "Tenant Selection": show Tenant Selections panel filtered to
     [AWAITING_SIGNATURE, FALLBACK_1, FALLBACK_2, EXHAUSTED] statuses; hide Vacant Units
   - "Awaiting Signature": show Tenant Selections panel filtered to [AWAITING_SIGNATURE] only
   - Each segment button pushes router.query.view to the URL
2. If apps/web/pages/owner/vacancies.js (or similar) exists: apply the same segmented
   control pattern. If no owner vacancies page exists, skip.

Auth: no changes

In scope:
- Segmented control with three tabs, URL-persisted
- Client-side filtering of existing loaded data
- Correct status filtering per segment
- Both manager and owner vacancies pages (if owner page exists)

Out of scope:
- No new API endpoints
- No changes to the outer inventory tab strip
- No changes to the table columns or row content
- No redesign of card layouts

Required output before code:
- The exact segmented control component/pattern found in the finance page reference
- The three segment key/label pairs
- Status values included per segment
- Whether an owner vacancies page exists

Definition of done:
- npx tsc --noEmit — 0 errors
- Clicking each segment shows the correct subset of data
- ?view= query param persists on page refresh
- Existing tab strip (Buildings / Vacancies / Assets etc.) is unchanged
- npm test — all existing tests pass
```

---

## INT-020 — Tenant selection: dropdown fallback in candidate dropzones

**What exists today:** `apps/web/pages/manager/vacancies/[unitId]/applications.js` has a "Your Selection" card with three candidate dropzone slots (Primary, Back-up 1, Back-up 2). Each empty slot shows placeholder text ("click a candidate below" or similar). Managers must click a candidate card in the "Candidates" panel to dispatch them into a slot. This is the only way to select candidates.

**What this adds:** A secondary selection method: each empty dropzone slot also shows a `<select>` dropdown populated with the candidates list. Selecting a candidate from the dropdown dispatches them into that slot. Both methods co-exist — clicking a candidate card still works; the dropdown is an alternative.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Read apps/web/pages/manager/vacancies/[unitId]/applications.js in full.
   - Find the "Your Selection" card and the three dropzone slots.
   - Identify the placeholder text in each empty slot ("click a candidate below" or similar).
   - Find the function that dispatches a candidate into a slot when clicking a candidate card
     (e.g. handleSelectCandidate, handleDispatch, or equivalent). Note its signature.
   - Find the candidates array that is loaded and displayed in the Candidates card.
   - Confirm the data shape of each candidate: the fields available (id, name, email, etc.).
2. Identify the API call made when a candidate is dispatched into a slot — the POST or PATCH
   endpoint and its body shape. The dropdown must call the same function/endpoint.
3. Output a short implementation plan:
   - The exact JSX location in each dropzone slot where the dropdown replaces the placeholder text
   - The dispatch function signature and how to call it from the dropdown onChange
   - Which candidate fields to show in the <option> labels (name + email recommended)

Architecture rules:
- No backend changes. The dropdown calls the exact same dispatch function as the click method.
- No new API calls. Reuse the existing dispatch handler.
- If slots already have a filled candidate, do not show the dropdown (only show for empty slots).
- Follow F-UI4: no inline styles, use cn() for conditional classes.
- The <select> must have an associated <label> or aria-label.

Slice name: selection-dropdown-fallback
Goal: Add a <select> dropdown in each empty candidate slot as a secondary selection method,
alongside the existing click-to-select pattern.

Files to modify — in this order:
1. apps/web/pages/manager/vacancies/[unitId]/applications.js
   - In each of the three dropzone slots (Primary, Back-up 1, Back-up 2):
     - If the slot is empty: replace the placeholder text with a <select> dropdown
       populated from the candidates array
     - The <select> has a default disabled option "— Select a candidate —"
     - onChange calls the same dispatch function as clicking a candidate card
     - If the slot is filled: render the existing filled-slot content unchanged
   - Candidates in the dropdown are filtered to exclude any already dispatched to another slot

Auth: no changes

In scope:
- <select> dropdown in each empty dropzone slot
- Options populated from the candidates list (name + email as label)
- onChange calls the existing dispatch function
- Filled slots are unaffected
- Candidates already in another slot are excluded from the dropdown options

Out of scope:
- No drag-and-drop
- No reordering of slots
- No changes to the candidate card click behaviour
- No backend changes
- No new styling beyond what fits the existing dropzone design

Required output before code:
- The dispatch function name and signature
- The exact placeholder text being replaced in each slot
- The candidate data shape (fields available for option labels)
- Which slot identifiers map to Primary / Back-up 1 / Back-up 2 (e.g. FALLBACK_1, FALLBACK_2)

Definition of done:
- npx tsc --noEmit — 0 errors
- Each empty slot shows a dropdown populated with unselected candidates
- Selecting from the dropdown dispatches the candidate into the correct slot
- Clicking a candidate card still works identically
- Filled slots show existing content unchanged
- Dropdown has aria-label on the <select> element
```

---

## INT-011 — In-page iframe preview for all attached documents

**What exists today:** Various pages across the app trigger document download or open in a new tab via `window.open(url, '_blank')`. The `Content-Disposition` on most attachment routes is `attachment`, causing the browser to download the file rather than preview it. The exception is `GET /invoices/:id/pdf` (fixed in a prior slice to `Content-Disposition: inline`). All other document attachment views (maintenance attachments, lease PDFs, etc.) either download directly or open raw in a new tab with no in-page preview.

**What this adds:** For any attachment rendered in the interface, the primary interaction is an in-page `<iframe>` preview (modal or inline). A secondary "Download" button remains. The download is never the default action unless triggered by an explicit "Download" CTA.

**Scope for this slice:** Implement the `<iframe>` preview pattern in a reusable component (`DocumentPreviewModal`) and wire it into the two highest-traffic surfaces: maintenance request attachments (`manager/requests/[id].js` or equivalent) and lease PDF preview.

---

```
Read PROJECT_OVERVIEW.md first (entry point), then apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md
(lookup), then PROJECT_STATE.md (canonical reference), docs/AUDIT.md, and blueprint.js.
Obey all guardrails exactly.

Before writing code:
1. Search for all occurrences of window.open across apps/web/pages/ — list every page that
   calls window.open with an attachment/document URL. These are the candidates for the
   iframe preview pattern.
2. For each occurrence, identify:
   - The URL being opened (is it a PDF, an image, a generic attachment?)
   - The Content-Disposition header the backend returns for that route (inline vs attachment)
   - Whether the backend route needs to be updated to return "inline" for preview to work
3. Read apps/web/components/ — check if any modal or preview component already exists
   that wraps an <iframe>.
4. Output a short implementation plan:
   - Which backend routes need Content-Disposition changed from attachment to inline
   - The DocumentPreviewModal component interface (props: url, filename, onClose)
   - The two or three pages to wire it into in this slice
   - Which pages are deferred (listed as out of scope below, for a follow-up slice)

Architecture rules:
- Backend changes required: change Content-Disposition from attachment to inline for any
  route that serves a document meant to be previewed. Only change routes where inline
  preview makes sense (PDFs, images). Signed lease PDFs (generate-pdf) keep attachment.
- Do not create new backend routes.
- The DocumentPreviewModal wraps an <iframe src={url} /> in a fixed overlay. It must:
  - Have a close button (aria-label="Close preview") that calls onClose
  - Have a Download button that triggers a programmatic download (anchor with download attr)
  - Trap focus within the modal when open (or use a simple fixed overlay at minimum)
  - Not exceed viewport height; the iframe should be 80vh or similar
- Do not use inline style={{}} — use Tailwind utility classes.
- If the browser cannot render the file in an iframe (e.g. some PDF viewers on mobile),
  the Download button is the fallback.
- Follow F-UI4 and accessibility baseline: role="dialog", aria-modal="true",
  aria-label="Document preview" on the modal container.

Slice name: document-iframe-preview
Goal: Replace window.open download triggers with an in-page iframe preview modal.
Build a reusable DocumentPreviewModal and wire it into maintenance attachments and
lease PDF preview in this slice.

Files to create:
1. apps/web/components/DocumentPreviewModal.js
   - Props: { url: string, filename: string, onClose: () => void }
   - Fixed full-screen overlay (bg-black/50 backdrop)
   - Centered container with close button, filename heading, <iframe src={url}>, Download button
   - Download button: <a href={url} download={filename}> with button styling

Files to modify — in this order:
Backend (Content-Disposition changes):
2. Identify routes that serve maintenance attachments — change to Content-Disposition: inline
   for image/* and application/pdf responses. Keep attachment for binary/unknown types.
3. Any other route identified in step 2 of the inspection that needs inline.

Frontend (wire-up):
4. apps/web/components/AttachmentsSection.js (or the attachment viewer used in request detail)
   — replace window.open calls with state: { previewUrl, previewFilename } and render
   <DocumentPreviewModal> when previewUrl is set
5. The lease PDF "View PDF" button in apps/web/pages/manager/leases/[id].js
   — replace window.open with DocumentPreviewModal

Auth: no changes for frontend. Backend route changes preserve existing auth middleware.

In scope:
- DocumentPreviewModal reusable component
- Maintenance attachment preview (highest traffic)
- Lease PDF preview (second highest)
- Content-Disposition: inline for PDF/image attachment routes

Out of scope (deferred to follow-up):
- Owner finance invoice PDF — already fixed (inline) in prior slice
- Tenant portal attachment preview — follow-up slice
- File type detection for non-PDF files — show a "Preview not available; download instead"
  fallback if the iframe src returns a non-previewable type

Required output before code:
- List of all window.open document URLs found across apps/web/pages/
- For each: current Content-Disposition (if known) and whether inline switch is needed
- The two backend routes to update in this slice
- Confirmation that no existing modal/preview component exists to reuse

Definition of done:
- npx tsc --noEmit — 0 errors
- Clicking "View" on a maintenance attachment opens DocumentPreviewModal with iframe
- Clicking "View PDF" on a lease opens DocumentPreviewModal with iframe
- "Download" button in the modal triggers file download
- Closing the modal returns focus to the trigger button
- No window.open calls remain for the two wired surfaces
- npm test — all existing tests pass
```

---

## Appendix — Recently resolved (do not re-implement)

| Ticket | Resolution |
|--------|-----------|
| DT-011 | Done — all 67 test suites audited; 29 integration suites use canonical `startTestServer`; 0 legacy `startServer` copies remain |
| DT-116 | Done — `ConfigurableTable.onRowClick` was already wired in `templates.js`; rows are clickable |
| DT-110/111/112/113 | Done — test harness epic complete (port deconfliction, canonical helpers, contract tests, CONTRIBUTING.md) |
| DT-010 | Done — background job scheduler is implemented in `server.ts` via `setInterval` + `BG_JOB_INTERVAL_MS` env var |
| F-P1-001 | Done — QR-invoice (SIX v2.3) backend + tenant portal invoice detail merged (commits 18519d3, 8e0cbf6, b896756) |
