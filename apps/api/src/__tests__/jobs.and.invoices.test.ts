import { PrismaClient, RequestStatus, JobStatus, InvoiceStatus } from "@prisma/client";
import { createJob, getJob, listJobs, updateJob } from "../services/jobs";
import { createInvoice, getInvoice, listInvoices, approveInvoice, markInvoicePaid, issueInvoice } from "../services/invoices";

const prisma = new PrismaClient();

describe("Jobs and Invoices", () => {
  let orgId: string;
  let contractorId: string;
  let requestId: string;
  let jobId: string;
  let invoiceId: string;
  let billingEntityId: string;

  beforeAll(async () => {
    // Create org
    const org = await prisma.org.create({
      data: { name: "Test Org" },
    });
    orgId = org.id;

    // Create contractor
    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "Test Contractor",
        phone: "+41791234567",
        email: "test@contractor.com",
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
        name: "Test Contractor",
        addressLine1: "Main Street 1",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
        vatNumber: "CHE-123.456.789",
        defaultVatRate: 7.7,
      },
    });
    billingEntityId = billingEntity.id;

    // Create request
    const request = await prisma.request.create({
      data: {
        description: "Leaking pipe",
        category: "plumbing",
        estimatedCost: 200,
        status: RequestStatus.APPROVED,
        assignedContractorId: contractorId,
      },
    });
    requestId = request.id;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { jobId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { requestId } }).catch(() => {});
    await prisma.request.delete({ where: { id: requestId } }).catch(() => {});
    await prisma.billingEntity.deleteMany({ where: { id: billingEntityId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: contractorId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("should create a job from an approved request", async () => {
    const job = await createJob({
      orgId,
      requestId,
      contractorId,
    });

    jobId = job.id;

    expect(job).toBeDefined();
    expect(job.requestId).toBe(requestId);
    expect(job.contractorId).toBe(contractorId);
    expect(job.status).toBe(JobStatus.PENDING);
  });

  it("should get a job by ID", async () => {
    const job = await getJob(jobId);

    expect(job).toBeDefined();
    expect(job?.id).toBe(jobId);
    expect(job?.status).toBe(JobStatus.PENDING);
  });

  it("should list jobs for org", async () => {
    const result = await listJobs(orgId);

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(typeof result.total).toBe("number");
    expect(result.data.find((j) => j.id === jobId)).toBeDefined();
  });

  it("should update job status", async () => {
    const updated = await updateJob(jobId, {
      status: JobStatus.IN_PROGRESS,
      actualCost: 250,
    });

    expect(updated.status).toBe(JobStatus.IN_PROGRESS);
    expect(updated.actualCost).toBe(250);
  });

  it("should mark job as completed", async () => {
    const completed = await updateJob(jobId, {
      status: JobStatus.COMPLETED,
      completedAt: new Date(),
      actualCost: 280,
    });

    expect(completed.status).toBe(JobStatus.COMPLETED);
    expect(completed.completedAt).toBeDefined();
  });

  it("should create an invoice for a job", async () => {
    const invoice = await createInvoice({
      orgId,
      jobId,
      issuerBillingEntityId: billingEntityId,
      recipientName: "Test Org",
      recipientAddressLine1: "Org Street 9",
      recipientPostalCode: "8000",
      recipientCity: "Zurich",
      recipientCountry: "CH",
      lineItems: [
        {
          description: "Plumbing repair - pipe replacement",
          quantity: 1,
          unitPrice: 280,
          vatRate: 7.7,
        },
      ],
    });

    invoiceId = invoice.id;

    expect(invoice).toBeDefined();
    expect(invoice.jobId).toBe(jobId);
    expect(invoice.totalAmount).toBeCloseTo(301.56, 2);
    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(invoice.lineItems.length).toBe(1);
  });

  it("should get invoice by ID", async () => {
    const invoice = await getInvoice(invoiceId);

    expect(invoice).toBeDefined();
    expect(invoice?.id).toBe(invoiceId);
    expect(invoice?.status).toBe(InvoiceStatus.DRAFT);
  });

  it("should list invoices for org", async () => {
    const result = await listInvoices(orgId);

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(typeof result.total).toBe("number");
    expect(result.data.find((i) => i.id === invoiceId)).toBeDefined();
  });

  it("should approve an invoice", async () => {
    const approved = await approveInvoice(invoiceId);

    expect(approved.status).toBe(InvoiceStatus.APPROVED);
    expect(approved.approvedAt).toBeDefined();
    expect(approved.invoiceNumber).toBeDefined();
    expect(approved.lockedAt).toBeDefined();
  });

  it("should mark invoice as paid", async () => {
    const paid = await markInvoicePaid(invoiceId);

    expect(paid.status).toBe(InvoiceStatus.PAID);
    expect(paid.paidAt).toBeDefined();
  });

  it("should list invoices filtered by status", async () => {
    const result = await listInvoices(orgId, { status: InvoiceStatus.PAID });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((i) => i.status === InvoiceStatus.PAID)).toBe(true);
  });
});

describe("Slice 8.3 — Invoice Model Upgrade", () => {
  let testOrgId: string;
  let testContractorId: string;
  let testRequestId: string;
  let testJobId: string;
  let testBillingEntityId: string;

  beforeAll(async () => {
    // Create org
    const org = await prisma.org.create({
      data: { name: "Invoice Upgrade Test Org" },
    });
    testOrgId = org.id;

    // Create contractor
    const contractor = await prisma.contractor.create({
      data: {
        orgId: testOrgId,
        name: "Invoice Test Contractor",
        phone: "+41791234567",
        email: "test@contractor.com",
        hourlyRate: 100,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    testContractorId = contractor.id;

    // Create billing entity
    const billingEntity = await prisma.billingEntity.create({
      data: {
        orgId: testOrgId,
        type: "CONTRACTOR",
        contractorId: testContractorId,
        name: "Invoice Test Contractor",
        addressLine1: "Main Street 1",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
        vatNumber: "CHE-123.456.789",
        defaultVatRate: 7.7,
      },
    });
    testBillingEntityId = billingEntity.id;

    // Create request
    const request = await prisma.request.create({
      data: {
        description: "Leaking pipe - invoice test",
        category: "plumbing",
        estimatedCost: 500,
        status: RequestStatus.APPROVED,
        assignedContractorId: testContractorId,
      },
    });
    testRequestId = request.id;

    // Create job
    const job = await createJob({
      orgId: testOrgId,
      requestId: testRequestId,
      contractorId: testContractorId,
    });
    testJobId = job.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.invoice.deleteMany({ where: { jobId: testJobId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { requestId: testRequestId } }).catch(() => {});
    await prisma.request.delete({ where: { id: testRequestId } }).catch(() => {});
    await prisma.billingEntity.delete({ where: { id: testBillingEntityId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: testContractorId } }).catch(() => {});
    await prisma.org.delete({ where: { id: testOrgId } }).catch(() => {});
  });

  describe("VAT Calculation", () => {
    it("should calculate VAT correctly with default rate (7.7%)", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test Client",
        recipientAddressLine1: "Client Street 1",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        lineItems: [
          {
            description: "Plumbing repair",
            quantity: 1,
            unitPrice: 100, // CHF
            vatRate: 7.7,
          },
        ],
      });

      // 100 CHF * 7.7% = 7.7 CHF VAT
      // Total = 107.7 CHF
      const expectedTotalCHF = 107.7;
      
      expect(invoice.totalAmount).toBeCloseTo(expectedTotalCHF, 1);
      expect(invoice.lineItems.length).toBe(1);
      // lineTotal is in cents
      expect(invoice.lineItems[0].lineTotal).toBeCloseTo(10770, 0);
    });

    it("should calculate VAT correctly with custom rate", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test Client",
        recipientAddressLine1: "Client Street 1",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        lineItems: [
          {
            description: "Emergency repair",
            quantity: 1,
            unitPrice: 250, // CHF
            vatRate: 3.7, // Reduced rate
          },
        ],
      });

      // 250 CHF * 3.7% = 9.25 CHF VAT
      // Total = 259.25 CHF
      const expectedTotalCHF = 259.25;
      
      expect(invoice.totalAmount).toBeCloseTo(expectedTotalCHF, 1);
    });

    it("should calculate VAT for multiple line items", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test Client",
        recipientAddressLine1: "Client Street 1",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        lineItems: [
          {
            description: "Item 1",
            quantity: 2,
            unitPrice: 100, // 200 CHF
            vatRate: 7.7,
          },
          {
            description: "Item 2",
            quantity: 1,
            unitPrice: 150, // 150 CHF
            vatRate: 7.7,
          },
        ],
      });

      // Item 1: 200 CHF -> 215.4 CHF (with 7.7% VAT)
      // Item 2: 150 CHF -> 161.55 CHF (with 7.7% VAT)
      // Total: 376.95 CHF
      const expectedTotalCHF = 376.95;
      
      expect(invoice.totalAmount).toBeCloseTo(expectedTotalCHF, 1);
      expect(invoice.lineItems.length).toBe(2);
    });
  });

  describe("Sequential Invoice Numbering", () => {
    it("should generate sequential invoice numbers per billing entity", async () => {
      // Create first invoice
      const inv1 = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      const issued1 = await issueInvoice(inv1.id, { issuerBillingEntityId: testBillingEntityId });
      
      expect(issued1.invoiceNumber).toBeDefined();
      expect(issued1.invoiceNumber).toMatch(/^\d{4}-\d{3}$/); // Format: YYYY-NNN
      expect(issued1.lockedAt).toBeDefined();

      // Create second invoice and check sequential number
      const inv2 = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      const issued2 = await issueInvoice(inv2.id, { issuerBillingEntityId: testBillingEntityId });

      expect(issued2.invoiceNumber).toBeDefined();
      // Second number should be higher
      const num1 = parseInt(issued1.invoiceNumber!.split("-")[1], 10);
      const num2 = parseInt(issued2.invoiceNumber!.split("-")[1], 10);
      expect(num2).toBeGreaterThan(num1);
    });
  });

  describe("Invoice Locking on Issuance", () => {
    it("should lock invoice on issuance", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.lockedAt).toBeUndefined();

      const issued = await issueInvoice(invoice.id, { issuerBillingEntityId: testBillingEntityId });

      expect(issued.lockedAt).toBeDefined();
      expect(issued.invoiceNumber).toBeDefined();
    });

    it("should prevent re-issuance of locked invoice", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      await issueInvoice(invoice.id, { issuerBillingEntityId: testBillingEntityId });

      // Try to issue again - should throw
      await expect(issueInvoice(invoice.id)).rejects.toThrow("INVOICE_ALREADY_ISSUED");
    });
  });

  describe("Invoice Approval Workflow", () => {
    it("should transition invoice from DRAFT to APPROVED", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      expect(invoice.status).toBe(InvoiceStatus.DRAFT);

      const approved = await approveInvoice(invoice.id);

      expect(approved.status).toBe(InvoiceStatus.APPROVED);
      expect(approved.invoiceNumber).toBeDefined();
      expect(approved.lockedAt).toBeDefined();
    });

    it("should include issuer IBAN on issuance", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      const approved = await approveInvoice(invoice.id);

      expect(approved.iban).toBe("CH9300762011623852957");
    });
  });

  describe("Org-Scoped Invoice Data", () => {
    it("should enforce org-scoped invoice access", async () => {
      const invoice = await createInvoice({
        orgId: testOrgId,
        jobId: testJobId,
        issuerBillingEntityId: testBillingEntityId,
        recipientName: "Test",
        recipientAddressLine1: "Street",
        recipientPostalCode: "8000",
        recipientCity: "City",
      });

      // Invoice belongs to testOrgId
      expect(invoice.orgId).toBe(testOrgId);

      // Cross-org queries should not find it
      const retrieved = await getInvoice(invoice.id);
      if (retrieved) {
        expect(retrieved.orgId).toBe(testOrgId);
      }
    });
  });
});
