/**
 * Phase 2 — Capex Schedule: Integration Tests
 *
 * Tests GET /buildings/:id/capex-schedule
 *
 * Runs on PORT 3226.
 */
import {
  startTestServer,
  stopTestServer,
} from "./testHelpers";
import type { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3226;
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

describe("Capex Schedule — Phase 2", () => {
  let proc: ChildProcessWithoutNullStreams;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });

    // Create a building via API (gets orgId = "default-org" from dev JWT)
    const res = await post("/buildings", {
      name: "Capex Test Tower",
      address: "10 Asset Ave",
    });
    const json = await res.json();
    buildingId = json.data?.id;
    if (!buildingId) throw new Error("Failed to create test building");
  }, 25000);

  afterAll(() => stopTestServer(proc));

  // ── Building with no assets returns 200 with empty schedule ──────────────
  it("GET /buildings/:id/capex-schedule returns 200 with empty schedule for building with no assets", async () => {
    const res = await get(`/buildings/${buildingId}/capex-schedule`);
    // Building exists but has no assets — route now always returns 200 with empty schedule
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveProperty("buildingId");
    expect(json.data).toHaveProperty("schedule");
    expect(Array.isArray(json.data.schedule)).toBe(true);

    // All buckets should have zero amounts (building has no assets)
    for (const bucket of json.data.schedule) {
      expect(bucket.totalChf).toBe(0);
      expect(bucket.assetCount).toBe(0);
    }

    // excludedAssets array must be present (empty since building has no assets at all)
    expect(Array.isArray(json.data.excludedAssets)).toBe(true);
  });

  // ── Unknown building returns 404 ──────────────────────────────────────
  it("GET /buildings/nonexistent/capex-schedule returns 404", async () => {
    const res = await get("/buildings/00000000-0000-0000-0000-000000000000/capex-schedule");
    expect(res.status).toBe(404);
  });

  // ── horizonYears param is accepted ──────────────────────────────────────
  it("GET with horizonYears=3 responds without error", async () => {
    const res = await get(`/buildings/${buildingId}/capex-schedule?horizonYears=3`);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(500);
  });
});
