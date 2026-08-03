# Critical Project Audit — 2026-06-23

Scope: read-only audit of `PROJECT_OVERVIEW.md`, referenced project documents, guardrails, and selected live code paths. No code changes were made during the audit.

## Executive Summary

The project has strong architectural intent and useful guardrail tooling, but the current risk is governance drift: the documentation, guardrails, OpenAPI spec, and implementation no longer agree in several important places.

The highest-priority fixes are:

1. Reconcile stale/contradictory project docs with the live schema and codebase.
2. Decide whether “no Prisma in routes/services” is a hard rule, then enforce it consistently.
3. Reduce the OpenAPI unspecced-route allowlist.
4. Stabilize the current dirty working tree before starting more feature work.
5. Close pre-GA security hardening items: durable rate limiting, CSP, audit logging, and sandbox/dev-route policy.

## Current Working Tree Risk

`git status --short` showed an active in-flight change set touching schema, OpenAPI, tests, backend services/repositories, frontend pages/components, locales, and a new migration directory.

Representative dirty files:

- `apps/api/prisma/schema.prisma`
- `apps/api/openapi.yaml`
- `apps/api/src/__tests__/contracts.test.ts`
- `apps/api/src/services/financials.ts`
- `apps/web/pages/owner/reporting.js`
- `apps/web/public/locales/en/owner.json`
- `apps/api/prisma/migrations/20260623030000_rename_income_collected_accrued/`

Recommendation: before remediation work, either commit the current change set, park it on a branch, or explicitly document it as the active baseline. Otherwise future audits will mix baseline defects with work-in-progress defects.

## Findings

### P0 — Documentation Is Not a Reliable Source of Truth

`PROJECT_OVERVIEW.md` and related state documents contain live contradictions.

Examples:

- `PROJECT_OVERVIEW.md` says `Request` has no `orgId`, but live schema has `Request.orgId`.
  - Doc: `PROJECT_OVERVIEW.md` — “Request has no orgId”
  - Schema: `apps/api/prisma/schema.prisma`, `model Request`, `orgId String`
- `PROJECT_STATE.md` says 83 models and 109 migrations, while the current tree reports 91 models, 78 enums, and 120 migration directories.
- `PROJECT_STATE.md` says the service layer is fully decoupled from Prisma, but live services still contain direct `prisma.*` calls.
- `SCHEMA_REFERENCE.md` reports older counts and omits newer schema additions.

Impact:

- New contributors and agents will follow incorrect instructions.
- Schema changes may be implemented against stale assumptions.
- Guardrails lose credibility because the “current state” is not current.

Recommended fix:

- Regenerate or manually refresh all derived counts.
- Remove historical snapshots from “current” sections.
- Move archival claims to dated history sections.
- Add a simple doc freshness checklist to the pre-commit/blueprint process.

### P0 — Architecture Rule Is Violated and Not Fully Enforced

The stated backend layer rule is:

```text
routes → workflows → services → repositories → Prisma
```

But current searches found:

- 41 direct `prisma.*` lines in route files.
- 219 direct `prisma.*` lines in service files.
- 28 service files still call Prisma directly.

Examples:

- `apps/api/src/routes/correspondence.ts`
- `apps/api/src/routes/conditionReports.ts`
- `apps/api/src/routes/cashflowPlans.ts`
- `apps/api/src/services/financials.ts`
- `apps/api/src/services/importedStatementService.ts`
- `apps/api/src/services/legalDecisionEngine.ts`
- `apps/api/src/services/maintenanceRequests.ts`

The guardrail script catches some route include-tree issues, but does not enforce “no Prisma in services.”

Impact:

- Business logic and persistence boundaries remain blurry.
- DTO/include drift can reappear.
- Repository include constants are not a true canonical layer.
- Audits keep rediscovering the same class of issue.

Recommended fix:

- Decide whether “services never call Prisma” is mandatory or aspirational.
- If mandatory, add a guardrail check for `apps/api/src/services/**` direct `prisma.` usage.
- Create an allowlist only for explicitly accepted exceptions, with comments explaining why.
- Burn down direct service Prisma access by domain rather than opportunistically.

### P1 — OpenAPI Sync Is Being Bypassed by a Large Allowlist

`apps/api/src/__tests__/openApiSync.test.ts` contains a large `KNOWN_UNSPECCED_ROUTES` allowlist, approximately 87 entries.

Examples include:

- Strategy/profile routes
- Imported statement routes
- Correspondence routes
- Financial reporting routes
- Condition report routes
- Sandbox routes

Impact:

- The OpenAPI test stays green while the spec falls behind.
- Generated clients and frontend assumptions can drift from backend behavior.
- API changes lose contract-test value.

Recommended fix:

- Split the allowlist into “intentionally private/dev-only” and “public but unspecced.”
- Add a budget: e.g. no net increase in public unspecced routes.
- Convert the highest-traffic public routes into OpenAPI entries first.
- Link each remaining exception to a ticket or owner.

### P1 — Frontend Styling Claims Are Overstated

`PROJECT_OVERVIEW.md` says no hardcoded `slate-*`, `bg-white`, or inline styles remain in JSX. Current code still contains several examples.

Examples:

- `apps/web/pages/login.js`
- `apps/web/pages/index.js`
- `apps/web/components/HubBar.js`
- `apps/web/components/PortfolioCanvasChart.jsx`
- `apps/web/components/ImportedStatementsPanel.js`

Some may be intentional visual exceptions, but not all are documented with the stated `/* no-token: <reason> */` pattern.

Impact:

- Dark mode and token-based theming are less reliable than documented.
- Future UI work may cargo-cult stale patterns.
- Guardrail docs claim a stronger state than the code supports.

Recommended fix:

- Re-run a focused token/style audit.
- Mark true exceptions with `/* no-token: <reason> */`.
- Replace ordinary raw colors/classes with semantic tokens.
- Update the docs to distinguish “target rule” from “current compliance.”

### P1 — Current Guardrails Do Not Cover the Highest-Risk Drift

`npm run guardrails` passed with one warning:

- `apps/api/src/routes/cashflowPlans.ts` has an ad-hoc route include tree:
  - `include: { user: { include: { strategyProfile: true } } }`

Good checks currently include:

- Banned `prisma db push`
- Template-literal `className`
- Inline status color maps
- Staged secret patterns
- `MyApp.getInitialProps`
- Mirrored docs divergence

Missing or partial checks:

- No direct Prisma calls in services.
- No direct Prisma calls in routes except allowed dev/bootstrap files.
- OpenAPI allowlist size/regression budget.
- Documentation count freshness.
- Raw token/style regression outside staged files.

Recommended fix:

- Add guardrails for the architectural rules the team actually wants enforced.
- Treat warnings that represent architectural violations as errors once the backlog is burned down.
- Track baseline counts for architectural smells like the quality report tracks `any`/`console`.

### P1 — Security Hardening Has Known Pre-GA Gaps

Positive findings:

- Production boot guards reject missing `AUTH_SECRET`.
- Production rejects `AUTH_OPTIONAL=true`.
- Production rejects `DEV_IDENTITY_ENABLED=true`.
- Production requires S3 attachment storage.
- CORS is allowlist-based.
- Security headers exist on backend and frontend.

Open concerns:

- In-memory rate limiters reset on process restart and do not work across multiple instances.
- CSP is still deferred.
- Audit logging is still deferred.
- Production deploy guard allows both `main` and `sandbox` branches.
- Sandbox routes are registered in all environments and gated at runtime by `SANDBOX_MODE`.

Impact:

- Multi-instance or restart-heavy environments can bypass rate limits.
- Security incident investigation is weaker without durable audit logs.
- A branch/deployment policy mistake could expose unintended behavior.

Recommended fix:

- Move public-route and AI/OCR route limits to Redis or another shared store.
- Add a CSP policy and test it in staging.
- Add audit logging for auth-sensitive and data-mutating actions.
- Clarify whether `sandbox` is allowed in production; if not, remove it from the production branch allowlist.
- Consider registering sandbox routes only when sandbox mode is enabled.

### P2 — Quality Tooling Is Visibility-Only

`docs/quality-baseline.json` records:

- `eslint_err`: 0
- `eslint_warn`: 2380
- `any`: 695
- `console`: 496
- `bigfiles`: 14

This is useful as a baseline, but the rules are report-only.

Impact:

- Debt can remain stable or grow without blocking merges.
- Important quality risks such as `any` and raw `console.*` are visible but not prevented.

Recommended fix:

- Keep report-only mode for noisy rules, but enforce no regression against baseline in CI.
- Promote individual rules to errors as counts reach zero.
- Start with `rules-of-hooks`, no-debugger, no-var, and no net-new `any` in touched backend files.

### P2 — Frontend Inventory and Current Page Counts Are Stale

`docs/FRONTEND_INVENTORY.md` is dated 2026-05-04 and lists 74 UI pages / 137 API proxy files. Current tree counts are much higher:

- 396 page files under `apps/web/pages`
- 289 API proxy files under `apps/web/pages/api`

Impact:

- UI coverage and conformance claims are outdated.
- Old placeholder/orphan notes may hide newer actual debt.

Recommended fix:

- Regenerate the frontend inventory.
- Move old inventory to an archived dated section.
- Add page/proxy count generation to the blueprint or quality report.

## Validation Performed

Read-only checks performed:

- Read `PROJECT_OVERVIEW.md`, `PROJECT_STATE.md`, `SCHEMA_REFERENCE.md`, `CONTRIBUTING.md`, `docs/AUDIT.md`, `docs/DEV_COMMANDS.md`, `docs/FRONTEND_INVENTORY.md`, and `EPIC_HISTORY.md`.
- Ran `git status --short`.
- Ran direct Prisma usage searches over `apps/api/src/routes` and `apps/api/src/services`.
- Checked live schema counts via `rg '^model '` and `rg '^enum '`.
- Checked migration directory count.
- Checked mirrored docs with `cmp`; mirrored docs passed.
- Ran `npm run guardrails`; it passed with one warning.

## Suggested Remediation Order

1. Stabilize the working tree.
2. Refresh project-state docs and schema references from live code.
3. Fix the `Request.orgId` contradiction in `PROJECT_OVERVIEW.md`.
4. Decide and encode the Prisma-layer rule.
5. Add architectural smell baselines to guardrails or quality report.
6. Reduce OpenAPI unspecced public routes.
7. Re-run frontend token/style audit and mark real exceptions.
8. Close pre-GA security items: Redis rate limits, CSP, audit logging.
9. Regenerate frontend inventory.

## Open Question

Should the repository continue enforcing the strict rule that services never call Prisma directly, or should the rule be softened to “routes never call Prisma; services may call Prisma for simple domain-local queries”? The answer determines whether the current 219 service-level Prisma lines are defects or accepted architecture.
