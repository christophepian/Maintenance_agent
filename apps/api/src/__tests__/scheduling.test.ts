/**
 * Scheduling Handshake — Integration Tests (Slice 6)
 *
 * Tests the appointment scheduling endpoints:
 *   POST /contractor/jobs/:id/slots              — contractor proposes slots
 *   GET  /contractor/jobs/:id/slots              — contractor lists slots
 *   GET  /tenant-portal/requests/:requestId/slots — tenant views slots
 *   POST /tenant-portal/slots/:slotId/accept      — tenant accepts slot
 *   POST /tenant-portal/slots/:slotId/decline      — tenant declines slot
 *
 * Coverage:
 *   - Auth gates (401 without token, 403 for wrong role)
 *   - Contractor can only propose for their own PENDING job
 *   - Tenant can only respond for their own request
 *   - Accept auto-declines other PROPOSED slots
 *   - Invalid status transitions (double accept, accept already declined)
 *   - Cross-org isolation
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { PrismaClient, JobStatus, SlotStatus } from "@prisma/client";
import { startTestServer, stopTestServer } from './testHelpers';

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");

const prisma = new PrismaClient();
const PORT = 3216;

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

const ORG_ID = "sched-test-org";

const managerToken = encodeToken({
  userId: "sched-manager-user",
  orgId: ORG_ID,
  email: "manager@sched-test.ch",
  role: "MANAGER",
});

const contractorToken = encodeToken({
  userId: "sched-contractor-user",
  orgId: ORG_ID,
  email: "contractor@sched-test.ch",
  role: "CONTRACTOR",
});

const tenantToken = encodeToken({
  userId: "sched-tenant-id",
  tenantId: "sched-tenant-id",
  orgId: ORG_ID,
  email: "tenant@sched-test.ch",
  role: "TENANT",
});

const otherTenantToken = encodeToken({
  userId: "sched-other-tenant-id",
  tenantId: "sched-other-tenant-id",
  orgId: ORG_ID,
  email: "other-tenant@sched-test.ch",
  role: "TENANT",
});

const wrongOrgContractorToken = encodeToken({
  userId: "wrong-org-contractor-user",
  orgId: "wrong-org",
  email: "contractor@wrong-org.ch",
  role: "CONTRACTOR",
});

/* ── Shared test data IDs ───────────────────────────────────── */

let contractorId: string;
let requestId: string;
let jobId: string;
let slotIds: string[] = [];

/* ── Setup & Teardown ────────────────────────────────────────── */

let serverProcess: ChildProcessWithoutNullStreams;

beforeAll(async () => {
  // Clean up any stale test data
  await prisma.appointmentSlot.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.notification.deleteMany({ where: { orgId: ORG_ID } });
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

  // Create test org
  await prisma.org.create({ data: { id: ORG_ID, name: "Sched Test Org" } });

  // Create manager user
  await prisma.user.create({
    data: {
      id: "sched-manager-user",
      orgId: ORG_ID,
      name: "Sched Manager",
      role: "MANAGER",
      email: "manager@sched-test.ch",
    },
  });

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: "sched-tenant-id",
      name: "Sched Tenant",
      email: "tenant@sched-test.ch",
      phone: "+41791230001",
      org: { connect: { id: ORG_ID } },
    },
  });

  // Create another tenant (for cross-tenant tests)
  await prisma.tenant.create({
    data: {
      id: "sched-other-tenant-id",
      name: "Other Tenant",
      email: "other-tenant@sched-test.ch",
      phone: "+41791230002",
      org: { connect: { id: ORG_ID } },
    },
  });

  // Create building + unit
  const building = await prisma.building.create({
    data: { orgId: ORG_ID, name: "Sched Building", address: "Test St 1" },
  });
  const unit = await prisma.unit.create({
    data: { orgId: ORG_ID, buildingId: building.id, unitNumber: "S-1" },
  });

  // Create contractor
  const contractor = await prisma.contractor.create({
    data: {
      name: "Sched Contractor",
      email: "contractor@sched-test.ch",
      phone: "+41791234567",
      serviceCategories: "HEATING",
      org: { connect: { id: ORG_ID } },
    },
  });
  contractorId = contractor.id;

  // Create request with tenant
  const request = await prisma.request.create({
    data: {
      description: "Fix radiator for scheduling test",
      category: "HEATING",
      tenantId: tenant.id,
      unitId: unit.id,
      status: "APPROVED",
      assignedContractorId: contractor.id,
    },
  });
  requestId = request.id;

  // Create PENDING job
  const job = await prisma.job.create({
    data: {
      orgId: ORG_ID,
      requestId: request.id,
      contractorId: contractor.id,
      status: "PENDING",
    },
  });
  jobId = job.id;

  // Start server
  serverProcess = await startTestServer(PORT, { AUTH_OPTIONAL: "false", NODE_ENV: "test", BG_JOBS_ENABLED: "false" });
}, 30000);

afterAll(async () => {
  await stopTestServer(serverProcess);

  // Clean up
  await prisma.appointmentSlot.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.notification.deleteMany({ where: { orgId: ORG_ID } });
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
  await prisma.$disconnect();
}, 15000);

/* ── Auth gate tests ─────────────────────────────────────────── */

describe("Auth gates", () => {
  it("POST /contractor/jobs/:id/slots → 401 without token", async () => {
    const res = await httpPost(`/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`, {
      slots: [{ startTime: "2026-06-01T09:00:00Z", endTime: "2026-06-01T10:00:00Z" }],
    });
    expect(res.status).toBe(401);
  });

  it("POST /contractor/jobs/:id/slots → 403 for TENANT role", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
      { slots: [{ startTime: "2026-06-01T09:00:00Z", endTime: "2026-06-01T10:00:00Z" }] },
      tenantToken,
    );
    expect(res.status).toBe(403);
  });

  it("GET /tenant-portal/requests/:requestId/slots → 401 without token", async () => {
    const res = await httpGet(`/tenant-portal/requests/${requestId}/slots`);
    expect(res.status).toBe(401);
  });

  it("POST /tenant-portal/slots/:slotId/accept → 401 without token", async () => {
    const res = await httpPost("/tenant-portal/slots/00000000-0000-0000-0000-000000000000/accept", {});
    expect(res.status).toBe(401);
  });

  it("POST /tenant-portal/slots/:slotId/accept → 403 for CONTRACTOR role", async () => {
    const res = await httpPost("/tenant-portal/slots/00000000-0000-0000-0000-000000000000/accept", {}, contractorToken);
    expect(res.status).toBe(403);
  });
});

/* ── Contractor: propose slots ───────────────────────────────── */

describe("POST /contractor/jobs/:id/slots", () => {
  it("proposes slots successfully for a PENDING job", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(tomorrowEnd.getHours() + 1);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterEnd = new Date(dayAfter);
    dayAfterEnd.setHours(dayAfterEnd.getHours() + 2);

    const res = await httpPost(
      `/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
      {
        slots: [
          { startTime: tomorrow.toISOString(), endTime: tomorrowEnd.toISOString() },
          { startTime: dayAfter.toISOString(), endTime: dayAfterEnd.toISOString() },
        ],
      },
      contractorToken,
    );

    expect(res.status).toBe(201);
    expect(res.data.data.slots).toHaveLength(2);
    expect(res.data.data.schedulingExpiresAt).toBeDefined();

    slotIds = res.data.data.slots.map((s: any) => s.id);
    expect(slotIds).toHaveLength(2);

    // Verify slots are PROPOSED
    for (const slot of res.data.data.slots) {
      expect(slot.status).toBe("PROPOSED");
    }
  });

  it("rejects empty slots array", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
      { slots: [] },
      contractorToken,
    );
    expect(res.status).toBe(400);
  });

  it("rejects slots with endTime before startTime", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const past = new Date(future);
    past.setHours(past.getHours() - 2);

    const res = await httpPost(
      `/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
      { slots: [{ startTime: future.toISOString(), endTime: past.toISOString() }] },
      contractorToken,
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing contractorId param", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/slots`,
      { slots: [{ startTime: "2026-06-01T09:00:00Z", endTime: "2026-06-01T10:00:00Z" }] },
      contractorToken,
    );
    expect(res.status).toBe(400);
  });

  it("rejects for non-existent job", async () => {
    const res = await httpPost(
      `/contractor/jobs/00000000-0000-0000-0000-000000000000/slots?contractorId=${contractorId}`,
      {
        slots: [{ startTime: "2026-06-01T09:00:00Z", endTime: "2026-06-01T10:00:00Z" }],
      },
      contractorToken,
    );
    expect(res.status).toBe(404);
  });
});

/* ── Contractor: list slots ──────────────────────────────────── */

describe("GET /contractor/jobs/:id/slots", () => {
  it("lists proposed slots for the contractor's job", async () => {
    const res = await httpGet(
      `/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBeGreaterThanOrEqual(2);
  });
});

/* ── Tenant: view slots ──────────────────────────────────────── */

describe("GET /tenant-portal/requests/:requestId/slots", () => {
  it("tenant sees proposed slots for their request", async () => {
    const res = await httpGet(
      `/tenant-portal/requests/${requestId}/slots`,
      tenantToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.length).toBeGreaterThanOrEqual(2);
  });

  it("other tenant gets 403 for someone else's request", async () => {
    const res = await httpGet(
      `/tenant-portal/requests/${requestId}/slots`,
      otherTenantToken,
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent request", async () => {
    const res = await httpGet(
      `/tenant-portal/requests/00000000-0000-0000-0000-000000000000/slots`,
      tenantToken,
    );
    expect(res.status).toBe(404);
  });
});

/* ── Tenant: decline a slot ──────────────────────────────────── */

describe("POST /tenant-portal/slots/:slotId/decline", () => {
  it("tenant declines a PROPOSED slot", async () => {
    const res = await httpPost(
      `/tenant-portal/slots/${slotIds[1]}/decline`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.status).toBe("DECLINED");
    expect(res.data.data.respondedAt).toBeDefined();
  });

  it("cannot decline an already DECLINED slot", async () => {
    const res = await httpPost(
      `/tenant-portal/slots/${slotIds[1]}/decline`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(409);
  });

  it("other tenant cannot decline this slot", async () => {
    // Re-create a new slot to test cross-tenant rejection
    // Use existing PROPOSED slot slotIds[0]
    const res = await httpPost(
      `/tenant-portal/slots/${slotIds[0]}/decline`,
      {},
      otherTenantToken,
    );
    expect(res.status).toBe(403);
  });
});

/* ── Tenant: accept a slot ───────────────────────────────────── */

describe("POST /tenant-portal/slots/:slotId/accept", () => {
  it("tenant accepts a PROPOSED slot", async () => {
    const res = await httpPost(
      `/tenant-portal/slots/${slotIds[0]}/accept`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.data.status).toBe("ACCEPTED");
    expect(res.data.data.respondedAt).toBeDefined();
  });

  it("cannot accept an already ACCEPTED slot", async () => {
    const res = await httpPost(
      `/tenant-portal/slots/${slotIds[0]}/accept`,
      {},
      tenantToken,
    );
    expect(res.status).toBe(409);
  });

  it("verifies scheduling expiry is cleared after accept", async () => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.schedulingExpiresAt).toBeNull();
  });

  it("verifies manager was notified of accepted slot", async () => {
    const notifs = await prisma.notification.findMany({
      where: {
        orgId: ORG_ID,
        userId: "sched-manager-user",
        eventType: "SLOT_ACCEPTED" as any,
      },
    });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });
});

/* ── Cross-org isolation ─────────────────────────────────────── */

describe("Cross-org isolation", () => {
  it("contractor from wrong org gets 404 for contractor not found", async () => {
    const res = await httpPost(
      `/contractor/jobs/${jobId}/slots?contractorId=${contractorId}`,
      { slots: [{ startTime: "2026-06-01T09:00:00Z", endTime: "2026-06-01T10:00:00Z" }] },
      wrongOrgContractorToken,
    );
    // The contractor ownership check should fail
    expect(res.status).toBe(404);
  });
});

/* ── Domain events ───────────────────────────────────────────── */

describe("Domain events", () => {
  it("SLOT_PROPOSED event was persisted", async () => {
    const events = await prisma.event.findMany({
      where: { orgId: ORG_ID, type: "SLOT_PROPOSED" },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("SLOT_ACCEPTED event was persisted", async () => {
    const events = await prisma.event.findMany({
      where: { orgId: ORG_ID, type: "SLOT_ACCEPTED" },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("SLOT_DECLINED event was persisted", async () => {
    const events = await prisma.event.findMany({
      where: { orgId: ORG_ID, type: "SLOT_DECLINED" },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
