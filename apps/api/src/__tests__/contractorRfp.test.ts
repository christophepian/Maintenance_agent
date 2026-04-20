/**
 * Contractor RFP Marketplace — Integration Tests
 *
 * Tests the contractor-facing RFP endpoints:
 *   GET /contractor/rfps       — list RFPs visible to a contractor
 *   GET /contractor/rfps/:id   — single RFP detail (contractor-safe)
 *
 * Visibility rules:
 *   - OPEN RFPs matching contractor's serviceCategories
 *   - Any RFP where the contractor has an invite (regardless of category/status)
 *   - Cross-org isolation
 *
 * Response stripping:
 *   - No full building address (only postal code)
 *   - No tenant identity
 *   - No other contractors' data
 */

import * as http from "http";
import { ChildProcessWithoutNullStreams } from 'child_process';
import { PrismaClient, RfpStatus, RfpInviteStatus, RfpQuoteStatus } from "@prisma/client";
import { startTestServer, stopTestServer } from './testHelpers';

process.env.AUTH_SECRET = "test-secret";
const { encodeToken } = require("../services/auth");

const prisma = new PrismaClient();
const PORT = 3214;

/* ── Server helpers ──────────────────────────────────────────── */

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
        "Content-Type": "application/json",
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

const ORG_ID = "crfp-test-org";

const contractorToken = encodeToken({
  userId: "crfp-contractor-user",
  orgId: ORG_ID,
  email: "contractor@crfp-test.ch",
  role: "CONTRACTOR",
});

const managerToken = encodeToken({
  userId: "crfp-manager-user",
  orgId: ORG_ID,
  email: "manager@crfp-test.ch",
  role: "MANAGER",
});

const otherOrgContractorToken = encodeToken({
  userId: "crfp-other-org-user",
  orgId: "crfp-other-org",
  email: "contractor@other-org.ch",
  role: "CONTRACTOR",
});

const ownerToken = encodeToken({
  userId: "crfp-owner-user",
  orgId: ORG_ID,
  email: "owner@crfp-test.ch",
  role: "OWNER",
});

/* ── Seed data IDs ───────────────────────────────────────────── */

let contractorId: string;
let otherContractorId: string;
let buildingId: string;
let unitId: string;
let requestId: string;
let openRfpPlumbingId: string;    // OPEN, category=plumbing → visible to contractor (category match)
let draftRfpPlumbingId: string;   // DRAFT, category=plumbing → NOT visible (not OPEN, no invite)
let openRfpElectricalId: string;  // OPEN, category=electrical → NOT visible (category mismatch)
let closedRfpWithInviteId: string; // CLOSED, category=electrical but contractor invited → visible

/* ── Award test data ─────────────────────────────────────────── */

let awardRfpId: string;          // OPEN RFP for award tests
let awardQuote1Id: string;       // Low-value quote (below threshold — 100 CHF = 10000 cents)
let awardQuote2Id: string;       // High-value quote (above default 200 CHF threshold — 500 CHF)
let awardContractor2Id: string;  // Second contractor for the losing quote

let ownerApprovalRfpId: string;  // Separate OPEN RFP for owner-approval-routing test
let ownerApprovalQuoteId: string;

/* ── Test suite ──────────────────────────────────────────────── */

describe("Contractor RFP Marketplace", () => {
  let proc: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    // 1. Seed data via Prisma
    const org = await prisma.org.upsert({
      where: { id: ORG_ID },
      update: {},
      create: { id: ORG_ID, name: "CRFP Test Org" },
    });

    // Create OrgConfig so threshold-based approval routing works
    // Default threshold: 200 CHF (quotes above this need owner approval)
    await prisma.orgConfig.upsert({
      where: { orgId: org.id },
      update: {},
      create: {
        orgId: org.id,
        autoApproveLimit: 200,
      },
    });

    const building = await prisma.building.create({
      data: {
        orgId: org.id,
        name: "Résidence du Lac",
        address: "Rue du Lac 15, 1003 Lausanne",
      },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        unitNumber: "3B",
        isActive: true,
      },
    });
    unitId = unit.id;

    // Contractor with plumbing category
    const contractor = await prisma.contractor.create({
      data: {
        orgId: org.id,
        name: "Plumber Pro",
        phone: "+41791234567",
        email: `crfp-plumber-${Date.now()}@test.ch`,
        serviceCategories: JSON.stringify(["plumbing", "heating"]),
      },
    });
    contractorId = contractor.id;

    // Another contractor (for isolation checks)
    const otherContractor = await prisma.contractor.create({
      data: {
        orgId: org.id,
        name: "Electrician Pro",
        phone: "+41791234568",
        email: `crfp-electrician-${Date.now()}@test.ch`,
        serviceCategories: JSON.stringify(["electrical"]),
      },
    });
    otherContractorId = otherContractor.id;

    // Request linked to RFPs
    const request = await prisma.request.create({
      data: {
        orgId: ORG_ID,
        description: "Kitchen sink leaking badly",
        category: "plumbing",
        unitId: unit.id,
        assignedContractorId: contractor.id,
      },
    });
    requestId = request.id;

    // RFP 1: OPEN, plumbing → visible via category match
    const openRfpPlumbing = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        unitId: unit.id,
        requestId: request.id,
        category: "plumbing",
        status: RfpStatus.OPEN,
        inviteCount: 3,
        deadlineAt: new Date("2025-06-01T00:00:00.000Z"),
      },
    });
    openRfpPlumbingId = openRfpPlumbing.id;

    // RFP 2: DRAFT, plumbing → NOT visible (not OPEN, no invite)
    const draftRfpPlumbing = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        category: "plumbing",
        status: RfpStatus.DRAFT,
        inviteCount: 3,
      },
    });
    draftRfpPlumbingId = draftRfpPlumbing.id;

    // RFP 3: OPEN, electrical → NOT visible (category mismatch, no invite)
    const openRfpElectrical = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        category: "electrical",
        status: RfpStatus.OPEN,
        inviteCount: 3,
      },
    });
    openRfpElectricalId = openRfpElectrical.id;

    // RFP 4: CLOSED, electrical BUT contractor has invite → visible
    const closedRfpWithInvite = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        category: "electrical",
        status: RfpStatus.CLOSED,
        inviteCount: 3,
      },
    });
    closedRfpWithInviteId = closedRfpWithInvite.id;

    // Create invite for contractor on RFP 4
    await prisma.rfpInvite.create({
      data: {
        rfpId: closedRfpWithInvite.id,
        contractorId: contractor.id,
        status: RfpInviteStatus.INVITED,
      },
    });

    // ── Award test data ──────────────────────────────────────

    // Second contractor for award testing
    const awardContractor2 = await prisma.contractor.create({
      data: {
        orgId: org.id,
        name: "Award Test Plumber 2",
        phone: "+41791234569",
        email: `crfp-award-plumber2-${Date.now()}@test.ch`,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    awardContractor2Id = awardContractor2.id;

    // RFP for direct award tests (below threshold)
    const awardRfp = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        unitId: unit.id,
        category: "plumbing",
        status: RfpStatus.OPEN,
        inviteCount: 3,
      },
    });
    awardRfpId = awardRfp.id;

    // Quote 1: low value (100 CHF = 10000 cents) — below default 200 CHF threshold
    const aq1 = await prisma.rfpQuote.create({
      data: {
        rfpId: awardRfp.id,
        contractorId: contractor.id,
        amountCents: 10000,
        currency: "CHF",
        vatIncluded: true,
        workPlan: "Quick fix under threshold",
        status: RfpQuoteStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
    awardQuote1Id = aq1.id;

    // Quote 2: also low value, from second contractor
    const aq2 = await prisma.rfpQuote.create({
      data: {
        rfpId: awardRfp.id,
        contractorId: awardContractor2.id,
        amountCents: 12000,
        currency: "CHF",
        vatIncluded: true,
        workPlan: "Alternative low-cost fix",
        status: RfpQuoteStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
    awardQuote2Id = aq2.id;

    // Separate RFP for owner-approval routing (above threshold)
    const ownerApprovalRfp = await prisma.rfp.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        unitId: unit.id,
        category: "plumbing",
        status: RfpStatus.OPEN,
        inviteCount: 3,
      },
    });
    ownerApprovalRfpId = ownerApprovalRfp.id;

    // High-value quote (500 CHF = 50000 cents) — above default 200 CHF threshold
    const oaq = await prisma.rfpQuote.create({
      data: {
        rfpId: ownerApprovalRfp.id,
        contractorId: contractor.id,
        amountCents: 50000,
        currency: "CHF",
        vatIncluded: true,
        workPlan: "Major repair above threshold",
        status: RfpQuoteStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
    ownerApprovalQuoteId = oaq.id;

    // ── User records matching contractor emails (for notification targeting) ──
    // The award workflow finds users by email matching against contractor.email
    await prisma.user.upsert({
      where: { id: "crfp-contractor-user" },
      update: { email: contractor.email },
      create: {
        id: "crfp-contractor-user",
        orgId: org.id,
        role: "CONTRACTOR",
        name: contractor.name,
        email: contractor.email,
      },
    });

    await prisma.user.upsert({
      where: { id: "crfp-contractor2-user" },
      update: { email: awardContractor2.email },
      create: {
        id: "crfp-contractor2-user",
        orgId: org.id,
        role: "CONTRACTOR",
        name: awardContractor2.name,
        email: awardContractor2.email,
      },
    });

    // 2. Start server
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "false", NODE_ENV: "test" });
  }, 30000);

  afterAll(async () => {
    await stopTestServer(proc);

    // Cleanup in reverse dependency order
    await prisma.notification.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.rfpQuote.deleteMany({ where: { rfp: { orgId: ORG_ID } } }).catch(() => {});
    await prisma.rfpInvite.deleteMany({ where: { rfp: { orgId: ORG_ID } } }).catch(() => {});
    await prisma.rfp.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.request.deleteMany({ where: { unitId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.user.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.orgConfig.deleteMany({ where: { orgId: ORG_ID } }).catch(() => {});
    await prisma.org.deleteMany({ where: { id: ORG_ID } }).catch(() => {});
    await prisma.$disconnect();
  });

  /* ── Auth gates ──────────────────────────────────────────── */

  it("returns 401 without token (requireRole auth gate)", async () => {
    const result = await httpGet(`/contractor/rfps?contractorId=${contractorId}`);
    // Contractor routes use requireRole('CONTRACTOR') → 401 for unauthenticated
    expect(result.status).toBe(401);
  }, 10000);

  it("returns 403 for MANAGER role", async () => {
    const result = await httpGet(
      `/contractor/rfps?contractorId=${contractorId}`,
      managerToken,
    );
    expect(result.status).toBe(403);
  }, 10000);

  /* ── List endpoint ─────────────────────────────────────────── */

  it("lists RFPs visible to contractor (category match + invited)", async () => {
    const result = await httpGet(
      `/contractor/rfps?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const rows = result.data.data;
    expect(Array.isArray(rows)).toBe(true);

    const ids = rows.map((r: any) => r.id);

    // Should see: OPEN plumbing (category match) + CLOSED with invite
    expect(ids).toContain(openRfpPlumbingId);
    expect(ids).toContain(closedRfpWithInviteId);

    // Should NOT see: DRAFT plumbing (not OPEN) or OPEN electrical (wrong category, no invite)
    expect(ids).not.toContain(draftRfpPlumbingId);
    expect(ids).not.toContain(openRfpElectricalId);
  }, 10000);

  it("supports status filter", async () => {
    const result = await httpGet(
      `/contractor/rfps?contractorId=${contractorId}&status=OPEN`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const rows = result.data.data;
    const ids = rows.map((r: any) => r.id);

    // Only OPEN plumbing should appear (CLOSED with invite has wrong status for filter)
    expect(ids).toContain(openRfpPlumbingId);
    expect(ids).not.toContain(closedRfpWithInviteId);
  }, 10000);

  it("returns total count for pagination", async () => {
    const result = await httpGet(
      `/contractor/rfps?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);
    expect(typeof result.data.total).toBe("number");
    expect(result.data.total).toBeGreaterThanOrEqual(2);
  }, 10000);

  /* ── Detail endpoint ───────────────────────────────────────── */

  it("returns detail for visible RFP (category match)", async () => {
    const result = await httpGet(
      `/contractor/rfps/${openRfpPlumbingId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const rfp = result.data.data;
    expect(rfp.id).toBe(openRfpPlumbingId);
    expect(rfp.category).toBe("plumbing");
    expect(rfp.status).toBe("OPEN");
    expect(rfp.isInvited).toBe(false);
  }, 10000);

  it("returns detail for invited RFP (regardless of category)", async () => {
    const result = await httpGet(
      `/contractor/rfps/${closedRfpWithInviteId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const rfp = result.data.data;
    expect(rfp.id).toBe(closedRfpWithInviteId);
    expect(rfp.isInvited).toBe(true);
  }, 10000);

  it("returns 404 for non-visible RFP (DRAFT, no invite)", async () => {
    const result = await httpGet(
      `/contractor/rfps/${draftRfpPlumbingId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(404);
  }, 10000);

  it("returns 404 for non-visible RFP (wrong category, no invite)", async () => {
    const result = await httpGet(
      `/contractor/rfps/${openRfpElectricalId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(404);
  }, 10000);

  /* ── Response stripping ────────────────────────────────────── */

  it("detail response contains postal code but NOT full address", async () => {
    const result = await httpGet(
      `/contractor/rfps/${openRfpPlumbingId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const rfp = result.data.data;

    // Should have postal code extracted from "Rue du Lac 15, 1003 Lausanne"
    expect(rfp.postalCode).toBe("1003");

    // Should have building name
    expect(rfp.buildingName).toBe("Résidence du Lac");

    // Should NOT expose full address, buildingId, unitId, requestId, orgId
    expect(rfp).not.toHaveProperty("address");
    expect(rfp).not.toHaveProperty("buildingId");
    expect(rfp).not.toHaveProperty("unitId");
    expect(rfp).not.toHaveProperty("requestId");
    expect(rfp).not.toHaveProperty("orgId");
    expect(rfp).not.toHaveProperty("awardedContractorId");
  }, 10000);

  it("detail response contains contractor-safe request summary", async () => {
    const result = await httpGet(
      `/contractor/rfps/${openRfpPlumbingId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const req = result.data.data.request;
    expect(req).toBeDefined();
    expect(req.description).toBe("Kitchen sink leaking badly");
    expect(req.category).toBe("plumbing");
    expect(typeof req.requestNumber).toBe("number");

    // Should NOT have tenant identity
    expect(req).not.toHaveProperty("tenantId");
    expect(req).not.toHaveProperty("tenant");
    expect(req).not.toHaveProperty("tenantName");
  }, 10000);

  /* ── Cross-org isolation ───────────────────────────────────── */

  it("cross-org contractor gets 404 (contractor not in org)", async () => {
    const result = await httpGet(
      `/contractor/rfps?contractorId=${contractorId}`,
      otherOrgContractorToken,
    );
    // Contractor ID belongs to ORG_ID but token is for crfp-other-org → 404
    expect(result.status).toBe(404);
  }, 10000);

  /* ── Quote Submission ──────────────────────────────────────── */

  const validQuoteBody = {
    amountCents: 150000,
    currency: "CHF",
    vatIncluded: true,
    workPlan: "Replace kitchen sink pipes and fittings. Step 1: disconnect, Step 2: replace, Step 3: test.",
    estimatedDurationDays: 3,
    notes: "Materials included in price.",
    assumptions: "Access to main water valve available.",
  };

  it("returns 401 for quote submission without token", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
    );
    expect(result.status).toBe(401);
  }, 10000);

  it("returns 403 for MANAGER role submitting a quote", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
      managerToken,
    );
    expect(result.status).toBe(403);
  }, 10000);

  it("returns 400 when contractorId is missing", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes`,
      validQuoteBody,
      contractorToken,
    );
    expect(result.status).toBe(400);
  }, 10000);

  it("returns 400 when workPlan is missing", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      { amountCents: 100000, currency: "CHF", vatIncluded: true },
      contractorToken,
    );
    expect(result.status).toBe(400);
  }, 10000);

  it("returns 400 when amountCents is zero", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      { ...validQuoteBody, amountCents: 0 },
      contractorToken,
    );
    expect(result.status).toBe(400);
  }, 10000);

  it("successfully submits a quote for a visible OPEN RFP", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
      contractorToken,
    );
    expect(result.status).toBe(201);

    const quote = result.data.data;
    expect(quote).toBeDefined();
    expect(quote.rfpId).toBe(openRfpPlumbingId);
    expect(quote.contractorId).toBe(contractorId);
    expect(quote.amountCents).toBe(150000);
    expect(quote.currency).toBe("CHF");
    expect(quote.vatIncluded).toBe(true);
    expect(quote.workPlan).toContain("Replace kitchen sink");
    expect(quote.estimatedDurationDays).toBe(3);
    expect(quote.notes).toBe("Materials included in price.");
    expect(quote.assumptions).toBe("Access to main water valve available.");
    expect(quote.submittedAt).toBeDefined();
  }, 10000);

  it("rejects duplicate quote (one per contractor per RFP)", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
      contractorToken,
    );
    expect(result.status).toBe(409);
    expect(result.data.error?.code || result.data.code).toBe("DUPLICATE_QUOTE");
  }, 10000);

  it("contractor RFP detail now includes myQuote", async () => {
    const result = await httpGet(
      `/contractor/rfps/${openRfpPlumbingId}?contractorId=${contractorId}`,
      contractorToken,
    );
    expect(result.status).toBe(200);

    const rfp = result.data.data;
    expect(rfp.myQuote).toBeDefined();
    expect(rfp.myQuote.amountCents).toBe(150000);
    expect(rfp.myQuote.workPlan).toContain("Replace kitchen sink");
    expect(rfp.quoteCount).toBeGreaterThanOrEqual(1);
  }, 10000);

  it("rejects quote for DRAFT RFP (not OPEN)", async () => {
    const result = await httpPost(
      `/contractor/rfps/${draftRfpPlumbingId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
      contractorToken,
    );
    // DRAFT RFP → NOT_FOUND (contractor can't even see it) or RFP_NOT_OPEN
    expect([404, 409]).toContain(result.status);
  }, 10000);

  it("rejects quote for non-visible RFP (wrong category, no invite)", async () => {
    const result = await httpPost(
      `/contractor/rfps/${openRfpElectricalId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
      contractorToken,
    );
    // NOT_VISIBLE → 403
    expect(result.status).toBe(403);
  }, 10000);

  it("rejects quote for CLOSED RFP even with invite", async () => {
    const result = await httpPost(
      `/contractor/rfps/${closedRfpWithInviteId}/quotes?contractorId=${contractorId}`,
      validQuoteBody,
      contractorToken,
    );
    // CLOSED → RFP_NOT_OPEN (409)
    expect(result.status).toBe(409);
  }, 10000);

  /* ── Award Quote ───────────────────────────────────────────── */

  describe("POST /rfps/:id/award", () => {
    it("returns 403 for CONTRACTOR role", async () => {
      const result = await httpPost(
        `/rfps/${awardRfpId}/award`,
        { quoteId: awardQuote1Id },
        contractorToken,
      );
      expect(result.status).toBe(403);
    }, 10000);

    it("returns 400 without quoteId", async () => {
      const result = await httpPost(
        `/rfps/${awardRfpId}/award`,
        {},
        managerToken,
      );
      expect(result.status).toBe(400);
    }, 10000);

    it("returns 404 for non-existent RFP", async () => {
      const result = await httpPost(
        `/rfps/00000000-0000-0000-0000-000000000000/award`,
        { quoteId: awardQuote1Id },
        managerToken,
      );
      expect(result.status).toBe(404);
    }, 10000);

    it("returns 404 for non-existent quote", async () => {
      const result = await httpPost(
        `/rfps/${awardRfpId}/award`,
        { quoteId: "00000000-0000-0000-0000-000000000000" },
        managerToken,
      );
      expect(result.status).toBe(404);
    }, 10000);

    it("MANAGER direct award below threshold: quote AWARDED, loser REJECTED", async () => {
      const result = await httpPost(
        `/rfps/${awardRfpId}/award`,
        { quoteId: awardQuote1Id },
        managerToken,
      );
      expect(result.status).toBe(200);

      const data = result.data.data;
      expect(data.rfpId).toBe(awardRfpId);
      expect(data.quoteId).toBe(awardQuote1Id);
      expect(data.status).toBe("AWARDED");
      expect(data.ownerApprovalRequired).toBe(false);
      expect(data.awardedContractorId).toBe(contractorId);

      // Verify quote statuses via DB
      const winnerQuote = await prisma.rfpQuote.findUnique({ where: { id: awardQuote1Id } });
      expect(winnerQuote?.status).toBe("AWARDED");

      const loserQuote = await prisma.rfpQuote.findUnique({ where: { id: awardQuote2Id } });
      expect(loserQuote?.status).toBe("REJECTED");

      // Verify RFP status
      const rfp = await prisma.rfp.findUnique({ where: { id: awardRfpId } });
      expect(rfp?.status).toBe("AWARDED");
      expect(rfp?.awardedContractorId).toBe(contractorId);
      expect(rfp?.awardedQuoteId).toBe(awardQuote1Id);
    }, 15000);

    it("returns 409 when trying to award already-awarded RFP", async () => {
      const result = await httpPost(
        `/rfps/${awardRfpId}/award`,
        { quoteId: awardQuote2Id },
        managerToken,
      );
      expect(result.status).toBe(409);
    }, 10000);

    it("MANAGER routes to PENDING_OWNER_APPROVAL when above threshold", async () => {
      const result = await httpPost(
        `/rfps/${ownerApprovalRfpId}/award`,
        { quoteId: ownerApprovalQuoteId },
        managerToken,
      );
      expect(result.status).toBe(200);

      const data = result.data.data;
      expect(data.rfpId).toBe(ownerApprovalRfpId);
      expect(data.status).toBe("PENDING_OWNER_APPROVAL");
      expect(data.ownerApprovalRequired).toBe(true);
      // awardedContractorId is set even for PENDING — it records the manager's selection for the owner
      expect(data.awardedContractorId).toBe(contractorId);

      // Verify RFP status in DB
      const rfp = await prisma.rfp.findUnique({ where: { id: ownerApprovalRfpId } });
      expect(rfp?.status).toBe("PENDING_OWNER_APPROVAL");
    }, 15000);

    it("MANAGER cannot complete award on PENDING_OWNER_APPROVAL RFP", async () => {
      const result = await httpPost(
        `/rfps/${ownerApprovalRfpId}/award`,
        { quoteId: ownerApprovalQuoteId },
        managerToken,
      );
      expect(result.status).toBe(403);
    }, 10000);

    it("OWNER completes award on PENDING_OWNER_APPROVAL RFP", async () => {
      const result = await httpPost(
        `/rfps/${ownerApprovalRfpId}/award`,
        { quoteId: ownerApprovalQuoteId },
        ownerToken,
      );
      expect(result.status).toBe(200);

      const data = result.data.data;
      expect(data.rfpId).toBe(ownerApprovalRfpId);
      expect(data.status).toBe("AWARDED");
      expect(data.ownerApprovalRequired).toBe(false);
      expect(data.awardedContractorId).toBe(contractorId);

      // Verify final state
      const rfp = await prisma.rfp.findUnique({ where: { id: ownerApprovalRfpId } });
      expect(rfp?.status).toBe("AWARDED");
      expect(rfp?.awardedQuoteId).toBe(ownerApprovalQuoteId);
    }, 15000);
  });

  /* ── A-2 Regression: Manager DTO shape after award ───────────── */

  describe("A-2 regression: Manager RFP DTO has typed awardedQuoteId + quote.status", () => {
    it("GET /rfps/:id returns awardedQuoteId as string (not null from as-any fallback)", async () => {
      const result = await httpGet(`/rfps/${awardRfpId}`, managerToken);
      expect(result.status).toBe(200);

      const rfp = result.data.data;
      expect(rfp.awardedQuoteId).toBe(awardQuote1Id);
      expect(typeof rfp.awardedQuoteId).toBe("string");
      expect(rfp.awardedContractorId).toBe(contractorId);
      expect(rfp.status).toBe("AWARDED");
    }, 10000);

    it("GET /rfps/:id returns quotes with typed status field (not as-any fallback)", async () => {
      const result = await httpGet(`/rfps/${awardRfpId}`, managerToken);
      expect(result.status).toBe(200);

      const rfp = result.data.data;
      expect(Array.isArray(rfp.quotes)).toBe(true);
      expect(rfp.quotes.length).toBeGreaterThanOrEqual(2);

      // Every quote should have a valid RfpQuoteStatus string
      const validStatuses = ["SUBMITTED", "AWARDED", "REJECTED"];
      for (const q of rfp.quotes) {
        expect(validStatuses).toContain(q.status);
        expect(typeof q.status).toBe("string");
      }

      // Winning quote = AWARDED, loser = REJECTED
      const winner = rfp.quotes.find((q: any) => q.id === awardQuote1Id);
      const loser = rfp.quotes.find((q: any) => q.id === awardQuote2Id);
      expect(winner?.status).toBe("AWARDED");
      expect(loser?.status).toBe("REJECTED");
    }, 10000);

    it("GET /rfps list includes awardedQuoteId in DTO", async () => {
      const result = await httpGet(`/rfps?status=AWARDED`, managerToken);
      expect(result.status).toBe(200);

      const awardedRfp = result.data.data.find((r: any) => r.id === awardRfpId);
      expect(awardedRfp).toBeDefined();
      expect(awardedRfp.awardedQuoteId).toBe(awardQuote1Id);
    }, 10000);
  });

  /* ── Notification persistence (after award) ────────────────── */

  describe("Notification persistence after award", () => {
    it("creates QUOTE_AWARDED notification for winning contractor's user", async () => {
      // After the direct award test above, awardRfpId is AWARDED with awardQuote1Id winning.
      // The winning contractor (contractorId) has a matching User (crfp-contractor-user).
      const notifications = await prisma.notification.findMany({
        where: {
          orgId: ORG_ID,
          userId: "crfp-contractor-user",
          entityType: "RFP",
          entityId: awardRfpId,
          eventType: "QUOTE_AWARDED",
        },
      });
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain("CHF");
      expect(notifications[0].message).toContain("selected");
    }, 10000);

    it("creates QUOTE_REJECTED notification for losing contractor's user", async () => {
      // awardContractor2 submitted awardQuote2Id which was REJECTED.
      // Matching User: crfp-contractor2-user
      const notifications = await prisma.notification.findMany({
        where: {
          orgId: ORG_ID,
          userId: "crfp-contractor2-user",
          entityType: "RFP",
          entityId: awardRfpId,
          eventType: "QUOTE_REJECTED",
        },
      });
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain("awarded to another contractor");
    }, 10000);

    it("does NOT send QUOTE_AWARDED to other contractor users", async () => {
      // crfp-contractor2-user should NOT have a QUOTE_AWARDED notification for awardRfpId
      const notifications = await prisma.notification.findMany({
        where: {
          orgId: ORG_ID,
          userId: "crfp-contractor2-user",
          entityType: "RFP",
          entityId: awardRfpId,
          eventType: "QUOTE_AWARDED",
        },
      });
      expect(notifications.length).toBe(0);
    }, 10000);
  });

  /* ── Contractor visibility of AWARDED RFPs ─────────────────── */

  describe("Contractor visibility of awarded RFPs", () => {
    it("awarded RFP appears in contractor list (quote-based visibility)", async () => {
      // awardRfpId is now AWARDED — contractor should still see it because they have a quote on it
      const result = await httpGet(
        `/contractor/rfps?contractorId=${contractorId}`,
        contractorToken,
      );
      expect(result.status).toBe(200);

      const ids = result.data.data.map((r: any) => r.id);
      expect(ids).toContain(awardRfpId);
    }, 10000);

    it("awarded RFP detail shows myQuote.status = AWARDED for winning contractor", async () => {
      const result = await httpGet(
        `/contractor/rfps/${awardRfpId}?contractorId=${contractorId}`,
        contractorToken,
      );
      expect(result.status).toBe(200);

      const rfp = result.data.data;
      expect(rfp.status).toBe("AWARDED");
      expect(rfp.myQuote).toBeDefined();
      expect(rfp.myQuote.status).toBe("AWARDED");
    }, 10000);

    it("filtering by AWARDED status returns awarded RFPs", async () => {
      const result = await httpGet(
        `/contractor/rfps?contractorId=${contractorId}&status=AWARDED`,
        contractorToken,
      );
      expect(result.status).toBe(200);

      const ids = result.data.data.map((r: any) => r.id);
      expect(ids).toContain(awardRfpId);
    }, 10000);
  });
});
