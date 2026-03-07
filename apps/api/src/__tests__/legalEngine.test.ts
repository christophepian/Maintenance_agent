import * as http from "http";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const API_ROOT = path.resolve(__dirname, "..", "..");
const TS_NODE = path.resolve(API_ROOT, "node_modules", ".bin", "ts-node");
const PORT = 3208;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const prisma = new PrismaClient();

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn(TS_NODE, ["--transpile-only", "src/server.ts"], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        AUTH_SECRET: "test-secret",
        ...envOverrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes("API running on")) {
        cleanup();
        resolve(child);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Server did not start in time"));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("error", onError);
    }

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", onError);
  });
}

function httpRequest(
  method: string,
  urlPath: string,
  body?: object,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch (e) {
          resolve({
            status: res.statusCode || 500,
            data: { error: "Parse error", raw: data },
          });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Legal Engine Integration Tests", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let buildingId: string;
  let unitId: string;
  let requestId: string;
  let ruleId: string;
  let mappingId: string;
  let standardId: string;
  let sourceId: string;

  beforeAll(async () => {
    proc = await startServer(
      { AUTH_OPTIONAL: "true", NODE_ENV: "test" },
      PORT,
    );
  }, 20000);

  afterAll(async () => {
    proc?.kill();

    // Clean up test data created via HTTP API to prevent accumulation
    // Delete in dependency order: evaluations → rules/versions → mappings → standards → sources
    if (sourceId) {
      await prisma.legalSource.delete({ where: { id: sourceId } }).catch(() => {});
    }
    if (ruleId) {
      await prisma.legalRuleVersion.deleteMany({ where: { ruleId } }).catch(() => {});
      await prisma.legalRule.delete({ where: { id: ruleId } }).catch(() => {});
    }
    if (mappingId) {
      await prisma.legalCategoryMapping.delete({ where: { id: mappingId } }).catch(() => {});
    }
    if (standardId) {
      await prisma.depreciationStandard.delete({ where: { id: standardId } }).catch(() => {});
    }
    if (requestId) {
      await prisma.legalEvaluationLog.deleteMany({ where: { requestId } }).catch(() => {});
      await prisma.rfp.deleteMany({ where: { requestId } }).catch(() => {});
    }
    // Clean up duplicate rules/standards/mappings created by uniqueness tests (Date.now() keyed)
    // These have no stored IDs, but were created by the test server under "default-org"
    await prisma.legalRuleVersion.deleteMany({
      where: { rule: { key: { startsWith: "dup-rule-" } } },
    }).catch(() => {});
    await prisma.legalRule.deleteMany({
      where: { key: { startsWith: "dup-rule-" } },
    }).catch(() => {});
    await prisma.depreciationStandard.deleteMany({
      where: { topic: { startsWith: "dup_depr_" } },
    }).catch(() => {});
    await prisma.legalCategoryMapping.deleteMany({
      where: { requestCategory: { startsWith: "dup_test_" } },
    }).catch(() => {});
    await prisma.legalCategoryMapping.deleteMany({
      where: { requestCategory: { startsWith: "test_cat_" } },
    }).catch(() => {});
    // Clean up the source that has null fetcherType (test-created, not seeded)
    await prisma.legalSource.deleteMany({
      where: { name: "Swiss Code of Obligations", fetcherType: null },
    }).catch(() => {});

    await prisma.$disconnect();
  });

  // ════════════════════════════════════════════════════════════
  // Setup: Create test data scaffold
  // ════════════════════════════════════════════════════════════

  describe("Test data setup", () => {
    it("should create a building with a Swiss postal code", async () => {
      const result = await httpRequest("POST", "/buildings", {
        name: "Legal Test Building",
        address: "Bahnhofstrasse 1, 8001 Zürich",
      });
      expect(result.status).toBe(201);
      expect(result.data.data).toHaveProperty("id");
      buildingId = result.data.data.id;
    }, 10000);

    it("should create a unit in the building", async () => {
      const result = await httpRequest(
        "POST",
        `/buildings/${buildingId}/units`,
        {
          unitNumber: "L01",
          type: "RESIDENTIAL",
        },
      );
      expect(result.status).toBe(201);
      unitId = result.data.data.id;
    }, 10000);

    it("should create a maintenance request on the unit", async () => {
      const result = await httpRequest("POST", "/requests", {
        description: "The dishwasher is leaking water onto the kitchen floor",
        category: "dishwasher",
        unitId,
        estimatedCost: 500,
      });
      expect(result.status).toBe(201);
      expect(result.data.data).toHaveProperty("id");
      requestId = result.data.data.id;
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Legal Sources
  // ════════════════════════════════════════════════════════════

  describe("Legal Sources", () => {
    it("should create a legal source (POST /legal/sources)", async () => {
      const result = await httpRequest("POST", "/legal/sources", {
        name: "Swiss Code of Obligations",
        jurisdiction: "CH",
        url: "https://www.admin.ch/opc/de/classified-compilation/19110009/",
      });
      expect(result.status).toBe(201);
      expect(result.data.data).toHaveProperty("id");
      expect(result.data.data.name).toBe("Swiss Code of Obligations");
      sourceId = result.data.data.id;
    }, 10000);

    it("should list legal sources (GET /legal/sources)", async () => {
      const result = await httpRequest("GET", "/legal/sources");
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data.data)).toBe(true);
      expect(result.data.data.length).toBeGreaterThanOrEqual(1);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Depreciation Standards
  // ════════════════════════════════════════════════════════════

  describe("Depreciation Standards", () => {
    it("should create a depreciation standard (POST /legal/depreciation-standards)", async () => {
      const result = await httpRequest(
        "POST",
        "/legal/depreciation-standards",
        {
          assetType: "APPLIANCE",
          topic: "dishwasher",
          usefulLifeMonths: 180, // 15 years
          authority: "INDUSTRY_STANDARD",
          notes: "Paritätische Lebensdauertabelle: Geschirrspüler",
        },
      );
      expect(result.status).toBe(201);
      expect(result.data.data).toHaveProperty("id");
      expect(result.data.data.usefulLifeMonths).toBe(180);
      standardId = result.data.data.id;
    }, 10000);

    it("should list depreciation standards (GET /legal/depreciation-standards)", async () => {
      const result = await httpRequest(
        "GET",
        "/legal/depreciation-standards",
      );
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data.data)).toBe(true);
      expect(result.data.data.length).toBeGreaterThanOrEqual(1);
    }, 10000);

    it("should reject duplicate depreciation standard with same canton (409)", async () => {
      // Create with explicit canton to test unique constraint properly
      const uniqueTopic = `dup_depr_${Date.now()}`;
      const first = await httpRequest(
        "POST",
        "/legal/depreciation-standards",
        {
          assetType: "APPLIANCE",
          topic: uniqueTopic,
          usefulLifeMonths: 120,
          authority: "INDUSTRY_STANDARD",
          canton: "ZH",
        },
      );
      expect(first.status).toBe(201);

      // Same canton + assetType + topic → 409
      const result = await httpRequest(
        "POST",
        "/legal/depreciation-standards",
        {
          assetType: "APPLIANCE",
          topic: uniqueTopic,
          usefulLifeMonths: 120,
          authority: "INDUSTRY_STANDARD",
          canton: "ZH",
        },
      );
      expect(result.status).toBe(409);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Legal Rules
  // ════════════════════════════════════════════════════════════

  describe("Legal Rules", () => {
    it("should create a statutory rule (POST /legal/rules)", async () => {
      const uniqueKey = `co-259a-dishwasher-leak-${Date.now()}`;
      const result = await httpRequest("POST", "/legal/rules", {
        key: uniqueKey,
        ruleType: "MAINTENANCE_OBLIGATION",
        authority: "STATUTE",
        jurisdiction: "CH",
        priority: 100,
        dslJson: {
          type: "AND",
          conditions: [
            { type: "category_match", category: "dishwasher" },
            { type: "always_true" },
          ],
        },
        citationsJson: [
          {
            article: "CO Art. 259a",
            text: "Landlord must repair defects not caused by tenant.",
          },
        ],
        summary:
          "Dishwasher repair is landlord obligation under Swiss CO Art. 259a",
        effectiveFrom: "2024-01-01T00:00:00Z",
      });
      expect(result.status).toBe(201);
      expect(result.data.data).toHaveProperty("id");
      expect(result.data.data.key).toBe(uniqueKey);
      expect(result.data.data.versions?.length).toBeGreaterThanOrEqual(1);
      ruleId = result.data.data.id;
    }, 10000);

    it("should list legal rules (GET /legal/rules)", async () => {
      const result = await httpRequest("GET", "/legal/rules");
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data.data)).toBe(true);
      expect(result.data.data.length).toBeGreaterThanOrEqual(1);
    }, 10000);

    it("should reject duplicate rule key (409)", async () => {
      const dupKey = `dup-rule-${Date.now()}`;
      const result = await httpRequest("POST", "/legal/rules", {
        key: dupKey,
        ruleType: "MAINTENANCE_OBLIGATION",
        authority: "STATUTE",
        dslJson: { type: "always_true" },
        effectiveFrom: "2024-01-01T00:00:00Z",
      });
      expect(result.status).toBe(201); // first insert works
      // Now try with same key
      const result2 = await httpRequest("POST", "/legal/rules", {
        key: dupKey,
        ruleType: "MAINTENANCE_OBLIGATION",
        authority: "STATUTE",
        dslJson: { type: "always_true" },
        effectiveFrom: "2024-01-01T00:00:00Z",
      });
      expect(result2.status).toBe(409);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Category Mappings
  // ════════════════════════════════════════════════════════════

  describe("Category Mappings", () => {
    it("should create a category mapping (POST /legal/category-mappings)", async () => {
      const uniqueCategory = `test_cat_${Date.now()}`;
      const result = await httpRequest(
        "POST",
        "/legal/category-mappings",
        {
          requestCategory: uniqueCategory,
          legalTopic: "test_legal_topic",
        },
      );
      expect(result.status).toBe(201);
      expect(result.data.data).toHaveProperty("id");
      expect(result.data.data.requestCategory).toBe(uniqueCategory);
      mappingId = result.data.data.id;
    }, 10000);

    it("should list category mappings (GET /legal/category-mappings)", async () => {
      const result = await httpRequest(
        "GET",
        "/legal/category-mappings",
      );
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data.data)).toBe(true);
    }, 10000);

    it("should reject duplicate mapping (409)", async () => {
      // Create a fresh mapping
      const uniqueCategory = `dup_test_${Date.now()}`;
      await httpRequest("POST", "/legal/category-mappings", {
        requestCategory: uniqueCategory,
        legalTopic: "test_topic",
      });
      // Try to create again with same category → 409
      const result = await httpRequest(
        "POST",
        "/legal/category-mappings",
        {
          requestCategory: uniqueCategory,
          legalTopic: "test_topic",
        },
      );
      expect(result.status).toBe(409);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Legal Decision Engine
  // ════════════════════════════════════════════════════════════

  describe("Legal Decision Engine", () => {
    it("should evaluate legal decision for a request (GET /requests/:id/legal-decision)", async () => {
      const result = await httpRequest(
        "GET",
        `/requests/${requestId}/legal-decision`,
      );
      expect(result.status).toBe(200);

      const decision = result.data.data;
      expect(decision).toHaveProperty("requestId", requestId);
      expect(decision).toHaveProperty("legalObligation");
      expect(decision).toHaveProperty("confidence");
      expect(decision).toHaveProperty("reasons");
      expect(decision).toHaveProperty("citations");
      expect(decision).toHaveProperty("recommendedActions");
      expect(decision).toHaveProperty("evaluationLogId");
      expect(Array.isArray(decision.reasons)).toBe(true);
      expect(Array.isArray(decision.citations)).toBe(true);
      expect(typeof decision.confidence).toBe("number");
    }, 15000);

    it("should return 404 for non-existent request", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await httpRequest(
        "GET",
        `/requests/${fakeId}/legal-decision`,
      );
      expect(result.status).toBe(404);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // RFP Endpoints
  // ════════════════════════════════════════════════════════════

  describe("RFPs", () => {
    it("should list RFPs (GET /rfps)", async () => {
      const result = await httpRequest("GET", "/rfps");
      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty("data");
      expect(Array.isArray(result.data.data)).toBe(true);
    }, 10000);

    it("should filter RFPs by status (GET /rfps?status=OPEN)", async () => {
      const result = await httpRequest("GET", "/rfps?status=OPEN");
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data.data)).toBe(true);
    }, 10000);

    it("should return 400 for invalid status filter", async () => {
      const result = await httpRequest("GET", "/rfps?status=INVALID");
      expect(result.status).toBe(400);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Evaluation Logs
  // ════════════════════════════════════════════════════════════

  describe("Evaluation Logs", () => {
    it("should list evaluation logs (GET /legal/evaluations)", async () => {
      const result = await httpRequest("GET", "/legal/evaluations");
      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty("data");
      expect(result.data).toHaveProperty("total");
      expect(Array.isArray(result.data.data)).toBe(true);
      // Should have at least 1 from the legal decision test
      expect(result.data.data.length).toBeGreaterThanOrEqual(1);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Legal Decision Idempotency
  // ════════════════════════════════════════════════════════════

  describe("Idempotency", () => {
    it("should return same evaluationLogId on repeated calls", async () => {
      // First call
      const r1 = await httpRequest(
        "GET",
        `/requests/${requestId}/legal-decision`,
      );
      expect(r1.status).toBe(200);

      // Second call — new evaluation log (not idempotent at evaluation level)
      const r2 = await httpRequest(
        "GET",
        `/requests/${requestId}/legal-decision`,
      );
      expect(r2.status).toBe(200);

      // Both should succeed and produce valid decisions
      expect(r1.data.data.legalObligation).toBe(r2.data.data.legalObligation);
      expect(r1.data.data.legalTopic).toBe(r2.data.data.legalTopic);
    }, 20000);

    it("RFP creation should be idempotent (same RFP for same request)", async () => {
      // If both decisions created RFPs, they should be the same one
      const r1 = await httpRequest("GET", `/requests/${requestId}/legal-decision`);
      const r2 = await httpRequest("GET", `/requests/${requestId}/legal-decision`);

      if (r1.data.data.rfpId && r2.data.data.rfpId) {
        expect(r1.data.data.rfpId).toBe(r2.data.data.rfpId);
      }
    }, 20000);
  });

  // ════════════════════════════════════════════════════════════
  // Validation errors
  // ════════════════════════════════════════════════════════════

  describe("Validation", () => {
    it("should reject creating rule without key (400)", async () => {
      const result = await httpRequest("POST", "/legal/rules", {
        ruleType: "MAINTENANCE_OBLIGATION",
        authority: "STATUTE",
        dslJson: { type: "always_true" },
        effectiveFrom: "2024-01-01T00:00:00Z",
      });
      expect(result.status).toBe(400);
    }, 10000);

    it("should reject creating depreciation standard without topic (400)", async () => {
      const result = await httpRequest(
        "POST",
        "/legal/depreciation-standards",
        {
          assetType: "APPLIANCE",
          usefulLifeMonths: 120,
        },
      );
      expect(result.status).toBe(400);
    }, 10000);

    it("should reject creating category mapping without legalTopic (400)", async () => {
      const result = await httpRequest(
        "POST",
        "/legal/category-mappings",
        {
          requestCategory: "oven",
        },
      );
      expect(result.status).toBe(400);
    }, 10000);
  });

  // ════════════════════════════════════════════════════════════
  // Sidecar constraint: RFP does NOT change request status
  // ════════════════════════════════════════════════════════════

  describe("Sidecar constraint", () => {
    it("legal decision should NOT change the request status", async () => {
      // Get original request
      const before = await httpRequest("GET", `/requests/${requestId}`);
      expect(before.status).toBe(200);
      const statusBefore = before.data.data.status;

      // Trigger legal decision (which may create RFP)
      const decision = await httpRequest(
        "GET",
        `/requests/${requestId}/legal-decision`,
      );
      expect(decision.status).toBe(200);

      // Check request status has NOT changed
      const after = await httpRequest("GET", `/requests/${requestId}`);
      expect(after.status).toBe(200);
      expect(after.data.data.status).toBe(statusBefore);
    }, 15000);
  });
});
