/**
 * P1 — Value-Creation Agenda: Integration Tests
 *
 * Tests GET /buildings/:id/value-creation-agenda
 *   - 404 for unknown building
 *   - 200 shape: strategyContext + ranked opportunities
 *   - ?mandate= what-if override reflected in strategyContext
 *   - manager guard
 *
 * Runs on PORT 3233.
 */
import { startTestServer, stopTestServer } from "./testHelpers";
import type { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3233;
const API_BASE = `http://127.0.0.1:${PORT}`;

const MANAGER_HEADERS = { "Content-Type": "application/json", "x-dev-role": "MANAGER" };

async function get(path: string, headers = MANAGER_HEADERS) {
  return fetch(`${API_BASE}${path}`, { headers });
}
async function post(path: string, body: object = {}) {
  return fetch(`${API_BASE}${path}`, { method: "POST", headers: MANAGER_HEADERS, body: JSON.stringify(body) });
}

describe("Value-Creation Agenda — P1", () => {
  let proc: ChildProcessWithoutNullStreams;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });
    const res = await post("/buildings", { name: "Agenda Test Tower", address: "12 Agenda St" });
    const json = await res.json();
    buildingId = json.data?.id;
    if (!buildingId) throw new Error("Failed to create test building");
  }, 25000);

  afterAll(() => stopTestServer(proc));

  it("returns 404 for an unknown building", async () => {
    const res = await get("/buildings/00000000-0000-0000-0000-000000000000/value-creation-agenda");
    expect(res.status).toBe(404);
  });

  it("returns 200 with strategyContext and a (possibly empty) ranked opportunities array", async () => {
    const res = await get(`/buildings/${buildingId}/value-creation-agenda`);
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data).toHaveProperty("strategyContext");
    expect(data.strategyContext).toHaveProperty("source"); // building | owner-portfolio | none
    expect(data.strategyContext).toHaveProperty("hasProfile");
    expect(Array.isArray(data.opportunities)).toBe(true);
    // A freshly-created building has no assets → no opportunities → no profile.
    expect(data.strategyContext.hasProfile).toBe(false);
    expect(data.strategyContext.source).toBe("none");
  });

  it("?mandate= a what-if archetype is reflected in strategyContext and computes a verdict", async () => {
    const res = await get(`/buildings/${buildingId}/value-creation-agenda?mandate=value_builder`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.strategyContext.archetype).toBe("value_builder");
    expect(data.strategyContext.isWhatIf).toBe(true);
    // a mandate (even a what-if) triggers the verdict
    expect(["invest", "defer", "neglect"]).toContain(data.strategyContext.recommendedScenario);
  });

  it("ignores an invalid mandate value", async () => {
    const res = await get(`/buildings/${buildingId}/value-creation-agenda?mandate=not_an_archetype`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.strategyContext.isWhatIf).toBe(false);
  });

  // Note: the route uses maybeRequireManager (MANAGER/OWNER reads). Role enforcement
  // is only active when AUTH_OPTIONAL=false (production); under the test server's
  // AUTH_OPTIONAL=true it is permissive, so a role-gate assertion isn't meaningful here —
  // same as the sibling npv-scenarios integration test.
});
