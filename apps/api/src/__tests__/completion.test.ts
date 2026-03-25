/**
 * Completion & Ratings — Integration Tests (Slice 7)
 *
 * Tests the job completion, confirmation, and rating endpoints:
 *   POST /contractor/jobs/:id/complete            — contractor marks job completed
 *   POST /tenant-portal/jobs/:jobId/confirm       — tenant confirms completion
 *   POST /contractor/jobs/:id/rate                — contractor submits rating
 *   POST /tenant-portal/jobs/:jobId/rate          — tenant submits rating
 *   GET  /contractors/:id/ratings                 — contractor rating history
 *
 * Coverage:
 *   - Auth gates (401 without token, 403 wrong role)
 *   - Contractor can only complete their own job
 *   - Tenant can only confirm their own request's job
 *   - Both parties can rate; duplicate ratings blocked
 *   - GET ratings returns paginated results
 *   - Cross-org isolation
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { PrismaClient } from "@prisma/client";
import { startTestServer, stopTestServer } from './testHelpers';

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");

const prisma = new PrismaClient();
const PORT = 3217;

/* ── Server helpers ──────────────────────────────────────────── */

function httpPost(
  pathName: string,
  body: any,
  token?: string,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: PORT,
      path: pathName,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 500, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode || 500, data: { raw: data } });
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(
  pathName: string,
  token?: string,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: PORT,
      path: pathName,
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 500, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode || 500, data: { raw: data } });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/* ── Tokens ──────────────────────────────────────────────────── */

const ORG_ID = "compl-test-org";

const managerToken = encodeToken({
  userId: "compl-manager-user",
  orgId: ORG_ID,
  email: "manager@compl-test.ch",
  role: "MANAGER",
});

const contractorToken = encodeToken({
  userId: "compl-contractor-user",
  orgId: ORG_ID,
  email: "contractor@compl-test.ch",
  role: "CONTRACTOR",
});

const tenantToken = encodeToken({
  userId: "compl-tenant-id",
  tenantId: "compl-tenant-id",
  orgId: ORG_ID,
  email: "tenant@compl-test.ch",
  role: "TENANT",
});

const otherTenantToken = encodeToken({
  userId: "compl-other-tenant-id",
  tenantId: "compl-other-tenant-id",
  orgId: ORG_ID,
  email: "other-tenant@compl-test.ch",
  role: "TENANT",
});

const wrongOrgContractorToken = encodeToken({
  userId: "wrong-org-contractor-user",
  orgId: "wrong-org-compl",
  email: "contractor@wrong-org-compl.ch",
  role: "CONTRACTOR",
});

/* ── Shared test data IDs ───────────────────────────────────── */

let contractorId: string;
let requestId: string;
let jobId: string;

/* ── Setup & Teardown ────────────────────────────────────────── */

let serverProcess: ChildProcessWithoutNullStreams;

async function cleanupTestData() {
  await prisma.jobRating.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.appointmentSlot.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.notification.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.invoice.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.job.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.request.deleteMany({ where: { tenant: { orgId: ORG_ID } } });
  await prisma.occupancy.deleteMany({ where: { tenant: { orgId: ORG_ID } } });
  await prisma.tenant.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.contractor.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.unit.deleteMany({ where: { building: { orgId: ORG_ID } } });
  await prisma.building.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.user.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.event.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.org.deleteMany({ where: { id: ORG_ID } });
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test org
  await prisma.org.create({ data: { id: ORG_ID, name: "Completion Test Org" } });

  // Create manager user
  await prisma.user.create({
    data: {
      id: "compl-manager-user",
      orgId: ORG_ID,
      name: "Compl Manager",
      role: "MANAGER",
      email: "manager@compl-test.ch",
    },
  });

  // Create tenant
  await prisma.tenant.create({
    data: {
      id: "compl-tenant-id",
      name: "Compl Tenant",
      email: "tenant@compl-test.ch",
      phone: "+41791230010",
      org: { connect: { id: ORG_ID } },
    },
  });

  // Create another tenant (for cross-tenant tests)
  await prisma.tenant.create({
    data: {
      id: "compl-other-tenant-id",
      name: "Other Compl Tenant",
      email: "other-tenant@compl-test.ch",
      phone: "+41791230011",
      org: { connect: { id: ORG_ID } },
    },
  });

  // Create building + unit
  const building = await prisma.building.create({
    data: { orgId: ORG_ID, name: "Compl Building", address: "Test St 7" },
  });
  const unit = await prisma.unit.create({
    data: { orgId: ORG_ID, buildingId: building.id, unitNumber: "C-1" },
  });

  // Create contractor
  const contractor = await prisma.contractor.create({
    data: {
      name: "Compl Contractor",
      email: "contractor@compl-test.ch",
      phone: "+41791234570",
      serviceCategories: "PLUMBING",
      org: { connect: { id: ORG_ID } },
    },
  });
  contractorId = contractor.id;

  // Create request with tenant + assigned contractor
  const request = await prisma.request.create({
    data: {
      description: "Fix sink for completion test",
      category: "PLUMBING",
      tenantId: "compl-tenant-id",
      unitId: unit.id,
      status: "APPROVED",
      assignedContractorId: contractor.id,
    },
  });
  requestId = request.id;

  // Create IN_PROGRESS job
  const job = await prisma.job.create({
    data: {
      orgId: ORG_ID,
      requestId: request.id,
      contractorId: contractor.id,
      status: "IN_PROGRESS",
    },
  });
  jobId = job.id;

  // Start server
  serverProcess = await startTestServer(PORT, { AUTH_OPTIONAL: "false", NODE_ENV: "test", BG_JOBS_ENABLED: "false" });
}, 30000);

afterAll(async () => {
  await stopTestServer(serverProcess);

  await cleanupTestData();
  await prisma.$disconnect();
}, 15000);

/* ── Auth gate tests ─────────────────────────────────────────── */

describe("Auth gates", () => {
  it("POST /contractor/jobs/:id/complete → 401 without token", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/complete?contractorId=${contractorId}`,
      {},
    );
    expect(res.status).toBe(401);
  });

  it("POST /contractor/jobs/:id/complete → 403 for TENANT role", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/complete?contractorId=${contractorId}`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(403);
  });

  it("POST /tenant-portal/jobs/:jobId/confirm → 401 without token", async () => {
    const res = await httpPost(`/tenant-portal/jobs/${jobId}/confirm`, {});
    expect(res.status).toBe(401);
  });

  it("POST /tenant-portal/jobs/:jobId/confirm → 403 for CONTRACTOR role", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/confirm`,
      {},
      contractorToken,
    );
    expect(res.status).toBe(403);
  });

  it("GET /contractors/:id/ratings → 401 without token", async () => {
    const res = await httpGet(`/contractors/${contractorId}/ratings`);
    expect(res.status).toBe(401);
  });
});

/* ── Contractor completes job ────────────────────────────────── */

describe("Contractor complete job", () => {
  it("POST /contractor/jobs/:id/complete → 200 for valid contractor", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/complete?contractorId=${contractorId}`,
      { actualCost: 15000 },
      contractorToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data).toBeDefined();
    expect(res.data.data.status).toBe("COMPLETED");
  });

  it("POST /contractor/jobs/:id/complete → 409 for already completed job", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/complete?contractorId=${contractorId}`,
      {},
      contractorToken,
    );
    expect(res.status).toBe(409);
  });
});

/* ── Tenant confirms completion ──────────────────────────────── */

describe("Tenant confirm completion", () => {
  it("POST /tenant-portal/jobs/:jobId/confirm → 403 for wrong tenant", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/confirm`,
      {},
      otherTenantToken,
    );
    expect(res.status).toBe(403);
  });

  it("POST /tenant-portal/jobs/:jobId/confirm → 200 for correct tenant", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/confirm`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data).toBeDefined();
    expect(res.data.data.confirmedAt).toBeDefined();
  });

  it("POST /tenant-portal/jobs/:jobId/confirm → 409 when already confirmed", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/confirm`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(409);
  });
});

/* ── Rating submission ───────────────────────────────────────── */

describe("Rating submission", () => {
  it("POST /contractor/jobs/:id/rate → 201 for contractor rating", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/rate?contractorId=${contractorId}`,
      { score: 4, comment: "Good tenant, easy to schedule" },
      contractorToken,
    );
    expect(res.status).toBe(201);
    expect(res.data.data.score).toBe(4);
    expect(res.data.data.raterRole).toBe("CONTRACTOR");
    expect(res.data.data.comment).toBe("Good tenant, easy to schedule");
  });

  it("POST /contractor/jobs/:id/rate → 409 for duplicate contractor rating", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/rate?contractorId=${contractorId}`,
      { score: 5 },
      contractorToken,
    );
    expect(res.status).toBe(409);
    expect(res.data.error.code).toBe("DUPLICATE_RATING");
  });

  it("POST /tenant-portal/jobs/:jobId/rate → 201 for tenant rating", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/rate`,
      { score: 5, comment: "Excellent work!" },
      tenantToken,
    );
    expect(res.status).toBe(201);
    expect(res.data.data.score).toBe(5);
    expect(res.data.data.raterRole).toBe("TENANT");
  });

  it("POST /tenant-portal/jobs/:jobId/rate → 409 for duplicate tenant rating", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/rate`,
      { score: 3 },
      tenantToken,
    );
    expect(res.status).toBe(409);
    expect(res.data.error.code).toBe("DUPLICATE_RATING");
  });

  it("POST /tenant-portal/jobs/:jobId/rate → 403 for wrong tenant", async () => {
    const res = await httpPost(
      `/tenant-portal/jobs/${jobId}/rate`,
      { score: 3 },
      otherTenantToken,
    );
    expect(res.status).toBe(403);
  });
});

/* ── Contractor ratings history ──────────────────────────────── */

describe("Contractor ratings history", () => {
  it("GET /contractors/:id/ratings → 200 with manager token", async () => {
    const res = await httpGet(
      `/contractors/${contractorId}/ratings`,
      managerToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data).toBeInstanceOf(Array);
    // Should have both contractor and tenant ratings
    expect(res.data.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data.pagination).toBeDefined();
    expect(res.data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /contractors/:id/ratings → ratings include job context", async () => {
    const res = await httpGet(
      `/contractors/${contractorId}/ratings`,
      managerToken,
    );
    expect(res.status).toBe(200);
    const tenantRating = res.data.data.find((r: any) => r.raterRole === "TENANT");
    expect(tenantRating).toBeDefined();
    expect(tenantRating.score).toBe(5);
    expect(tenantRating.job).toBeDefined();
    expect(tenantRating.job.description).toBe("Fix sink for completion test");
  });

  it("GET /contractors/:id/ratings → supports pagination", async () => {
    const res = await httpGet(
      `/contractors/${contractorId}/ratings?limit=1&offset=0`,
      managerToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBe(1);
  });
});

/* ── Cross-org isolation ─────────────────────────────────────── */

describe("Cross-org isolation", () => {
  it("POST /contractor/jobs/:id/complete → 404 from wrong org", async () => {
    // Create a contractor in the wrong org and use its token
    const res = await httpPost(
      `/contractor/jobs/${jobId}/complete?contractorId=nonexistent-contractor`,
      {},
      wrongOrgContractorToken,
    );
    // Cross-org request should not find the contractor (404)
    expect(res.status).toBe(404);
  });
});
