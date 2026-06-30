/**
 * Regression tests for the cross-tenant IDOR fixes (2026-06-30 isolation audit).
 *
 * Each previously-exposed path is asserted to be org-scoped: an entity created
 * under ORG_A must be invisible / unmutatable when accessed with ORG_B's id.
 * These lock the fixes so the leaks cannot silently return.
 *
 * Clusters:
 *   1. Rental applications (getApplication, findApplicationUnitById via
 *      adjustEvaluation/overrideDisqualification, findAttachmentById,
 *      findApplicationDocuments)
 *   2. Invoices (swapInvoiceParties — must throw AND not mutate cross-org)
 *   3. Condition-report photos (the relation-scoped query the route uses)
 */
import { PrismaClient, LeaseStatus } from "@prisma/client";
import {
  getApplication,
  adjustEvaluation,
  overrideDisqualification,
} from "../services/rentalApplications";
import {
  findApplicationUnitById,
  findAttachmentById,
  findApplicationDocuments,
} from "../repositories/rentalApplicationRepository";
import { swapInvoiceParties } from "../services/invoices";

const prisma = new PrismaClient();

describe("Tenant isolation — cross-org IDOR regression", () => {
  let orgA: string;
  let orgB: string;
  let appId: string;
  let appUnitId: string;
  let attachmentId: string;
  let invoiceId: string;
  let photoId: string;

  beforeAll(async () => {
    orgA = (await prisma.org.create({ data: { name: "IDOR Org A" } })).id;
    orgB = (await prisma.org.create({ data: { name: "IDOR Org B" } })).id;

    const building = await prisma.building.create({
      data: { orgId: orgA, name: "A Tower", address: "1 A St" },
    });
    const unit = await prisma.unit.create({
      data: { orgId: orgA, buildingId: building.id, unitNumber: "A-1", isActive: true },
    });

    // ── Rental application chain (org A) ──
    const app = await prisma.rentalApplication.create({ data: { orgId: orgA } });
    appId = app.id;
    const applicant = await prisma.rentalApplicant.create({
      data: { applicationId: appId, firstName: "Jane", lastName: "Doe" },
    });
    const au = await prisma.rentalApplicationUnit.create({
      data: { applicationId: appId, unitId: unit.id, disqualified: true },
    });
    appUnitId = au.id;
    const attachment = await prisma.rentalAttachment.create({
      data: {
        applicationId: appId,
        applicantId: applicant.id,
        docType: "IDENTITY",
        fileName: "id.pdf",
        fileSizeBytes: 100,
        mimeType: "application/pdf",
        storageKey: "idor/id.pdf",
        sha256: "deadbeef",
      },
    });
    attachmentId = attachment.id;

    // ── Invoice (org A) — issuer/recipient set to detectable sentinels ──
    const inv = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "Invoice" (id, "orgId", description, "issuerName", "recipientName",
        "recipientAddressLine1", "recipientPostalCode", "recipientCity",
        "subtotalAmount", "vatAmount", "totalAmount", amount, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::"InvoiceStatus", NOW(), NOW())
       RETURNING id`,
      orgA, "IDOR invoice", "ORIG_ISSUER", "ORIG_RECIP",
      "1 A St", "8000", "Zurich", 1000, 0, 1000, 1000, "DRAFT",
    );
    invoiceId = inv[0].id;

    // ── Condition-report photo chain (org A) ──
    const tenant = await prisma.tenant.create({
      data: { orgId: orgA, phone: "+41790000001" },
    });
    const lease = await prisma.lease.create({
      data: {
        orgId: orgA,
        unitId: unit.id,
        status: LeaseStatus.ACTIVE,
        landlordName: "LL",
        landlordAddress: "2 A St",
        landlordZipCity: "8001 Zurich",
        tenantName: "Jane Doe",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        netRentChf: 2000,
        objectType: "APPARTEMENT",
      },
    });
    const report = await prisma.unitConditionReport.create({
      data: { orgId: orgA, unitId: unit.id, tenantId: tenant.id, leaseId: lease.id, type: "MOVE_IN" },
    });
    const item = await prisma.unitConditionReportItem.create({
      data: { reportId: report.id, roomLabel: "Kitchen", itemLabel: "Sink", condition: "GOOD" },
    });
    const photo = await prisma.unitConditionReportPhoto.create({
      data: { itemId: item.id, storageKey: "idor/photo.jpg" },
    });
    photoId = photo.id;
  });

  afterAll(async () => {
    await prisma.unitConditionReportPhoto.deleteMany({ where: { item: { report: { orgId: orgA } } } }).catch(() => {});
    await prisma.unitConditionReportItem.deleteMany({ where: { report: { orgId: orgA } } }).catch(() => {});
    await prisma.unitConditionReport.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.rentalAttachment.deleteMany({ where: { application: { orgId: orgA } } }).catch(() => {});
    await prisma.rentalApplicationUnit.deleteMany({ where: { application: { orgId: orgA } } }).catch(() => {});
    await prisma.rentalApplicant.deleteMany({ where: { application: { orgId: orgA } } }).catch(() => {});
    await prisma.rentalApplication.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId: orgA } }).catch(() => {});
    await prisma.org.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe("Cluster 1 — rental applications", () => {
    it("getApplication is null cross-org, present same-org", async () => {
      expect(await getApplication(appId, orgB)).toBeNull();
      expect(await getApplication(appId, orgA)).not.toBeNull();
    });

    it("findApplicationUnitById is null cross-org, present same-org", async () => {
      expect(await findApplicationUnitById(prisma, appUnitId, orgB)).toBeNull();
      expect(await findApplicationUnitById(prisma, appUnitId, orgA)).not.toBeNull();
    });

    it("adjustEvaluation throws cross-org", async () => {
      await expect(
        adjustEvaluation(appUnitId, { scoreDelta: -50, reason: "x" } as any, orgB),
      ).rejects.toThrow("APPLICATION_UNIT_NOT_FOUND");
    });

    it("overrideDisqualification throws cross-org", async () => {
      await expect(
        overrideDisqualification(appUnitId, "x", orgB),
      ).rejects.toThrow("APPLICATION_UNIT_NOT_FOUND");
    });

    it("findAttachmentById is null cross-org, present same-org", async () => {
      expect(await findAttachmentById(prisma, attachmentId, orgB)).toBeNull();
      expect(await findAttachmentById(prisma, attachmentId, orgA)).not.toBeNull();
    });

    it("findApplicationDocuments is null cross-org, present same-org", async () => {
      expect(await findApplicationDocuments(prisma, appId, orgB)).toBeNull();
      expect(await findApplicationDocuments(prisma, appId, orgA)).not.toBeNull();
    });
  });

  describe("Cluster 2 — invoices", () => {
    it("swapInvoiceParties throws cross-org AND does not mutate", async () => {
      await expect(swapInvoiceParties(invoiceId, orgB)).rejects.toThrow("INVOICE_NOT_FOUND");
      const after = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(after?.issuerName).toBe("ORIG_ISSUER"); // unchanged — no TOCTOU write
      expect(after?.recipientName).toBe("ORIG_RECIP");
    });

    it("swapInvoiceParties succeeds same-org", async () => {
      const dto = await swapInvoiceParties(invoiceId, orgA);
      expect(dto.issuerName).toBe("ORIG_RECIP"); // swapped
    });
  });

  describe("Cluster 3 — condition-report photos", () => {
    it("relation-scoped photo lookup is null cross-org, present same-org", async () => {
      const crossOrg = await prisma.unitConditionReportPhoto.findFirst({
        where: { id: photoId, item: { report: { orgId: orgB } } },
      });
      expect(crossOrg).toBeNull();
      const sameOrg = await prisma.unitConditionReportPhoto.findFirst({
        where: { id: photoId, item: { report: { orgId: orgA } } },
      });
      expect(sameOrg).not.toBeNull();
    });
  });
});
