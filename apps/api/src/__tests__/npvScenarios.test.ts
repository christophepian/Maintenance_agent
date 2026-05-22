/**
 * Phase 3 — NPV Scenarios: Integration Tests
 *
 * Tests GET /buildings/:id/npv-scenarios
 *
 * Runs on PORT 3227.
 */
import { startTestServer, stopTestServer } from "./testHelpers";
import type { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3227;
const API_BASE = `http://127.0.0.1:${PORT}`;

const MANAGER_HEADERS = {
  "Content-Type": "application/json",
  "x-dev-role": "MANAGER",
};

async function get(path: string) {
  return fetch(`${API_BASE}${path}`, { headers: MANAGER_HEADERS });
}

async function post(path: string, body: object = {}) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: MANAGER_HEADERS,
    body: JSON.stringify(body),
  });
}

describe("NPV Scenarios — Phase 3", () => {
  let proc: ChildProcessWithoutNullStreams;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });

    // Create a building via API (orgId = "default-org" from dev JWT)
    const res = await post("/buildings", { name: "NPV Test Tower", address: "99 NPV Ave" });
    const json = await res.json();
    buildingId = json.data?.id;
    if (!buildingId) throw new Error("Failed to create test building");
  }, 25000);

  afterAll(() => stopTestServer(proc));

  // ── Unknown building returns 404 ─────────────────────────────
  it("GET /buildings/nonexistent/npv-scenarios returns 404", async () => {
    const res = await get("/buildings/00000000-0000-0000-0000-000000000000/npv-scenarios");
    expect(res.status).toBe(404);
  });

  // ── Valid building returns 200 with all three scenarios ───────
  it("GET /buildings/:id/npv-scenarios returns 200 with invest/defer/neglect", async () => {
    const res = await get(`/buildings/${buildingId}/npv-scenarios`);
    expect(res.status).toBe(200);

    const json = await res.json();
    const data = json.data;

    expect(data).toHaveProperty("buildingId", buildingId);
    expect(data).toHaveProperty("discountRatePct");
    expect(data).toHaveProperty("horizonYears");
    expect(data).toHaveProperty("baseAnnualNoiChf");
    expect(data).toHaveProperty("fromYear");
    expect(data).toHaveProperty("toYear");
    expect(data.toYear).toBe(data.fromYear + data.horizonYears - 1);

    const { invest, defer, neglect } = data.scenarios;
    for (const scenario of [invest, defer, neglect]) {
      expect(typeof scenario.npvChf).toBe("number");
      expect(typeof scenario.totalCapexChf).toBe("number");
      expect(typeof scenario.totalNoiChf).toBe("number");
      expect(Array.isArray(scenario.yearlyFlows)).toBe(true);
      expect(scenario.yearlyFlows).toHaveLength(data.horizonYears);

      for (const flow of scenario.yearlyFlows) {
        expect(typeof flow.year).toBe("number");
        expect(typeof flow.projectedNoiChf).toBe("number");
        expect(typeof flow.capexChf).toBe("number");
        expect(typeof flow.netCashFlowChf).toBe("number");
        expect(typeof flow.pvChf).toBe("number");
        expect(typeof flow.cumulativePvChf).toBe("number");
        expect(typeof flow.discountFactor).toBe("number");
      }
    }
  });

  // ── Neglect scenario always has zero capex ────────────────────
  it("Neglect scenario has zero capex in all years", async () => {
    const res = await get(`/buildings/${buildingId}/npv-scenarios`);
    const json = await res.json();
    const neglect = json.data.scenarios.neglect;

    for (const flow of neglect.yearlyFlows) {
      expect(flow.capexChf).toBe(0);
    }
    expect(neglect.totalCapexChf).toBe(0);
  });

  // ── Invest NPV ≤ Neglect NPV (capex reduces cash flows) ──────
  it("Invest NPV is lower than Neglect NPV for a building with no assets", async () => {
    const res = await get(`/buildings/${buildingId}/npv-scenarios`);
    const json = await res.json();
    const { invest, neglect } = json.data.scenarios;
    // No assets → invest capex = 0, so invest NPV should equal neglect NPV
    expect(invest.npvChf).toBe(neglect.npvChf);
  });

  // ── Custom params are accepted ────────────────────────────────
  it("GET with discountRatePct=6&horizonYears=5 responds without error", async () => {
    const res = await get(
      `/buildings/${buildingId}/npv-scenarios?discountRatePct=6&horizonYears=5`,
    );
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(500);

    const json = await res.json();
    expect(json.data.discountRatePct).toBe(6);
    expect(json.data.horizonYears).toBe(5);
    expect(json.data.scenarios.invest.yearlyFlows).toHaveLength(5);
  });
});
