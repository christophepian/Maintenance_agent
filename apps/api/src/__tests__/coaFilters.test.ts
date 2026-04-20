/**
 * FIN-COA-05: Financial views expose account metadata — Integration Tests
 *
 * Verifies that:
 * 1. GET /invoices filters by expenseTypeId and accountId
 * 2. GET /leases filters by expenseTypeId (via expenseItems)
 * 3. GET /buildings/:id/financials?groupByAccount=true returns expensesByAccount
 */
import {
  PrismaClient,
  RequestStatus,
  JobStatus,
  InvoiceStatus,
  LeaseStatus,
} from "@prisma/client";
import { listInvoices } from "../services/invoices";
import { listLeases } from "../services/leases";
import { getBuildingFinancials } from "../services/financials";

const prisma = new PrismaClient();

describe("FIN-COA-05: Financial views expose account metadata", () => {
  let orgId: string;
  let buildingId: string;
  let unitId: string;
  let contractorId: string;
  let expenseTypeAId: string;
  let expenseTypeBId: string;
  let accountAId: string;
  let accountBId: string;
  let invoiceAId: string;
  let invoiceBId: string;
  let invoiceNoAccountId: string;
  let leaseId: string;

  beforeAll(async () => {
    // 1. Org
    const org = await prisma.org.create({ data: { name: `COA-Filter Test ${Date.now()}` } });
    orgId = org.id;

    // 2. Building + Unit
    const building = await prisma.building.create({
      data: { orgId, name: "COA Filter Tower", address: "1 Filter St" },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: "COA-1A", isActive: true },
    });
    unitId = unit.id;

    // 3. Contractor
    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "COA Contractor",
        phone: "+41791110099",
        email: "coa-contractor@test.ch",
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorId = contractor.id;

    // 4. Expense Types
    const etA = await prisma.expenseType.create({
      data: { orgId, name: "Heating", code: "HEAT-T", isActive: true },
    });
    expenseTypeAId = etA.id;

    const etB = await prisma.expenseType.create({
      data: { orgId, name: "Water", code: "WATER-T", isActive: true },
    });
    expenseTypeBId = etB.id;

    // 5. Accounts
    const accA = await prisma.account.create({
      data: { orgId, name: "Building Expenses", code: "4000-T", accountType: "EXPENSE", isActive: true },
    });
    accountAId = accA.id;

    const accB = await prisma.account.create({
      data: { orgId, name: "Utilities Account", code: "4100-T", accountType: "EXPENSE", isActive: true },
    });
    accountBId = accB.id;

    // 6. Request → Job → 3 Invoices (different account/expenseType combos)
    const request = await prisma.request.create({
      data: {
        orgId,
        description: "COA filter test request",
        category: "plumbing",
        status: RequestStatus.COMPLETED,
        assignedContractorId: contractorId,
        unitId,
      },
    });

    const job = await prisma.job.create({
      data: { orgId, requestId: request.id, contractorId, status: JobStatus.INVOICED },
    });

    // Invoice A: accountA + expenseTypeA
    const invA = await prisma.invoice.create({
      data: {
        orgId,
        jobId: job.id,
        description: "Invoice A - heating",
        recipientName: "Test Org",
        recipientAddressLine1: "1 Filter St",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        subtotalAmount: 10000,
        vatAmount: 770,
        totalAmount: 10770,
        amount: 10770,
        status: InvoiceStatus.PAID,
        paidAt: new Date("2025-03-15T00:00:00.000Z"),
        expenseTypeId: expenseTypeAId,
        accountId: accountAId,
      },
    });
    invoiceAId = invA.id;

    // Invoice B: accountB + expenseTypeB
    const invB = await prisma.invoice.create({
      data: {
        orgId,
        jobId: job.id,
        description: "Invoice B - water",
        recipientName: "Test Org",
        recipientAddressLine1: "1 Filter St",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        subtotalAmount: 5000,
        vatAmount: 385,
        totalAmount: 5385,
        amount: 5385,
        status: InvoiceStatus.PAID,
        paidAt: new Date("2025-03-20T00:00:00.000Z"),
        expenseTypeId: expenseTypeBId,
        accountId: accountBId,
      },
    });
    invoiceBId = invB.id;

    // Invoice C: no account/expenseType
    const invC = await prisma.invoice.create({
      data: {
        orgId,
        jobId: job.id,
        description: "Invoice C - unclassified",
        recipientName: "Test Org",
        recipientAddressLine1: "1 Filter St",
        recipientPostalCode: "8000",
        recipientCity: "Zurich",
        subtotalAmount: 2000,
        vatAmount: 154,
        totalAmount: 2154,
        amount: 2154,
        status: InvoiceStatus.PAID,
        paidAt: new Date("2025-03-25T00:00:00.000Z"),
      },
    });
    invoiceNoAccountId = invC.id;

    // 6b. LedgerEntry rows (mimics postInvoiceIssued for groupByAccount tests)
    const journalA = `journal-coa-a-${Date.now()}`;
    const journalB = `journal-coa-b-${Date.now()}`;
    await prisma.ledgerEntry.createMany({
      data: [
        {
          orgId,
          buildingId,
          accountId: accountAId,
          sourceType: "INVOICE_ISSUED",
          sourceId: invoiceAId,
          date: new Date("2025-03-15T00:00:00.000Z"),
          debitCents: 10770,
          creditCents: 0,
          description: "Invoice A - heating",
          journalId: journalA,
        },
        {
          orgId,
          buildingId,
          accountId: accountBId,
          sourceType: "INVOICE_ISSUED",
          sourceId: invoiceBId,
          date: new Date("2025-03-20T00:00:00.000Z"),
          debitCents: 5385,
          creditCents: 0,
          description: "Invoice B - water",
          journalId: journalB,
        },
      ],
    });

    // 7. Lease with expense items referencing different expense types
    const lease = await prisma.lease.create({
      data: {
        orgId,
        unitId,
        status: LeaseStatus.ACTIVE,
        landlordName: "Landlord AG",
        landlordAddress: "2 Filter Lane",
        landlordZipCity: "8001 Zurich",
        tenantName: "COA Tenant",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        endDate: new Date("2025-12-31T00:00:00.000Z"),
        netRentChf: 2000,
        chargesTotalChf: 300,
        objectType: "APPARTEMENT",
      },
    });
    leaseId = lease.id;

    // Add expense items to the lease
    await prisma.leaseExpenseItem.createMany({
      data: [
        {
          leaseId: lease.id,
          expenseTypeId: expenseTypeAId,
          description: "Heating acompte",
          mode: "ACOMPTE",
          amountChf: 150,
        },
        {
          leaseId: lease.id,
          expenseTypeId: expenseTypeBId,
          description: "Water forfait",
          mode: "FORFAIT",
          amountChf: 50,
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up in reverse FK order
    await prisma.buildingFinancialSnapshot.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.leaseExpenseItem.deleteMany({ where: { lease: { orgId } } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.request.deleteMany({ where: { unitId } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { buildingId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.expenseMapping.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.expenseType.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════
  // Invoice filters: expenseTypeId + accountId
  // ═══════════════════════════════════════════════════════════

  describe("listInvoices — COA filters", () => {
    it("returns all invoices when no COA filter is set", async () => {
      const result = await listInvoices(orgId);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });

    it("filters by accountId = A → returns only invoice A", async () => {
      const result = await listInvoices(orgId, { accountId: accountAId });
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(invoiceAId);
    });

    it("filters by accountId = B → returns only invoice B", async () => {
      const result = await listInvoices(orgId, { accountId: accountBId });
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(invoiceBId);
    });

    it("filters by expenseTypeId = A → returns only invoice A", async () => {
      const result = await listInvoices(orgId, { expenseTypeId: expenseTypeAId });
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(invoiceAId);
    });

    it("filters by expenseTypeId = B → returns only invoice B", async () => {
      const result = await listInvoices(orgId, { expenseTypeId: expenseTypeBId });
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(invoiceBId);
    });

    it("filters by both accountId and expenseTypeId — intersection", async () => {
      const result = await listInvoices(orgId, {
        accountId: accountAId,
        expenseTypeId: expenseTypeAId,
      });
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(invoiceAId);
    });

    it("returns empty when accountId and expenseTypeId mismatch", async () => {
      const result = await listInvoices(orgId, {
        accountId: accountAId,
        expenseTypeId: expenseTypeBId,
      });
      expect(result.total).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Lease filters: expenseTypeId (via expenseItems)
  // ═══════════════════════════════════════════════════════════

  describe("listLeases — expenseTypeId filter", () => {
    it("returns the lease when filtered by expenseTypeId A", async () => {
      const result = await listLeases(orgId, {
        expenseTypeId: expenseTypeAId,
      });
      expect(result.total).toBeGreaterThanOrEqual(1);
      const ids = result.data.map((l: any) => l.id);
      expect(ids).toContain(leaseId);
    });

    it("returns the lease when filtered by expenseTypeId B", async () => {
      const result = await listLeases(orgId, {
        expenseTypeId: expenseTypeBId,
      });
      expect(result.total).toBeGreaterThanOrEqual(1);
      const ids = result.data.map((l: any) => l.id);
      expect(ids).toContain(leaseId);
    });

    it("returns nothing for a non-existent expenseTypeId", async () => {
      const result = await listLeases(orgId, {
        expenseTypeId: "00000000-0000-0000-0000-000000000000",
      });
      // Our lease should NOT be in the result
      const ids = result.data.map((l: any) => l.id);
      expect(ids).not.toContain(leaseId);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Building financials: groupByAccount
  // ═══════════════════════════════════════════════════════════

  describe("getBuildingFinancials — groupByAccount", () => {
    it("does NOT include expensesByAccount when groupByAccount is false", async () => {
      const result = await getBuildingFinancials(orgId, buildingId, {
        from: "2025-03-01",
        to: "2025-04-01",
      });
      expect(result.expensesByAccount).toBeUndefined();
    });

    it("returns expensesByAccount with 2 entries when groupByAccount=true", async () => {
      const result = await getBuildingFinancials(orgId, buildingId, {
        from: "2025-03-01",
        to: "2025-04-01",
        groupByAccount: true,
      });
      expect(result.expensesByAccount).toBeDefined();
      expect(Array.isArray(result.expensesByAccount)).toBe(true);
      expect(result.expensesByAccount!.length).toBe(2);

      // Should include both accounts
      const accountIds = result.expensesByAccount!.map((a) => a.accountId);
      expect(accountIds).toContain(accountAId);
      expect(accountIds).toContain(accountBId);

      // Verify amounts
      const entryA = result.expensesByAccount!.find((a) => a.accountId === accountAId);
      expect(entryA).toBeDefined();
      expect(entryA!.accountName).toBe("Building Expenses");
      expect(entryA!.accountCode).toBe("4000-T");
      expect(entryA!.totalCents).toBe(10770); // invoice A total

      const entryB = result.expensesByAccount!.find((a) => a.accountId === accountBId);
      expect(entryB).toBeDefined();
      expect(entryB!.accountName).toBe("Utilities Account");
      expect(entryB!.accountCode).toBe("4100-T");
      expect(entryB!.totalCents).toBe(5385); // invoice B total
    });

    it("sorts expensesByAccount by totalCents descending", async () => {
      const result = await getBuildingFinancials(orgId, buildingId, {
        from: "2025-03-01",
        to: "2025-04-01",
        groupByAccount: true,
      });
      expect(result.expensesByAccount).toBeDefined();
      const totals = result.expensesByAccount!.map((a) => a.totalCents);
      // First entry should have higher totalCents
      expect(totals[0]).toBeGreaterThanOrEqual(totals[1]);
    });
  });
});
