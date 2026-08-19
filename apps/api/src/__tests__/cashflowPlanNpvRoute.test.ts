/**
 * Functional tests for GET /cashflow-plans/:id/npv-scenarios (CR-020).
 *
 * This route was previously only checked for OpenAPI presence; its distinctive
 * logic — building vs. portfolio scope resolution, renovation-override
 * extraction, strategyContext resolution, terminal-value modelling, verdict
 * caching, and the new noiEstimatedFromRent flag — was never exercised.
 *
 * Runs on PORT 3241.
 */
import { startTestServer, stopTestServer } from "./testHelpers";
import type { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3241;
const API_BASE = `http://127.0.0.1:${PORT}`;

const MANAGER_HEADERS = {
  "Content-Type": "application/json",
  "x-dev-role": "MANAGER",
};

async function get(path: string) {
  return fetch(`${API_BASE}${path}`, { headers: MANAGER_HEADERS });
}
async function post(path: string, body: object = {}) {
  return fetch(`${API_BASE}${path}`, { method: "POST", headers: MANAGER_HEADERS, body: JSON.stringify(body) });
}

describe("GET /cashflow-plans/:id/npv-scenarios", () => {
  let proc: ChildProcessWithoutNullStreams;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });
    const b = await post("/buildings", { name: "NPV Route Tower", address: "1 NPV Route" });
    buildingId = (await b.json()).data?.id;
    if (!buildingId) throw new Error("Failed to create test building");
  }, 25000);

  afterAll(() => stopTestServer(proc));

  async function createPlan(body: object) {
    const res = await post("/cashflow-plans", body);
    const json = await res.json();
    expect(res.status).toBe(201);
    return json.data.id as string;
  }

  it("404s for an unknown plan", async () => {
    const res = await get("/cashflow-plans/00000000-0000-0000-0000-000000000000/npv-scenarios");
    expect(res.status).toBe(404);
  });

  it("returns the three scenarios + strategyContext for a building-scoped plan", async () => {
    const planId = await createPlan({ name: "Building plan", buildingId, horizonMonths: 60 });
    const res = await get(`/cashflow-plans/${planId}/npv-scenarios`);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;

    // Scenario structure
    for (const key of ["invest", "defer", "neglect"] as const) {
      expect(typeof data.scenarios[key].npvChf).toBe("number");
      expect(Array.isArray(data.scenarios[key].yearlyFlows)).toBe(true);
    }
    // Neglect never schedules capex
    expect(data.scenarios.neglect.totalCapexChf).toBe(0);

    // New flag from CR-009 is always present and boolean
    expect(typeof data.noiEstimatedFromRent).toBe("boolean");

    // strategyContext resolves (no profile set → source "none")
    expect(data.strategyContext).toBeDefined();
    expect(data.strategyContext.source).toBe("none");
    expect(data.strategyContext.hasProfile).toBe(false);
  });

  it("models terminal value + debt block when propertyValueChf is provided", async () => {
    const planId = await createPlan({
      name: "Valued plan",
      buildingId,
      horizonMonths: 120,
      propertyValueChf: 2_000_000,
      discountRatePct: 4,
      deferYears: 3,
    });
    const res = await get(`/cashflow-plans/${planId}/npv-scenarios`);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;

    // Terminal value modelled → each scenario carries a positive terminal PV
    expect(data.terminalValueModeled).toBe(true);
    expect(data.scenarios.invest.terminalValuePvChf).toBeGreaterThan(0);
    // Debt summary present once a market value exists (LTV/WACC computable)
    expect(data.debt).not.toBeNull();
    expect(data.debt.marketValueChf).toBe(2_000_000);
    // Horizon honoured (120 months → 10 years of flows)
    expect(data.scenarios.invest.yearlyFlows).toHaveLength(10);
    // Verdict is cached back on the plan by a best-effort (fire-and-forget) write,
    // so poll briefly rather than reading synchronously.
    let cached: string | null = null;
    for (let i = 0; i < 10 && cached == null; i++) {
      const planAfter = await (await get(`/cashflow-plans/${planId}`)).json();
      cached = planAfter.data.lastVerdictScenario ?? null;
      if (cached == null) await new Promise((r) => setTimeout(r, 100));
    }
    expect(["invest", "defer", "neglect"]).toContain(cached);
  });

  it("aggregates a portfolio-scoped plan across active buildings", async () => {
    const planId = await createPlan({ name: "Portfolio plan", horizonMonths: 60 });
    const res = await get(`/cashflow-plans/${planId}/npv-scenarios`);
    // Either aggregates (200) or, if no active buildings exist, a clear 400.
    expect([200, 400]).toContain(res.status);
    const data = (await res.json()).data;
    if (res.status === 200) {
      expect(data.buildingName).toMatch(/Portfolio/);
      expect(typeof data.scenarios.invest.npvChf).toBe("number");
      // Portfolio strategyContext is "none" (only single-building plans resolve it)
      expect(data.strategyContext.source).toBe("none");
    }
  });
});
