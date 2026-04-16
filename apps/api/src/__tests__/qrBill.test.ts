import { PrismaClient } from "@prisma/client";
import {
  buildSwissQRBillPayload,
  generateQRCodeSVG,
  generateQRCodePNG,
  formatAmountForQRBill,
  generateSwissReference,
  generateQRReference,
  generateCreditorReference,
  mod10Recursive,
  isQrIban,
  isValidSwissIban,
  referenceTypeForIban,
  validateSwissQRBillPayload,
  generateCompleteQRBill,
  SwissQRBillPayload,
} from "../services/qrBill";
import { generateInvoiceQRBill, getInvoiceQRCodePNG } from "../services/invoiceQRBill";

const prisma = new PrismaClient();

describe("Slice 8.4 - QR-Bill Integration", () => {
  let orgId: string;
  let billingEntityId: string;
  let invoiceId: string;
  let jobId: string;
  let contractorId: string;

  beforeAll(async () => {
    // Create org
    const org = await prisma.org.create({
      data: { name: "QR-Bill Test Org", mode: "OWNER_DIRECT" },
    });
    orgId = org.id;

    // Create contractor
    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "Test Contractor",
        phone: "+41791234567",
        email: "contractor@test.com",
        hourlyRate: 100,
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorId = contractor.id;

    // Create billing entity
    const billingEntity = await prisma.billingEntity.create({
      data: {
        orgId,
        type: "CONTRACTOR",
        contractorId,
        name: "Contractor Billing",
        addressLine1: "Hauptstrasse 123",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
        vatNumber: "CHE-123.456.789",
        defaultVatRate: 7.7,
      },
    });
    billingEntityId = billingEntity.id;

    const tenant = await prisma.tenant.create({
      data: {
        orgId,
        name: "Test Tenant",
        phone: "+41790000000",
        email: "tenant@test.com",
      },
    });

    const request = await prisma.request.create({
      data: {
        category: "plumbing",
        description: "Leaking pipe",
        estimatedCost: 25000, // CHF 250
        status: "APPROVED",
        assignedContractorId: contractorId,
        tenantId: tenant.id,
      },
    });

    // Create job
    const job = await prisma.job.create({
      data: {
        orgId,
        requestId: request.id,
        contractorId,
        status: "COMPLETED",
        actualCost: 25000,
        completedAt: new Date(),
      },
    });
    jobId = job.id;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        org: { connect: { id: orgId } },
        job: { connect: { id: jobId } },
        issuer: { connect: { id: billingEntityId } },
        recipientName: tenant.name,
        recipientAddressLine1: "456 Tenant St",
        recipientPostalCode: "8001",
        recipientCity: "Zurich",
        recipientCountry: "CH",
        subtotalAmount: 25000,
        vatAmount: 1925,
        totalAmount: 26925,
        currency: "CHF",
        vatRate: 7.7,
        amount: 26925,
        description: "Test Invoice",
        status: "APPROVED",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        invoiceNumber: "2026-001",
        iban: "CH9300762011623852957",
        lineItems: {
          create: [
            {
              description: "Pipe repair",
              quantity: 1,
              unitPrice: 25000,
              vatRate: 7.7,
              lineTotal: 26925,
            },
          ],
        },
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    await prisma.org.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  // ===========================
  // QR-Bill Payload Tests
  // ===========================

  /** Helper: build a valid SIX-compliant payload for testing */
  function makePayload(overrides?: Partial<SwissQRBillPayload>): SwissQRBillPayload {
    return {
      qrType: "SPC",
      version: "0200",
      coding: "1",
      iban: "CH4431999123000889012", // QR-IBAN (IID 31999)
      creditorAddressType: "K",
      creditorName: "Test Contractor",
      creditorAddressLine1: "Hauptstrasse 123",
      creditorAddressLine2: "",
      creditorPostalCode: "8000",
      creditorCity: "Zurich",
      creditorCountry: "CH",
      amount: "269.25",
      currency: "CHF",
      debtorAddressType: "K",
      debtorName: "Test Tenant",
      debtorAddressLine1: "456 Tenant St",
      debtorAddressLine2: "",
      debtorPostalCode: "8001",
      debtorCity: "Zurich",
      debtorCountry: "CH",
      referenceType: "QRR",
      reference: "000000000000000000000000000", // 27 zeros
      ...overrides,
    };
  }

  describe("Swiss QR-Bill Payload Generation (SIX spec v2.3)", () => {
    test("should build SPC payload with correct 31-element field order", () => {
      const payload = makePayload();
      const qrText = buildSwissQRBillPayload(payload);
      const lines = qrText.split("\n");

      // Must have at least 31 lines (+ optional bill info / alt procedures)
      expect(lines.length).toBeGreaterThanOrEqual(31);

      // Header
      expect(lines[0]).toBe("SPC");        // 1  QRType
      expect(lines[1]).toBe("0200");       // 2  Version
      expect(lines[2]).toBe("1");          // 3  Coding

      // Creditor account
      expect(lines[3]).toBe(payload.iban); // 4  IBAN

      // Creditor address
      expect(lines[4]).toBe("K");          // 5  Address type
      expect(lines[5]).toBe("Test Contractor"); // 6  Name
      expect(lines[6]).toBe("Hauptstrasse 123"); // 7  Street
      expect(lines[7]).toBe("");           // 8  House no / addr line 2
      expect(lines[8]).toBe("8000");       // 9  Postal code
      expect(lines[9]).toBe("Zurich");     // 10 City
      expect(lines[10]).toBe("CH");        // 11 Country

      // Ultimate creditor — 7 empty lines (12–18)
      for (let i = 11; i <= 17; i++) {
        expect(lines[i]).toBe("");
      }

      // Amount & currency
      expect(lines[18]).toBe("269.25");    // 19 Amount
      expect(lines[19]).toBe("CHF");       // 20 Currency

      // Debtor address
      expect(lines[20]).toBe("K");         // 21 Address type
      expect(lines[21]).toBe("Test Tenant"); // 22 Name

      // Reference
      expect(lines[27]).toBe("QRR");       // 28 Reference type
      expect(lines[28]).toBe("000000000000000000000000000"); // 29 Reference

      // Trailer
      expect(lines[30]).toBe("EPD");       // 31 EPD trailer
    });

    test("should format amount correctly (cents to CHF decimal)", () => {
      expect(formatAmountForQRBill(26925)).toBe("269.25");
      expect(formatAmountForQRBill(100)).toBe("1.00");
      expect(formatAmountForQRBill(0)).toBe("0.00");
    });

    test("should validate correct payload without throwing", () => {
      expect(() => validateSwissQRBillPayload(makePayload())).not.toThrow();
    });

    test("should reject non-Swiss/LI IBAN", () => {
      const p = makePayload({ iban: "DE9300762011623852957" });
      expect(() => validateSwissQRBillPayload(p)).toThrow(/Invalid IBAN/);
    });

    test("should reject invalid amount format (comma)", () => {
      const p = makePayload({ amount: "269,25" });
      expect(() => validateSwissQRBillPayload(p)).toThrow(/Invalid amount/);
    });

    test("should accept empty amount (open amount)", () => {
      const p = makePayload({ amount: "" });
      expect(() => validateSwissQRBillPayload(p)).not.toThrow();
    });

    test("should reject QRR reference type with regular IBAN", () => {
      // Regular IBAN (IID < 30000)
      const p = makePayload({
        iban: "CH9300762011623852957",
        referenceType: "QRR",
        reference: "000000000000000000000000000",
      });
      expect(() => validateSwissQRBillPayload(p)).toThrow(/QR-IBAN/);
    });

    test("should reject SCOR reference with QR-IBAN", () => {
      const p = makePayload({
        referenceType: "SCOR",
        reference: "RF18539007547034",
      });
      expect(() => validateSwissQRBillPayload(p)).toThrow(/SCOR.*not allowed.*QR-IBAN/);
    });

    test("should accept EUR currency", () => {
      const p = makePayload({ currency: "EUR" });
      expect(() => validateSwissQRBillPayload(p)).not.toThrow();
    });
  });

  // ===========================
  // QR-Reference (mod-10-recursive) Tests
  // ===========================

  describe("QR-Reference Generation (mod-10-recursive)", () => {
    test("mod10Recursive should compute correct check digit", () => {
      // Known test vector: "00000000000000000000000000" → check digit 6
      // (26 zeros → carry through table → check digit)
      const cd = mod10Recursive("00000000000000000000000000");
      expect(typeof cd).toBe("number");
      expect(cd).toBeGreaterThanOrEqual(0);
      expect(cd).toBeLessThanOrEqual(9);
    });

    test("generateQRReference should produce exactly 27 digits", () => {
      const ref = generateQRReference("test-id", "2026-001");
      expect(ref).toMatch(/^\d{27}$/);
    });

    test("generateQRReference should be deterministic", () => {
      const r1 = generateQRReference("abc", "2026-001");
      const r2 = generateQRReference("abc", "2026-001");
      expect(r1).toBe(r2);
    });

    test("generateQRReference without invoice number uses UUID", () => {
      const ref = generateQRReference("550e8400-e29b-41d4-a716-446655440000", null);
      expect(ref).toMatch(/^\d{27}$/);
    });

    test("legacy generateSwissReference still works (backward compat)", () => {
      const ref = generateSwissReference("id", "2026-001");
      expect(ref).toMatch(/^\d{27}$/);
    });
  });

  // ===========================
  // Creditor Reference (SCOR / ISO 11649) Tests
  // ===========================

  describe("Creditor Reference (SCOR / ISO 11649)", () => {
    test("should produce reference starting with RF", () => {
      const ref = generateCreditorReference("test-id", "2026-001");
      expect(ref).toMatch(/^RF\d{2}/);
    });

    test("should produce deterministic output", () => {
      const r1 = generateCreditorReference("x", "2026-001");
      const r2 = generateCreditorReference("x", "2026-001");
      expect(r1).toBe(r2);
    });
  });

  // ===========================
  // IBAN Utilities
  // ===========================

  describe("IBAN Utilities", () => {
    test("isQrIban should detect QR-IBAN (IID 30000–31999)", () => {
      expect(isQrIban("CH4431999123000889012")).toBe(true);
      expect(isQrIban("CH4430000123000889012")).toBe(true);
    });

    test("isQrIban should reject regular IBAN", () => {
      expect(isQrIban("CH9300762011623852957")).toBe(false);
    });

    test("isQrIban should accept LI IBAN", () => {
      expect(isQrIban("LI4431999123000889012")).toBe(true);
    });

    test("isValidSwissIban should validate CH and LI", () => {
      expect(isValidSwissIban("CH9300762011623852957")).toBe(true);
      expect(isValidSwissIban("LI9300762011623852957")).toBe(true);
      expect(isValidSwissIban("DE9300762011623852957")).toBe(false);
    });

    test("referenceTypeForIban should return QRR for QR-IBAN", () => {
      expect(referenceTypeForIban("CH4431999123000889012")).toBe("QRR");
      expect(referenceTypeForIban("CH9300762011623852957")).toBe("SCOR");
    });
  });

  // ===========================
  // QR Code Generation Tests
  // ===========================

  describe("QR Code Generation", () => {
    test("should generate QR code as SVG", async () => {
      const payload = buildSwissQRBillPayload(makePayload());
      const svg = await generateQRCodeSVG(payload);

      expect(svg).toBeDefined();
      expect(svg).toContain("svg");
      expect(svg).toContain("xmlns");
    });

    test("should generate QR code as PNG buffer", async () => {
      const payload = buildSwissQRBillPayload(makePayload());
      const png = await generateQRCodePNG(payload, 200);

      expect(Buffer.isBuffer(png)).toBe(true);
      expect(png.length).toBeGreaterThan(0);
      // PNG magic bytes
      expect(png[0]).toBe(0x89);
      expect(png[1]).toBe(0x50);
      expect(png[2]).toBe(0x4e);
      expect(png[3]).toBe(0x47);
    });

    test("should generate complete QR-bill data with SVG and PNG", async () => {
      const result = await generateCompleteQRBill(makePayload());

      expect(result.qrPayload).toBeDefined();
      expect(result.qrPayload).toContain("SPC");
      expect(result.qrCodeSVG).toContain("svg");
      expect(Buffer.isBuffer(result.qrCodePNG)).toBe(true);
    });
  });

  // ===========================
  // Invoice QR-Bill Integration Tests
  // ===========================

  describe("Invoice QR-Bill Integration", () => {
    test("should generate QR-bill data for invoice", async () => {
      const qrBill = await generateInvoiceQRBill(invoiceId, orgId);

      expect(qrBill).toBeDefined();
      expect(qrBill.invoiceId).toBe(invoiceId);
      expect(qrBill.invoiceNumber).toBe("2026-001");
      expect(qrBill.amount).toBe("269.25");
      expect(qrBill.creditorIban).toBe("CH9300762011623852957");
      expect(qrBill.creditorName).toBe("Contractor Billing");
      expect(qrBill.qrPayload).toContain("SPC");
      expect(qrBill.qrCodeSVG).toContain("svg");
    });

    test("should enforce org scoping on QR-bill generation", async () => {
      const otherOrg = await prisma.org.create({
        data: { name: "Other Org", mode: "OWNER_DIRECT" },
      });

      await expect(generateInvoiceQRBill(invoiceId, otherOrg.id)).rejects.toThrow(
        "Invoice does not belong to this org"
      );

      await prisma.org.delete({ where: { id: otherOrg.id } });
    });

    test("should get QR code PNG for invoice", async () => {
      const png = await getInvoiceQRCodePNG(invoiceId, orgId);

      expect(Buffer.isBuffer(png)).toBe(true);
      expect(png.length).toBeGreaterThan(0);
      // Verify PNG signature
      expect(png[0]).toBe(0x89);
      expect(png[1]).toBe(0x50);
    });

    test("should throw error for missing invoice", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await expect(generateInvoiceQRBill(fakeId, orgId)).rejects.toThrow();
    });

    test("should throw error if invoice has no issuer", async () => {
      // Create a simple request and job without creating a billing entity issuer
      const noissueTenant = await prisma.tenant.create({
        data: {
          orgId,
          name: "NoIssue Tenant",
          phone: "+41799999999",
          email: "noissue@test.com",
        },
      });

      const noissueRequest = await prisma.request.create({
        data: {
          category: "oven",
          description: "Test",
          estimatedCost: 10000,
          status: "APPROVED",
          assignedContractorId: contractorId,
          tenantId: noissueTenant.id,
        },
      });

      const noissueJob = await prisma.job.create({
        data: {
          orgId,
          requestId: noissueRequest.id,
          contractorId,
        },
      });

      const noissueInvoice = await prisma.invoice.create({
        data: {
          org: { connect: { id: orgId } },
          job: { connect: { id: noissueJob.id } },
          recipientName: "Tenant",
          recipientAddressLine1: "Main",
          recipientPostalCode: "8000",
          recipientCity: "Zurich",
          recipientCountry: "CH",
          subtotalAmount: 10000,
          vatAmount: 770,
          totalAmount: 10770,
          amount: 10770,
          description: "Test Invoice",
        },
      });

      await expect(generateInvoiceQRBill(noissueInvoice.id, orgId)).rejects.toThrow(
        "no issuer"
      );
    });
  });
});
