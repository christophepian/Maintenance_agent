/**
 * Ancillary Cost Categories (Nebenkosten taxonomy) — Phase 1
 *
 * Verifies:
 * 1. seedDefaultCategories() is idempotent and seeds billable + non-billable cats
 * 2. A BILLABLE category can be attached to a lease expense item
 * 3. The legal gate rejects attaching a NON_BILLABLE category to a tenant charge
 */
import { PrismaClient } from "@prisma/client";
import { createLease, createLeaseExpenseItem } from "../services/leases";
import { seedDefaultCategories, listCategories } from "../services/ancillaryCostCategoryService";

const prisma = new PrismaClient();

describe("Ancillary Cost Categories (Phase 1)", () => {
  let orgId: string;
  let leaseId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Ancillary Cat Test Org" } });
    orgId = org.id;
    await prisma.orgConfig.create({ data: { orgId, autoApproveLimit: 200 } });
    const building = await prisma.building.create({
      data: { orgId, name: "Cat Test Building", address: "Teststrasse 1, 8000 Zürich" },
    });
    const unit = await prisma.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "1A", floor: "1", type: "RESIDENTIAL" },
    });
    const lease = await createLease(orgId, {
      unitId: unit.id,
      tenantName: "Test Tenant",
      startDate: "2026-04-01",
      netRentChf: 1500,
    });
    leaseId = lease.id;
  });

  afterAll(async () => {
    await prisma.leaseExpenseItem.deleteMany({ where: { lease: { orgId } } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.ancillaryCostCategory.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.orgConfig.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("seeds default categories idempotently", async () => {
    await seedDefaultCategories(orgId);
    const first = await listCategories(orgId);
    await seedDefaultCategories(orgId); // second call must not duplicate
    const second = await listCategories(orgId);

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
    expect(second.some((c) => c.billability === "BILLABLE")).toBe(true);
    expect(second.some((c) => c.billability === "NON_BILLABLE")).toBe(true);
    expect(second.some((c) => c.isAdminFee)).toBe(true);
  });

  it("attaches a BILLABLE category to a lease expense item", async () => {
    const cats = await listCategories(orgId);
    const billable = cats.find((c) => c.billability === "BILLABLE")!;
    const item = await createLeaseExpenseItem(orgId, leaseId, {
      description: "Heating",
      amountChf: 120,
      mode: "ACOMPTE",
      categoryId: billable.id,
    });
    expect(item.categoryId).toBe(billable.id);
  });

  it("rejects attaching a NON_BILLABLE category to a tenant charge", async () => {
    const cats = await listCategories(orgId);
    const nonBillable = cats.find((c) => c.billability === "NON_BILLABLE")!;
    await expect(
      createLeaseExpenseItem(orgId, leaseId, {
        description: "Mortgage interest",
        amountChf: 500,
        mode: "ACOMPTE",
        categoryId: nonBillable.id,
      }),
    ).rejects.toThrow(/non-billable/i);
  });
});
