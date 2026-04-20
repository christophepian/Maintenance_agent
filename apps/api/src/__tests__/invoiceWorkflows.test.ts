/**
 * Invoice Workflow Integration Tests
 *
 * Verifies that invoice approve/pay/dispute operations go through
 * workflows with proper transition guards and domain events.
 *
 * Tests:
 *   - approve workflow: DRAFT → APPROVED (via auto-issue)
 *   - pay workflow: APPROVED → PAID
 *   - dispute workflow: APPROVED → DISPUTED
 *   - invalid transition: PAID → APPROVED blocked
 *   - invalid transition: DRAFT → PAID blocked
 *
 * Port: none (direct DB + workflow calls, no server spawn)
 */

import { PrismaClient, InvoiceStatus, RequestStatus, JobStatus } from "@prisma/client";
import { approveInvoiceWorkflow } from "../workflows/approveInvoiceWorkflow";
import { payInvoiceWorkflow } from "../workflows/payInvoiceWorkflow";
import { disputeInvoiceWorkflow } from "../workflows/disputeInvoiceWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";
import { createInvoice } from "../services/invoices";
import { WorkflowContext } from "../workflows/context";

const prisma = new PrismaClient();

describe("Invoice Workflows — transition guards & domain events", () => {
  let orgId: string;
  let contractorId: string;
  let requestId: string;
  let jobId: string;
  let billingEntityId: string;
  let ctx: WorkflowContext;

  beforeAll(async () => {
    // Create org
    const org = await prisma.org.create({
      data: { name: `InvWf Test Org ${Date.now()}` },
    });
    orgId = org.id;

    // Create contractor
    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "InvWf Test Contractor",
        phone: "+41791234567",
        email: `invwf-${Date.now()}@test.com`,
        hourlyRate: 100,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorId = contractor.id;

    // Create billing entity (required for invoice issue/approve)
    const billingEntity = await prisma.billingEntity.create({
      data: {
        orgId,
        type: "CONTRACTOR",
        contractorId,
        name: "InvWf Test Contractor",
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

    // Create request
    const request = await prisma.request.create({
      data: {
        orgId,
        description: "Invoice workflow test request",
        category: "plumbing",
        estimatedCost: 200,
        status: RequestStatus.APPROVED,
        assignedContractorId: contractorId,
      },
    });
    requestId = request.id;

    // Create job
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

    // Workflow context
    ctx = {
      orgId,
      prisma,
      actorUserId: "test-actor",
    };
  });

  afterAll(async () => {
    // Clean up in reverse order of creation
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

  // Helper: create a fresh DRAFT invoice for a test
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
        {
          description: "Test line item",
          quantity: 1,
          unitPrice: 100,
          vatRate: 7.7,
        },
      ],
    });
    return inv.id;
  }

  it("approveInvoiceWorkflow: DRAFT → APPROVED (auto-issues first)", async () => {
    const invoiceId = await createTestInvoice();

    const result = await approveInvoiceWorkflow(ctx, { invoiceId });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(InvoiceStatus.APPROVED);
    expect(result.dto.approvedAt).toBeDefined();
    expect(result.dto.invoiceNumber).toBeDefined();
  });

  it("payInvoiceWorkflow: APPROVED → PAID", async () => {
    const invoiceId = await createTestInvoice();

    // First approve
    await approveInvoiceWorkflow(ctx, { invoiceId });

    // Then pay
    const result = await payInvoiceWorkflow(ctx, { invoiceId });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(InvoiceStatus.PAID);
    expect(result.dto.paidAt).toBeDefined();
  });

  it("disputeInvoiceWorkflow: APPROVED → DISPUTED", async () => {
    const invoiceId = await createTestInvoice();

    // First approve
    await approveInvoiceWorkflow(ctx, { invoiceId });

    // Then dispute
    const result = await disputeInvoiceWorkflow(ctx, {
      invoiceId,
      reason: "Test dispute reason",
    });

    expect(result.dto).toBeDefined();
    expect(result.dto.status).toBe(InvoiceStatus.DISPUTED);
  });

  it("rejects invalid transition: DRAFT → PAID (must approve first)", async () => {
    const invoiceId = await createTestInvoice();

    await expect(
      payInvoiceWorkflow(ctx, { invoiceId })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects invalid transition: PAID → APPROVED", async () => {
    const invoiceId = await createTestInvoice();

    // Approve then pay
    await approveInvoiceWorkflow(ctx, { invoiceId });
    await payInvoiceWorkflow(ctx, { invoiceId });

    // Try to approve again — PAID is terminal
    await expect(
      approveInvoiceWorkflow(ctx, { invoiceId })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects wrong org", async () => {
    const invoiceId = await createTestInvoice();

    const wrongOrgCtx: WorkflowContext = {
      orgId: "wrong-org-id",
      prisma,
      actorUserId: "test-actor",
    };

    await expect(
      approveInvoiceWorkflow(wrongOrgCtx, { invoiceId })
    ).rejects.toThrow(/not found/i);
  });
});
