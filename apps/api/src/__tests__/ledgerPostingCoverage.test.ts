/**
 * Slice: ledger-posting-coverage
 *
 * Verifies:
 *   1. postInvoiceIssued produces correct debit/credit legs (Dr Expense, Cr Payable)
 *   2. postInvoicePaid produces correct debit/credit legs (Dr Payable, Cr Bank)
 *   3. approveInvoiceWorkflow on a DRAFT invoice posts INVOICE_ISSUED entries
 *      (covers the auto-issue path that previously skipped ledger posting)
 */
import { PrismaClient, JobStatus, RequestStatus, InvoiceStatus } from "@prisma/client";
import { postInvoiceIssued, postInvoicePaid, listLedgerEntries } from "../services/ledgerService";
import { approveInvoiceWorkflow } from "../workflows/approveInvoiceWorkflow";
import type { InvoiceDTO } from "../services/invoices";

const prisma = new PrismaClient();

describe("Ledger posting coverage", () => {
  let orgId: string;
  let buildingId: string;
  let unitId: string;
  let contractorId: string;
  let jobId: string;
  let requestId: string;
  let invoiceId: string;

  // Reusable minimal InvoiceDTO
  function makeInvoiceDTO(overrides: Partial<InvoiceDTO> = {}): InvoiceDTO {
    return {
      id: invoiceId,
      orgId,
      jobId,
      amount: 100,
      recipientName: "Test Co",
      recipientAddressLine1: "1 Test St",
      recipientPostalCode: "8000",
      recipientCity: "Zurich",
      recipientCountry: "CH",
      invoiceNumberFormat: "YYYY-NNN",
      subtotalAmount: 100,
      vatAmount: 7.7,
      totalAmount: 107.7,
      currency: "CHF",
      vatRate: 7.7,
      status: "ISSUED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lineItems: [],
      direction: "OUTGOING",
      sourceChannel: "MANUAL",
      isBackfilled: false,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Ledger Coverage Org" } });
    orgId = org.id;

    const building = await prisma.building.create({
      data: { orgId, name: "Coverage Tower", address: "2 Test St" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: "B1", isActive: true },
    });
    unitId = unit.id;

    const contractor = await prisma.contractor.create({
      data: { orgId, name: "Coverage Co", phone: "+41791112244", email: "cov@co.ch", serviceCategories: "[]" },
    });
    contractorId = contractor.id;

    // BillingEntity required by issueInvoice (auto-issue path in approveInvoice)
    await prisma.billingEntity.create({
      data: {
        orgId,
        contractorId,
        type: "CONTRACTOR",
        name: "Coverage Co Billing",
        addressLine1: "1 Test St",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
      },
    });

    const request = await prisma.request.create({
      data: {
        description: "Coverage repair",
        category: "plumbing",
        status: RequestStatus.ASSIGNED,
        unitId,
        assignedContractorId: contractorId,
      },
    });
    requestId = request.id;

    const job = await prisma.job.create({
      data: { orgId, requestId, contractorId, status: JobStatus.IN_PROGRESS },
    });
    jobId = job.id;

    // Insert invoice as ISSUED for debit/credit tests
    const inv = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Invoice" (id, "orgId", "jobId", description, "recipientName", "recipientAddressLine1",
       "recipientPostalCode", "recipientCity", "subtotalAmount", "vatAmount", "totalAmount",
       amount, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::"InvoiceStatus", NOW(), NOW())
       RETURNING id`,
      orgId, jobId, "Coverage invoice", "Coverage Co", "1 St", "8000", "Zurich",
      10000, 770, 10770, 10770, "ISSUED",
    );
    invoiceId = inv[0].id;

    // Seed accounts 4200 (expense), 2000 (payables), 1020 (bank)
    await prisma.account.createMany({
      data: [
        { orgId, name: "Aufwand", code: "4200", accountType: "EXPENSE", isActive: true },
        { orgId, name: "Kreditoren", code: "2000", accountType: "LIABILITY", isActive: true },
        { orgId, name: "Bankkonto", code: "1020", accountType: "ASSET", isActive: true },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { orgId } });
    await prisma.invoice.deleteMany({ where: { orgId } });
    await prisma.job.deleteMany({ where: { orgId } });
    await prisma.request.deleteMany({ where: { unitId } });
    await prisma.account.deleteMany({ where: { orgId } });
    await prisma.billingEntity.deleteMany({ where: { orgId } });
    await prisma.unit.deleteMany({ where: { buildingId } });
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { orgId } });
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  /* ── Test 1: postInvoiceIssued debit/credit correctness ──────── */

  it("postInvoiceIssued produces Dr Expense / Cr Payable with correct amounts", async () => {
    const dto = makeInvoiceDTO();
    const entries = await postInvoiceIssued(prisma, orgId, dto);

    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(2);

    const debitLeg  = entries!.find((e) => e.debitCents  > 0 && e.creditCents === 0);
    const creditLeg = entries!.find((e) => e.creditCents > 0 && e.debitCents  === 0);

    expect(debitLeg).toBeDefined();
    expect(creditLeg).toBeDefined();

    // totalAmount 107.7 CHF → 10770 cents
    expect(debitLeg!.debitCents).toBe(10770);
    expect(creditLeg!.creditCents).toBe(10770);

    // Debit leg → expense account (4200)
    expect(debitLeg!.accountCode).toBe("4200");
    // Credit leg → payables account (2000)
    expect(creditLeg!.accountCode).toBe("2000");

    // Both legs share the same journalId (double-entry pairing)
    expect(debitLeg!.journalId).toBe(creditLeg!.journalId);

    // Source linkage
    expect(debitLeg!.sourceType).toBe("INVOICE_ISSUED");
    expect(debitLeg!.sourceId).toBe(invoiceId);
  });

  /* ── Test 2: postInvoicePaid debit/credit correctness ─────────── */

  it("postInvoicePaid produces Dr Payable / Cr Bank with correct amounts", async () => {
    const dto = makeInvoiceDTO({ paidAt: new Date().toISOString() });
    const entries = await postInvoicePaid(prisma, orgId, dto);

    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(2);

    const debitLeg  = entries!.find((e) => e.debitCents  > 0 && e.creditCents === 0);
    const creditLeg = entries!.find((e) => e.creditCents > 0 && e.debitCents  === 0);

    expect(debitLeg).toBeDefined();
    expect(creditLeg).toBeDefined();

    expect(debitLeg!.debitCents).toBe(10770);
    expect(creditLeg!.creditCents).toBe(10770);

    // Debit leg → payables cleared (2000)
    expect(debitLeg!.accountCode).toBe("2000");
    // Credit leg → bank (1020)
    expect(creditLeg!.accountCode).toBe("1020");

    expect(debitLeg!.journalId).toBe(creditLeg!.journalId);

    expect(debitLeg!.sourceType).toBe("INVOICE_PAID");
    expect(debitLeg!.sourceId).toBe(invoiceId);
  });

  /* ── Test 3: approveInvoiceWorkflow auto-issue path posts INVOICE_ISSUED ── */

  it("approveInvoiceWorkflow on DRAFT invoice posts INVOICE_ISSUED entries", async () => {
    // Create a fresh DRAFT invoice for this test
    const draftInv = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Invoice" (id, "orgId", "jobId", description, "recipientName", "recipientAddressLine1",
       "recipientPostalCode", "recipientCity", "subtotalAmount", "vatAmount", "totalAmount",
       amount, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::"InvoiceStatus", NOW(), NOW())
       RETURNING id`,
      orgId, jobId, "Draft invoice for approval", "Coverage Co", "1 St", "8000", "Zurich",
      5000, 385, 5385, 5385, "DRAFT",
    );
    const draftInvoiceId = draftInv[0].id;

    // Run the workflow — this triggers the DRAFT → APPROVED auto-issue path
    const ctx = { orgId, prisma, actorUserId: null };
    await approveInvoiceWorkflow(ctx, { invoiceId: draftInvoiceId });

    // The postInvoiceIssued call is fire-and-forget (.catch); give the event loop a tick
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify INVOICE_ISSUED entries were posted for this invoice
    const result = await listLedgerEntries(prisma, orgId, { sourceType: "INVOICE_ISSUED" });
    const forThisInvoice = result.data.filter((e) => e.sourceId === draftInvoiceId);

    expect(forThisInvoice.length).toBe(2);

    const debitLeg  = forThisInvoice.find((e) => e.debitCents  > 0 && e.creditCents === 0);
    const creditLeg = forThisInvoice.find((e) => e.creditCents > 0 && e.debitCents  === 0);

    expect(debitLeg).toBeDefined();
    expect(creditLeg).toBeDefined();
    // 5385 cents (53.85 CHF total)
    expect(debitLeg!.debitCents).toBe(5385);
    expect(creditLeg!.creditCents).toBe(5385);
    expect(debitLeg!.accountCode).toBe("4200");
    expect(creditLeg!.accountCode).toBe("2000");
  });
});
