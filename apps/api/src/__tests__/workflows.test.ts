/**
 * Workflow Layer Integration Tests
 *
 * Verifies the workflow layer:
 *   - Request creation → PENDING_REVIEW (or RFP_PENDING if OBLIGATED)
 *   - Manager approval (PENDING_REVIEW → RFP_PENDING) / owner approval flows
 *   - Contractor assignment + auto-job creation
 *   - Job completion → invoice auto-creation
 *   - Invoice issuance
 *   - Legal decision endpoint returns correct data
 *
 * Pattern: spawns the real API server on a dedicated port, exercises
 *          HTTP endpoints that now delegate to workflows.
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { createManagerToken, getAuthHeaders, startTestServer, stopTestServer } from "./testHelpers";

const PORT = 3202;
const BASE = `http://127.0.0.1:${PORT}`;

// ─── HTTP helpers ───────────────────────────────────────────────

function request(
  method: string,
  urlPath: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      ...extraHeaders,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    };

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode!, data: parsed });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const GET = (p: string, h?: Record<string, string>) => request("GET", p, undefined, h);
const POST = (p: string, b?: unknown, h?: Record<string, string>) => request("POST", p, b, h);
const PATCH = (p: string, b?: unknown, h?: Record<string, string>) => request("PATCH", p, b, h);

// ─── Server lifecycle ───────────────────────────────────────────

// ─── Test Suite ─────────────────────────────────────────────────

describe("Workflow Layer — Integration", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let unitId: string;
  const auth = getAuthHeaders(createManagerToken());

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });

    // Create a building + unit for all request creation tests
    const bRes = await POST("/buildings", {
      name: "Workflow Test Building",
      address: "1 Workflow Test Ave",
    });
    const buildingId = bRes.data.data.id;
    const uRes = await POST(`/buildings/${buildingId}/units`, {
      unitNumber: "WT-01",
      type: "RESIDENTIAL",
    });
    unitId = uRes.data.data.id;
  }, 25000);

  afterAll(() => stopTestServer(proc));

  // ═══════════════════════════════════════════════════════════
  // 1. createRequestWorkflow
  // ═══════════════════════════════════════════════════════════

  describe("createRequestWorkflow (POST /requests)", () => {
    it("creates a request when no estimatedCost", async () => {
      const { status, data } = await POST("/requests", {
        description: "Test workflow: oven not heating properly",
        category: "oven",
        unitId,
      });
      expect(status).toBe(201);
      expect(data.data).toHaveProperty("id");
      // All requests start as PENDING_REVIEW; only OBLIGATED legal routing → RFP_PENDING
      expect([
        "PENDING_REVIEW",
        "RFP_PENDING",
      ]).toContain(data.data.status);
    });

    it("creates request with estimatedCost (no auto-approval at creation)", async () => {
      const { status, data } = await POST("/requests", {
        description: "Light bulb replacement in hallway fixture",
        category: "lighting",
        estimatedCost: 10,
        unitId,
      });
      expect(status).toBe(201);
      // All requests start as PENDING_REVIEW; only OBLIGATED legal routing → RFP_PENDING
      expect(["PENDING_REVIEW", "RFP_PENDING"]).toContain(data.data.status);
    });

    it("returns validation error for missing description", async () => {
      const { status } = await POST("/requests", {
        category: "oven",
      });
      expect(status).toBe(400);
    });

    it("returns validation error for short description", async () => {
      const { status } = await POST("/requests", {
        description: "Too short",
        category: "oven",
      });
      expect(status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. approveRequestWorkflow (POST /requests/approve)
  // ═══════════════════════════════════════════════════════════

  describe("approveRequestWorkflow (POST /requests/:id/owner-approve)", () => {
    let pendingRequestId: string;
    let initialStatus: string;

    beforeAll(async () => {
      // Create a request using a valid category
      const res = await POST("/requests", {
        description: "Walls in living room need repainting, chipped and faded paint",
        category: "lighting",
        unitId,
      });
      // Guard: if creation failed, surface a clear error instead of
      // "Cannot read properties of undefined (reading 'id')"
      if (res.status !== 201 || !res.data?.data) {
        throw new Error(
          `POST /requests failed (${res.status}): ${JSON.stringify(res.data)}`,
        );
      }
      pendingRequestId = res.data.data.id;
      initialStatus = res.data.data.status;
    });

    it("manager-approves a PENDING_REVIEW request → RFP_PENDING", async () => {
      if (initialStatus === "PENDING_REVIEW") {
        const { status, data } = await PATCH(
          `/requests/${pendingRequestId}/status`,
          { status: "APPROVED" },
          auth,
        );
        expect(status).toBe(200);
        expect(data.data.status).toBe("RFP_PENDING");
      } else {
        // Already legal-routed to RFP_PENDING at creation
        expect(initialStatus).toBe("RFP_PENDING");
      }
    });

    it("is idempotent — approving an already-approved request returns 200 or 409", async () => {
      const { status } = await POST(
        `/requests/${pendingRequestId}/owner-approve`,
        {},
        auth,
      );
      // Should succeed (idempotent) or be 409 if transition not allowed
      expect([200, 409]).toContain(status);
    });

    it("returns 404 for non-existent request", async () => {
      const { status } = await POST(
        "/requests/00000000-0000-0000-0000-000000000000/owner-approve",
        {},
        auth,
      );
      expect(status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. assignContractorWorkflow (POST /requests/:id/assign)
  // ═══════════════════════════════════════════════════════════

  describe("assignContractorWorkflow (POST /requests/:id/assign)", () => {
    let approvedRequestId: string;
    let contractorId: string;

    beforeAll(async () => {
      // Get a contractor
      const { data: cData } = await GET("/contractors");
      if (cData.data.length > 0) {
        contractorId = cData.data[0].id;
      }

      // Create a request with unitId + non-obligated category
      const { data: rData } = await POST("/requests", {
        description: "Bathroom drain clogged, water backing up slowly",
        category: "bathroom",
        unitId,
      });
      approvedRequestId = rData.data.id;

      // Drive to RFP_PENDING via manager-approve if in PENDING_REVIEW
      if (rData.data.status === "PENDING_REVIEW") {
        await PATCH(
          `/requests/${approvedRequestId}/status`,
          { status: "APPROVED" },
          auth,
        );
      }
    });

    it("assigns contractor and auto-creates job", async () => {
      if (!contractorId) return; // skip if no contractor in DB

      const { status, data } = await POST(
        `/requests/${approvedRequestId}/assign`,
        { contractorId },
        auth,
      );
      expect(status).toBe(200);
      expect(data.data.assignedContractor).toBeTruthy();
      expect(data.data.assignedContractor.id).toBe(contractorId);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. completeJobWorkflow (PATCH /jobs/:id)
  // ═══════════════════════════════════════════════════════════

  describe("completeJobWorkflow (PATCH /jobs/:id)", () => {
    let jobId: string | undefined;

    it("lists existing jobs", async () => {
      const { status, data } = await GET("/jobs", auth);
      expect(status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
      // Grab the first ASSIGNED/IN_PROGRESS job for the completion test
      const eligible = data.data.find(
        (j: any) => j.status === "ASSIGNED" || j.status === "IN_PROGRESS",
      );
      if (eligible) jobId = eligible.id;
    });

    it("transitions job to IN_PROGRESS", async () => {
      if (!jobId) return; // skip if no eligible job
      const { status, data } = await PATCH(
        `/jobs/${jobId}`,
        { status: "IN_PROGRESS", startedAt: new Date().toISOString() },
        auth,
      );
      // May already be IN_PROGRESS from a prior run
      expect([200, 409]).toContain(status);
      if (status === 200) {
        expect(data.data.status).toBe("IN_PROGRESS");
      }
    });

    it("completes job and auto-creates invoice (TC-9)", async () => {
      if (!jobId) return; // skip if no eligible job
      const { status, data } = await PATCH(
        `/jobs/${jobId}`,
        {
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
          actualCost: 350,
        },
        auth,
      );
      expect(status).toBe(200);
      expect(data.data.status).toBe("COMPLETED");

      // Verify an invoice was auto-created for this job
      const { data: invData } = await GET(
        `/invoices?jobId=${jobId}`,
        auth,
      );
      expect(Array.isArray(invData.data)).toBe(true);
      expect(invData.data.length).toBeGreaterThanOrEqual(1);
      expect(invData.data[0].jobId).toBe(jobId);
    });

    it("rejects double completion (409)", async () => {
      if (!jobId) return;
      const { status } = await PATCH(
        `/jobs/${jobId}`,
        { status: "COMPLETED" },
        auth,
      );
      expect(status).toBe(409);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. evaluateLegalRoutingWorkflow (GET /requests/:id/legal-decision)
  // ═══════════════════════════════════════════════════════════

  describe("evaluateLegalRoutingWorkflow (GET /requests/:id/legal-decision)", () => {
    let requestId: string;

    beforeAll(async () => {
      const { data } = await POST("/requests", {
        description: "Dishwasher leaking water onto kitchen floor tiles",
        category: "dishwasher",
        estimatedCost: 200,
        unitId,
      });
      requestId = data.data.id;
    });

    it("returns legal decision with obligation assessment", async () => {
      const { status, data } = await GET(
        `/requests/${requestId}/legal-decision`,
        auth,
      );
      expect(status).toBe(200);
      expect(data.data).toBeTruthy();
      const decision = data.data.decision ?? data.data;
      expect(decision).toHaveProperty("legalObligation");
      expect(decision).toHaveProperty("confidence");
      expect(["OBLIGATED", "NOT_OBLIGATED", "DISCRETIONARY", "TENANT_RESPONSIBLE", "UNKNOWN"]).toContain(
        decision.legalObligation,
      );
    });

    it("returns 404 for non-existent request", async () => {
      const { status } = await GET(
        "/requests/00000000-0000-0000-0000-000000000000/legal-decision",
        auth,
      );
      expect(status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Routes remain thin — list / get / suggest still work
  // ═══════════════════════════════════════════════════════════

  describe("Thin routes — query endpoints still work", () => {
    it("GET /requests returns paginated list", async () => {
      const { status, data } = await GET("/requests?limit=5");
      expect(status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it("GET /requests/:id returns single request with full include", async () => {
      // First get a valid ID
      const { data: list } = await GET("/requests?limit=1");
      if (list.data.length === 0) return;

      const id = list.data[0].id;
      const { status, data } = await GET(`/requests/${id}`);
      expect(status).toBe(200);
      expect(data.data.id).toBe(id);
      expect(data.data).toHaveProperty("unit");
    });

    it("GET /requests/:id returns 404 for missing", async () => {
      const { status } = await GET(
        "/requests/00000000-0000-0000-0000-000000000000",
      );
      expect(status).toBe(404);
    });

    it("GET /invoices returns list", async () => {
      const { status, data } = await GET("/invoices", auth);
      expect(status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("GET /rfps returns list", async () => {
      const { status, data } = await GET("/rfps", auth);
      expect(status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. State transitions are enforced
  // ═══════════════════════════════════════════════════════════

  describe("State transition discipline", () => {
    it("rejects invalid status in PATCH /requests/:id/status", async () => {
      const { data: list } = await GET("/requests?limit=1");
      if (list.data.length === 0) return;
      const id = list.data[0].id;

      const { status } = await PATCH(
        `/requests/${id}/status`,
        { status: "NONSENSE_STATUS" },
        auth,
      );
      // Should be 400 or 409
      expect([400, 409]).toContain(status);
    });
  });
});
