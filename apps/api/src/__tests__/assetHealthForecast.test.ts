/**
 * GET /forecasting/asset-health — Contract Test
 *
 * Asserts the full DTO shape of the asset health forecast endpoint.
 * Required by G10 — new endpoint must have a contract test.
 *
 * Port: 3223 (unique — see CONTRIBUTING.md port registry)
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from "child_process";
import { PrismaClient } from "@prisma/client";
import { startTestServer, stopTestServer, createManagerToken, getAuthHeaders } from "./testHelpers";

process.env.AUTH_SECRET = "test-secret";

const prisma = new PrismaClient();
const PORT = 3223;
const orgId = "default-org";
const managerToken = createManagerToken(orgId);

function jsonRequest(
  method: string,
  path: string,
  headers?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode || 500, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode || 500, data: { raw: data } }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

describe("GET /forecasting/asset-health — contract test", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  let buildingId: string;

  beforeAll(async () => {
    // Ensure org exists
    await prisma.org.upsert({
      where: { id: orgId },
      create: { id: orgId, name: "Forecast Test Org" },
      update: {},
    });

    // Create a building with a unit and asset for a meaningful test
    const building = await prisma.building.create({
      data: { orgId, name: `Forecast Test Building ${Date.now()}`, address: "Forecast St 1", canton: "ZH" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: `FT-${Date.now()}`, type: "RESIDENTIAL" },
    });

    await prisma.asset.create({
      data: {
        orgId,
        unitId: unit.id,
        type: "APPLIANCE",
        topic: "STOVE",
        name: "Test Stove",
        isPresent: true,
        isActive: true,
        installedAt: new Date("2010-01-01"),
      },
    });

    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "false", NODE_ENV: "test" });
  }, 30000);

  afterAll(async () => {
    await stopTestServer(proc);
    // Clean up test data
    await prisma.asset.deleteMany({ where: { orgId, unit: { buildingId } } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { buildingId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("returns full DTO shape with portfolio and buildings array", async () => {
    const res = await jsonRequest("GET", "/forecasting/asset-health", getAuthHeaders(managerToken));

    expect(res.status).toBe(200);
    const dto = res.data.data;

    // Portfolio summary
    expect(dto).toHaveProperty("portfolio");
    expect(dto.portfolio).toHaveProperty("totalBuildings");
    expect(typeof dto.portfolio.totalBuildings).toBe("number");
    expect(dto.portfolio).toHaveProperty("totalAssets");
    expect(typeof dto.portfolio.totalAssets).toBe("number");
    expect(dto.portfolio).toHaveProperty("agingAssetsCount");
    expect(typeof dto.portfolio.agingAssetsCount).toBe("number");
    expect(dto.portfolio).toHaveProperty("endOfLifeAssetsCount");
    expect(typeof dto.portfolio.endOfLifeAssetsCount).toBe("number");
    expect(dto.portfolio).toHaveProperty("missingDepreciationCount");
    expect(typeof dto.portfolio.missingDepreciationCount).toBe("number");
    expect(dto.portfolio).toHaveProperty("buildingsWithExposureCount");
    expect(typeof dto.portfolio.buildingsWithExposureCount).toBe("number");

    // Buildings array
    expect(dto).toHaveProperty("buildings");
    expect(Array.isArray(dto.buildings)).toBe(true);
    expect(dto.buildings.length).toBeGreaterThan(0);

    const b = dto.buildings.find((x: any) => x.buildingId === buildingId);
    expect(b).toBeDefined();
    expect(b).toHaveProperty("buildingName");
    expect(b).toHaveProperty("totalAssets");
    expect(typeof b.totalAssets).toBe("number");
    expect(b.totalAssets).toBeGreaterThan(0);
    expect(b).toHaveProperty("agingAssetsCount");
    expect(b).toHaveProperty("endOfLifeAssetsCount");
    expect(b).toHaveProperty("missingDepreciationCount");
    expect(b).toHaveProperty("healthBucket");
    expect(["GOOD", "ATTENTION", "CRITICAL"]).toContain(b.healthBucket);
    expect(b).toHaveProperty("byType");
    expect(typeof b.byType).toBe("object");

    // H-4: Semantic assertion — stove installed 2010 should be past end-of-life
    // (most appliances have < 15-year useful life, and we're well past that)
    // If a depreciation standard exists, the asset should show as CRITICAL
    // with endOfLifeAssetsCount >= 1.  If no standard exists, it falls into
    // missingDepreciationCount instead.  Either way, totalAssets >= 1.
    const hasDepreciationData = b.missingDepreciationCount < b.totalAssets;
    if (hasDepreciationData) {
      expect(b.endOfLifeAssetsCount).toBeGreaterThanOrEqual(1);
      expect(b.healthBucket).toBe("CRITICAL");
    }

    // H-5: byType shape — APPLIANCE key should exist for our seeded asset
    expect(b.byType).toHaveProperty("APPLIANCE");
    expect(b.byType.APPLIANCE).toHaveProperty("total");
    expect(b.byType.APPLIANCE).toHaveProperty("aging");
    expect(b.byType.APPLIANCE).toHaveProperty("endOfLife");
    expect(typeof b.byType.APPLIANCE.total).toBe("number");
    expect(b.byType.APPLIANCE.total).toBeGreaterThanOrEqual(1);

    // Legal coverage summary (may be null but property must exist)
    expect(dto).toHaveProperty("legalCoverageSummary");
    // H-6: If legalCoverageSummary is non-null, assert its shape
    if (dto.legalCoverageSummary !== null) {
      expect(dto.legalCoverageSummary).toHaveProperty("totalCategories");
      expect(dto.legalCoverageSummary).toHaveProperty("mappedCategories");
      expect(dto.legalCoverageSummary).toHaveProperty("unmappedCategories");
      expect(typeof dto.legalCoverageSummary.totalCategories).toBe("number");
      expect(typeof dto.legalCoverageSummary.mappedCategories).toBe("number");
      expect(typeof dto.legalCoverageSummary.unmappedCategories).toBe("number");
    }
  }, 15000);

  it("supports includeLegalCoverage=false", async () => {
    const res = await jsonRequest("GET", "/forecasting/asset-health?includeLegalCoverage=false", getAuthHeaders(managerToken));

    expect(res.status).toBe(200);
    const dto = res.data.data;
    expect(dto).toHaveProperty("portfolio");
    expect(dto).toHaveProperty("buildings");
    expect(dto.legalCoverageSummary).toBeNull();
  }, 15000);

  it("returns 401 without token", async () => {
    const res = await jsonRequest("GET", "/forecasting/asset-health");
    expect(res.status).toBe(401);
  }, 10000);
});
