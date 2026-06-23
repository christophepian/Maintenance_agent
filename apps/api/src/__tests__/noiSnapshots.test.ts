/**
 * Phase 1 — Historical NOI Snapshots: Integration Tests
 *
 * Tests the two new endpoints:
 *   GET  /buildings/:id/financial-snapshots  → list stored snapshots
 *   POST /buildings/:id/financial-snapshots/refresh → batch compute annual NOI
 *
 * Runs on PORT 3225.
 */
import {
  startTestServer,
  stopTestServer,
} from "./testHelpers";
import type { ChildProcessWithoutNullStreams } from "child_process";

const PORT = 3225;
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

describe("NOI Snapshots — Phase 1", () => {
  let proc: ChildProcessWithoutNullStreams;
  let buildingId: string;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });

    // Create building via API so it gets orgId = "default-org" from the dev JWT
    const res = await post("/buildings", {
      name: "Snapshot Tower",
      address: "5 Annual St",
    });
    const json = await res.json();
    buildingId = json.data?.id;
    if (!buildingId) throw new Error("Failed to create test building");
  }, 25000);

  afterAll(() => stopTestServer(proc));

  // ── GET — empty list before any refresh ──────────────────────────────────
  it("GET /buildings/:id/financial-snapshots returns empty array initially", async () => {
    const res = await get(`/buildings/${buildingId}/financial-snapshots`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(0);
  });

  // ── GET — unknown building returns 404 ───────────────────────────────────
  it("GET /buildings/nonexistent/financial-snapshots returns 404", async () => {
    const res = await get("/buildings/00000000-0000-0000-0000-000000000000/financial-snapshots");
    expect(res.status).toBe(404);
  });

  // ── POST refresh — computes snapshots for last N years ────────────────────
  it("POST refresh computes snapshots and returns them", async () => {
    const res = await post(
      `/buildings/${buildingId}/financial-snapshots/refresh`,
      { years: 3 },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);

    // 3 completed fiscal years should have been stored
    expect(json.data.length).toBe(3);

    // Each snapshot should have the expected shape
    const snap = json.data[0];
    expect(typeof snap.periodStart).toBe("string");
    expect(typeof snap.periodEnd).toBe("string");
    expect(typeof snap.netOperatingIncomeCents).toBe("number");
    expect(typeof snap.collectedIncomeCents).toBe("number");
    expect(typeof snap.expensesTotalCents).toBe("number");
    expect(typeof snap.computedAt).toBe("string");
  });

  // ── GET — snapshots now returned after refresh ───────────────────────────
  it("GET after refresh returns the stored snapshots", async () => {
    const res = await get(`/buildings/${buildingId}/financial-snapshots`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(3);

    // Verify ordering: oldest first
    const years = json.data.map((s: any) => s.periodStart.slice(0, 4));
    expect(years).toEqual([...years].sort());
  });

  // ── Snapshot shape — each annual snapshot covers Jan 1 → Dec 31 ──────────
  it("each snapshot covers a full fiscal year", async () => {
    const res = await get(`/buildings/${buildingId}/financial-snapshots`);
    const json = await res.json();
    for (const snap of json.data) {
      expect(snap.periodStart).toMatch(/^\d{4}-01-01$/);
      expect(snap.periodEnd).toMatch(/^\d{4}-12-31$/);
      const startYear = snap.periodStart.slice(0, 4);
      const endYear = snap.periodEnd.slice(0, 4);
      expect(startYear).toBe(endYear);
    }
  });

  // ── POST refresh — invalid years value ───────────────────────────────────
  it("POST refresh with years=0 returns 400", async () => {
    const res = await post(
      `/buildings/${buildingId}/financial-snapshots/refresh`,
      { years: 0 },
    );
    expect(res.status).toBe(400);
  });

  // ── POST refresh — unknown building returns 404 ───────────────────────────
  it("POST refresh for nonexistent building returns 404", async () => {
    const res = await post(
      "/buildings/00000000-0000-0000-0000-000000000000/financial-snapshots/refresh",
      { years: 2 },
    );
    expect(res.status).toBe(404);
  });
});
