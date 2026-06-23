/**
 * OpenAPI Spec ↔ Router Synchronization Test
 *
 * Ensures the OpenAPI spec (openapi.yaml) stays in sync with the actual
 * route registrations in the codebase.  Detects:
 *   • Routes registered in code but missing from the spec
 *   • Routes in the spec but not registered in code
 *
 * This is a unit test — no running server required.
 */

import * as fs from "fs";
import * as path from "path";

/* ── Parse OpenAPI YAML (simple regex — no yaml library needed) ── */

function extractSpecRoutes(yamlContent: string): Set<string> {
  const routes = new Set<string>();
  const lines = yamlContent.split("\n");

  let currentPath: string | null = null;
  let inPaths = false;

  for (const line of lines) {
    // Detect the top-level `paths:` key
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }

    if (!inPaths) continue;

    // A new top-level key ends the paths section
    if (/^[a-z]/.test(line) && !line.startsWith(" ") && !line.startsWith("#")) {
      inPaths = false;
      continue;
    }

    // Path entry: exactly 2 spaces + /path:
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      // Convert OpenAPI {id} to router :id
      currentPath = pathMatch[1].replace(/\{([^}]+)\}/g, ":$1");
      continue;
    }

    // Method entry: exactly 4 spaces + method:
    const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
    if (methodMatch && currentPath) {
      routes.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
  }

  return routes;
}

/* ── Parse router registrations from source files ── */

function extractCodeRoutes(routesDir: string): Set<string> {
  const routes = new Set<string>();
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), "utf-8");

    // Match: router.get("/path", ...) or router.post("/path/:id/action", ...)
    const regex = /router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      routes.add(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }

  return routes;
}

/* ── Also extract addCustom routes ── */

function extractCustomRoutes(routesDir: string): Set<string> {
  const routes = new Set<string>();
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), "utf-8");

    // Match labels like: "GET /invoices/:id/qr-code.png"
    // These appear as the last string argument of router.addCustom(...)
    // Use dotAll (s) flag so . matches newlines
    const regex = /router\.addCustom\([\s\S]*?["']((GET|POST|PUT|PATCH|DELETE)\s+\/[^"']+)["']\s*,?\s*\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      routes.add(match[1]);
    }
  }

  return routes;
}

/* ── Tests ── */

describe("OpenAPI spec ↔ Router sync", () => {
  const specPath = path.resolve(__dirname, "../../openapi.yaml");
  const routesDir = path.resolve(__dirname, "../routes");

  let specRoutes: Set<string>;
  let codeRoutes: Set<string>;

  beforeAll(() => {
    const yaml = fs.readFileSync(specPath, "utf-8");
    specRoutes = extractSpecRoutes(yaml);

    codeRoutes = extractCodeRoutes(routesDir);
    const customRoutes = extractCustomRoutes(routesDir);
    for (const r of customRoutes) codeRoutes.add(r);
  });

  it("spec file exists and contains routes", () => {
    expect(specRoutes.size).toBeGreaterThan(50);
  });

  it("code routes exist", () => {
    expect(codeRoutes.size).toBeGreaterThan(50);
  });

  // ── Unspecced-route allowlist, split by intent (CRITICAL_AUDIT_2026-06-23) ──
  //
  // INTENTIONALLY_PRIVATE_ROUTES: dev/demo-only endpoints that must NEVER appear
  // in the public OpenAPI spec. This set may grow (new dev tooling is fine).
  //
  // PUBLIC_UNSPECCED_ROUTES: public routes that SHOULD be in openapi.yaml but
  // aren't yet. This is debt. A budget test below pins its size so it can only
  // SHRINK — a new public route must be added to the spec, not parked here.
  // To document a public route: add it to apps/api/openapi.yaml, delete it from
  // this set, and lower PUBLIC_UNSPECCED_BUDGET to match.

  const INTENTIONALLY_PRIVATE_ROUTES = new Set<string>([
    // Dev-only impersonation endpoints — never exposed in the public spec
    "GET /__dev/tenant-list",
    "POST /__dev/tenant-login",
    // Sandbox/demo provisioning — runtime-gated by SANDBOX_MODE, not public API
    "POST /sandbox/setup",
    "POST /sandbox/seed",
  ]);

  const PUBLIC_UNSPECCED_ROUTES = new Set<string>([
    // API-04: Strategy Engine routes (added 2026-04-16, spec pending)
    "POST /strategy/owner-profile",
    "GET /strategy/owner-profile/:ownerId",
    "POST /strategy/building-profile",
    "GET /strategy/building-profile/:buildingId",
    // API-05: Decision Options & Recommendations routes (added 2026-04-16, spec pending)
    "POST /decision-options",
    "GET /decision-options/:opportunityId",
    "POST /recommendations/evaluate",
    "GET /recommendations/:opportunityId",
    "PATCH /recommendations/:resultId/decision",
    // API-06: New routes added in Strategy & Capture Hardening epic (2026-04-16, spec pending)
    "GET /tenant-portal/invoices/:id/qr-bill",
    "POST /tenant-portal/capture-sessions",
    "GET /tenant-portal/capture-sessions/:id",
    "GET /invoices/:id/source-file",
    "GET /requests/:id/claim-analysis",
    "POST /requests/:id/manager-reject",
    // API-07: Asset inventory management routes (Appliance→Asset migration, spec pending)
    "GET /asset-topic-suggestions",
    "PATCH /assets/:id",
    "DELETE /assets/:id",
    // API-08: Routes added 2026-04-24, spec pending
    "GET /units/:id/unlinked-jobs",
    "PATCH /requests/:id/asset",
    "GET /strategy/owner-profile-current",
    // API-09: Imported statements & owner people routes (added 2026-05, spec pending)
    "POST /imported-statements/upload",
    "GET /imported-statements/batch/:batchId",
    "DELETE /imported-statements/batch/:batchId",
    "GET /imported-statements/batches",
    "GET /imported-statements",
    "GET /imported-statements/:id",
    "POST /imported-statements/:id/approve",
    "POST /imported-statements/:id/reject",
    "GET /imported-statements/:id/ledger-preview",
    "POST /imported-statements/:id/re-extract",
    "PATCH /imported-statements/:id/building",
    "DELETE /imported-statements/:id",
    "DELETE /imported-statements",
    "PATCH /imported-statements/:id/balances/:balanceId",
    "DELETE /imported-statements/:id/balances/:balanceId",
    "POST /imported-statements/:id/balances",
    "GET /people/owners/:id",
    "PATCH /people/owners/:id",
    "GET /buildings/:id/house-rules-pdf",
    "POST /people/owners/:id/sync-buildings",
    "POST /buildings/:id/seed-default-assets",
    "POST /units/:id/seed-default-assets",
    "GET /ledger/balance-sheet",
    "GET /listings",
    // API-10: NPV scenarios route (added 2026-05, spec pending)
    "GET /buildings/:id/npv-scenarios",
    // API-11: Routes added 2026-06 (correspondence, reporting timeseries, complaint patches,
    //         renovation opportunities, legal-sources, invoice swap — spec pending)
    "GET /correspondence/:id",
    "PATCH /correspondence/:id",
    "DELETE /correspondence/:id",
    "POST /correspondence/:id/ai-draft",
    "POST /correspondence/:id/send",
    "GET /tenant-portal/letters",
    "GET /tenant-portal/letters/:id",
    "POST /tenant-portal/letters/:id/respond",
    "GET /owner/letters",
    "GET /financials/portfolio-monthly",
    "GET /buildings/:id/timeseries",
    "GET /buildings/:id/period-report",
    "GET /units/:id/period-report",
    "GET /buildings/:id/unit-financials",
    "GET /buildings/:id/legal-sources",
    "GET /buildings/:id/renovation-opportunities",
    "POST /invoices/:id/swap-parties",
    "PATCH /requests/:id/resolution",
    "PATCH /requests/:id/type",
    "POST /requests/:id/warning-letter",
    // API-12: Base correspondence routes + tenant departure + NPV plan scenarios (added 2026-06, spec pending)
    "GET /correspondence",
    "POST /correspondence",
    "POST /tenant-portal/leases/:id/give-notice",
    "GET /cashflow-plans/:id/npv-scenarios",
    // API-13: Condition report routes (added 2026-06, spec pending)
    "GET /units/:id/condition-reports",
    "POST /units/:id/condition-reports",
    "GET /condition-reports/:id",
    "POST /condition-reports/:id/approve",
    "POST /condition-reports/:id/reopen",
    "GET /tenant-portal/condition-reports",
    "GET /tenant-portal/condition-reports/:id",
    "POST /tenant-portal/condition-reports/:id/items",
    "PATCH /tenant-portal/condition-reports/:id/items/:itemId",
    "DELETE /tenant-portal/condition-reports/:id/items/:itemId",
    "POST /tenant-portal/condition-reports/:id/items/:itemId/photos",
    "DELETE /tenant-portal/condition-reports/:id/items/:itemId/photos/:photoId",
    "GET /condition-report-photos/:photoId",
    "POST /tenant-portal/condition-reports/:id/submit",
    // API-14: Ancillary costs / billing periods / charge reconciliation / credit
    //         notes / mortgages + valuation (nebenkosten v3 + levered NPV epics,
    //         added 2026-06, catalogued 2026-06-23 — these had silently fallen out
    //         of sync; spec pending)
    "GET /ancillary-cost-categories",
    "POST /ancillary-cost-categories",
    "PUT /ancillary-cost-categories/:id",
    "POST /ancillary-cost-categories/seed",
    "GET /billing-periods",
    "POST /billing-periods",
    "GET /billing-periods/:id",
    "PUT /billing-periods/:id",
    "POST /billing-periods/:id/cost-entries",
    "DELETE /billing-periods/:id/cost-entries/:eid",
    "POST /billing-periods/:id/qualify-invoice",
    "GET /billing-periods/:id/apportionment/:lid",
    "GET /charge-distribution",
    "PUT /charge-distribution",
    "GET /flat-rate",
    "GET /unit-reconciliation",
    "POST /unit-reconciliation/settle",
    "GET /charge-reconciliations/:id/doc-requests",
    "POST /charge-reconciliations/:id/doc-requests",
    "POST /charge-reconciliations/:id/doc-requests/:rid/fulfill",
    "GET /charge-reconciliations/:id/supporting-documents",
    "POST /charge-reconciliations/:id/autofill",
    // GET /credit-notes + GET /credit-notes/:id graduated into openapi.yaml 2026-06-23
    "GET /buildings/:id/mortgages",
    "POST /buildings/:id/mortgages",
    "PUT /mortgages/:id",
    "DELETE /mortgages/:id",
    "PUT /buildings/:id/valuation",
  ]);

  // Regression budget: the public-unspecced backlog may only shrink. Lower this
  // each time a route graduates into openapi.yaml. (Audit 2026-06-23 baseline:
  // 84 prior + 29 catalogued from the API-14 backfill = 113; −2 credit-notes
  // graduated into the spec = 111.)
  const PUBLIC_UNSPECCED_BUDGET = 111;

  const KNOWN_UNSPECCED_ROUTES = new Set<string>([
    ...INTENTIONALLY_PRIVATE_ROUTES,
    ...PUBLIC_UNSPECCED_ROUTES,
  ]);

  it("every code route has a spec entry", () => {
    const missing: string[] = [];
    for (const route of codeRoutes) {
      if (!specRoutes.has(route) && !KNOWN_UNSPECCED_ROUTES.has(route)) {
        missing.push(route);
      }
    }

    expect(missing).toEqual([]);
    // If this fails, add the missing routes to apps/api/openapi.yaml
  });

  it("public-unspecced backlog does not grow beyond budget", () => {
    // No net increase in public routes that bypass the spec. If this fails you
    // added a public route to PUBLIC_UNSPECCED_ROUTES instead of openapi.yaml —
    // document it in the spec, or (if it's genuinely dev/demo-only) move it to
    // INTENTIONALLY_PRIVATE_ROUTES.
    expect(PUBLIC_UNSPECCED_ROUTES.size).toBeLessThanOrEqual(PUBLIC_UNSPECCED_BUDGET);
  });

  it("private and public allowlists do not overlap", () => {
    const overlap = [...INTENTIONALLY_PRIVATE_ROUTES].filter((r) =>
      PUBLIC_UNSPECCED_ROUTES.has(r),
    );
    expect(overlap).toEqual([]);
  });

  it("every spec route has a code registration", () => {
    // Routes handled inline in server.ts (not via the Router) — kept here so
    // the sync test stays green. Currently: T-03 health probe.
    const INLINE_SERVER_ROUTES = new Set<string>(["GET /health"]);

    const extra: string[] = [];
    for (const route of specRoutes) {
      if (!codeRoutes.has(route) && !INLINE_SERVER_ROUTES.has(route)) {
        extra.push(route);
      }
    }

    expect(extra).toEqual([]);
    // If this fails, either add the route to code or remove from openapi.yaml
  });

  it("all operationIds are unique", () => {
    const yaml = fs.readFileSync(specPath, "utf-8");
    const opIds: string[] = [];
    const regex = /operationId:\s*(\S+)/g;
    let match;
    while ((match = regex.exec(yaml)) !== null) {
      opIds.push(match[1]);
    }

    const dupes = opIds.filter((id, i) => opIds.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    // If this fails, fix duplicate operationIds in openapi.yaml
  });

  it("spec contains all expected DTO schemas", () => {
    const yaml = fs.readFileSync(specPath, "utf-8");
    const expectedSchemas = [
      "MaintenanceRequestDTO",
      "JobDTO",
      "InvoiceDTO",
      "LeaseDTO",
      "ContractorDTO",
      "TenantDTO",
      "BuildingDTO",
      "UnitDTO",
      "NotificationDTO",
      "ApprovalRuleDTO",
      "BillingEntityDTO",
      "ErrorResponse",
    ];

    for (const schema of expectedSchemas) {
      expect(yaml).toContain(`${schema}:`);
    }
  });
});
