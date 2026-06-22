/**
 * Credit Notes (Phase 3a)
 *
 * Verifies:
 * 1. createCreditNote() assigns a sequential CN-YYYY-NNN number from the issuer
 *    and increments the sequence.
 * 2. settleReconciliation() on a negative balance (tenant overpaid) issues a
 *    credit note (not an invoice) and links it to the reconciliation.
 */
import { PrismaClient } from "@prisma/client";
import { createCreditNote } from "../services/creditNoteService";
import { settleReconciliation } from "../services/chargeReconciliationService";
import { createLease } from "../services/leases";

const prisma = new PrismaClient();

describe("Credit Notes (Phase 3a)", () => {
  let orgId: string;
  let issuerId: string;
  let leaseId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Credit Note Test Org" } });
    orgId = org.id;
    await prisma.orgConfig.create({ data: { orgId, autoApproveLimit: 200 } });
    const issuer = await prisma.billingEntity.create({
      data: {
        orgId, type: "ORG", name: "Pian Properties",
        addressLine1: "Teststrasse 1", postalCode: "8000", city: "Zürich", iban: "CH5631000123456789012",
      },
    });
    issuerId = issuer.id;
    const building = await prisma.building.create({
      data: { orgId, name: "CN Building", address: "Teststrasse 1, 8000 Zürich" },
    });
    const unit = await prisma.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "1A", floor: "1", type: "RESIDENTIAL" },
    });
    const lease = await createLease(orgId, { unitId: unit.id, tenantName: "Marco Rossi", startDate: "2026-01-01", netRentChf: 1500 });
    await prisma.lease.update({ where: { id: lease.id }, data: { status: "ACTIVE" } });
    leaseId = lease.id;
  });

  afterAll(async () => {
    await prisma.creditNoteLine.deleteMany({ where: { creditNote: { orgId } } }).catch(() => {});
    await prisma.chargeReconciliation.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.creditNote.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.billingEntity.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.orgConfig.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("assigns a sequential number and increments the issuer sequence", async () => {
    const cn = await createCreditNote({
      orgId, leaseId, issuerBillingEntityId: issuerId, recipientName: "Marco Rossi",
      amountCents: 12345, description: "Test avoir",
      lineItems: [{ description: "Overpaid heating", amountCents: 12345 }],
    });
    expect(cn.status).toBe("ISSUED");
    expect(cn.creditNoteNumber).toMatch(/^CN-\d{4}-001$/);
    expect(cn.amountCents).toBe(12345);
    expect(cn.lineItems).toHaveLength(1);

    const issuer = await prisma.billingEntity.findUnique({ where: { id: issuerId } });
    expect(issuer!.nextCreditNoteSequence).toBe(2);
  });

  it("settles a negative-balance reconciliation with a credit note, not an invoice", async () => {
    const recon = await prisma.chargeReconciliation.create({
      data: {
        orgId, leaseId, fiscalYear: 2026, status: "FINALIZED",
        totalAcomptePaidCents: 120000, totalActualCostsCents: 100000, balanceCents: -20000,
        lineItems: {
          create: [{ description: "Heating", chargeMode: "ACOMPTE", acomptePaidCents: 120000, actualCostCents: 100000, balanceCents: -20000 }],
        },
      },
    });

    const settled = await settleReconciliation(prisma, recon.id, orgId);

    expect(settled.status).toBe("SETTLED");
    expect(settled.settlementCreditNoteId).toBeTruthy();
    expect(settled.settlementInvoiceId).toBeNull();

    const cn = await prisma.creditNote.findUnique({ where: { id: settled.settlementCreditNoteId! } });
    expect(cn!.amountCents).toBe(20000); // abs(balance)
    expect(cn!.status).toBe("ISSUED");
  });
});
