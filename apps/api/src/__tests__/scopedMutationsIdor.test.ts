/**
 * Workstream A regression tests (tenant-isolation hardening).
 *
 * The mortgage / billing-period mutation repos previously took a bare id and
 * relied on a route/service pre-check for org scoping. They now enforce orgId
 * at the DB. These tests assert a cross-org mutation is a no-op (and same-org
 * still works), so the defense-in-depth can't silently regress.
 */
import { PrismaClient } from "@prisma/client";
import { updateMortgage, deleteMortgage } from "../repositories/mortgageRepository";
import { updateBillingPeriod, deleteCostEntry } from "../repositories/billingPeriodRepository";

const prisma = new PrismaClient();

describe("Scoped mutations — cross-org no-op (Workstream A)", () => {
  let orgA: string;
  let orgB: string;
  let mortgageId: string;
  let periodId: string;
  let costEntryId: string;

  beforeAll(async () => {
    orgA = (await prisma.org.create({ data: { name: "WSA Org A" } })).id;
    orgB = (await prisma.org.create({ data: { name: "WSA Org B" } })).id;
    const building = await prisma.building.create({
      data: { orgId: orgA, name: "WSA Tower", address: "1 WSA St" },
    });
    mortgageId = (await prisma.mortgage.create({
      data: {
        orgId: orgA,
        buildingId: building.id,
        lenderName: "ORIG_LENDER",
        originalPrincipalChf: 1_000_000,
        currentBalanceChf: 900_000,
        interestRatePct: 1.5,
      },
    })).id;
    periodId = (await prisma.billingPeriod.create({
      data: {
        orgId: orgA,
        buildingId: building.id,
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        endDate: new Date("2025-12-31T00:00:00.000Z"),
      },
    })).id;
    const category = await prisma.ancillaryCostCategory.create({
      data: { orgId: orgA, code: "WSA_HEATING", name: "Heating" },
    });
    costEntryId = (await prisma.costEntry.create({
      data: { billingPeriodId: periodId, categoryId: category.id, amountCents: 12345 },
    })).id;
  });

  afterAll(async () => {
    await prisma.costEntry.deleteMany({ where: { billingPeriod: { orgId: orgA } } }).catch(() => {});
    await prisma.billingPeriod.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.ancillaryCostCategory.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.mortgage.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.org.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("updateMortgage cross-org is a no-op; same-org mutates", async () => {
    const crossOrg = await updateMortgage(prisma, mortgageId, orgB, { lenderName: "HACKED" });
    expect(crossOrg).toBeNull();
    expect((await prisma.mortgage.findUnique({ where: { id: mortgageId } }))?.lenderName).toBe("ORIG_LENDER");

    const sameOrg = await updateMortgage(prisma, mortgageId, orgA, { lenderName: "NEW_LENDER" });
    expect(sameOrg?.lenderName).toBe("NEW_LENDER");
  });

  it("deleteMortgage cross-org is a no-op", async () => {
    const res = await deleteMortgage(prisma, mortgageId, orgB);
    expect(res.count).toBe(0);
    expect(await prisma.mortgage.findUnique({ where: { id: mortgageId } })).not.toBeNull();
  });

  it("updateBillingPeriod cross-org is a no-op; same-org mutates", async () => {
    const crossOrg = await updateBillingPeriod(prisma, periodId, orgB, { adminFeeRatePermille: 999 });
    expect(crossOrg).toBeNull();

    const sameOrg = await updateBillingPeriod(prisma, periodId, orgA, { adminFeeRatePermille: 50 });
    expect(sameOrg?.adminFeeRatePermille).toBe(50);
  });

  it("deleteCostEntry cross-org is a no-op", async () => {
    const res = await deleteCostEntry(prisma, costEntryId, orgB);
    expect(res.count).toBe(0);
    expect(await prisma.costEntry.findUnique({ where: { id: costEntryId } })).not.toBeNull();
  });
});
