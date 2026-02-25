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

  it("every code route has a spec entry", () => {
    const missing: string[] = [];
    for (const route of codeRoutes) {
      if (!specRoutes.has(route)) {
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
      "ApplianceDTO",
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
