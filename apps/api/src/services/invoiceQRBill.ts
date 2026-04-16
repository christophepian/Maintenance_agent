import prisma from './prismaClient';
import {
  SwissQRBillPayload,
  ReferenceType,
  formatAmountForQRBill,
  generateQRReference,
  generateCreditorReference,
  generateCompleteQRBill,
  isQrIban,
  referenceTypeForIban,
} from './qrBill';

export interface InvoiceQRBillDTO {
  invoiceId: string;
  invoiceNumber: string | null;
  qrPayload: string;
  qrCodeSVG: string;
  amount: string; // CHF formatted
  creditorIban: string;
  creditorName: string;
  reference: string;
  referenceType: ReferenceType;
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

  // Determine reference type from IBAN (QR-IBAN → QRR, regular → SCOR)
  const refType = referenceTypeForIban(invoice.iban);
  const reference = refType === 'QRR'
    ? generateQRReference(invoiceId, invoice.invoiceNumber)
    : generateCreditorReference(invoiceId, invoice.invoiceNumber);

  // Build QR-bill payload per SIX spec v2.3
  const payload: SwissQRBillPayload = {
    qrType: 'SPC',
    version: '0200',
    coding: '1',

    // Creditor account
    iban: invoice.iban,

    // Creditor address (combined format)
    creditorAddressType: 'K',
    creditorName: invoice.issuer.name,
    creditorAddressLine1: invoice.issuer.addressLine1,
    creditorAddressLine2: invoice.issuer.addressLine2 || '',
    creditorPostalCode: invoice.issuer.postalCode,
    creditorCity: invoice.issuer.city,
    creditorCountry: invoice.issuer.country,

    // Amount
    amount: amountStr,
    currency: 'CHF',

    // Debtor address (combined format)
    debtorAddressType: 'K',
    debtorName: invoice.recipientName,
    debtorAddressLine1: invoice.recipientAddressLine1,
    debtorAddressLine2: invoice.recipientAddressLine2 || '',
    debtorPostalCode: invoice.recipientPostalCode,
    debtorCity: invoice.recipientCity,
    debtorCountry: invoice.recipientCountry,

    // Reference
    referenceType: refType,
    reference,

    // Optional message
    unstructuredMessage: invoice.invoiceNumber
      ? `Invoice ${invoice.invoiceNumber}`
      : undefined,
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
    referenceType: refType,
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
