/**
 * Slice: ledger-unit-attribution
 *
 * Verifies that postInvoiceIssued / postInvoicePaid automatically resolve
 * and store unitId + buildingId on LedgerEntry rows.
 */
import { PrismaClient, JobStatus, RequestStatus } from "@prisma/client";
import { postInvoiceIssued, postInvoicePaid, listLedgerEntries } from "../services/ledgerService";
import type { InvoiceDTO } from "../services/invoices";

const prisma = new PrismaClient();

describe("Ledger unit attribution", () => {
  let orgId: string;
  let buildingId: string;
  let unitId: string;
  let contractorId: string;
  let jobId: string;
  let requestId: string;
  let invoiceId: string;

  // Minimal stub that satisfies InvoiceDTO for posting
  function makeInvoiceDTO(overrides: Partial<InvoiceDTO> = {}): InvoiceDTO {
    return {
      id: invoiceId,
      orgId,
      jobId,
      amount: 100,
      recipientName: "Test",
      recipientAddressLine1: "1 St",
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
      ...overrides,
    };
  }

  beforeAll(async () => {
    // Seed org, building, unit, contractor, request, job
    const org = await prisma.org.create({ data: { name: "Ledger Attribution Org" } });
    orgId = org.id;

    const building = await prisma.building.create({
      data: { orgId, name: "Attribution Tower", address: "1 Test St" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: "A1", isActive: true },
    });
    unitId = unit.id;

    const contractor = await prisma.contractor.create({
      data: { orgId, name: "Test Co", phone: "+41791112233", email: "test@co.ch", serviceCategories: "[]" },
    });
    contractorId = contractor.id;

    const request = await prisma.request.create({
      data: { description: "Test repair", category: "plumbing", status: RequestStatus.ASSIGNED, unitId, assignedContractorId: contractorId },
    });
    requestId = request.id;

    const job = await prisma.job.create({
      data: { orgId, requestId, contractorId, status: JobStatus.IN_PROGRESS },
    });
    jobId = job.id;

    // Invoice (using raw insert — status ISSUED so we can test posting)
    const inv = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Invoice" (id, "orgId", "jobId", description, "recipientName", "recipientAddressLine1",
       "recipientPostalCode", "recipientCity", "subtotalAmount", "vatAmount", "totalAmount",
       amount, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::"InvoiceStatus", NOW(), NOW())
       RETURNING id`,
      orgId, jobId, "Test invoice", "Test Co", "1 St", "8000", "Zurich",
      10000, 770, 10770, 10770, "ISSUED",
    );
    invoiceId = inv[0].id;

    // Seed accounts 4200 (expense) and 2000 (payables) so posting doesn't skip
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
    await prisma.unit.deleteMany({ where: { buildingId } });
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { orgId } });
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("postInvoiceIssued resolves unitId and buildingId from job→request→unit", async () => {
    const dto = makeInvoiceDTO();
    const entries = await postInvoiceIssued(prisma, orgId, dto);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(2);
    for (const entry of entries!) {
      expect(entry.unitId).toBe(unitId);
      expect(entry.buildingId).toBe(buildingId);
    }
  });

  it("listLedgerEntries can filter by unitId", async () => {
    const result = await listLedgerEntries(prisma, orgId, { unitId });
    expect(result.total).toBeGreaterThan(0);
    for (const entry of result.data) {
      expect(entry.unitId).toBe(unitId);
    }
  });

  it("postInvoicePaid resolves unitId and buildingId", async () => {
    const dto = makeInvoiceDTO({ paidAt: new Date().toISOString() });
    const entries = await postInvoicePaid(prisma, orgId, dto);
    expect(entries).not.toBeNull();
    for (const entry of entries!) {
      expect(entry.unitId).toBe(unitId);
      expect(entry.buildingId).toBe(buildingId);
    }
  });
});
