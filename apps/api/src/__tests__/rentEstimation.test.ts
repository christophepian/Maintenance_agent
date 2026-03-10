/**
 * Rent Estimation — Algorithm unit tests + API contract tests
 *
 * Unit tests: pure `computeRentEstimate()` — no DB, no server.
 * Contract tests: real server on port 3205, validates shapes.
 */

import { computeRentEstimate, EstimationInputs, EstimationConfig } from "../services/rentEstimation";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";

/* ═══════════════════════════════════════════════════════════════
 * Shared default config (Swiss-typical defaults from schema)
 * ═══════════════════════════════════════════════════════════════ */

const DEFAULT_CONFIG: EstimationConfig = {
  baseRentPerSqmChfMonthly: 25,
  locationCoefPrime: 1.25,
  locationCoefStandard: 1.0,
  locationCoefPeriphery: 0.8,
  ageCoefNew: 1.1,
  ageCoefMid: 1.0,
  ageCoefOld: 0.9,
  ageCoefVeryOld: 0.8,
  energyCoefJson: { A: 1.05, B: 1.02, C: 1.0, D: 0.98, E: 0.95, F: 0.92, G: 0.88 },
  chargesBaseOptimistic: 0.15,
  chargesBasePessimistic: 0.22,
  heatingChargeAdjJson: { HEAT_PUMP: -0.02, DISTRICT: 0.0, GAS: 0.01, OIL: 0.03, ELECTRIC: 0.04, UNKNOWN: 0.0 },
  serviceChargeAdjElevator: 0.02,
  serviceChargeAdjConcierge: 0.03,
  chargesMinClamp: 0.10,
  chargesMaxClamp: 0.40,
};

/* ═══════════════════════════════════════════════════════════════
 * Unit Tests: computeRentEstimate (pure function)
 * ═══════════════════════════════════════════════════════════════ */

describe("computeRentEstimate (unit)", () => {
  it("computes a basic estimate with all inputs provided", () => {
    const inputs: EstimationInputs = {
      unitId: "u1",
      livingAreaSqm: 80,
      locationSegment: "STANDARD",
      yearBuilt: 2010,
      lastRenovationYear: null,
      energyLabel: "B",
      heatingType: "HEAT_PUMP",
      hasElevator: true,
      hasConcierge: false,
    };

    const result = computeRentEstimate(inputs, DEFAULT_CONFIG);

    // Net rent: 80 * 25 * 1.0(standard) * 1.1(new, age=~15→mid) * 1.02(B) = 80*25*1*1*1.02 ≈ 2040
    // Actually age = 2025-2010=15 → mid band (10-30), ageCoef = 1.0
    // netRent = 80 * 25 * 1.0 * 1.0 * 1.02 = 2040
    expect(result.netRentChfMonthly).toBe(2040);
    expect(result.unitId).toBe("u1");
    expect(result.warnings).toEqual([]);

    // Charges: heatingAdj = -0.02, serviceAdj = 0.02 (elevator only)
    // rateOpt = 0.15 + (-0.02) + 0.02 = 0.15; ratePes = 0.22 + (-0.02) + 0.02 = 0.22
    expect(result.chargesOptimisticChfMonthly).toBe(Math.round(2040 * 0.15)); // 306
    expect(result.chargesPessimisticChfMonthly).toBe(Math.round(2040 * 0.22)); // 449

    expect(result.totalOptimisticChfMonthly).toBe(2040 + 306);
    expect(result.totalPessimisticChfMonthly).toBe(2040 + 449);
  });

  it("applies PRIME location coefficient", () => {
    const inputs: EstimationInputs = {
      unitId: "u2",
      livingAreaSqm: 100,
      locationSegment: "PRIME",
      yearBuilt: 2020,
      lastRenovationYear: null,
      energyLabel: "A",
      heatingType: "DISTRICT",
      hasElevator: false,
      hasConcierge: false,
    };

    const result = computeRentEstimate(inputs, DEFAULT_CONFIG);
    // age = ~5 → new (ageCoef=1.1), location=PRIME(1.25), energy=A(1.05)
    // 100 * 25 * 1.25 * 1.1 * 1.05 = 3609.375 → rounded 3609
    expect(result.netRentChfMonthly).toBe(3609);
    expect(result.appliedCoefficients.locationCoef).toBe(1.25);
    expect(result.appliedCoefficients.ageCoef).toBe(1.1);
  });

  it("uses veryOld age coefficient for buildings > 50 years", () => {
    const inputs: EstimationInputs = {
      unitId: "u3",
      livingAreaSqm: 60,
      locationSegment: "PERIPHERY",
      yearBuilt: 1960,
      lastRenovationYear: null,
      energyLabel: "F",
      heatingType: "OIL",
      hasElevator: false,
      hasConcierge: false,
    };

    const result = computeRentEstimate(inputs, DEFAULT_CONFIG);
    // age = ~65 → veryOld (0.8), periphery(0.8), energy=F(0.92)
    // 60 * 25 * 0.8 * 0.8 * 0.92 = 883.2 → 883
    expect(result.netRentChfMonthly).toBe(883);
    expect(result.appliedCoefficients.ageCoef).toBe(0.8);
    expect(result.appliedCoefficients.locationCoef).toBe(0.8);
  });

  it("uses lastRenovationYear when newer than yearBuilt", () => {
    const inputs: EstimationInputs = {
      unitId: "u4",
      livingAreaSqm: 50,
      locationSegment: "STANDARD",
      yearBuilt: 1970,
      lastRenovationYear: 2018,
      energyLabel: "C",
      heatingType: "GAS",
      hasElevator: false,
      hasConcierge: false,
    };

    const result = computeRentEstimate(inputs, DEFAULT_CONFIG);
    // effectiveYear = max(1970, 2018) = 2018, age = ~7 → new (1.1)
    expect(result.inputsUsed.effectiveYear).toBe(2018);
    expect(result.appliedCoefficients.ageCoef).toBe(1.1);
  });

  it("produces warnings when optional fields are missing", () => {
    const inputs: EstimationInputs = {
      unitId: "u5",
      livingAreaSqm: 70,
      locationSegment: undefined,
      yearBuilt: null,
      lastRenovationYear: null,
      energyLabel: null,
      heatingType: null,
      hasElevator: false,
      hasConcierge: false,
    };

    const result = computeRentEstimate(inputs, DEFAULT_CONFIG);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toContain("locationSegment missing; defaulting to STANDARD");
    expect(result.warnings).toContain("yearBuilt/lastRenovationYear missing; defaulting to mid age coefficient");
    expect(result.warnings).toContain("energyLabel missing; defaulting to 1.0");
    // Defaults: standard(1.0), mid(1.0), energy(1.0)
    // 70 * 25 * 1 * 1 * 1 = 1750
    expect(result.netRentChfMonthly).toBe(1750);
  });

  it("clamps charges when rate goes below min", () => {
    const config: EstimationConfig = {
      ...DEFAULT_CONFIG,
      chargesBaseOptimistic: 0.05,
      chargesMinClamp: 0.10,
    };
    const inputs: EstimationInputs = {
      unitId: "u6",
      livingAreaSqm: 100,
      locationSegment: "STANDARD",
      yearBuilt: 2020,
      lastRenovationYear: null,
      energyLabel: "C",
      heatingType: "HEAT_PUMP", // adj = -0.02 → total = 0.05 + (-0.02) + 0 = 0.03 → clamped to 0.10
      hasElevator: false,
      hasConcierge: false,
    };

    const result = computeRentEstimate(inputs, config);
    expect(result.appliedCoefficients.chargesRateOptimistic).toBe(0.10);
    expect(result.appliedCoefficients.clampsApplied?.optimistic).toBe(true);
  });

  it("adds concierge and elevator service adjustments", () => {
    const inputs: EstimationInputs = {
      unitId: "u7",
      livingAreaSqm: 80,
      locationSegment: "STANDARD",
      yearBuilt: 2010,
      lastRenovationYear: null,
      energyLabel: "C",
      heatingType: "DISTRICT",
      hasElevator: true,
      hasConcierge: true,
    };

    const result = computeRentEstimate(inputs, DEFAULT_CONFIG);
    // serviceAdj = 0.02 + 0.03 = 0.05
    expect(result.appliedCoefficients.serviceAdj).toBe(0.05);
    // rateOpt = 0.15 + 0 + 0.05 = 0.20
    expect(result.appliedCoefficients.chargesRateOptimistic).toBe(0.20);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * Contract Tests: Rent Estimation API endpoints
 * ═══════════════════════════════════════════════════════════════ */

const API_ROOT = path.resolve(__dirname, "..", "..");
const PORT = 3209; // unique port to avoid collisions with other test files
const API_BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn("npx", ["tsx", "src/server.ts"], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: String(PORT),
        AUTH_OPTIONAL: "true",
        NODE_ENV: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onData = (data: Buffer) => {
      if (data.toString().includes("API running on")) {
        cleanup();
        resolve(child);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("error", onError);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", onError);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Server did not start within 30s"));
    }, 30000);
  });
}

describe("Rent Estimation Contract Tests", () => {
  let proc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    proc = await startServer();
  }, 35000);

  afterAll(() => {
    if (proc) proc.kill();
  });

  describe("GET /rent-estimation/config", () => {
    it("returns a config object (auto-created if missing)", async () => {
      const res = await fetch(`${API_BASE}/rent-estimation/config`);
      expect(res.status).toBe(200);
      const body = await res.json();
      const config = body.data;

      // Verify shape
      expect(config).toHaveProperty("id");
      expect(config).toHaveProperty("orgId");
      expect(config).toHaveProperty("baseRentPerSqmChfMonthly");
      expect(typeof config.baseRentPerSqmChfMonthly).toBe("number");
      expect(config).toHaveProperty("locationCoefPrime");
      expect(config).toHaveProperty("locationCoefStandard");
      expect(config).toHaveProperty("locationCoefPeriphery");
      expect(config).toHaveProperty("ageCoefNew");
      expect(config).toHaveProperty("ageCoefMid");
      expect(config).toHaveProperty("ageCoefOld");
      expect(config).toHaveProperty("ageCoefVeryOld");
      expect(config).toHaveProperty("energyCoefJson");
      expect(typeof config.energyCoefJson).toBe("object");
      expect(config).toHaveProperty("chargesBaseOptimistic");
      expect(config).toHaveProperty("chargesBasePessimistic");
      expect(config).toHaveProperty("heatingChargeAdjJson");
      expect(config).toHaveProperty("serviceChargeAdjElevator");
      expect(config).toHaveProperty("serviceChargeAdjConcierge");
      expect(config).toHaveProperty("chargesMinClamp");
      expect(config).toHaveProperty("chargesMaxClamp");
      expect(config).toHaveProperty("createdAt");
      expect(config).toHaveProperty("updatedAt");
    });
  });

  describe("PUT /rent-estimation/config", () => {
    it("upserts org-default config and returns updated shape", async () => {
      const res = await fetch(`${API_BASE}/rent-estimation/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseRentPerSqmChfMonthly: 30 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.baseRentPerSqmChfMonthly).toBe(30);
      expect(body.data.canton).toBeNull();
    });
  });

  describe("PUT /rent-estimation/config/:canton", () => {
    it("upserts canton-specific config", async () => {
      const res = await fetch(`${API_BASE}/rent-estimation/config/ZH`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseRentPerSqmChfMonthly: 35, locationCoefPrime: 1.4 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.canton).toBe("ZH");
      expect(body.data.baseRentPerSqmChfMonthly).toBe(35);
      expect(body.data.locationCoefPrime).toBe(1.4);
    });
  });

  describe("PUT /rent-estimation/config (validation)", () => {
    it("rejects invalid coefficient values", async () => {
      const res = await fetch(`${API_BASE}/rent-estimation/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationCoefPrime: 5.0 }), // max is 2.5
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /rent-estimation/bulk (validation)", () => {
    it("rejects empty payload", async () => {
      const res = await fetch(`${API_BASE}/rent-estimation/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("accepts unitIds array with at least one element", async () => {
      const res = await fetch(`${API_BASE}/rent-estimation/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitIds: ["00000000-0000-0000-0000-000000000000"] }),
      });
      // Should succeed even if no units match (empty result)
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
