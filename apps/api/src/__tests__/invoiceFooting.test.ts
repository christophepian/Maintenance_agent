/**
 * Invoice footing invariant — the invoice total must equal the sum of its own
 * visible line items.
 *
 * Regression for a ±1-cent mismatch: the header charges total used to be
 * re-rounded from the schedule aggregate (Math.round(totalChargesCents * fraction))
 * while each charge line item was rounded independently. With ≥2 itemised charges
 * that each land on a fractional cent under a pro-rata fraction,
 * Σ round(itemᵢ) ≠ round(Σ itemᵢ), so totalAmount disagreed with the line items.
 */

import { PrismaClient } from "@prisma/client";
import { createScheduleForLease, generateInvoiceForPeriod } from "../services/recurringBillingService";
import { findScheduleByLeaseId } from "../repositories/recurringBillingRepository";

const prisma = new PrismaClient();

// Mid-month activation (the 20th of a 30-day month → pro-rata fraction 11/30).
// Midday UTC so getDate() resolves to the 20th regardless of the runner's timezone.
const ACTIVATION = new Date("2026-04-20T12:00:00.000Z");

const LEASE_BASE = {
  landlordName: "LL", landlordAddress: "LL St 1", landlordZipCity: "8000 Zurich",
  tenantAddress: "T St 1", tenantZipCity: "3000 Bern",
};

describe("invoice footing (total = sum of line items)", () => {
  const orgId = "default-org";
  let buildingId: string, unitId: string, leaseId: string;

  beforeAll(async () => {
    await prisma.org.upsert({ where: { id: orgId }, create: { id: orgId, name: "Footing Org" }, update: {} });
    const b = await prisma.building.create({ data: { orgId, name: `Footing Bldg ${Date.now()}`, address: "F St 1", canton: "ZH" } });
    buildingId = b.id;
    const u = await prisma.unit.create({ data: { orgId, buildingId, unitNumber: `FU-${Date.now()}`, type: "RESIDENTIAL" } });
    unitId = u.id;
    // Two itemised charges of 100 CHF each. Pro-rated at 11/30 each rounds to 3667
    // cents (Σ = 7334), whereas the aggregate 200 CHF rounds to 7333 — a 1-cent gap.
    const lease = await prisma.lease.create({
      data: {
        orgId, unitId, status: "ACTIVE", startDate: ACTIVATION,
        netRentChf: 1500, chargesTotalChf: 200, tenantName: "Footing Tenant", ...LEASE_BASE,
        expenseItems: {
          create: [
            { description: "Chauffage", amountChf: 100, mode: "ACOMPTE" },
            { description: "Eau", amountChf: 100, mode: "ACOMPTE" },
          ],
        },
      },
    });
    leaseId = lease.id;
  }, 30000);

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { leaseId } }).catch(() => {});
    await prisma.recurringBillingSchedule.deleteMany({ where: { leaseId } }).catch(() => {});
    await prisma.leaseExpenseItem.deleteMany({ where: { leaseId } }).catch(() => {});
    await prisma.lease.delete({ where: { id: leaseId } }).catch(() => {});
    await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("totalAmount equals the sum of line items for a multi-item pro-rata invoice", async () => {
    await createScheduleForLease(prisma, { orgId, leaseId, activationDate: ACTIVATION, netRentChf: 1500, totalChargesChf: 200 });
    const sched = await findScheduleByLeaseId(prisma, leaseId);
    const result = await generateInvoiceForPeriod(prisma, sched, ACTIVATION, {});
    expect(result).not.toBeNull();
    expect(result!.isProRata).toBe(true);

    const inv = await prisma.invoice.findUnique({ where: { id: result!.invoiceId }, include: { lineItems: true } });
    // Base rent + two charge lines.
    expect(inv!.lineItems.length).toBe(3);

    const lineSum = inv!.lineItems.reduce((s, li) => s + li.lineTotal, 0);
    // The footing invariant that regressed: header must equal its own lines.
    expect(inv!.totalAmount).toBe(lineSum);
    expect(inv!.subtotalAmount).toBe(lineSum);
    expect(result!.totalAmountCents).toBe(lineSum);
  });
});
