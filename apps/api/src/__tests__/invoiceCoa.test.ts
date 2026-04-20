/**
 * FIN-COA-02 — Invoice COA classification tests
 *
 * Verifies that invoices can be created/updated with expenseTypeId and
 * accountId, and that GET returns the nested expenseType/account objects.
 */
import { PrismaClient, RequestStatus, JobStatus } from "@prisma/client";
import {
  createInvoice,
  getInvoice,
  updateInvoice,
} from "../services/invoices";
import { seedSwissTaxonomy } from "../services/coaService";

const prisma = new PrismaClient();

describe("Invoice COA classification (FIN-COA-02)", () => {
  let orgId: string;
  let contractorId: string;
  let requestId: string;
  let jobId: string;
  let expenseTypeId: string;
  let accountId: string;

  beforeAll(async () => {
    // Org
    const org = await prisma.org.create({ data: { name: "COA Invoice Test Org" } });
    orgId = org.id;

    // Seed COA taxonomy
    const seedResult = await seedSwissTaxonomy(prisma, orgId);
    expect(seedResult.expenseTypes).toBeGreaterThanOrEqual(8);
    expect(seedResult.accounts).toBeGreaterThanOrEqual(4);

    // Grab an expense type and account
    const et = await prisma.expenseType.findFirst({ where: { orgId }, orderBy: { name: "asc" } });
    const acc = await prisma.account.findFirst({ where: { orgId }, orderBy: { name: "asc" } });
    expenseTypeId = et!.id;
    accountId = acc!.id;

    // Contractor → Request → Job
    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "COA Test Contractor",
        phone: "+41791234567",
        email: "coa-inv@test.com",
        hourlyRate: 80,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorId = contractor.id;

    const request = await prisma.request.create({
      data: {
        orgId,
        description: "COA test request",
        category: "plumbing",
        estimatedCost: 100,
        status: RequestStatus.APPROVED,
        assignedContractorId: contractorId,
      },
    });
    requestId = request.id;

    const job = await prisma.job.create({
      data: {
        orgId,
        requestId: request.id,
        contractorId,
        status: JobStatus.COMPLETED,
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { requestId } }).catch(() => {});
    await prisma.request.delete({ where: { id: requestId } }).catch(() => {});
    await prisma.contractor.delete({ where: { id: contractorId } }).catch(() => {});
    await prisma.expenseMapping.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.expenseType.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("creates invoice without classification — expenseType/account are null", async () => {
    const inv = await createInvoice({
      orgId,
      jobId,
      amount: 100,
      description: "No classification",
    });

    expect(inv.expenseTypeId).toBeNull();
    expect(inv.accountId).toBeNull();
    expect(inv.expenseType).toBeNull();
    expect(inv.account).toBeNull();
  });

  it("creates invoice with expenseTypeId and accountId", async () => {
    const inv = await createInvoice({
      orgId,
      jobId,
      amount: 200,
      description: "Classified invoice",
      expenseTypeId,
      accountId,
    });

    expect(inv.expenseTypeId).toBe(expenseTypeId);
    expect(inv.accountId).toBe(accountId);
    expect(inv.expenseType).toBeDefined();
    expect(inv.expenseType!.id).toBe(expenseTypeId);
    expect(inv.expenseType!.name).toBeTruthy();
    expect(inv.account).toBeDefined();
    expect(inv.account!.id).toBe(accountId);
    expect(inv.account!.name).toBeTruthy();
  });

  it("GET returns classification nested objects", async () => {
    const inv = await createInvoice({
      orgId,
      jobId,
      amount: 150,
      description: "Fetch test",
      expenseTypeId,
      accountId,
    });

    const fetched = await getInvoice(inv.id);
    expect(fetched).toBeDefined();
    expect(fetched!.expenseTypeId).toBe(expenseTypeId);
    expect(fetched!.accountId).toBe(accountId);
    expect(fetched!.expenseType).toEqual(
      expect.objectContaining({ id: expenseTypeId, name: expect.any(String) }),
    );
    expect(fetched!.account).toEqual(
      expect.objectContaining({ id: accountId, name: expect.any(String) }),
    );
  });

  it("updates invoice to add expenseTypeId — GET reflects change", async () => {
    // Create without classification
    const inv = await createInvoice({
      orgId,
      jobId,
      amount: 175,
      description: "Will classify later",
    });
    expect(inv.expenseTypeId).toBeNull();

    // Update with classification
    const updated = await updateInvoice(inv.id, {
      expenseTypeId,
      accountId,
    });

    expect(updated.expenseTypeId).toBe(expenseTypeId);
    expect(updated.accountId).toBe(accountId);
    expect(updated.expenseType).toBeDefined();
    expect(updated.account).toBeDefined();

    // Verify via GET
    const fetched = await getInvoice(inv.id);
    expect(fetched!.expenseType!.id).toBe(expenseTypeId);
    expect(fetched!.account!.id).toBe(accountId);
  });

  it("updates invoice to clear classification — sets to null", async () => {
    const inv = await createInvoice({
      orgId,
      jobId,
      amount: 125,
      description: "Will declassify",
      expenseTypeId,
      accountId,
    });
    expect(inv.expenseTypeId).toBe(expenseTypeId);

    const updated = await updateInvoice(inv.id, {
      expenseTypeId: null,
      accountId: null,
    });

    expect(updated.expenseTypeId).toBeNull();
    expect(updated.accountId).toBeNull();
    expect(updated.expenseType).toBeNull();
    expect(updated.account).toBeNull();
  });
});
