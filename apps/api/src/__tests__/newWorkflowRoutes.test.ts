/**
 * ARCH-NEW-3 · HTTP Integration Tests for 3 newer workflow routes
 *
 * Covers:
 *   1. Cashflow Plan routes (cashflowPlanWorkflow) — POST, GET, submit, approve auth gates
 *   2. Claim Analysis route (analyseClaimWorkflow) — GET /requests/:id/claim-analysis auth gates
 *   3. Recommendation routes (recommendationWorkflow) — POST /recommendations/evaluate auth gates
 *
 * Focus: auth enforcement (401 without token, 403 wrong role) and basic happy-path
 * shape assertions. AI/LLM service calls are mocked by the server's test env.
 */

import {
  startTestServer,
  stopTestServer,
  createManagerToken,
  createContractorToken,
  createOwnerToken,
} from "./testHelpers";
import * as http from "http";
import { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3272;

process.env.AUTH_SECRET = "test-secret";

/* ── HTTP helper ─────────────────────────────────────────────── */
function httpRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: PORT,
      path,
      method,
      headers: { ...headers, ...(body ? { "content-length": Buffer.byteLength(body).toString() } : {}) },
    };
    const reqNode = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    reqNode.on("error", reject);
    if (body) reqNode.write(body);
    reqNode.end();
  });
}

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const { token, body } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await httpRequest(method, path, headers, body ? JSON.stringify(body) : undefined);
  let parsed: unknown;
  try { parsed = JSON.parse(res.body); } catch { parsed = res.body; }
  return { status: res.status, body: parsed };
}

/* ── Server lifecycle ─────────────────────────────────────────── */
let server: ChildProcessWithoutNullStreams;

beforeAll(async () => {
  server = await startTestServer(PORT);
}, 30_000);

afterAll(async () => {
  await stopTestServer(server);
});

/* ═══════════════════════════════════════════════════════════════
   1 · Cashflow Plan routes
   ═══════════════════════════════════════════════════════════════ */

describe("Cashflow Plan routes (cashflowPlanWorkflow)", () => {
  const managerToken = createManagerToken();
  const contractorToken = createContractorToken();
  const ownerToken = createOwnerToken();

  describe("GET /cashflow-plans", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("GET", "/cashflow-plans");
      expect(status).toBe(401);
    });

    it("returns 200 with MANAGER token and array body", async () => {
      const { status, body } = await req("GET", "/cashflow-plans", { token: managerToken });
      expect(status).toBe(200);
      expect((body as any).data).toBeDefined();
      expect(Array.isArray((body as any).data)).toBe(true);
    });

    it("returns 403 with OWNER token (route is MANAGER-only)", async () => {
      const { status } = await req("GET", "/cashflow-plans", { token: ownerToken });
      expect([403, 401]).toContain(status);
    });
  });

  describe("POST /cashflow-plans", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("POST", "/cashflow-plans", {
        body: { name: "Test Plan", buildingId: "non-existent", years: 5 },
      });
      expect(status).toBe(401);
    });

    it("returns 401/403 with CONTRACTOR token", async () => {
      const { status } = await req("POST", "/cashflow-plans", {
        token: contractorToken,
        body: { name: "Test Plan", buildingId: "non-existent", years: 5 },
      });
      expect([401, 403]).toContain(status);
    });

    it("returns 400/404 with MANAGER token and non-existent buildingId (auth passes)", async () => {
      const { status } = await req("POST", "/cashflow-plans", {
        token: managerToken,
        body: { name: "Test Plan", buildingId: "00000000-0000-0000-0000-000000000000", years: 5 },
      });
      // Auth passes — 400/404/422/500 depending on workflow validation path
      expect([400, 404, 422, 500]).toContain(status);
    });
  });

  describe("POST /cashflow-plans/:id/submit", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("POST", "/cashflow-plans/non-existent/submit");
      expect(status).toBe(401);
    });

    it("returns 401/403 with CONTRACTOR token", async () => {
      const { status } = await req("POST", "/cashflow-plans/non-existent/submit", {
        token: contractorToken,
      });
      expect([401, 403]).toContain(status);
    });

    it("returns 404 with MANAGER token for non-existent plan (auth passes)", async () => {
      const { status } = await req("POST", "/cashflow-plans/non-existent/submit", {
        token: managerToken,
      });
      expect([404, 400]).toContain(status);
    });
  });

  describe("POST /cashflow-plans/:id/approve", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("POST", "/cashflow-plans/non-existent/approve");
      expect(status).toBe(401);
    });

    it("returns 404 with MANAGER token for non-existent plan (auth passes)", async () => {
      const { status } = await req("POST", "/cashflow-plans/non-existent/approve", {
        token: managerToken,
      });
      expect([404, 400]).toContain(status);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   2 · Claim Analysis route (analyseClaimWorkflow)
   ═══════════════════════════════════════════════════════════════ */

describe("Claim Analysis route (analyseClaimWorkflow)", () => {
  const managerToken = createManagerToken();
  const contractorToken = createContractorToken();

  describe("GET /requests/:id/claim-analysis", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("GET", "/requests/non-existent/claim-analysis");
      expect(status).toBe(401);
    });

    it("returns 401/403 with CONTRACTOR token", async () => {
      const { status } = await req("GET", "/requests/non-existent/claim-analysis", {
        token: contractorToken,
      });
      expect([401, 403]).toContain(status);
    });

    it("returns 404 with MANAGER token for non-existent request (auth passes)", async () => {
      const { status } = await req("GET", "/requests/00000000-0000-0000-0000-000000000000/claim-analysis", {
        token: managerToken,
      });
      expect([404, 400]).toContain(status);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   3 · Recommendation routes (recommendationWorkflow)
   ═══════════════════════════════════════════════════════════════ */

describe("Recommendation routes (recommendationWorkflow)", () => {
  const managerToken = createManagerToken();
  const contractorToken = createContractorToken();

  describe("POST /recommendations/evaluate", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("POST", "/recommendations/evaluate", {
        body: { requestId: "non-existent" },
      });
      expect(status).toBe(401);
    });

    it("returns 401/403 with CONTRACTOR token", async () => {
      const { status } = await req("POST", "/recommendations/evaluate", {
        token: contractorToken,
        body: { requestId: "non-existent" },
      });
      expect([401, 403]).toContain(status);
    });

    it("returns 400/404 with MANAGER token for non-existent request (auth passes)", async () => {
      const { status } = await req("POST", "/recommendations/evaluate", {
        token: managerToken,
        body: { requestId: "00000000-0000-0000-0000-000000000000" },
      });
      expect([400, 404, 500]).toContain(status);
    });
  });

  describe("GET /recommendations/:opportunityId", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("GET", "/recommendations/non-existent");
      expect(status).toBe(401);
    });

    it("returns 200 with MANAGER token for non-existent id (empty array ok)", async () => {
      const { status, body } = await req("GET", "/recommendations/00000000-0000-0000-0000-000000000000", {
        token: managerToken,
      });
      // Auth passes — either 200 with empty array or 404
      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect((body as any).recommendations).toBeDefined();
      }
    });
  });

  describe("POST /decision-options", () => {
    it("returns 401 without token", async () => {
      const { status } = await req("POST", "/decision-options", {
        body: { options: [] },
      });
      expect(status).toBe(401);
    });
  });
});
