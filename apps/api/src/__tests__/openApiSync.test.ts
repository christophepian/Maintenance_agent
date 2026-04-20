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

  // Routes registered in code but not yet documented in openapi.yaml.
  // Track here so the sync test stays green while spec catches up.
  const KNOWN_UNSPECCED_ROUTES = new Set<string>([
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

  it("every spec route has a code registration", () => {
    const extra: string[] = [];
    for (const route of specRoutes) {
      if (!codeRoutes.has(route)) {
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
