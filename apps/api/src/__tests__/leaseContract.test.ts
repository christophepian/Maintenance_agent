/**
 * GET /leases/:id Contract Test (TC-3)
 *
 * Asserts the full DTO shape of GET /leases/:id including nested
 * unit, building, and expense items. Required by G10.
 *
 * Port: 3251 (unique)
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from "child_process";
import { PrismaClient, LeaseStatus } from "@prisma/client";
import { startTestServer, stopTestServer, createManagerToken } from "./testHelpers";

process.env.AUTH_SECRET = "test-secret";

const prisma = new PrismaClient();

function httpRequest(
  port: number,
  method: string,
  pathName: string,
  body?: object,
  token?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path: pathName,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("GET /leases/:id — contract test", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  const port = 3251;
  const orgId = "default-org";
  const managerToken = createManagerToken(orgId);
  let buildingId: string;
  let unitId: string;
  let leaseId: string;

  beforeAll(async () => {
    await prisma.org.upsert({
      where: { id: orgId },
      create: { id: orgId, name: "Lease Contract Test Org" },
      update: {},
    });

    const building = await prisma.building.create({
      data: { orgId, name: `Lease Contract Building ${Date.now()}`, address: "Contract St 1", canton: "ZH" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: `LCT-${Date.now()}`, type: "RESIDENTIAL" },
    });
    unitId = unit.id;

    const lease = await prisma.lease.create({
      data: {
        orgId,
        unitId,
        status: LeaseStatus.DRAFT,
        startDate: new Date("2026-04-01"),
        netRentChf: 1500,
        landlordName: "Contract Test Landlord",
        landlordAddress: "Landlord St 1",
        landlordZipCity: "8000 Zurich",
        tenantName: "Contract Test Tenant",
        tenantAddress: "Tenant St 1",
        tenantZipCity: "3000 Bern",
      },
    });
    leaseId = lease.id;

    proc = await startTestServer(port, { AUTH_OPTIONAL: "false", NODE_ENV: "test" });
  }, 30000);

  afterAll(async () => {
    await stopTestServer(proc);
    await prisma.lease.delete({ where: { id: leaseId } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("returns full DTO shape with nested unit and building", async () => {
    const res = await httpRequest(port, "GET", `/leases/${leaseId}`, undefined, managerToken);

    expect(res.status).toBe(200);
    const dto = res.data.data;

    // Top-level lease fields
    expect(dto).toHaveProperty("id", leaseId);
    expect(dto).toHaveProperty("status", "DRAFT");
    expect(dto).toHaveProperty("startDate");
    expect(dto).toHaveProperty("netRentChf", 1500);
    expect(dto).toHaveProperty("landlordName", "Contract Test Landlord");
    expect(dto).toHaveProperty("landlordAddress");
    expect(dto).toHaveProperty("landlordZipCity");
    expect(dto).toHaveProperty("tenantName", "Contract Test Tenant");
    expect(dto).toHaveProperty("createdAt");
    expect(dto).toHaveProperty("updatedAt");

    // Nested unit
    expect(dto).toHaveProperty("unit");
    expect(dto.unit).toHaveProperty("id", unitId);
    expect(dto.unit).toHaveProperty("unitNumber");

    // Nested building (via unit)
    expect(dto.unit).toHaveProperty("building");
    expect(dto.unit.building).toHaveProperty("id", buildingId);
    expect(dto.unit.building).toHaveProperty("name");

    // Expense items array (may be empty)
    expect(dto).toHaveProperty("expenseItems");
    expect(Array.isArray(dto.expenseItems)).toBe(true);
  }, 10000);

  it("returns 404 for non-existent lease", async () => {
    const res = await httpRequest(port, "GET", `/leases/non-existent-id`, undefined, managerToken);
    expect(res.status).toBe(404);
  }, 10000);

  it("returns 401 without token", async () => {
    const res = await httpRequest(port, "GET", `/leases/${leaseId}`);
    expect(res.status).toBe(401);
  }, 10000);
});
