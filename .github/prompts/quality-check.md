# Quality Check Prompt — Maintenance Agent

Use this prompt to run a full codebase health audit. Run it after completing an epic/slice
milestone, adding a new Prisma model, or after 8+ findings have been closed since the last
audit. It covers documentation freshness, guardrail enforcement, security invariants,
technical checks, code quality, and CI hygiene.

---

Perform a comprehensive codebase health audit. Work through every section below in order
and return a structured report. Do not skip sections even if they appear clean.

## 1. Documentation freshness

### 1a. PROJECT_OVERVIEW.md
Read `PROJECT_OVERVIEW.md`. Check:
- Does the system snapshot at the bottom match the current counts (tests, suites, TS errors, audit findings)?
- Is the backend layer diagram still accurate (routes → workflows → services → repositories → Prisma)?
- Are any guardrails listed that have been relaxed, or new guardrails added that are missing?
- Does the auth helpers table match the exports in `apps/api/src/authz.ts`?

### 1b. PROJECT_STATE.md
Read `PROJECT_STATE.md`. Check:
- Does the Document Integrity table at the bottom match reality?
  Verify: model count, enum count, migration count, workflow count, repository count,
  route module count, test count/suites, frontend page count, API operations, URL paths.
- Are all guardrails (G1–G15, F1–F8, F-UI1–F-UI7) still accurate?
- Is the Backlog section up to date — any items that have been implemented but not removed?
- Is the Completed Epics table in sync with `EPIC_HISTORY.md`?
- Does State Integrity reflect the actual dev auth tokens, dev user IDs, and expiry dates?

### 1c. SCHEMA_REFERENCE.md
Read `SCHEMA_REFERENCE.md`. Check:
- Does the model count match `npx prisma migrate status` output?
- Are all models in `schema.prisma` listed?
- Are schema gotchas still accurate (`Request` no `orgId`, `Job` no `description`,
  `Appliance` no `category`, `Job.contractorId` required)?
- Is the enum count accurate?

### 1d. ARCHITECTURE_LOW_CONTEXT_GUIDE.md
Read `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`. Check:
- Does the codebase summary line match current counts?
- Are all route modules listed in the Domain File Maps section?
- Are all repositories listed?
- Are all workflows listed?
- Any new services or repositories that need to be added to the lookup tables?

### 1e. CONTRIBUTING.md
Read `CONTRIBUTING.md`. Check:
- Does the test count match the current suite (`npm test` output)?
- Is the port registry complete — every test file in `apps/api/src/__tests__/` that
  spawns a server has a port listed?
- Does the contract test guidance match what `contracts.test.ts` actually does?

### 1f. copilot-instructions.md
Read `.github/copilot-instructions.md` and scan `apps/api/src/`. Identify:
- Patterns, utilities, or naming conventions in `src/` not yet documented
- Rules in the instructions that are contradicted by actual code
- Does the monorepo structure tree match reality?
- Are file counts (pages, proxies, models, enums, migrations) accurate?

### 1g. docs/AUDIT.md
Read `docs/AUDIT.md`. Check:
- Is the summary table (findings by area, resolved vs open) accurate?
- Are any findings marked "open" that have actually been resolved in code?
- Are any findings marked "resolved" where the fix has regressed?

### 1h. docs/FRONTEND_INVENTORY.md
Read `docs/FRONTEND_INVENTORY.md`. Check:
- Does the page count match `find apps/web/pages -name '*.js' | wc -l`?
- Are any new pages missing from the inventory?
- Is the proxy conformance count accurate (all proxies using `proxyToBackend()`)?

### 1i. OpenAPI spec
Read `apps/api/openapi.yaml`. Check:
- Does `openApiSync.test.ts` pass? (It compares registered routes against the spec.)
- Are there routes in `KNOWN_UNSPECCED_ROUTES` that should now be documented?
- Any new endpoints missing from the spec?

### 1j. Environment variables
Run `grep -rn "process\.env\." apps/api/src/ --include="*.ts" -h | grep -oP 'process\.env\.\K[A-Z_]+' | sort -u`
to collect all env var references. Then read `apps/api/.env.example`. Report:
- Any `process.env.VAR` used in code but absent from `.env.example`
- Any vars in `.env.example` that appear unused in `apps/api/src/`

---

## 2. Guardrail enforcement (G1–G15)

### 2a. G1/G8: No `db push`
Search the entire repo for `db push`. Verify:
- Zero occurrences in any script, CI step, or source file
- CI step "G8: Reject prisma db push" exists in `.github/workflows/ci.yml`

### 2b. G2/G3/G9: Canonical includes
For every repository in `apps/api/src/repositories/`, verify:
- Each exports at least one `*_INCLUDE` constant (e.g. `JOB_FULL_INCLUDE`)
- No route file in `apps/api/src/routes/` contains an inline `include: {` definition
- DTO mappers in `apps/api/src/services/` use typed Prisma payloads, not `any`

### 2c. G5/G7: CI pipeline completeness
Read `.github/workflows/ci.yml`. Verify all 6 gates are present:
1. Schema drift check
2. `prisma generate`
3. `tsc --noEmit` (backend)
4. `next build` (frontend)
5. `next lint --max-warnings 0` (frontend)
6. Jest tests
7. Boot smoke curls

### 2d. G10: Contract tests
Read `apps/api/src/__tests__/contracts.test.ts`. Verify:
- Tests exist for `GET /requests`, `GET /jobs`, `GET /invoices`, `GET /leases/:id`
- Each test asserts required fields and nested relations
- Port matches `CONTRIBUTING.md` port registry (3205)

### 2e. G11: Test DB seed documentation
Check that the seed steps in `PROJECT_STATE.md` (G11) still match the actual seed
scripts that exist in `apps/api/prisma/` and `apps/api/`.

---

## 3. Security invariants

### 3a. Production boot guard (F1)
Read `apps/api/src/server.ts`. Verify:
- Server refuses to boot in production if `AUTH_OPTIONAL=true`
- Server refuses to boot in production if `DEV_IDENTITY_ENABLED=true`
- Server refuses to boot in production if `AUTH_SECRET` is not set

### 3b. Route auth enforcement
List every route handler in `apps/api/src/routes/`. For each endpoint that modifies data
(POST/PUT/PATCH/DELETE), verify it calls one of:
- `requireAuth(req, res)`
- `requireRole(req, res, role)`
- `requireAnyRole(req, res, roles[])`
- `requireTenantSession(req, res)`
Flag any mutation endpoint with no auth check.

### 3c. Tenant session isolation
Search `apps/api/src/routes/` for any tenant-portal route that accepts `tenantId` as a
query parameter instead of using `requireTenantSession()`. This is a security violation.

### 3d. Org scoping
Search `apps/api/src/` for `DEFAULT_ORG_ID`. Verify it only appears in:
- `authz.ts` (dev/test fallback)
- `orgConfig.ts` (bootstrap)
- Test files
Flag any occurrence in production code paths (routes, workflows, services).

### 3e. Hardcoded secrets
Search `apps/api/src/` for string literals that look like API keys, tokens, or passwords:
- Patterns: `sk-`, `Bearer ` followed by a literal token, base64 strings >40 chars
- Exclude test files that use `'test-secret'` (expected)

### 3f. PII in logs
Search `apps/api/src/` for `console.log` or `console.error` calls that could emit:
- Email addresses, user names, tenant names
- JWT tokens or session IDs
- Full request bodies containing PII

### 3g. `maybeRequireManager` usage
Search all route files for `maybeRequireManager`. Verify it is only used on GET (read)
endpoints. Any POST/PUT/PATCH/DELETE using it is a security violation — should use
`requireRole('MANAGER')` instead.

---

## 4. Technical checks

### 4a. TypeScript
Run `cd apps/api && npx tsc --noEmit`. Report all errors with file path and line number.

### 4b. Frontend build
Run `cd apps/web && npx next build`. Report any build errors.

### 4c. Frontend lint
Run `cd apps/web && npx next lint --max-warnings 0`. Report any errors.

### 4d. Prisma schema health
Read `apps/api/prisma/schema.prisma`. Check:
- Every model that stores user-related data has `createdAt`/`updatedAt` timestamps
- Every relation is bidirectional (both sides of a one-to-many are declared)
- No field is typed `String` where an enum would be more appropriate (look for `status`,
  `type`, `role` fields with String type)
- Run `npx prisma validate` and report any errors
- Run schema drift check:
  ```bash
  npx prisma migrate diff \
    --from-schema-datasource ./prisma/schema.prisma \
    --to-schema-datamodel ./prisma/schema.prisma --script
  ```
  Must output "empty migration"

### 4e. Zod validation coverage
List every route file in `apps/api/src/routes/`. For each POST/PUT/PATCH endpoint, check
that request body is validated with a Zod schema from `apps/api/src/validation/` before use.
Flag any route that accesses `body.*` or parsed JSON without prior Zod validation.

### 4f. Dependencies
Run `cd apps/api && npm audit --audit-level=moderate`. Report any moderate+ vulnerabilities.
Run `cd apps/web && npm audit --audit-level=moderate`. Same for frontend.
Run `npm outdated` in both `apps/api` and `apps/web`. List packages more than 2 major versions behind.

### 4g. Test suite
Run `cd apps/api && npm test -- --ci --forceExit`. Report:
- Total tests / suites passing
- Any failures with file path and test name
- Does the count match PROJECT_STATE.md (769 tests, 56 suites)?

### 4h. Boot smoke test
Start the API server and verify these endpoints return 200:
- `GET /requests?limit=1`
- `GET /jobs?limit=1`
- `GET /leases?limit=1`
- `GET /invoices?limit=1`
- `GET /contractors?limit=1`
- `GET /units?limit=1`
- `GET /buildings?limit=1`
- `GET /rental-applications?limit=1`
- `GET /rfp?limit=1`

---

## 5. Architecture compliance

### 5a. Layer violations — routes calling Prisma
Search `apps/api/src/routes/` for `prisma.` (direct Prisma calls). Every occurrence is a
layer violation (routes must delegate to workflows/services/repositories). List each with
file and line number.

### 5b. Layer violations — services calling Prisma
Search `apps/api/src/services/` for `prisma.` calls that are NOT in a repository file.
Services should use repository methods, not raw Prisma. Exclude `prismaClient.ts` (the
client re-export).

### 5c. Transition rules location
Search the codebase for status transition logic (e.g. `VALID_*_TRANSITIONS`, status
checks like `=== 'APPROVED'` or `=== 'PENDING'`). Verify all transition maps live in
`apps/api/src/workflows/transitions.ts` and nowhere else.

### 5d. Workflow structure
For every file in `apps/api/src/workflows/`, verify it follows the pattern:
- Typed `Input` / `Result` interfaces
- Calls `assert*Transition()` from transitions.ts for status changes
- Uses repository/service calls (no direct Prisma)
- Calls `emit()` for domain events where applicable
- Reloads entity with canonical include before returning

### 5e. Frontend proxy conformance
Count all `.js` files in `apps/web/pages/api/`. For each proxy route, verify it uses
`proxyToBackend()` from `apps/web/lib/proxy.js`. Flag any that use manual `fetch` to
the backend.

### 5f. Frontend styling compliance (F-UI4/F8)
Search `apps/web/pages/` for:
- `style={` (inline style objects) — flag all occurrences
- Hardcoded hex colors (`#[0-9a-fA-F]{3,6}`) in JSX — flag all
- `import` of any `.css` file other than `globals.css` — flag all

---

## 6. Code quality

### 6a. TypeScript `any`
Search `apps/api/src/` for `: any` and `as any` (exclude `__tests__/`). List every
occurrence with file path and line. Each one is a type-safety gap that violates G9.

### 6b. Dead exports
Search `apps/api/src/services/` and `apps/api/src/repositories/` for exported functions.
For each, verify it has at least one import elsewhere. Flag exports with zero consumers.

### 6c. Console.log debugging
Search `apps/api/src/` for `console.log` (exclude `__tests__/` and `server.ts`). Flag
any that appear to be debugging leftovers rather than intentional logging.

### 6d. TODO / FIXME / HACK
Search `apps/api/src/` and `apps/web/pages/` for `TODO`, `FIXME`, `HACK`, and `XXX`
comments. List each with file path, line number, and comment text. For each:
- Suggest: `create issue` / `fix inline` / `remove if stale`

### 6e. Error handling consistency
Read 3 route files in `apps/api/src/routes/`. Note the error response pattern (JSON shape,
HTTP status codes). Then scan remaining routes for deviations. Check that all routes use
the shared helpers from `apps/api/src/http/` (`sendJson`, `sendError`, `sendNotFound`).

### 6f. Include integrity
Verify that `apps/api/src/__tests__/includeIntegrity.test.ts` passes. This test ensures
every canonical include constant is valid against the Prisma schema.

---

## 7. Roadmap & backlog hygiene

### 7a. ROADMAP.json
Run `node scripts/generate-roadmap.js` (or `npm run blueprint`). Check:
- Does it complete without errors?
- Does `docs/roadmap.html` get regenerated?

### 7b. Backlog freshness
Read PROJECT_STATE.md §12 (Backlog). For each item:
- Has it already been implemented? (Search codebase for evidence)
- Is it still relevant?
- Flag any stale items that should be removed or promoted to roadmap tickets

### 7c. Audit findings
Read `docs/AUDIT.md`. For the 3 remaining open findings (SI-2/3/4):
- Are they still valid?
- Has any code been written that resolves them without updating the audit doc?

---

## Output format

Return the report with one section per heading above. For each finding:
- **File path** (as a clickable markdown link)
- **What is wrong or missing**
- **Suggested action**: one of — `create issue` / `update doc` / `fix inline` / `✅ clean`

End with a **Health summary** table:

| Section | Issues found | Priority |
|---------|-------------|----------|
| Documentation freshness | N | High / Medium / Low |
| Guardrail enforcement | N | Critical / High / Medium |
| Security invariants | N | Critical / High / Medium |
| Technical checks | N | High / Medium / Low |
| Architecture compliance | N | High / Medium / Low |
| Code quality | N | Medium / Low |
| Roadmap & backlog | N | Low |

**Overall verdict**: `Healthy` / `Needs attention` / `Critical issues found`

List the top 3 actions to take first.

---

## After completing the audit

Record the audit date so the pre-commit staleness check resets:

```bash
cd apps/api && npm run audit:record
```

This stamps `docs/.last-audit` with today's date. The pre-commit hook (`blueprint.js`)
will warn you again after 14 days or after 8+ commits touch `docs/AUDIT.md`.
