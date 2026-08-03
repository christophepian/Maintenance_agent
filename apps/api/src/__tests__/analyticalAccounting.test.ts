/**
 * WS-C: Analytical accounting view.
 *
 * Verifies the equity bridge (opening + result − distributions = closing),
 * NAV/mortgage/LTV KPIs, and account movements.
 */
import { PrismaClient } from "@prisma/client";
import { getAnalyticalReport } from "../services/analyticalAccountingService";

const prisma = new PrismaClient();

describe("Analytical accounting (WS-C)", () => {
  let orgId: string;
  let buildingId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Anly Org" } });
    orgId = org.id;
    const b = await prisma.building.create({
      data: { orgId, name: "Anly Bldg", address: "3 Rue", marketValueChf: 1_000_000 },
    });
    buildingId = b.id;

    const mk = (name: string, code: string, accountType: string) =>
      prisma.account.create({ data: { orgId, name, code, accountType } });
    const bank = await mk("Bank", "1020", "ASSET");
    const ar = await mk("Receivables", "1100", "ASSET");
    const ap = await mk("Payables", "2000", "LIABILITY");
    const mortgage = await mk("Mortgage 1st", "2300", "LIABILITY");
    const equity = await mk("Retained Earnings", "2900", "LIABILITY");
    const rev = await mk("Rental Income", "3200", "REVENUE");
    const exp = await mk("Maintenance", "4200", "EXPENSE");

    // Opening (2024): Dr Bank 500k / Cr Mortgage 300k / Cr Equity 200k
    await prisma.ledgerEntry.createMany({
      data: [
        { orgId, buildingId, accountId: bank.id, debitCents: 50_000_000, creditCents: 0, description: "Open", sourceType: "BALANCE_SHEET_IMPORT", journalId: "o1", date: new Date("2024-06-30T00:00:00Z") },
        { orgId, buildingId, accountId: mortgage.id, debitCents: 0, creditCents: 30_000_000, description: "Open", sourceType: "BALANCE_SHEET_IMPORT", journalId: "o1", date: new Date("2024-06-30T00:00:00Z") },
        { orgId, buildingId, accountId: equity.id, debitCents: 0, creditCents: 20_000_000, description: "Open", sourceType: "BALANCE_SHEET_IMPORT", journalId: "o1", date: new Date("2024-06-30T00:00:00Z") },
        // 2025 activity: rent 1000, expense 300 → result 700
        { orgId, buildingId, accountId: ar.id, debitCents: 100_000, creditCents: 0, description: "Rent", sourceType: "INVOICE_ISSUED", journalId: "r1", date: new Date("2025-05-01T00:00:00Z") },
        { orgId, buildingId, accountId: rev.id, debitCents: 0, creditCents: 100_000, description: "Rent", sourceType: "INVOICE_ISSUED", journalId: "r1", date: new Date("2025-05-01T00:00:00Z") },
        { orgId, buildingId, accountId: exp.id, debitCents: 30_000, creditCents: 0, description: "Repair", sourceType: "INVOICE_ISSUED", journalId: "e1", date: new Date("2025-06-01T00:00:00Z") },
        { orgId, buildingId, accountId: ap.id, debitCents: 0, creditCents: 30_000, description: "Repair", sourceType: "INVOICE_ISSUED", journalId: "e1", date: new Date("2025-06-01T00:00:00Z") },
      ],
    });
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("computes the equity bridge", async () => {
    const r = await getAnalyticalReport(prisma, orgId, buildingId, 2025);
    expect(r.equityBridge.openingEquityCents).toBe(20_000_000); // 200k retained earnings
    expect(r.equityBridge.periodResultCents).toBe(70_000); // 1000 − 300
    expect(r.equityBridge.distributionsCents).toBe(0);
    expect(r.equityBridge.closingEquityCents).toBe(20_070_000);
  });

  it("computes NAV, mortgage and LTV", async () => {
    const r = await getAnalyticalReport(prisma, orgId, buildingId, 2025);
    expect(r.kpis.navCents).toBe(20_070_000);
    expect(r.kpis.mortgageCents).toBe(30_000_000);
    expect(r.kpis.propertyValueCents).toBe(100_000_000);
    expect(r.kpis.ltvPct).toBe(30); // 300k / 1M
  });

  it("returns account movements with opening + period split", async () => {
    const r = await getAnalyticalReport(prisma, orgId, buildingId, 2025);
    const ar = r.accountMovements.find((m) => m.code === "1100");
    expect(ar?.openingCents).toBe(0);
    expect(ar?.debitCents).toBe(100_000);
    expect(ar?.closingCents).toBe(100_000);
    const bank = r.accountMovements.find((m) => m.code === "1020");
    expect(bank?.openingCents).toBe(50_000_000); // carried in from 2024
  });
});
