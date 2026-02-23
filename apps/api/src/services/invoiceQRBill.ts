import { PrismaClient } from '@prisma/client';
import {
  SwissQRBillPayload,
  formatAmountForQRBill,
  generateSwissReference,
  generateCompleteQRBill,
} from './qrBill';

const prisma = new PrismaClient();

export interface InvoiceQRBillDTO {
  invoiceId: string;
  invoiceNumber: string | null;
  qrPayload: string;
  qrCodeSVG: string;
  amount: string; // CHF formatted
  creditorIban: string;
  creditorName: string;
  reference: string;
}

/**
 * Generate QR-bill data for an invoice
 * Fetches invoice and related data, builds QR payload, generates QR code
 */
export async function generateInvoiceQRBill(invoiceId: string, orgId: string): Promise<InvoiceQRBillDTO> {
  // Fetch invoice with relationships
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      issuer: true,
      job: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  if (invoice.orgId !== orgId) {
    throw new Error('Invoice does not belong to this org');
  }

  if (!invoice.issuer) {
    throw new Error('Invoice has no issuer billing entity');
  }

  if (!invoice.iban) {
    throw new Error('Invoice has no IBAN set');
  }

  // Format amount for QR-bill (CHF decimal)
  const amountStr = formatAmountForQRBill(invoice.totalAmount);

  // Generate Swiss reference
  const reference = generateSwissReference(invoiceId, invoice.invoiceNumber);

  // Build QR-bill payload
  const payload: SwissQRBillPayload = {
    qrType: 'SPC',
    version: '0200',
    coding: '1',
    amount: amountStr,
    currency: 'CHF',

    // Creditor (issuer)
    creditorName: invoice.issuer.name,
    creditorAddressLine1: invoice.issuer.addressLine1,
    creditorAddressLine2: invoice.issuer.addressLine2,
    creditorPostalCode: invoice.issuer.postalCode,
    creditorCity: invoice.issuer.city,
    creditorCountry: invoice.issuer.country,
    iban: invoice.iban,

    // Reference
    reference,

    // Optional message
    unstructuredMessage: invoice.invoiceNumber
      ? `Invoice ${invoice.invoiceNumber}`
      : undefined,

    // Debtor (tenant/recipient)
    debtorName: invoice.recipientName,
    debtorAddressLine1: invoice.recipientAddressLine1,
    debtorAddressLine2: invoice.recipientAddressLine2,
    debtorPostalCode: invoice.recipientPostalCode,
    debtorCity: invoice.recipientCity,
    debtorCountry: invoice.recipientCountry,
  };

  // Generate QR code
  const qrBill = await generateCompleteQRBill(payload);

  return {
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    qrPayload: qrBill.qrPayload,
    qrCodeSVG: qrBill.qrCodeSVG,
    amount: amountStr,
    creditorIban: invoice.iban,
    creditorName: invoice.issuer.name,
    reference,
  };
}

/**
 * Get QR code as PNG buffer
 */
export async function getInvoiceQRCodePNG(invoiceId: string, orgId: string): Promise<Buffer> {
  const qrBill = await generateInvoiceQRBill(invoiceId, orgId);

  const qrPayload = qrBill.qrPayload;

  // Import and generate PNG
  const { generateQRCodePNG } = await import('./qrBill');
  return generateQRCodePNG(qrPayload, 250);
}
