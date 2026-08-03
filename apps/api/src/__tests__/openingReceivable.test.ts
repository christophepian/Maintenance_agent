/**
 * WS-F: Per-tenant opening receivables.
 *
 * Verifies control-total reconciliation against the imported AR lump, aging by
 * due date, and settlement (posts Dr 1020 / Cr 1100, drops from aging).
 */
import { PrismaClient } from "@prisma/client";
import {
  createOpeningReceivable,
  getOpeningReceivableReport,
  settleOpeningReceivable,
} from "../services/openingReceivableService";

const prisma = new PrismaClient();

describe("Opening receivables (WS-F)", () => {
  let orgId: string;
  let buildingId: string;
  let item600: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "OR Org" } });
    orgId = org.id;
    const b = await prisma.building.create({ data: { orgId, name: "OR Bldg", address: "4 Rue" } });
    buildingId = b.id;
    const ar = await prisma.account.create({ data: { orgId, name: "Receivables", code: "1100", accountType: "ASSET" } });
    await prisma.account.create({ data: { orgId, name: "Bank", code: "1020", accountType: "ASSET" } });
    // Imported AR lump = 1000.00
    await prisma.ledgerEntry.create({
      data: { orgId, buildingId, accountId: ar.id, debitCents: 100000, creditCents: 0, description: "Opening AR", sourceType: "BALANCE_SHEET_IMPORT", journalId: "imp", date: new Date("2024-12-31T00:00:00Z") },
    });
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.openingReceivable.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("reconciles entered detail to the imported lump (control total)", async () => {
    const a = await createOpeningReceivable(prisma, orgId, { buildingId, tenantName: "Tenant A", amountCents: 60000, dueDate: "2024-10-01" });
    item600 = a.id;
    await createOpeningReceivable(prisma, orgId, { buildingId, tenantName: "Tenant B", amountCents: 40000, dueDate: "2099-01-01" });

    const r = await getOpeningReceivableReport(prisma, orgId, buildingId, new Date("2025-01-15T00:00:00Z"));
    expect(r.control.importLumpCents).toBe(100000);
    expect(r.control.enteredCents).toBe(100000);
    expect(r.control.varianceCents).toBe(0); // fully itemized
  });

  it("ages open items by due date", async () => {
    const r = await getOpeningReceivableReport(prisma, orgId, buildingId, new Date("2025-01-15T00:00:00Z"));
    expect(r.aging.overdue61plusCents).toBe(60000); // Tenant A, due 2024-10-01
    expect(r.aging.currentCents).toBe(40000); // Tenant B, due 2099
  });

  it("settles an item: posts Dr 1020 / Cr 1100 and drops it from aging", async () => {
    const settled = await settleOpeningReceivable(prisma, orgId, item600, "tester");
    expect(settled.status).toBe("SETTLED");

    // Ledger: bank debit + AR credit for 60000
    const bankDr = await prisma.ledgerEntry.aggregate({
      where: { orgId, buildingId, sourceType: "OPENING_AR_SETTLEMENT", account: { code: "1020" } },
      _sum: { debitCents: true },
    });
    expect(bankDr._sum.debitCents).toBe(60000);

    const r = await getOpeningReceivableReport(prisma, orgId, buildingId, new Date("2025-01-15T00:00:00Z"));
    expect(r.aging.overdue61plusCents).toBe(0); // settled item no longer aged
    expect(r.aging.currentCents).toBe(40000);
  });
});
