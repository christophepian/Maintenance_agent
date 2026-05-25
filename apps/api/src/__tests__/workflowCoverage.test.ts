/**
 * Workflow Coverage Tests (TC-1)
 *
 * Covers the 6 previously untested workflows:
 *   - activateLeaseWorkflow: SIGNED → ACTIVE
 *   - terminateLeaseWorkflow: ACTIVE → TERMINATED
 *   - issueInvoiceWorkflow: DRAFT → ISSUED
 *   - unassignContractorWorkflow: ASSIGNED → APPROVED
 *   - rejectRequestWorkflow: PENDING_OWNER_APPROVAL → REJECTED, PENDING_REVIEW → REJECTED
 *   - submitRentalApplicationWorkflow: DRAFT → SUBMITTED
 *
 * Also covers new workflows added post-audit:
 *   - cashflowPlanWorkflow: DRAFT → SUBMITTED → APPROVED
 *   - analyseClaimWorkflow: produces analysis DTO for a request
 *   - processTurnWorkflow (conversationWorkflow): handles a conversation turn
 *   - evaluateRecommendationWorkflow: scores decision options
 *   - createOwnerProfileWorkflow (strategyProfileWorkflow): creates strategy profile
 *
 * Pattern: Direct DB + workflow calls, no server spawn.
 */

import {
  PrismaClient,
  LeaseStatus,
  RequestStatus,
  JobStatus,
  InvoiceStatus,
} from "@prisma/client";
import { activateLeaseWorkflow } from "../workflows/activateLeaseWorkflow";
import { terminateLeaseWorkflow } from "../workflows/terminateLeaseWorkflow";
import { issueInvoiceWorkflow } from "../workflows/issueInvoiceWorkflow";
import { unassignContractorWorkflow } from "../workflows/unassignContractorWorkflow";
import { ownerRejectWorkflow } from "../workflows/ownerRejectWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";
import { WorkflowContext } from "../workflows/context";
import { createInvoice } from "../services/invoices";

// Mock Anthropic-dependent service so processTurnWorkflow tests don't require live API keys
jest.mock("../services/conversationService", () => ({
  handleTurn: jest.fn().mockResolvedValue({
    intent: "MAINTENANCE_REQUEST",
    replyText: "I have received your request.",
    threadId: "mock-thread-id",
  }),
}));

const prisma = new PrismaClient();

// ─── Lease Workflow Tests ────────────────────────────────────

describe("activateLeaseWorkflow & terminateLeaseWorkflow", () => {
  let orgId: string;
  let buildingId: string;
  let unitId: string;
  let leaseId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    const org = await prisma.org.create({
      data: { name: `LeaseWf Test ${Date.now()}` },
    });
    orgId = org.id;

    const building = await prisma.building.create({
      data: { orgId, name: "LeaseWf Building", address: "Test St 1", canton: "ZH" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: "LWf-1A", type: "RESIDENTIAL" },
    });
    unitId = unit.id;

    // Create lease in SIGNED state (ready for activation)
    const lease = await prisma.lease.create({
      data: {
        orgId,
        unitId,
        status: LeaseStatus.SIGNED,
        startDate: new Date("2026-04-01"),
        netRentChf: 1500,
        landlordName: "Test Landlord",
        landlordAddress: "Landlord St 1",
        landlordZipCity: "8000 Zurich",
        tenantName: "Test Tenant",
      },
    });
    leaseId = lease.id;

    ctx = { orgId, prisma, actorUserId: "test-actor" };
  });

  afterAll(async () => {
    await prisma.lease.deleteMany({ where: { unitId } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("activateLeaseWorkflow: SIGNED → ACTIVE", async () => {
    const result = await activateLeaseWorkflow(ctx, {
      leaseId,
    });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(LeaseStatus.ACTIVE);
  });

  it("terminateLeaseWorkflow: ACTIVE → TERMINATED", async () => {
    // Lease should now be ACTIVE from previous test
    const result = await terminateLeaseWorkflow(ctx, {
      leaseId,
      reason: "MUTUAL",
      notice: "End of contract",
    });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(LeaseStatus.TERMINATED);
  });

  it("rejects activating a TERMINATED lease", async () => {
    // Lease is now TERMINATED — cannot activate
    await expect(
      activateLeaseWorkflow(ctx, {
        leaseId,
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects wrong org", async () => {
    // Create another lease in SIGNED state
    const lease2 = await prisma.lease.create({
      data: {
        orgId,
        unitId,
        status: LeaseStatus.SIGNED,
        startDate: new Date("2026-05-01"),
        netRentChf: 1500,
        landlordName: "Test Landlord",
        landlordAddress: "Landlord St 1",
        landlordZipCity: "8000 Zurich",
        tenantName: "Test Tenant",
      },
    });

    const wrongCtx: WorkflowContext = {
      orgId: "wrong-org-id",
      prisma,
      actorUserId: "test-actor",
    };

    await expect(
      activateLeaseWorkflow(wrongCtx, {
        leaseId: lease2.id,
      })
    ).rejects.toThrow(/not found/i);

    // Clean up
    await prisma.lease.delete({ where: { id: lease2.id } }).catch(() => {});
  });
});

// ─── Issue Invoice Workflow Tests ────────────────────────────

describe("issueInvoiceWorkflow", () => {
  let orgId: string;
  let contractorId: string;
  let requestId: string;
  let jobId: string;
  let billingEntityId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    const org = await prisma.org.create({
      data: { name: `IssueWf Test ${Date.now()}` },
    });
    orgId = org.id;

    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "IssueWf Contractor",
        phone: "+41791234500",
        email: `issuewf-${Date.now()}@test.com`,
        hourlyRate: 100,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorId = contractor.id;

    const billingEntity = await prisma.billingEntity.create({
      data: {
        orgId,
        type: "CONTRACTOR",
        contractorId,
        name: "IssueWf Billing",
        addressLine1: "Test Street 1",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
        vatNumber: "CHE-111.222.333",
        defaultVatRate: 7.7,
      },
    });
    billingEntityId = billingEntity.id;

    const request = await prisma.request.create({
      data: {
        orgId,
        description: "Issue workflow test request",
        category: "plumbing",
        estimatedCost: 200,
        status: RequestStatus.APPROVED,
        assignedContractorId: contractorId,
      },
    });
    requestId = request.id;

    const job = await prisma.job.create({
      data: {
        orgId,
        requestId,
        contractorId,
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    jobId = job.id;

    ctx = { orgId, prisma, actorUserId: "test-actor" };
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.invoiceLineItem.deleteMany({
      where: { invoice: { job: { requestId } } },
    }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { jobId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { requestId } }).catch(() => {});
    await prisma.request.delete({ where: { id: requestId } }).catch(() => {});
    await prisma.billingEntity.delete({ where: { id: billingEntityId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: contractorId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  async function createTestInvoice(): Promise<string> {
    const inv = await createInvoice({
      orgId,
      jobId,
      issuerBillingEntityId: billingEntityId,
      recipientName: "Test Recipient",
      recipientAddressLine1: "Test Street 1",
      recipientPostalCode: "8000",
      recipientCity: "Zurich",
      recipientCountry: "CH",
      lineItems: [
        { description: "Issue test", quantity: 1, unitPrice: 100, vatRate: 7.7 },
      ],
    });
    return inv.id;
  }

  it("issueInvoiceWorkflow: DRAFT → ISSUED", async () => {
    const invoiceId = await createTestInvoice();

    const result = await issueInvoiceWorkflow(ctx, { invoiceId });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(InvoiceStatus.ISSUED);
    expect(result.dto.invoiceNumber).toBeDefined();
    expect(result.dto.issueDate).toBeDefined();
  });

  it("rejects issuing already-issued invoice", async () => {
    const invoiceId = await createTestInvoice();

    // Issue once
    await issueInvoiceWorkflow(ctx, { invoiceId });

    // Try to issue again — service throws Error('INVOICE_ALREADY_ISSUED'), not InvalidTransitionError
    await expect(
      issueInvoiceWorkflow(ctx, { invoiceId })
    ).rejects.toThrow(/INVOICE_ALREADY_ISSUED/);
  });
});

// ─── Unassign Contractor Workflow Tests ──────────────────────

describe("unassignContractorWorkflow", () => {
  let orgId: string;
  let contractorId: string;
  let requestId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    const org = await prisma.org.create({
      data: { name: `UnassignWf Test ${Date.now()}` },
    });
    orgId = org.id;

    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "UnassignWf Contractor",
        phone: "+41791234501",
        email: `unassignwf-${Date.now()}@test.com`,
        hourlyRate: 80,
        serviceCategories: JSON.stringify(["electrical"]),
      },
    });
    contractorId = contractor.id;

    // Create an ASSIGNED request
    const request = await prisma.request.create({
      data: {
        orgId,
        description: "Unassign workflow test request",
        category: "electrical",
        estimatedCost: 150,
        status: RequestStatus.ASSIGNED,
        assignedContractorId: contractorId,
      },
    });
    requestId = request.id;

    ctx = { orgId, prisma, actorUserId: "test-actor" };
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { requestId } }).catch(() => {});
    await prisma.request.delete({ where: { id: requestId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: contractorId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("unassignContractorWorkflow: removes contractor assignment", async () => {
    const result = await unassignContractorWorkflow(ctx, { requestId });

    expect(result.dto).toBeDefined();
    // After unassignment, contractor should be cleared
    expect(result.dto.assignedContractor).toBeNull();
  });
});

// ─── Owner Reject Workflow Tests ─────────────────────────────

describe("ownerRejectWorkflow", () => {
  let orgId: string;
  let contractorId: string;
  let buildingId: string;
  let unitId: string;
  let tenantId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    const org = await prisma.org.create({
      data: { name: `OwnerRejectWf Test ${Date.now()}` },
    });
    orgId = org.id;

    const building = await prisma.building.create({
      data: { orgId, name: "OwnerReject Building", address: "Test St 2", canton: "BE" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: "ORj-2A", type: "RESIDENTIAL" },
    });
    unitId = unit.id;

    const tenant = await prisma.tenant.create({
      data: { orgId, phone: `+4179${Date.now() % 10000000}`, name: "OwnerReject Tenant" },
    });
    tenantId = tenant.id;

    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "OwnerRejectWf Contractor",
        phone: "+41791234502",
        email: `ownerrejectwf-${Date.now()}@test.com`,
        hourlyRate: 90,
        serviceCategories: JSON.stringify(["carpentry"]),
      },
    });
    contractorId = contractor.id;

    ctx = { orgId, prisma, actorUserId: "test-actor" };
  });

  afterAll(async () => {
    await prisma.request.deleteMany({ where: { unitId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: contractorId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("rejectRequestWorkflow: PENDING_OWNER_APPROVAL → REJECTED", async () => {
    const request = await prisma.request.create({
      data: {
        orgId,
        description: "Owner reject test request",
        category: "carpentry",
        estimatedCost: 500,
        status: RequestStatus.PENDING_OWNER_APPROVAL,
        unitId,
        tenantId,
      },
    });

    const result = await ownerRejectWorkflow(ctx, {
      requestId: request.id,
      reason: "Too expensive",
    });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(RequestStatus.REJECTED);
  });

  it("rejectRequestWorkflow: PENDING_REVIEW → REJECTED (manager reject)", async () => {
    const request = await prisma.request.create({
      data: {
        orgId,
        description: "Manager reject test",
        category: "carpentry",
        estimatedCost: 300,
        status: RequestStatus.PENDING_REVIEW,
        unitId,
        tenantId,
      },
    });

    const result = await ownerRejectWorkflow(ctx, {
      requestId: request.id,
      reason: "Not needed",
    });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(RequestStatus.REJECTED);
  });
});

// ─── CashflowPlan Workflow Tests ──────────────────────────────

describe("cashflowPlanWorkflow", () => {
  let orgId: string;
  let ctx: WorkflowContext;
  const prismaLocal = new PrismaClient();

  beforeAll(async () => {
    const org = await prismaLocal.org.create({
      data: { name: `CashflowPlan Test ${Date.now()}` },
    });
    orgId = org.id;
    ctx = { orgId, prisma: prismaLocal, actorUserId: null };
  });

  afterAll(async () => {
    await prismaLocal.cashflowPlan.deleteMany({ where: { orgId } }).catch(() => {});
    await prismaLocal.org.delete({ where: { id: orgId } }).catch(() => {});
    await prismaLocal.$disconnect();
  });

  it("createPlanWorkflow: creates a DRAFT plan", async () => {
    const { createPlanWorkflow } = await import("../workflows/cashflowPlanWorkflow");
    const result = await createPlanWorkflow(ctx, { name: "Test Plan" });
    expect(result.plan).toBeDefined();
    expect(result.plan.status).toBe("DRAFT");
    expect(result.plan.name).toBe("Test Plan");
  });

  it("submitPlanWorkflow: DRAFT → SUBMITTED", async () => {
    const { createPlanWorkflow, submitPlanWorkflow } = await import("../workflows/cashflowPlanWorkflow");
    const { plan } = await createPlanWorkflow(ctx, { name: "Submit Test Plan" });
    const result = await submitPlanWorkflow(ctx, { planId: plan.id });
    expect(result.plan.status).toBe("SUBMITTED");
  });

  it("approvePlanWorkflow: SUBMITTED → APPROVED", async () => {
    const { createPlanWorkflow, submitPlanWorkflow, approvePlanWorkflow } = await import("../workflows/cashflowPlanWorkflow");
    const { plan } = await createPlanWorkflow(ctx, { name: "Approve Test Plan" });
    await submitPlanWorkflow(ctx, { planId: plan.id });
    const result = await approvePlanWorkflow(ctx, { planId: plan.id });
    expect(result.plan.status).toBe("APPROVED");
  });

  it("submitPlanWorkflow: rejects invalid transition from APPROVED", async () => {
    const { InvalidTransitionError } = await import("../workflows/transitions");
    const { createPlanWorkflow, submitPlanWorkflow, approvePlanWorkflow } = await import("../workflows/cashflowPlanWorkflow");
    const { plan } = await createPlanWorkflow(ctx, { name: "Double Submit Test" });
    await submitPlanWorkflow(ctx, { planId: plan.id });
    await approvePlanWorkflow(ctx, { planId: plan.id });
    await expect(submitPlanWorkflow(ctx, { planId: plan.id })).rejects.toThrow(InvalidTransitionError);
  });
});

// ─── submitRentalApplicationWorkflow ─────────────────────────

describe("submitRentalApplicationWorkflow", () => {
  let orgId: string;
  let unitId: string;
  let buildingId: string;
  let ctx: WorkflowContext;
  const prismaLocal = new PrismaClient();

  beforeAll(async () => {
    const org = await prismaLocal.org.create({ data: { name: `SubmitApp Test ${Date.now()}` } });
    orgId = org.id;

    const building = await prismaLocal.building.create({
      data: { orgId, name: "SubmitApp Building", address: "Test St 1", canton: "ZH" },
    });
    buildingId = building.id;

    const unit = await prismaLocal.unit.create({
      data: { orgId, buildingId, unitNumber: "1A", monthlyRentChf: 1500, monthlyChargesChf: 100 },
    });
    unitId = unit.id;

    ctx = { orgId, prisma: prismaLocal, actorUserId: null };
  });

  afterAll(async () => {
    await prismaLocal.rentalApplication.deleteMany({ where: { orgId } }).catch(() => {});
    await prismaLocal.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prismaLocal.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prismaLocal.org.delete({ where: { id: orgId } }).catch(() => {});
    await prismaLocal.$disconnect();
  });

  it("submitRentalApplicationWorkflow: DRAFT → SUBMITTED with applicant + unit", async () => {
    const { submitRentalApplicationWorkflow } = await import("../workflows/submitRentalApplicationWorkflow");

    // Create application with a unit and applicant
    const app = await prismaLocal.rentalApplication.create({
      data: {
        orgId,
        status: "DRAFT",
        householdSize: 1,
        applicants: {
          create: [{
            role: "PRIMARY",
            firstName: "Jane",
            lastName: "Doe",
            netMonthlyIncome: 5000,
            hasDebtEnforcement: false,
          }],
        },
        applicationUnits: {
          create: [{ unitId }],
        },
      },
    });

    const result = await submitRentalApplicationWorkflow(ctx, {
      applicationId: app.id,
      signedName: "Jane Doe",
      meta: { ip: "127.0.0.1", userAgent: "test-agent" },
    });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe("SUBMITTED");
  });

  it("submitRentalApplicationWorkflow: rejects ALREADY_SUBMITTED", async () => {
    const { submitRentalApplicationWorkflow } = await import("../workflows/submitRentalApplicationWorkflow");

    const app = await prismaLocal.rentalApplication.create({
      data: {
        orgId,
        status: "SUBMITTED",
        householdSize: 1,
        applicants: { create: [{ role: "PRIMARY", firstName: "Bob", lastName: "Smith", netMonthlyIncome: 4000, hasDebtEnforcement: false }] },
        applicationUnits: { create: [{ unitId }] },
      },
    });

    await expect(
      submitRentalApplicationWorkflow(ctx, {
        applicationId: app.id,
        signedName: "Bob Smith",
        meta: { ip: "127.0.0.1", userAgent: "test-agent" },
      }),
    ).rejects.toThrow("ALREADY_SUBMITTED");
  });
});

// ─── analyseClaimWorkflow ────────────────────────────────────

describe("analyseClaimWorkflow", () => {
  const prismaLocal = new PrismaClient();
  let orgId: string;
  let requestId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    const org = await prismaLocal.org.create({ data: { name: `Claim Test ${Date.now()}` } });
    orgId = org.id;
    const building = await prismaLocal.building.create({
      data: { orgId, name: "Claim Building", address: "Rue Test 1, 1200 Genève" },
    });
    const unit = await prismaLocal.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "1A", floor: "1" },
    });
    const req = await prismaLocal.request.create({
      data: {
        orgId,
        unitId: unit.id,
        description: "Water leak in bathroom",
        category: "PLUMBING",
        status: "PENDING_REVIEW",
      },
    });
    requestId = req.id;
    ctx = { orgId, prisma: prismaLocal };
  });

  afterAll(async () => {
    await prismaLocal.request.deleteMany({ where: { id: requestId } });
    await prismaLocal.org.deleteMany({ where: { id: orgId } });
    await prismaLocal.$disconnect();
  });

  it("analyseClaimWorkflow: returns an analysis DTO for a request", async () => {
    const { analyseClaimWorkflow } = await import("../workflows/analyseClaimWorkflow");
    const result = await analyseClaimWorkflow(ctx, { requestId });
    expect(result.analysis).toBeDefined();
    expect(result.analysis.legalObligation).toBeDefined();
    expect(result.analysis.confidence).toBeGreaterThanOrEqual(0);
  });

  it("analyseClaimWorkflow: rejects a non-existent requestId", async () => {
    const { analyseClaimWorkflow } = await import("../workflows/analyseClaimWorkflow");
    await expect(analyseClaimWorkflow(ctx, { requestId: "non-existent-id" })).rejects.toThrow();
  });
});

// ─── processTurnWorkflow (conversationWorkflow) ──────────────

describe("processTurnWorkflow", () => {
  const prismaLocal = new PrismaClient();
  let orgId: string;
  let tenantId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    const org = await prismaLocal.org.create({ data: { name: `Conv Test ${Date.now()}` } });
    orgId = org.id;
    const phone = `+4179${Date.now().toString().slice(-7)}`;
    const tenant = await prismaLocal.tenant.create({
      data: { orgId, name: "Tenant Conv", phone },
    });
    tenantId = tenant.id;
    ctx = { orgId, prisma: prismaLocal };
  });

  afterAll(async () => {
    await prismaLocal.conversationThread.deleteMany({ where: { tenantId } });
    await prismaLocal.tenant.deleteMany({ where: { id: tenantId } });
    await prismaLocal.org.deleteMany({ where: { id: orgId } });
    await prismaLocal.$disconnect();
  });

  it("processTurnWorkflow: creates a conversation turn and returns a result", async () => {
    const { processTurnWorkflow } = await import("../workflows/conversationWorkflow");
    const result = await processTurnWorkflow(ctx, {
      tenantId,
      channel: "IN_APP",
      messageText: "Hello, I have a leaking tap",
    });
    expect(result).toBeDefined();
    expect(result.intent).toBeDefined();
  });
});

// ─── strategyProfileWorkflow ─────────────────────────────────

describe("strategyProfileWorkflow — createOwnerProfileWorkflow", () => {
  const prismaLocal = new PrismaClient();
  let orgId: string;
  let ownerId: string;

  beforeAll(async () => {
    const org = await prismaLocal.org.create({ data: { name: `Strat Test ${Date.now()}` } });
    orgId = org.id;
    const owner = await prismaLocal.user.create({
      data: { orgId, name: "Strategy Owner", email: `owner-strat-${Date.now()}@test.com`, role: "OWNER", passwordHash: "x" },
    });
    ownerId = owner.id;
  });

  afterAll(async () => {
    await prismaLocal.ownerStrategyProfile.deleteMany({ where: { ownerId } });
    await prismaLocal.user.deleteMany({ where: { id: ownerId } });
    await prismaLocal.org.deleteMany({ where: { id: orgId } });
    await prismaLocal.$disconnect();
  });

  it("createOwnerProfileWorkflow: creates a strategy profile for an owner", async () => {
    const { createOwnerProfileWorkflow } = await import("../workflows/strategyProfileWorkflow");
    const result = await createOwnerProfileWorkflow(
      { orgId, prisma: prismaLocal },
      {
        ownerId,
        answers: {
          mainGoal: 3,
          holdPeriod: 4,
          renovationAppetite: 3,
          cashSensitivity: 3,
          disruptionTolerance: 2,
        },
      },
    );
    expect(result.profile).toBeDefined();
    expect(result.profile.primaryArchetype).toBeDefined();
  });

  it("createOwnerProfileWorkflow: rejects missing required fields", async () => {
    const { createOwnerProfileWorkflow } = await import("../workflows/strategyProfileWorkflow");
    await expect(
      createOwnerProfileWorkflow(
        { orgId, prisma: prismaLocal },
        { ownerId, answers: {} as any },
      ),
    ).rejects.toThrow("Missing required questionnaire answers");
  });
});

// ─── evaluateRecommendationWorkflow ──────────────────────────

describe("evaluateRecommendationWorkflow", () => {
  const prismaLocal = new PrismaClient();
  let orgId: string;
  let opportunityId: string;
  let buildingProfileId: string;
  let ownerProfileId: string;

  beforeAll(async () => {
    const org = await prismaLocal.org.create({ data: { name: `Rec Test ${Date.now()}` } });
    orgId = org.id;
    const building = await prismaLocal.building.create({
      data: { orgId, name: "Rec Building", address: "Rue Rec 1" },
    });
    const unit = await prismaLocal.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "R1" },
    });
    const owner = await prismaLocal.user.create({
      data: { orgId, name: "Rec Owner", email: `owner-rec-${Date.now()}@test.com`, role: "OWNER", passwordHash: "x" },
    });
    // Create OwnerStrategyProfile with all required fields
    const ownerProfile = await prismaLocal.ownerStrategyProfile.create({
      data: {
        orgId,
        ownerId: owner.id,
        userFacingGoalLabel: "Maximize rental income",
        dimensionsJson: "{}",
        archetypeScoresJson: "{}",
        primaryArchetype: "yield_maximizer",
      },
    });
    ownerProfileId = ownerProfile.id;
    // Create BuildingStrategyProfile with all required fields
    const buildingProfile = await prismaLocal.buildingStrategyProfile.create({
      data: {
        orgId,
        buildingId: building.id,
        ownerProfileId,
        roleIntent: "stable_hold",
        effectiveDimensionsJson: "{}",
        archetypeScoresJson: "{}",
        primaryArchetype: "yield_maximizer",
      },
    });
    buildingProfileId = buildingProfile.id;
    // opportunityId = Request.id per schema
    const req = await prismaLocal.request.create({
      data: {
        orgId,
        unitId: unit.id,
        description: "Replace boiler",
        category: "PLUMBING",
        status: "PENDING_REVIEW",
      },
    });
    opportunityId = req.id;
    await prismaLocal.maintenanceDecisionOption.create({
      data: {
        orgId,
        opportunityId,
        optionType: "repair",
        title: "Repair Now",
        estimatedCost: 1000,
      },
    });
  });

  afterAll(async () => {
    await prismaLocal.recommendationResult.deleteMany({ where: { opportunityId } });
    await prismaLocal.maintenanceDecisionOption.deleteMany({ where: { opportunityId } });
    await prismaLocal.request.deleteMany({ where: { id: opportunityId } });
    await prismaLocal.buildingStrategyProfile.deleteMany({ where: { id: buildingProfileId } });
    await prismaLocal.ownerStrategyProfile.deleteMany({ where: { id: ownerProfileId } });
    await prismaLocal.$disconnect();
  });

  it("evaluateRecommendationWorkflow: scores options and returns a recommendation", async () => {
    const { evaluateRecommendationWorkflow } = await import("../workflows/recommendationWorkflow");
    const result = await evaluateRecommendationWorkflow(
      { orgId, prisma: prismaLocal },
      {
        opportunityId,
        buildingProfileId,
        primaryArchetype: "yield_maximizer",
        opportunity: {
          urgency: "MEDIUM",
          conditionState: "FAIR",
          complianceRisk: "LOW",
        },
      },
    );
    expect(result.recommendation).toBeDefined();
    expect(result.recommendation.opportunityId).toBe(opportunityId);
  });
});
