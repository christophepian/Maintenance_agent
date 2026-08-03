/**
 * WS-E: Year-end closing journals.
 *
 * Verifies the close zeroes P&L into retained earnings (2900) so the balance
 * sheet reconciles (differenceCents → 0), is idempotent, and reverses cleanly.
 */
import { PrismaClient } from "@prisma/client";
import {
  closeFiscalYear,
  reopenFiscalYear,
  listFiscalCloses,
} from "../services/fiscalCloseService";
import { getBalanceSheet } from "../services/ledgerService";
import { ConflictError } from "../http/errors";

const prisma = new PrismaClient();

describe("Fiscal year-end close (WS-E)", () => {
  let orgId: string;
  let buildingId: string;
  let arId: string, revId: string, apId: string, expId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Close Test Org" } });
    orgId = org.id;
    const b = await prisma.building.create({ data: { orgId, name: "Close Bldg", address: "1 Rue" } });
    buildingId = b.id;

    const mk = (name: string, code: string, accountType: string) =>
      prisma.account.create({ data: { orgId, name, code, accountType } });
    arId = (await mk("Rent Receivables", "1100", "ASSET")).id;
    revId = (await mk("Residential Rental Income", "3200", "REVENUE")).id;
    apId = (await mk("Accounts Payable", "2000", "LIABILITY")).id;
    expId = (await mk("Maintenance & Repairs", "4200", "EXPENSE")).id;

    // Rent accrued: Dr 1100 / Cr 3200 = 1000.00; Expense: Dr 4200 / Cr 2000 = 300.00
    await prisma.ledgerEntry.createMany({
      data: [
        { orgId, buildingId, accountId: arId, debitCents: 100000, creditCents: 0, description: "Rent", sourceType: "INVOICE_ISSUED", journalId: "j-rev", date: new Date("2025-06-30T00:00:00Z") },
        { orgId, buildingId, accountId: revId, debitCents: 0, creditCents: 100000, description: "Rent", sourceType: "INVOICE_ISSUED", journalId: "j-rev", date: new Date("2025-06-30T00:00:00Z") },
        { orgId, buildingId, accountId: expId, debitCents: 30000, creditCents: 0, description: "Repair", sourceType: "INVOICE_ISSUED", journalId: "j-exp", date: new Date("2025-07-15T00:00:00Z") },
        { orgId, buildingId, accountId: apId, debitCents: 0, creditCents: 30000, description: "Repair", sourceType: "INVOICE_ISSUED", journalId: "j-exp", date: new Date("2025-07-15T00:00:00Z") },
      ],
    });
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.fiscalPeriodClose.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("balance sheet shows the unclosed result before closing", async () => {
    const bs = await getBalanceSheet(prisma, orgId, buildingId, new Date("2026-01-01T00:00:00Z"));
    // assets 1000 − liabilities 300 = 700 unclosed profit
    expect(bs.differenceCents).toBe(70000);
  });

  it("closes the year: result posts to equity and the balance sheet reconciles", async () => {
    const close = await closeFiscalYear(prisma, orgId, buildingId, 2025, "tester");
    expect(close.retainedEarningsCents).toBe(70000); // profit
    expect(close.status).toBe("CLOSED");

    const bs = await getBalanceSheet(prisma, orgId, buildingId, new Date("2026-01-01T00:00:00Z"));
    expect(Math.abs(bs.differenceCents)).toBeLessThan(2); // reconciled
    expect(bs.isBalanced).toBe(true);
    // Equity 2900 now carries the 700 result on the liabilities side
    const equity = bs.liabilities.find((l) => l.accountCode === "2900");
    expect(equity?.displayCents).toBe(70000);
  });

  it("is idempotent — re-closing a closed year throws", async () => {
    await expect(closeFiscalYear(prisma, orgId, buildingId, 2025, "tester")).rejects.toThrow(ConflictError);
  });

  it("reopens the year: reversal restores the unclosed residual", async () => {
    const reopened = await reopenFiscalYear(prisma, orgId, buildingId, 2025, "tester");
    expect(reopened.status).toBe("REVERSED");

    const bs = await getBalanceSheet(prisma, orgId, buildingId, new Date("2026-01-01T00:00:00Z"));
    expect(bs.differenceCents).toBe(70000); // back to unclosed

    const closes = await listFiscalCloses(prisma, orgId, buildingId);
    expect(closes).toHaveLength(1);
    expect(closes[0].status).toBe("REVERSED");
  });

  it("re-closes a reopened year in place", async () => {
    const reclosed = await closeFiscalYear(prisma, orgId, buildingId, 2025, "tester");
    expect(reclosed.status).toBe("CLOSED");
    const closes = await listFiscalCloses(prisma, orgId, buildingId);
    expect(closes).toHaveLength(1); // updated in place, not duplicated
  });
});
