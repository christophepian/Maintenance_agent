/**
 * Mortgage CRUD + levered (FCFE) NPV — integration tests.
 *
 * Verifies the vertical slice: create building → set valuation → add mortgage →
 * the /buildings/:id/npv-scenarios endpoint surfaces the debt summary (LTV/WACC)
 * and per-scenario levered metrics.
 *
 * Runs on PORT 3231.
 */
import { startTestServer, stopTestServer } from "./testHelpers";
import type { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3231;
const API_BASE = `http://127.0.0.1:${PORT}`;
const HEADERS = { "Content-Type": "application/json", "x-dev-role": "MANAGER" };

const get = (p: string) => fetch(`${API_BASE}${p}`, { headers: HEADERS });
const post = (p: string, body: object = {}) =>
  fetch(`${API_BASE}${p}`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
const put = (p: string, body: object = {}) =>
  fetch(`${API_BASE}${p}`, { method: "PUT", headers: HEADERS, body: JSON.stringify(body) });
const del = (p: string) => fetch(`${API_BASE}${p}`, { method: "DELETE", headers: HEADERS });

describe("Mortgages + levered NPV", () => {
  let proc: ChildProcessWithoutNullStreams;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });
    const res = await post("/buildings", { name: "Debt Test Tower", address: "1 Leverage Lane" });
    buildingId = (await res.json()).data?.id;
    if (!buildingId) throw new Error("Failed to create test building");
  }, 25000);

  afterAll(() => stopTestServer(proc));

  it("returns empty mortgages and null valuation initially", async () => {
    const res = await get(`/buildings/${buildingId}/mortgages`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.mortgages).toEqual([]);
    expect(data.marketValueChf).toBeNull();
  });

  it("sets a market value", async () => {
    const res = await put(`/buildings/${buildingId}/valuation`, { marketValueChf: 2_000_000 });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.marketValueChf).toBe(2_000_000);
    expect(data.marketValueAt).toBeTruthy();
  });

  it("creates and lists a mortgage", async () => {
    const create = await post(`/buildings/${buildingId}/mortgages`, {
      lenderName: "Test Bank",
      originalPrincipalChf: 1_200_000,
      currentBalanceChf: 1_000_000,
      interestRatePct: 2,
      amortizationType: "INTEREST_ONLY",
    });
    expect(create.status).toBe(201);

    const list = await get(`/buildings/${buildingId}/mortgages`);
    const { data } = await list.json();
    expect(data.mortgages).toHaveLength(1);
    expect(data.mortgages[0].lenderName).toBe("Test Bank");
  });

  it("rejects invalid mortgage data", async () => {
    const res = await post(`/buildings/${buildingId}/mortgages`, {
      originalPrincipalChf: -5,
      currentBalanceChf: 100,
      interestRatePct: 2,
    });
    expect(res.status).toBe(400);
  });

  it("surfaces the debt summary (LTV/WACC) in npv-scenarios", async () => {
    const res = await get(`/buildings/${buildingId}/npv-scenarios`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.debt).toBeTruthy();
    expect(data.debt.totalDebtChf).toBe(1_000_000);
    // LTV = 1,000,000 / 2,000,000 = 50%
    expect(data.debt.ltvPct).toBe(50);
    expect(data.debt.marketValueChf).toBe(2_000_000);
    expect(data.debt.currentEquityChf).toBe(1_000_000);
    // WACC is computed (number) when a market value exists
    expect(typeof data.debt.waccPct).toBe("number");
    // Per-scenario levered metrics present with DSCR
    expect(data.scenarios.invest.levered).toBeTruthy();
    expect(Array.isArray(data.scenarios.invest.levered.dscrByYear)).toBe(true);
  });

  it("deletes the mortgage", async () => {
    const list = await get(`/buildings/${buildingId}/mortgages`);
    const id = (await list.json()).data.mortgages[0].id;
    const res = await del(`/mortgages/${id}`);
    expect(res.status).toBe(200);
    const after = await get(`/buildings/${buildingId}/mortgages`);
    expect((await after.json()).data.mortgages).toHaveLength(0);
  });
});
