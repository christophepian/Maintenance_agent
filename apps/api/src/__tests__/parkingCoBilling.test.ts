/**
 * Parking combined invoicing (Phase 2).
 *
 * When a parking spot's ACTIVE lease is held by the same tenant as its linked
 * flat's ACTIVE lease, the parking rent rides on the flat's invoice as an extra
 * line and the parking lease does NOT self-bill. Rented to a different tenant, the
 * spot bills standalone.
 */

import { PrismaClient } from "@prisma/client";
import { createScheduleForLease, generateInvoiceForPeriod } from "../services/recurringBillingService";
import { findScheduleByLeaseId } from "../repositories/recurringBillingRepository";

const prisma = new PrismaClient();

const LEASE_BASE = {
  landlordName: "LL", landlordAddress: "LL St 1", landlordZipCity: "8000 Zurich",
  tenantAddress: "T St 1", tenantZipCity: "3000 Bern",
};
const PERIOD = new Date("2026-03-01T00:00:00.000Z");

describe("parking combined invoicing", () => {
  const orgId = "default-org";
  let buildingId: string, flatId: string, parkingId: string;
  let flatLeaseId: string, parkingLeaseId: string;

  beforeAll(async () => {
    await prisma.org.upsert({ where: { id: orgId }, create: { id: orgId, name: "CoBill Org" }, update: {} });
    const b = await prisma.building.create({ data: { orgId, name: `CoBill Bldg ${Date.now()}`, address: "C St 1", canton: "ZH" } });
    buildingId = b.id;
    const flat = await prisma.unit.create({ data: { orgId, buildingId, unitNumber: `F-${Date.now()}`, type: "RESIDENTIAL" } });
    flatId = flat.id;
    const parking = await prisma.unit.create({ data: { orgId, buildingId, unitNumber: `P-${Date.now()}`, type: "PARKING", parkingKind: "GARAGE", linkedFlatId: flatId } });
    parkingId = parking.id;
    const flatLease = await prisma.lease.create({ data: { orgId, unitId: flatId, status: "ACTIVE", startDate: PERIOD, netRentChf: 1800, chargesTotalChf: 0, tenantName: "CoBill Tenant", ...LEASE_BASE } });
    flatLeaseId = flatLease.id;
    const parkingLease = await prisma.lease.create({ data: { orgId, unitId: parkingId, status: "ACTIVE", startDate: PERIOD, netRentChf: 150, tenantName: "CoBill Tenant", ...LEASE_BASE } });
    parkingLeaseId = parkingLease.id;
  }, 30000);

  afterAll(async () => {
    const leaseIds = [flatLeaseId, parkingLeaseId];
    await prisma.invoice.deleteMany({ where: { leaseId: { in: leaseIds } } }).catch(() => {});
    await prisma.recurringBillingSchedule.deleteMany({ where: { leaseId: { in: leaseIds } } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { buildingId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("adds the parking rent as a line on the same-tenant flat's invoice", async () => {
    await createScheduleForLease(prisma, { orgId, leaseId: flatLeaseId, activationDate: PERIOD, netRentChf: 1800, totalChargesChf: 0 });
    const sched = await findScheduleByLeaseId(prisma, flatLeaseId);
    const result = await generateInvoiceForPeriod(prisma, sched, PERIOD, {});
    expect(result).not.toBeNull();
    // Flat net rent 180000 + parking 15000 = 195000 cents.
    expect(result!.totalAmountCents).toBe(195000);
    const inv = await prisma.invoice.findUnique({ where: { id: result!.invoiceId }, include: { lineItems: true } });
    const parkingLine = inv!.lineItems.find((li) => /garage|place de parc/i.test(li.description));
    expect(parkingLine).toBeTruthy();
    expect(parkingLine!.lineTotal).toBe(15000);
  });

  it("skips the parking spot's own invoice while co-billed (returns null)", async () => {
    await createScheduleForLease(prisma, { orgId, leaseId: parkingLeaseId, activationDate: PERIOD, netRentChf: 150, totalChargesChf: 0 });
    const sched = await findScheduleByLeaseId(prisma, parkingLeaseId);
    const result = await generateInvoiceForPeriod(prisma, sched, PERIOD, {});
    expect(result).toBeNull();
  });

  it("bills the spot standalone once its tenant differs from the flat's", async () => {
    await prisma.lease.update({ where: { id: parkingLeaseId }, data: { tenantName: "Third Party" } });
    const sched = await findScheduleByLeaseId(prisma, parkingLeaseId);
    const result = await generateInvoiceForPeriod(prisma, sched, PERIOD, {});
    expect(result).not.toBeNull();
    expect(result!.totalAmountCents).toBe(15000);
  });
});
