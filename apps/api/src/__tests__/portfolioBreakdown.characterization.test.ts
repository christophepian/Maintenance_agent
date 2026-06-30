/**
 * Characterization tests for the portfolio aggregation paths in
 * services/financials.ts — written ahead of the N+1 / concurrency refactor
 * (Layer 1: parallelize getPortfolioMonthlyBreakdown).
 *
 * These do NOT hardcode expected cents (too brittle). Instead they pin the
 * structural invariants that any refactor MUST preserve:
 *
 *   A. getPortfolioSummary aggregates == sum of its per-building rows.
 *   B. getPortfolioMonthlyBreakdown[m] == an independent getPortfolioSummary
 *      computed for exactly month m. This is the contract the monthly-loop
 *      parallelization must keep true.
 *
 * Seeds TWO buildings so the per-building fan-out is genuinely exercised.
 */
import { PrismaClient, JobStatus, LeaseStatus } from "@prisma/client";
import {
  getPortfolioSummary,
  getPortfolioMonthlyBreakdown,
} from "../services/financials";

const prisma = new PrismaClient();

// Seed a building with: unit + active full-year lease + one PAID invoice whose
// expense is posted to the ledger in `expenseMonth` of 2025. Returns building id.
async function seedBuilding(
  orgId: string,
  name: string,
  expenseMonth: number, // 1-12 — month the expense ledger entry lands in
  expenseCents: number,
  netRentChf: number,
): Promise<string> {
  const building = await prisma.building.create({
    data: { orgId, name, address: `${name} St` },
  });
  const unit = await prisma.unit.create({
    data: { orgId, buildingId: building.id, unitNumber: `${name}-1`, isActive: true },
  });
  const contractor = await prisma.contractor.create({
    data: {
      orgId,
      name: `${name} Contractor`,
      phone: `+4179${Math.floor(1000000 + expenseCents % 8999999)}`,
      email: `${name.toLowerCase()}@test.ch`,
      serviceCategories: JSON.stringify(["plumbing"]),
    },
  });
  const request = await prisma.request.create({
    data: {
      orgId,
      description: `${name} repair`,
      category: "plumbing",
      status: "COMPLETED",
      assignedContractorId: contractor.id,
      unitId: unit.id,
    },
  });
  const job = await prisma.job.create({
    data: { orgId, requestId: request.id, contractorId: contractor.id, status: JobStatus.INVOICED },
  });
  const mm = String(expenseMonth).padStart(2, "0");
  const expenseDate = new Date(`2025-${mm}-15T00:00:00.000Z`);
  const invoice = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "Invoice" (id, "orgId", "jobId", description, "recipientName", "recipientAddressLine1",
     "recipientPostalCode", "recipientCity", "subtotalAmount", "vatAmount", "totalAmount",
     amount, status, "paidAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::"InvoiceStatus", $13, NOW(), NOW())
     RETURNING id`,
    orgId, job.id,
    `${name} invoice`,
    "Fin Test Org", `${name} St`, "8000", "Zurich",
    expenseCents, 0, expenseCents, expenseCents,
    "PAID",
    expenseDate,
  );
  const account = await prisma.account.create({
    data: { orgId, name: `${name} Expense`, code: `40${expenseMonth}`, accountType: "EXPENSE" },
  });
  await prisma.ledgerEntry.create({
    data: {
      orgId,
      buildingId: building.id,
      accountId: account.id,
      sourceType: "INVOICE_ISSUED",
      sourceId: invoice[0].id,
      date: expenseDate,
      debitCents: expenseCents,
      creditCents: 0,
      description: `${name} invoice`,
      journalId: `journal-${name}-${expenseMonth}`,
    },
  });
  await prisma.lease.create({
    data: {
      orgId,
      unitId: unit.id,
      status: LeaseStatus.ACTIVE,
      landlordName: "Landlord AG",
      landlordAddress: "2 Profit Lane",
      landlordZipCity: "8001 Zurich",
      tenantName: `${name} Tenant`,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-12-31T00:00:00.000Z"),
      netRentChf,
      chargesTotalChf: 200,
      objectType: "APPARTEMENT",
    },
  });
  return building.id;
}

describe("Portfolio aggregation — characterization", () => {
  let orgId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Portfolio Char Org" } });
    orgId = org.id;
    // Two buildings, expenses in different months to make the monthly
    // breakdown non-degenerate (March vs September).
    await seedBuilding(orgId, "AlphaTower", 3, 120000, 2000);
    await seedBuilding(orgId, "BetaHouse", 9, 80000, 1500);
  });

  afterAll(async () => {
    await prisma.buildingFinancialSnapshot.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.job.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.request.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("A. portfolio summary aggregates equal the sum of its per-building rows", async () => {
    const summary = await getPortfolioSummary(orgId, { from: "2025-01-01", to: "2025-12-31" });

    expect(summary.buildingCount).toBe(2);
    expect(summary.buildings).toHaveLength(2);

    const sum = (sel: (b: (typeof summary.buildings)[number]) => number) =>
      summary.buildings.reduce((s, b) => s + sel(b), 0);

    expect(summary.totalCollectedIncomeCents).toBe(sum((b) => b.collectedIncomeCents));
    expect(summary.totalExpensesCents).toBe(sum((b) => b.expensesTotalCents));
    expect(summary.totalOperatingCents).toBe(sum((b) => b.operatingTotalCents));
    expect(summary.totalCapexCents).toBe(sum((b) => b.capexTotalCents));
    expect(summary.totalNetIncomeCents).toBe(sum((b) => b.netIncomeCents));
    expect(summary.totalNetOperatingIncomeCents).toBe(sum((b) => b.netOperatingIncomeCents));
    expect(summary.totalActiveUnits).toBe(sum((b) => b.activeUnitsCount));
    expect(summary.totalReceivablesCents).toBe(sum((b) => b.receivablesCents));
    expect(summary.totalPayablesCents).toBe(sum((b) => b.payablesCents));
  });

  it("B. monthly breakdown[m] equals an independent per-month portfolio summary", async () => {
    const breakdown = await getPortfolioMonthlyBreakdown(orgId, 2025);

    // 2025 is fully in the past → all 12 months present, in order.
    expect(breakdown).toHaveLength(12);
    breakdown.forEach((row, i) => expect(row.month).toBe(i + 1));

    // The contract the parallelization must preserve: each month of the
    // breakdown must match a standalone summary for that same month.
    for (const row of breakdown) {
      const mm = String(row.month).padStart(2, "0");
      const lastDay = new Date(2025, row.month, 0).getDate();
      const summary = await getPortfolioSummary(orgId, {
        from: `2025-${mm}-01`,
        to: `2025-${mm}-${String(lastDay).padStart(2, "0")}`,
      });
      expect(row.collectedIncomeCents).toBe(summary.totalCollectedIncomeCents);
      expect(row.expensesTotalCents).toBe(summary.totalExpensesCents);
      expect(row.noiCents).toBe(summary.totalNetOperatingIncomeCents);
      expect(row.collectionRate).toBe(summary.avgCollectionRate);
    }
  });

  it("C. the two seeded expenses land in their respective months (non-degenerate)", async () => {
    const breakdown = await getPortfolioMonthlyBreakdown(orgId, 2025);
    const march = breakdown.find((r) => r.month === 3)!;
    const september = breakdown.find((r) => r.month === 9)!;
    // AlphaTower expense (120000) in March, BetaHouse (80000) in September.
    expect(march.expensesTotalCents).toBeGreaterThanOrEqual(120000);
    expect(september.expensesTotalCents).toBeGreaterThanOrEqual(80000);
  });
});
