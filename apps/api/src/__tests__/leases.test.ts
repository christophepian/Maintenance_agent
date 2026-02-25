import { PrismaClient, LeaseStatus, SignatureRequestStatus } from "@prisma/client";
import { createLease, listLeases, getLease, updateLease, markLeaseReadyToSign, cancelLease, storeLeasePdfReference } from "../services/leases";
import { createSignatureRequest, listSignatureRequests, getSignatureRequest, sendSignatureRequest, markSignatureRequestSigned } from "../services/signatureRequests";
import { generateLeasePDF } from "../services/leasePDFRenderer";

const prisma = new PrismaClient();

describe("Leases and Signature Requests", () => {
  let orgId: string;
  let buildingId: string;
  let unitId: string;
  let leaseId: string;
  let signatureRequestId: string;

  beforeAll(async () => {
    // Create org + org config with landlord info
    const org = await prisma.org.create({
      data: { name: "Lease Test Org" },
    });
    orgId = org.id;

    await prisma.orgConfig.create({
      data: {
        orgId,
        autoApproveLimit: 200,
        landlordName: "Immobilien AG",
        landlordAddress: "Bahnhofstrasse 10",
        landlordZipCity: "8001 Zürich",
        landlordPhone: "+41441234567",
        landlordEmail: "info@immobilien.ch",
        landlordRepresentedBy: "Max Müller",
      },
    });

    // Create building + unit
    const building = await prisma.building.create({
      data: {
        orgId,
        name: "Central Plaza",
        address: "Bahnhofstrasse 10, 8001 Zürich",
      },
    });
    buildingId = building.id;

    const unit = await prisma.unit.create({
      data: {
        orgId,
        buildingId,
        unitNumber: "3A",
        floor: "3",
        type: "RESIDENTIAL",
      },
    });
    unitId = unit.id;
  });

  afterAll(async () => {
    // Cleanup in correct order
    await prisma.signatureRequest.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.orgConfig.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ==========================================
  // Lease CRUD
  // ==========================================

  it("should create a lease draft with auto-filled landlord data", async () => {
    const lease = await createLease(orgId, {
      unitId,
      tenantName: "Sophie Dubois",
      tenantEmail: "sophie@example.com",
      tenantPhone: "+41791234567",
      tenantAddress: "Rue du Marché 5",
      tenantZipCity: "1003 Lausanne",
      startDate: "2026-04-01",
      netRentChf: 1800,
      depositChf: 5400,
    });

    expect(lease).toBeDefined();
    expect(lease.status).toBe(LeaseStatus.DRAFT);
    expect(lease.tenantName).toBe("Sophie Dubois");
    expect(lease.tenantEmail).toBe("sophie@example.com");
    expect(lease.netRentChf).toBe(1800);
    expect(lease.depositChf).toBe(5400);
    expect(lease.rentTotalChf).toBe(1800); // net only, no extras

    // Auto-filled from OrgConfig
    expect(lease.landlordName).toBe("Immobilien AG");
    expect(lease.landlordAddress).toBe("Bahnhofstrasse 10");
    expect(lease.landlordZipCity).toBe("8001 Zürich");
    expect(lease.landlordRepresentedBy).toBe("Max Müller");

    // Auto-filled from unit/building
    expect(lease.unit).toBeDefined();
    expect(lease.unit?.unitNumber).toBe("3A");
    expect(lease.unit?.building?.name).toBe("Central Plaza");

    leaseId = lease.id;
  });

  it("should list leases filtered by status", async () => {
    const all = await listLeases(orgId);
    expect(all.length).toBeGreaterThanOrEqual(1);

    const drafts = await listLeases(orgId, { status: "DRAFT" });
    expect(drafts.every(l => l.status === "DRAFT")).toBe(true);

    const signed = await listLeases(orgId, { status: "SIGNED" });
    // We haven't signed any yet
    expect(signed.length).toBe(0);
  });

  it("should get a single lease by id", async () => {
    const lease = await getLease(leaseId, orgId);
    expect(lease).toBeDefined();
    expect(lease!.id).toBe(leaseId);
    expect(lease!.tenantName).toBe("Sophie Dubois");
  });

  it("should return null for a lease from another org", async () => {
    const lease = await getLease(leaseId, "non-existent-org");
    expect(lease).toBeNull();
  });

  it("should update editable fields on a DRAFT lease", async () => {
    const updated = await updateLease(leaseId, orgId, {
      netRentChf: 2000,
      garageRentChf: 150,
      chargesTotalChf: 200,
      depositChf: 6000,
      paymentIban: "CH9300762011623852957",
      otherStipulations: "No pets allowed.",
    });

    expect(updated.netRentChf).toBe(2000);
    expect(updated.garageRentChf).toBe(150);
    expect(updated.chargesTotalChf).toBe(200);
    expect(updated.rentTotalChf).toBe(2000 + 150 + 200); // auto-computed
    expect(updated.depositChf).toBe(6000);
    expect(updated.paymentIban).toBe("CH9300762011623852957");
    expect(updated.otherStipulations).toBe("No pets allowed.");
  });

  // ==========================================
  // PDF Generation
  // ==========================================

  it("should generate a lease PDF with SHA-256 hash", async () => {
    const { buffer, sha256 } = await generateLeasePDF(leaseId, orgId);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100); // PDF should have content
    expect(sha256).toBeDefined();
    expect(sha256.length).toBe(64); // hex sha256

    // Verify PDF magic bytes (%PDF)
    const header = buffer.slice(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("should store PDF reference on lease", async () => {
    const storageKey = "lease-pdf/test/123.pdf";
    const sha256 = "abc123def456";
    const updated = await storeLeasePdfReference(leaseId, orgId, storageKey, sha256);

    expect(updated.draftPdfStorageKey).toBe(storageKey);
    expect(updated.draftPdfSha256).toBe(sha256);
  });

  // ==========================================
  // Ready to Sign + Signature Requests
  // ==========================================

  it("should mark lease as READY_TO_SIGN", async () => {
    const lease = await markLeaseReadyToSign(leaseId, orgId);
    expect(lease.status).toBe(LeaseStatus.READY_TO_SIGN);
  });

  it("should reject editing a non-DRAFT lease", async () => {
    await expect(
      updateLease(leaseId, orgId, { netRentChf: 9999 })
    ).rejects.toThrow("Only DRAFT leases can be edited");
  });

  it("should create a signature request for the lease", async () => {
    const sr = await createSignatureRequest({
      orgId,
      leaseId,
      level: "SES",
      signers: [
        { role: "TENANT", name: "Sophie Dubois", email: "sophie@example.com" },
        { role: "LANDLORD", name: "Immobilien AG", email: "info@immobilien.ch" },
      ],
    });

    expect(sr).toBeDefined();
    expect(sr.entityType).toBe("LEASE");
    expect(sr.entityId).toBe(leaseId);
    expect(sr.provider).toBe("INTERNAL");
    expect(sr.level).toBe("SES");
    expect(sr.status).toBe("DRAFT");
    expect(sr.signers.length).toBe(2);
    expect(sr.signers[0].role).toBe("TENANT");

    signatureRequestId = sr.id;
  });

  it("should list signature requests filtered by entity", async () => {
    const results = await listSignatureRequests(orgId, { entityType: "LEASE", entityId: leaseId });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].entityId).toBe(leaseId);
  });

  it("should get a single signature request", async () => {
    const sr = await getSignatureRequest(signatureRequestId, orgId);
    expect(sr).toBeDefined();
    expect(sr!.id).toBe(signatureRequestId);
  });

  it("should send a signature request (stub)", async () => {
    const sr = await sendSignatureRequest(signatureRequestId, orgId);
    expect(sr.status).toBe("SENT");
    expect(sr.sentAt).toBeDefined();
  });

  it("should reject sending an already-sent request", async () => {
    await expect(
      sendSignatureRequest(signatureRequestId, orgId)
    ).rejects.toThrow("Only DRAFT requests can be sent");
  });

  it("should mark signature request as signed and update lease", async () => {
    const sr = await markSignatureRequestSigned(signatureRequestId, orgId);
    expect(sr.status).toBe("SIGNED");
    expect(sr.signedAt).toBeDefined();

    // Verify lease status was updated too
    const lease = await getLease(leaseId, orgId);
    expect(lease!.status).toBe(LeaseStatus.SIGNED);
  });

  // ==========================================
  // Cancel lease
  // ==========================================

  it("should not cancel a signed lease", async () => {
    await expect(
      cancelLease(leaseId, orgId)
    ).rejects.toThrow("Cannot cancel a signed or active lease");
  });

  it("should cancel a DRAFT lease", async () => {
    // Create another lease to cancel
    const lease2 = await createLease(orgId, {
      unitId,
      tenantName: "Marco Rossi",
      startDate: "2026-06-01",
      netRentChf: 1200,
    });
    const cancelled = await cancelLease(lease2.id, orgId);
    expect(cancelled.status).toBe(LeaseStatus.CANCELLED);
  });
});
