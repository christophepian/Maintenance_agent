/**
 * Ancillary Reconciliation — Phase 2 (building cost pool + distribution keys)
 *
 * Verifies:
 * 1. distributionFactor() math for each supported key (+ CONSUMPTION → null)
 * 2. apportionForLease() splits BILLABLE building costs by the category's key,
 *    excludes NON_BILLABLE costs, and applies the capped admin fee.
 */
import { PrismaClient } from "@prisma/client";
import { createLease } from "../services/leases";
import { seedDefaultCategories, listCategories } from "../services/ancillaryCostCategoryService";
import {
  distributionFactor,
  createPeriod,
  addCostEntry,
  apportionForLease,
  updatePeriod,
  calculateFlatRate,
  getUnitReconciliationPreview,
} from "../services/ancillaryReconciliationService";
import { autoFillActualCostsFromPeriod } from "../services/chargeReconciliationService";

const prisma = new PrismaClient();

describe("distributionFactor (pure)", () => {
  const parts = [
    { leaseId: "a", unitId: "ua", unitNumber: "A", areaSqm: 60, occupantCount: 2, fixedSharePermille: 600 },
    { leaseId: "b", unitId: "ub", unitNumber: "B", areaSqm: 40, occupantCount: 1, fixedSharePermille: 400 },
  ];
  const a = parts[0];
  it("SURFACE_AREA", () => expect(distributionFactor(a, "SURFACE_AREA", parts)).toBeCloseTo(0.6));
  it("UNIT_COUNT", () => expect(distributionFactor(a, "UNIT_COUNT", parts)).toBeCloseTo(0.5));
  it("OCCUPANT_COUNT", () => expect(distributionFactor(a, "OCCUPANT_COUNT", parts)).toBeCloseTo(2 / 3));
  it("FIXED_SHARE", () => expect(distributionFactor(a, "FIXED_SHARE", parts)).toBeCloseTo(0.6));
  it("CONSUMPTION → null (deferred)", () => expect(distributionFactor(a, "CONSUMPTION", parts)).toBeNull());
  it("missing basis → null", () =>
    expect(distributionFactor({ ...a, areaSqm: null }, "SURFACE_AREA", parts)).toBeNull());
});

describe("apportionForLease (Phase 2)", () => {
  let orgId: string;
  let leaseAId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Apportion Test Org" } });
    orgId = org.id;
    await prisma.orgConfig.create({ data: { orgId, autoApproveLimit: 200 } });
    await seedDefaultCategories(orgId);

    const building = await prisma.building.create({
      data: { orgId, name: "Apportion Building", address: "Teststrasse 1, 8000 Zürich" },
    });
    const unitA = await prisma.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "A", floor: "1", type: "RESIDENTIAL", livingAreaSqm: 60 },
    });
    const unitB = await prisma.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "B", floor: "2", type: "RESIDENTIAL", livingAreaSqm: 40 },
    });
    const la = await createLease(orgId, { unitId: unitA.id, tenantName: "Tenant A", startDate: "2026-01-01", netRentChf: 1500 });
    const lb = await createLease(orgId, { unitId: unitB.id, tenantName: "Tenant B", startDate: "2026-01-01", netRentChf: 1200 });
    leaseAId = la.id;
    // Activate both so they count as participants; give A 2 occupants.
    await prisma.lease.update({ where: { id: la.id }, data: { status: "ACTIVE", occupantCount: 2 } });
    await prisma.lease.update({ where: { id: lb.id }, data: { status: "ACTIVE", occupantCount: 1 } });

    const cats = await listCategories(orgId);
    const electricity = cats.find((c) => c.code === "COMMON_ELECTRICITY")!; // SURFACE_AREA
    const elevator = cats.find((c) => c.code === "ELEVATOR")!; // UNIT_COUNT
    const mortgage = cats.find((c) => c.code === "MORTGAGE_INTEREST")!; // NON_BILLABLE

    const period = await createPeriod(orgId, {
      buildingId: building.id,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      adminFeeRatePermille: 30,
    });
    await addCostEntry(orgId, period.id, { categoryId: electricity.id, amountCents: 100000 }); // CHF 1000
    await addCostEntry(orgId, period.id, { categoryId: elevator.id, amountCents: 60000 }); // CHF 600
    await addCostEntry(orgId, period.id, { categoryId: mortgage.id, amountCents: 500000 }); // non-billable
    (global as any).__periodId = period.id;
  });

  afterAll(async () => {
    await prisma.chargeReconciliationLine.deleteMany({ where: { reconciliation: { orgId } } }).catch(() => {});
    await prisma.chargeReconciliation.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.costEntry.deleteMany({ where: { billingPeriod: { orgId } } }).catch(() => {});
    await prisma.billingPeriod.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.ancillaryCostCategory.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.orgConfig.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("apportions billable costs by key, excludes non-billable, applies capped admin fee", async () => {
    const periodId = (global as any).__periodId as string;
    const result = await apportionForLease(orgId, periodId, leaseAId);

    const elec = result.lines.find((l) => l.categoryCode === "COMMON_ELECTRICITY")!;
    const lift = result.lines.find((l) => l.categoryCode === "ELEVATOR")!;

    // SURFACE_AREA 60/100 of 100000 = 60000
    expect(elec.actualShareCents).toBe(60000);
    // UNIT_COUNT 1/2 of 60000 = 30000
    expect(lift.actualShareCents).toBe(30000);
    // Non-billable mortgage excluded entirely
    expect(result.lines.some((l) => l.categoryCode === "MORTGAGE_INTEREST")).toBe(false);

    expect(result.billableShareCents).toBe(90000);
    // admin fee 30‰ of 90000 = 2700 (within 3% cap)
    expect(result.adminFeeCents).toBe(2700);
    expect(result.totalActualCostsCents).toBe(92700);
  });

  it("auto-fills a reconciliation's actual costs from the cost pool by category", async () => {
    const periodId = (global as any).__periodId as string;
    const cats = await listCategories(orgId);
    const elec = cats.find((c) => c.code === "COMMON_ELECTRICITY")!;
    const lift = cats.find((c) => c.code === "ELEVATOR")!;

    // Lease A (unit area 82 of 217) — reconciliation with category-tagged ACOMPTE lines
    const recon = await prisma.chargeReconciliation.create({
      data: {
        orgId, leaseId: leaseAId, fiscalYear: 2027, status: "DRAFT",
        lineItems: {
          create: [
            { description: "Électricité", chargeMode: "ACOMPTE", acomptePaidCents: 30000, categoryId: elec.id },
            { description: "Ascenseur", chargeMode: "ACOMPTE", acomptePaidCents: 20000, categoryId: lift.id },
          ],
        },
      },
    });

    const updated = await autoFillActualCostsFromPeriod(prisma, recon.id, periodId, orgId);
    const elecLine = updated.lineItems.find((l: any) => l.categoryId === elec.id)!;
    const liftLine = updated.lineItems.find((l: any) => l.categoryId === lift.id)!;

    expect(elecLine.actualCostCents).toBe(60000); // surface share 60/100 of 100000
    expect(liftLine.actualCostCents).toBe(30000); // half of 60000
    expect(updated.adminFeeCents).toBeGreaterThan(0);
    expect(updated.billingPeriodId).toBe(periodId);
  });

  it("unit reconciliation preview: advances vs apportioned actual → delta", async () => {
    const periodId = (global as any).__periodId as string;
    const lease = await prisma.lease.findUnique({ where: { id: leaseAId }, select: { unitId: true } });
    const preview = await getUnitReconciliationPreview(orgId, lease!.unitId!, periodId);
    // No charge-advance invoices for this lease → advances 0; actual = 60000 (elec) + 30000 (lift) + 2700 admin
    expect(preview.advancesPaidCents).toBe(0);
    expect(preview.actualCostsCents).toBe(92700);
    expect(preview.deltaCents).toBe(92700);
    expect(preview.isRefund).toBe(false);
  });

  it("calculateFlatRate averages prior CLOSED periods", async () => {
    const periodId = (global as any).__periodId as string;
    await updatePeriod(orgId, periodId, { status: "CLOSED" });
    const cats = await listCategories(orgId);
    const elec = cats.find((c) => c.code === "COMMON_ELECTRICITY")!;

    const fr = await calculateFlatRate(orgId, leaseAId, elec.id);
    expect(fr.basisYears).toBe(1);
    expect(fr.avgAnnualBuildingCents).toBe(100000);
    expect(fr.monthlyFlatRateCents).toBe(Math.round((100000 * (60 / 100)) / 12)); // 5000
  });
});
