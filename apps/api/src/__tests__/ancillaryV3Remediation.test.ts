/**
 * Ancillary Costs v3 remediation
 *
 * Verifies:
 * 1. updateInvoice coerces empty-string unitId/buildingId/ancillaryCategoryId → null
 *    (the invoice-page save bug) instead of failing on an invalid FK.
 * 2. bridgeChargeInvoiceToCostPool books an approved CHARGE invoice into the
 *    building cost pool, auto-creating an OPEN period, and is idempotent on the
 *    source invoice (re-run updates, never duplicates).
 * 3. CONSUMPTION categories ventilate by surface area (flagged) when no meters.
 * 4. getBuildingDistribution lazily seeds a row per billable category.
 */
import { PrismaClient } from "@prisma/client";
import { createLease } from "../services/leases";
import { seedDefaultCategories, listCategories } from "../services/ancillaryCostCategoryService";
import { createInvoice, updateInvoice } from "../services/invoices";
import {
  bridgeChargeInvoiceToCostPool,
  apportionForLease,
  createPeriod,
  addCostEntry,
  getBuildingDistribution,
} from "../services/ancillaryReconciliationService";

const prisma = new PrismaClient();

let orgId: string;
let buildingId: string;
let unitAId: string;
let leaseAId: string;

beforeAll(async () => {
  const org = await prisma.org.create({ data: { name: "V3 Remediation Org" } });
  orgId = org.id;
  await prisma.orgConfig.create({ data: { orgId, autoApproveLimit: 200 } });
  await seedDefaultCategories(orgId);

  const building = await prisma.building.create({
    data: { orgId, name: "V3 Building", address: "Teststrasse 9, 8000 Zürich" },
  });
  buildingId = building.id;
  const unitA = await prisma.unit.create({
    data: { orgId, buildingId, unitNumber: "A", floor: "1", type: "RESIDENTIAL", livingAreaSqm: 60 },
  });
  unitAId = unitA.id;
  const unitB = await prisma.unit.create({
    data: { orgId, buildingId, unitNumber: "B", floor: "2", type: "RESIDENTIAL", livingAreaSqm: 40 },
  });
  const la = await createLease(orgId, { unitId: unitA.id, tenantName: "Tenant A", startDate: "2026-01-01", netRentChf: 1500 });
  const lb = await createLease(orgId, { unitId: unitB.id, tenantName: "Tenant B", startDate: "2026-01-01", netRentChf: 1200 });
  leaseAId = la.id;
  await prisma.lease.update({ where: { id: la.id }, data: { status: "ACTIVE" } });
  await prisma.lease.update({ where: { id: lb.id }, data: { status: "ACTIVE" } });
});

afterAll(async () => {
  await prisma.costEntry.deleteMany({ where: { billingPeriod: { orgId } } }).catch(() => {});
  await prisma.billingPeriod.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.buildingChargeDistribution.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.invoiceLineItem.deleteMany({ where: { invoice: { orgId } } }).catch(() => {});
  await prisma.invoice.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.ancillaryCostCategory.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.orgConfig.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("updateInvoice empty-string FK coercion (WS1)", () => {
  it("coerces unitId '' → null instead of failing the save", async () => {
    const inv = await createInvoice({ orgId, amount: 1000, vatRate: 0, direction: "INCOMING", description: "Test" });
    const updated = await updateInvoice(inv.id, {
      buildingId,
      unitId: "" as any,
      ancillaryCategoryId: "" as any,
    });
    expect(updated.buildingId).toBe(buildingId);
    expect(updated.unitId).toBeNull();
    expect(updated.ancillaryCategoryId).toBeNull();
  });
});

describe("bridgeChargeInvoiceToCostPool (WS2)", () => {
  it("books a CHARGE invoice into an auto-created OPEN period, idempotently", async () => {
    const cats = await listCategories(orgId);
    const electricity = cats.find((c) => c.code === "COMMON_ELECTRICITY")!;

    const inv = await createInvoice({
      orgId, amount: 1000, vatRate: 0, direction: "INCOMING",
      description: "Régie électricité", issueDate: new Date("2026-06-15T00:00:00.000Z"),
    });
    await updateInvoice(inv.id, { buildingId, costNature: "CHARGE", ancillaryCategoryId: electricity.id });

    await bridgeChargeInvoiceToCostPool(orgId, inv.id);

    const entries = await prisma.costEntry.findMany({ where: { sourceInvoiceId: inv.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].amountCents).toBe(100000);
    expect(entries[0].categoryId).toBe(electricity.id);

    const period = await prisma.billingPeriod.findFirst({ where: { orgId, buildingId } });
    expect(period?.status).toBe("OPEN");
    expect(period?.startDate.getUTCFullYear()).toBe(2026);

    // Re-run is idempotent: still one entry, amount refreshed.
    await updateInvoice(inv.id, { lineItems: [{ description: "Régie électricité", unitPrice: 1200, vatRate: 0 }] });
    await bridgeChargeInvoiceToCostPool(orgId, inv.id);
    const after = await prisma.costEntry.findMany({ where: { sourceInvoiceId: inv.id } });
    expect(after).toHaveLength(1);
    expect(after[0].amountCents).toBe(120000);
  });

  it("no-ops for a DIRECT invoice", async () => {
    const inv = await createInvoice({ orgId, amount: 500, vatRate: 0, direction: "INCOMING", description: "Repair" });
    await updateInvoice(inv.id, { buildingId, unitId: unitAId, costNature: "DIRECT" });
    await bridgeChargeInvoiceToCostPool(orgId, inv.id);
    const entries = await prisma.costEntry.findMany({ where: { sourceInvoiceId: inv.id } });
    expect(entries).toHaveLength(0);
  });
});

describe("CONSUMPTION → surface fallback (WS4)", () => {
  it("ventilates a CONSUMPTION category by surface area, flagged", async () => {
    const cats = await listCategories(orgId);
    const heating = cats.find((c) => c.code === "HEATING_HOTWATER")!; // defaultKey CONSUMPTION
    const period = await createPeriod(orgId, { buildingId, startDate: "2025-01-01", endDate: "2025-12-31" });
    await addCostEntry(orgId, period.id, { categoryId: heating.id, amountCents: 100000 });

    const result = await apportionForLease(orgId, period.id, leaseAId);
    const line = result.lines.find((l) => l.categoryCode === "HEATING_HOTWATER")!;
    expect(line.usedConsumptionFallback).toBe(true);
    expect(line.distributionKey).toBe("SURFACE_AREA");
    expect(line.actualShareCents).toBe(60000); // 60/100 surface share
    expect(line.requiresManual).toBe(false);
  });
});

describe("getBuildingDistribution auto-seed (WS4)", () => {
  it("seeds a persisted row for every billable category", async () => {
    const rows = await getBuildingDistribution(orgId, buildingId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.isDefault === false)).toBe(true);
    const persisted = await prisma.buildingChargeDistribution.count({ where: { orgId, buildingId } });
    expect(persisted).toBe(rows.length);
  });
});
