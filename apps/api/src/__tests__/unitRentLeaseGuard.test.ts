/**
 * Unit rent/charges lease guard (services/inventory.updateUnit)
 *
 * A unit's monthlyRentChf / monthlyChargesChf are the *asking* rent. Invoices and the
 * signed lease read from Lease.netRentChf / chargesTotalChf. While a binding
 * (SIGNED/ACTIVE) lease exists we must not let the unit fields diverge, so updateUnit
 * rejects a *change* to those two fields with RENT_LOCKED_BY_LEASE. Unchanged values and
 * other-field edits still pass.
 */

import { PrismaClient, LeaseStatus } from "@prisma/client";
import { updateUnit } from "../services/inventory";

const prisma = new PrismaClient();

describe("updateUnit — rent/charges lease guard", () => {
  const orgId = "default-org";
  let buildingId: string;
  let unitId: string;
  let leaseId: string;

  beforeAll(async () => {
    await prisma.org.upsert({
      where: { id: orgId },
      create: { id: orgId, name: "Rent Guard Test Org" },
      update: {},
    });
    const building = await prisma.building.create({
      data: { orgId, name: `Rent Guard Building ${Date.now()}`, address: "Guard St 1", canton: "ZH" },
    });
    buildingId = building.id;
    const unit = await prisma.unit.create({
      data: { orgId, buildingId, unitNumber: `RG-${Date.now()}`, type: "RESIDENTIAL", monthlyRentChf: 1800, monthlyChargesChf: 200 },
    });
    unitId = unit.id;
    const lease = await prisma.lease.create({
      data: {
        orgId,
        unitId,
        status: LeaseStatus.ACTIVE,
        startDate: new Date("2026-01-01"),
        netRentChf: 1800,
        chargesTotalChf: 200,
        landlordName: "Guard Landlord",
        landlordAddress: "Landlord St 1",
        landlordZipCity: "8000 Zurich",
        tenantName: "Guard Tenant",
        tenantAddress: "Tenant St 1",
        tenantZipCity: "3000 Bern",
      },
    });
    leaseId = lease.id;
  }, 30000);

  afterAll(async () => {
    await prisma.lease.delete({ where: { id: leaseId } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("rejects changing net rent while a binding lease exists", async () => {
    await expect(updateUnit(orgId, unitId, { monthlyRentChf: 2000 })).rejects.toThrow("RENT_LOCKED_BY_LEASE");
  });

  it("rejects changing charges while a binding lease exists", async () => {
    await expect(updateUnit(orgId, unitId, { monthlyChargesChf: 300 })).rejects.toThrow("RENT_LOCKED_BY_LEASE");
  });

  it("allows editing other fields while sending unchanged rent/charges", async () => {
    const updated = await updateUnit(orgId, unitId, { floor: "3", monthlyRentChf: 1800, monthlyChargesChf: 200 });
    expect(updated?.floor).toBe("3");
  });

  it("allows changing rent once no binding lease remains", async () => {
    await prisma.lease.update({ where: { id: leaseId }, data: { status: LeaseStatus.TERMINATED } });
    const updated = await updateUnit(orgId, unitId, { monthlyRentChf: 2100 });
    expect(updated?.monthlyRentChf).toBe(2100);
  });
});
