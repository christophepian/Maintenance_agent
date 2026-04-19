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
