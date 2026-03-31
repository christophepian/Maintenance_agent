/**
 * Config Route Integration Tests (TC-2)
 *
 * Covers GET/PUT org config, GET/PUT building config, GET/PUT/DELETE unit config.
 *
 * Port: 3250 (unique for this test suite)
 * Pattern: HTTP integration (spawn server)
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from "child_process";
import { startTestServer, stopTestServer, createManagerToken } from "./testHelpers";
import { PrismaClient } from "@prisma/client";

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

describe("Config routes", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;
  const port = 3250;
  const orgId = "default-org";
  const managerToken = createManagerToken(orgId);
  let buildingId: string;
  let unitId: string;

  beforeAll(async () => {
    // Ensure org exists
    await prisma.org.upsert({
      where: { id: orgId },
      create: { id: orgId, name: "Config Test Org" },
      update: {},
    });

    // Create building + unit for config tests
    const building = await prisma.building.create({
      data: { orgId, name: `Config Test Building ${Date.now()}`, address: "Config St 1", canton: "ZH" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: `CfgU-${Date.now()}`, type: "RESIDENTIAL" },
    });
    unitId = unit.id;

    proc = await startTestServer(port, { AUTH_OPTIONAL: "false", NODE_ENV: "test" });
  }, 30000);

  afterAll(async () => {
    await stopTestServer(proc);
    await prisma.unitConfig.deleteMany({ where: { unitId } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe("GET /org-config", () => {
    it("returns org config for authenticated manager", async () => {
      const res = await httpRequest(port, "GET", "/org-config", undefined, managerToken);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("data");
    }, 10000);

    it("returns 401 without token", async () => {
      const res = await httpRequest(port, "GET", "/org-config");
      expect(res.status).toBe(401);
    }, 10000);
  });

  describe("GET /buildings/:id/config", () => {
    it("returns building config for authenticated manager", async () => {
      const res = await httpRequest(port, "GET", `/buildings/${buildingId}/config`, undefined, managerToken);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("data");
    }, 10000);
  });

  describe("PUT /buildings/:id/config", () => {
    it("updates building config", async () => {
      const res = await httpRequest(port, "PUT", `/buildings/${buildingId}/config`, {
        autoApproveLimit: 500,
        autoLegalRouting: true,
      }, managerToken);
      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty("autoApproveLimit", 500);
    }, 10000);
  });

  describe("GET /units/:id/config", () => {
    it("returns unit config (may be null if not set)", async () => {
      const res = await httpRequest(port, "GET", `/units/${unitId}/config`, undefined, managerToken);
      expect(res.status).toBe(200);
    }, 10000);
  });

  describe("PUT /units/:id/config", () => {
    it("upserts unit config", async () => {
      const res = await httpRequest(port, "PUT", `/units/${unitId}/config`, {
        autoApproveLimit: 200,
      }, managerToken);
      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty("autoApproveLimit", 200);
    }, 10000);
  });

  describe("DELETE /units/:id/config", () => {
    it("deletes unit config", async () => {
      // Ensure config exists first
      await httpRequest(port, "PUT", `/units/${unitId}/config`, {
        autoApproveLimit: 100,
      }, managerToken);

      const res = await httpRequest(port, "DELETE", `/units/${unitId}/config`, undefined, managerToken);
      expect([200, 204]).toContain(res.status);
    }, 10000);
  });
});
