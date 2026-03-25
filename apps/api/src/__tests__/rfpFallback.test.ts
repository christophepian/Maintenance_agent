/**
 * RFP Fallback Actions — Integration Tests
 *
 * Tests the manager-facing fallback endpoints:
 *   POST /rfps/:id/reinvite       — re-invite additional contractors to an open RFP
 *   POST /rfps/:id/direct-assign  — bypass quotes, close RFP, directly assign contractor
 *
 * Coverage:
 *   - Auth gates (401 without token, 403 for wrong role)
 *   - Re-invite: success, idempotency, invalid RFP state, invalid contractors
 *   - Direct-assign: success (close + assign + job), invalid RFP state, missing request
 *   - Cross-org isolation
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { PrismaClient, RfpStatus, RfpInviteStatus, RfpQuoteStatus } from "@prisma/client";
import { startTestServer, stopTestServer } from './testHelpers';

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");

const prisma = new PrismaClient();
const PORT = 3215;

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

/* ── Tokens ──────────────────────────────────────────────────── */

const ORG_ID = "rfb-test-org";

const managerToken = encodeToken({
  userId: "rfb-manager-user",
  orgId: ORG_ID,
  email: "manager@rfb-test.ch",
  role: "MANAGER",
});

const contractorToken = encodeToken({
  userId: "rfb-contractor-user",
  orgId: ORG_ID,
  email: "contractor@rfb-test.ch",
  role: "CONTRACTOR",
});

const otherOrgManagerToken = encodeToken({
  userId: "rfb-other-org-user",
  orgId: "rfb-other-org",
  email: "manager@other-org.ch",
  role: "MANAGER",
});

/* ── Seed data IDs ───────────────────────────────────────────── */

let contractorAId: string;
let contractorBId: string;
let contractorCId: string;
let buildingId: string;
let unitId: string;
let requestId: string;

// RFPs
let openRfpId: string;         // OPEN, has linked request, 1 invite (contractorA), 1 quote
let closedRfpId: string;       // CLOSED — should reject reinvite and direct-assign
let noRequestRfpId: string;    // OPEN but no linked request — direct-assign should fail

/* ── Test suite ──────────────────────────────────────────────── */

describe("RFP Fallback Actions", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    // 1. Seed data
    const org = await prisma.org.upsert({
      where: { id: ORG_ID },
      update: {},
      create: { id: ORG_ID, name: "RFB Test Org" },
    });

    const building = await prisma.building.create({
      data: {
        orgId: org.id,
        name: "Immeuble Léman",
        address: "Av. du Tribunal-Fédéral 2, 1005 Lausanne",
      },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        unitNumber: "5A",
        isActive: true,
      },
    });
    unitId = unit.id;

    const cA = await prisma.contractor.create({
      data: {
        orgId: org.id,
        name: "Plombier Reinvite A",
        phone: "+41791110001",
        email: `rfb-a-${Date.now()}@test.ch`,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorAId = cA.id;

    const cB = await prisma.contractor.create({
      data: {
        orgId: org.id,
        name: "Plombier Reinvite B",
        phone: "+41791110002",
        email: `rfb-b-${Date.now()}@test.ch`,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorBId = cB.id;

    const cC = await prisma.contractor.create({
      data: {
        orgId: org.id,
        name: "Plombier Reinvite C",
        phone: "+41791110003",
        email: `rfb-c-${Date.now()}@test.ch`,
        serviceCategories: JSON.stringify(["plumbing", "heating"]),
      },
    });
    contractorCId = cC.id;

    const request = await prisma.request.create({
      data: {
        description: "Fuite dans la salle de bain — urgent",
        category: "plumbing",
        unitId: unit.id,
        assignedContractorId: cA.id,
      },
    });
    requestId = request.id;

    // ── Open RFP with request + 1 existing invite + 1 submitted quote ──
    const openRfp = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        unitId: unit.id,
        requestId: request.id,
        category: "plumbing",
        status: RfpStatus.OPEN,
        inviteCount: 1,
        deadlineAt: new Date("2025-09-01T00:00:00.000Z"),
      },
    });
    openRfpId = openRfp.id;

    await prisma.rfpInvite.create({
      data: {
        rfpId: openRfp.id,
        contractorId: cA.id,
        status: RfpInviteStatus.INVITED,
      },
    });

    await prisma.rfpQuote.create({
      data: {
        rfpId: openRfp.id,
        contractorId: cA.id,
        amountCents: 15000,
        currency: "CHF",
        vatIncluded: true,
        workPlan: "Replacement of faulty pipe section",
        status: RfpQuoteStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    // ── Closed RFP (should reject all fallback actions) ──
    const closedRfp = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        category: "plumbing",
        status: RfpStatus.CLOSED,
        inviteCount: 0,
      },
    });
    closedRfpId = closedRfp.id;

    // ── Open RFP without linked request ──
    const noRequestRfp = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        category: "heating",
        status: RfpStatus.OPEN,
        inviteCount: 0,
      },
    });
    noRequestRfpId = noRequestRfp.id;

    // 2. Start server
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "false", NODE_ENV: "test" });
  }, 30000);

  afterAll(async () => {
    await stopTestServer(proc);

    // Cleanup in reverse dependency order
    await prisma.job.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.rfpQuote.deleteMany({ where: { rfp: { orgId: ORG_ID } } }).catch(() => {});
    await prisma.rfpInvite.deleteMany({ where: { rfp: { orgId: ORG_ID } } }).catch(() => {});
    await prisma.rfp.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.request.deleteMany({ where: { unitId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.org.deleteMany({ where: { id: ORG_ID } }).catch(() => {});
    await prisma.$disconnect();
  });

  /* ═══════════════════════════════════════════════════════════
   * POST /rfps/:id/reinvite
   * ═══════════════════════════════════════════════════════════ */

  describe("POST /rfps/:id/reinvite", () => {

    /* ── Auth gates ──────────────────────────────────────────── */

    it("returns 401 without token", async () => {
      const result = await httpPost(`/rfps/${openRfpId}/reinvite`, {
        contractorIds: [contractorBId],
      });
      expect(result.status).toBe(401);
    }, 10000);

    it("returns 403 for CONTRACTOR role", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/reinvite`,
        { contractorIds: [contractorBId] },
        contractorToken,
      );
      expect(result.status).toBe(403);
    }, 10000);

    /* ── Validation ──────────────────────────────────────────── */

    it("returns 400 when contractorIds is empty", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/reinvite`,
        { contractorIds: [] },
        managerToken,
      );
      expect(result.status).toBe(400);
    }, 10000);

    it("returns 400 when contractorIds is missing", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/reinvite`,
        {},
        managerToken,
      );
      expect(result.status).toBe(400);
    }, 10000);

    /* ── Success path ────────────────────────────────────────── */

    it("adds new contractors to OPEN RFP", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/reinvite`,
        { contractorIds: [contractorBId, contractorCId] },
        managerToken,
      );
      expect(result.status).toBe(200);

      const data = result.data.data;
      expect(data.rfpId).toBe(openRfpId);
      expect(data.addedCount).toBe(2);
      expect(data.skippedCount).toBe(0);
      expect(data.totalInvites).toBeGreaterThanOrEqual(3); // A + B + C

      // Verify invites in DB
      const invites = await prisma.rfpInvite.findMany({
        where: { rfpId: openRfpId },
      });
      const invitedIds = invites.map((i) => i.contractorId);
      expect(invitedIds).toContain(contractorAId); // original
      expect(invitedIds).toContain(contractorBId); // newly added
      expect(invitedIds).toContain(contractorCId); // newly added
    }, 15000);

    /* ── Idempotency ─────────────────────────────────────────── */

    it("re-inviting already-invited contractors returns 0 added", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/reinvite`,
        { contractorIds: [contractorAId, contractorBId] },
        managerToken,
      );
      expect(result.status).toBe(200);

      const data = result.data.data;
      expect(data.addedCount).toBe(0);
      expect(data.skippedCount).toBe(2);
    }, 10000);

    /* ── Invalid state ───────────────────────────────────────── */

    it("returns 409 for CLOSED RFP", async () => {
      const result = await httpPost(
        `/rfps/${closedRfpId}/reinvite`,
        { contractorIds: [contractorBId] },
        managerToken,
      );
      expect(result.status).toBe(409);
      const errCode = result.data?.error?.code || result.data?.code;
      expect(errCode).toBe("RFP_NOT_OPEN");
    }, 10000);

    it("returns 404 for non-existent RFP", async () => {
      const result = await httpPost(
        `/rfps/00000000-0000-0000-0000-000000000000/reinvite`,
        { contractorIds: [contractorBId] },
        managerToken,
      );
      expect(result.status).toBe(404);
    }, 10000);

    /* ── Cross-org isolation ─────────────────────────────────── */

    it("returns 404 for RFP from different org", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/reinvite`,
        { contractorIds: [contractorBId] },
        otherOrgManagerToken,
      );
      expect(result.status).toBe(404);
    }, 10000);
  });

  /* ═══════════════════════════════════════════════════════════
   * POST /rfps/:id/direct-assign
   * ═══════════════════════════════════════════════════════════ */

  describe("POST /rfps/:id/direct-assign", () => {

    /* ── Auth gates ──────────────────────────────────────────── */

    it("returns 401 without token", async () => {
      const result = await httpPost(`/rfps/${noRequestRfpId}/direct-assign`, {
        contractorId: contractorCId,
      });
      expect(result.status).toBe(401);
    }, 10000);

    it("returns 403 for CONTRACTOR role", async () => {
      const result = await httpPost(
        `/rfps/${noRequestRfpId}/direct-assign`,
        { contractorId: contractorCId },
        contractorToken,
      );
      expect(result.status).toBe(403);
    }, 10000);

    /* ── Validation ──────────────────────────────────────────── */

    it("returns 400 when contractorId is missing", async () => {
      const result = await httpPost(
        `/rfps/${noRequestRfpId}/direct-assign`,
        {},
        managerToken,
      );
      expect(result.status).toBe(400);
    }, 10000);

    /* ── Invalid state: no linked request ────────────────────── */

    it("returns 400 for RFP without linked request", async () => {
      const result = await httpPost(
        `/rfps/${noRequestRfpId}/direct-assign`,
        { contractorId: contractorCId },
        managerToken,
      );
      expect(result.status).toBe(400);
      const errCode = result.data?.error?.code || result.data?.code;
      expect(errCode).toBe("NO_LINKED_REQUEST");
    }, 10000);

    /* ── Invalid state: non-OPEN RFP ─────────────────────────── */

    it("returns 409 for CLOSED RFP", async () => {
      const result = await httpPost(
        `/rfps/${closedRfpId}/direct-assign`,
        { contractorId: contractorCId },
        managerToken,
      );
      expect(result.status).toBe(409);
      const errCode = result.data?.error?.code || result.data?.code;
      expect(errCode).toBe("RFP_NOT_OPEN");
    }, 10000);

    it("returns 404 for non-existent RFP", async () => {
      const result = await httpPost(
        `/rfps/00000000-0000-0000-0000-000000000000/direct-assign`,
        { contractorId: contractorCId },
        managerToken,
      );
      expect(result.status).toBe(404);
    }, 10000);

    /* ── Cross-org isolation ─────────────────────────────────── */

    it("returns 404 for RFP from different org", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/direct-assign`,
        { contractorId: contractorCId },
        otherOrgManagerToken,
      );
      expect(result.status).toBe(404);
    }, 10000);

    /* ── Success path (run last — mutates RFP to CLOSED) ──── */

    it("closes RFP, rejects quotes, assigns contractor, and creates job", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/direct-assign`,
        { contractorId: contractorBId },
        managerToken,
      );
      expect(result.status).toBe(200);

      const data = result.data.data;
      expect(data.rfpId).toBe(openRfpId);
      expect(data.requestId).toBe(requestId);
      expect(data.contractorId).toBe(contractorBId);
      expect(data.rfpStatus).toBe("CLOSED");
      expect(data.jobCreated).toBe(true);

      // Verify RFP is CLOSED in DB
      const rfp = await prisma.rfp.findUnique({ where: { id: openRfpId } });
      expect(rfp?.status).toBe("CLOSED");

      // Verify submitted quote was rejected
      const quotes = await prisma.rfpQuote.findMany({
        where: { rfpId: openRfpId },
      });
      for (const q of quotes) {
        expect(q.status).toBe("REJECTED");
      }

      // Verify contractor was assigned to request
      const request = await prisma.request.findUnique({
        where: { id: requestId },
      });
      expect(request?.assignedContractorId).toBe(contractorBId);

      // Verify a job was created
      const jobs = await prisma.job.findMany({
        where: { requestId, contractorId: contractorBId },
      });
      expect(jobs.length).toBeGreaterThanOrEqual(1);
    }, 15000);

    it("returns 409 after RFP is already CLOSED (from direct-assign above)", async () => {
      const result = await httpPost(
        `/rfps/${openRfpId}/direct-assign`,
        { contractorId: contractorCId },
        managerToken,
      );
      expect(result.status).toBe(409);
    }, 10000);
  });
});
