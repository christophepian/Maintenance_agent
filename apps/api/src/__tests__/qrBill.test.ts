import { PrismaClient } from "@prisma/client";
import {
  buildSwissQRBillPayload,
  generateQRCodeSVG,
  generateQRCodePNG,
  formatAmountForQRBill,
  generateSwissReference,
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

  describe("Swiss QR-Bill Payload Generation", () => {
    test("should build SPC format payload with all required fields", async () => {
      const payload: SwissQRBillPayload = {
        qrType: "SPC",
        version: "0200",
        coding: "1",
        amount: "269.25",
        currency: "CHF",
        creditorName: "Test Contractor",
        creditorAddressLine1: "Hauptstrasse 123",
        creditorPostalCode: "8000",
        creditorCity: "Zurich",
        creditorCountry: "CH",
        iban: "CH9300762011623852957",
        reference: "00 000000 000000000000000",
        debtorName: "Test Tenant",
        debtorAddressLine1: "456 Tenant St",
        debtorPostalCode: "8001",
        debtorCity: "Zurich",
        debtorCountry: "CH",
      };

      const qrText = buildSwissQRBillPayload(payload);

      // Verify structure (18 lines)
      const lines = qrText.split("\n");
      expect(lines.length).toBe(18);
      expect(lines[0]).toBe("SPC");
      expect(lines[1]).toBe("0200");
      expect(lines[4]).toBe("CHF");
      expect(lines[9]).toBe("CH9300762011623852957");
    });

    test("should format amount correctly (cents to CHF decimal)", () => {
      const amountInCents = 26925;
      const formatted = formatAmountForQRBill(amountInCents);
      expect(formatted).toBe("269.25");
    });

    test("should generate Swiss reference from invoice number", () => {
      const ref = generateSwissReference("test-invoice-id", "2026-001");
      // Format: "00 XXXXXX XXXXXXXXXXXXXXXXXXXX" (00 + digits, space-separated)
      expect(ref).toMatch(/^00 \d+ \d+$/);
      // Should be formatted correctly with spaces
      expect(ref.length).toBeGreaterThan(10);
    });

    test("should validate QR-bill payload structure", () => {
      const validPayload: SwissQRBillPayload = {
        qrType: "SPC",
        version: "0200",
        coding: "1",
        amount: "269.25",
        currency: "CHF",
        creditorName: "Test Corp",
        creditorAddressLine1: "Main St",
        creditorPostalCode: "8000",
        creditorCity: "Zurich",
        creditorCountry: "CH",
        iban: "CH9300762011623852957",
        reference: "00 000000 000000000000000",
        debtorName: "Tenant",
        debtorAddressLine1: "Side St",
        debtorPostalCode: "8001",
        debtorCity: "Zurich",
        debtorCountry: "CH",
      };

      expect(() => validateSwissQRBillPayload(validPayload)).not.toThrow();
    });

    test("should reject invalid IBAN", () => {
      const invalidPayload: SwissQRBillPayload = {
        qrType: "SPC",
        version: "0200",
        coding: "1",
        amount: "269.25",
        currency: "CHF",
        creditorName: "Test Corp",
        creditorAddressLine1: "Main St",
        creditorPostalCode: "8000",
        creditorCity: "Zurich",
        creditorCountry: "CH",
        iban: "DE9300762011623852957", // Non-Swiss
        reference: "00 000000 000000000000000",
        debtorName: "Tenant",
        debtorAddressLine1: "Side St",
        debtorPostalCode: "8001",
        debtorCity: "Zurich",
        debtorCountry: "CH",
      };

      expect(() => validateSwissQRBillPayload(invalidPayload)).toThrow(/Invalid IBAN/);
    });

    test("should reject invalid amount format", () => {
      const invalidPayload: SwissQRBillPayload = {
        qrType: "SPC",
        version: "0200",
        coding: "1",
        amount: "269,25", // Comma instead of period
        currency: "CHF",
        creditorName: "Test Corp",
        creditorAddressLine1: "Main St",
        creditorPostalCode: "8000",
        creditorCity: "Zurich",
        creditorCountry: "CH",
        iban: "CH9300762011623852957",
        reference: "00 000000 000000000000000",
        debtorName: "Tenant",
        debtorAddressLine1: "Side St",
        debtorPostalCode: "8001",
        debtorCity: "Zurich",
        debtorCountry: "CH",
      };

      expect(() => validateSwissQRBillPayload(invalidPayload)).toThrow();
    });
  });

  // ===========================
  // QR Code Generation Tests
  // ===========================

  describe("QR Code Generation", () => {
    test("should generate QR code as SVG", async () => {
      const payload = "SPC\n0200\n1\n269.25\nCHF\nTest\nMain\n8000 Zurich\nCH\nCH9300762011623852957\n1\n00 000000 000000000000000\n\nEPD\nTenant\nSide\n8001 Zurich\nCH";
      const svg = await generateQRCodeSVG(payload);

      expect(svg).toBeDefined();
      expect(svg).toContain("svg");
      expect(svg).toContain("xmlns");
    });

    test("should generate QR code as PNG buffer", async () => {
      const payload = "SPC\n0200\n1\n269.25\nCHF\nTest\nMain\n8000 Zurich\nCH\nCH9300762011623852957\n1\n00 000000 000000000000000\n\nEPD\nTenant\nSide\n8001 Zurich\nCH";
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
      const payload: SwissQRBillPayload = {
        qrType: "SPC",
        version: "0200",
        coding: "1",
        amount: "269.25",
        currency: "CHF",
        creditorName: "Test Corp",
        creditorAddressLine1: "Main St",
        creditorPostalCode: "8000",
        creditorCity: "Zurich",
        creditorCountry: "CH",
        iban: "CH9300762011623852957",
        reference: "00 000000 000000000000000",
        debtorName: "Tenant",
        debtorAddressLine1: "Side St",
        debtorPostalCode: "8001",
        debtorCity: "Zurich",
        debtorCountry: "CH",
      };

      const result = await generateCompleteQRBill(payload);

      expect(result.qrPayload).toBeDefined();
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
