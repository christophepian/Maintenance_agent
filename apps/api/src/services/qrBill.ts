import * as QRCode from 'qrcode';

/**
 * Swiss QR-Bill Payload (SPC standard)
 * Follows ISO 20022 and Swiss QR-bill standard
 */
export interface SwissQRBillPayload {
  // Header
  qrType: 'SPC';
  version: '0200';
  coding: '1'; // UTF-8

  // Amount & currency
  amount: string; // e.g. "1234.56" - CHF decimal format
  currency: 'CHF';

  // Creditor (issuer)
  creditorName: string;
  creditorAddressLine1: string;
  creditorAddressLine2?: string;
  creditorPostalCode: string;
  creditorCity: string;
  creditorCountry: string; // ISO 3166-1 alpha-2
  iban: string;

  // Reference
  reference: string; // Structured reference (ISR/QRF)

  // Optional
  unstructuredMessage?: string;
  trailerElement?: string;

  // Debtor (tenant/recipient)
  debtorName: string;
  debtorAddressLine1: string;
  debtorAddressLine2?: string;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry: string;
}

/**
 * Build Swiss QR-Bill text payload (SPC format)
 * Format: one element per line, elements separated by LF (newline)
 */
export function buildSwissQRBillPayload(payload: SwissQRBillPayload): string {
  const lines: string[] = [];

  // 1. Header (QRType)
  lines.push('SPC');

  // 2. Version
  lines.push('0200');

  // 3. Coding (UTF-8)
  lines.push('1');

  // 4. Amount (formatted as decimal: "XXXX.XX")
  lines.push(payload.amount);

  // 5. Currency
  lines.push(payload.currency);

  // 6. Creditor name
  lines.push(payload.creditorName);

  // 7. Creditor address line 1
  lines.push(payload.creditorAddressLine1);

  // 8. Creditor address line 2 (postal code city)
  lines.push(`${payload.creditorPostalCode} ${payload.creditorCity}`);

  // 9. Creditor country
  lines.push(payload.creditorCountry);

  // 10. IBAN
  lines.push(payload.iban);

  // 11. Reference type (if QRF/structured: '1', else '0')
  const hasReference = payload.reference && payload.reference.trim().length > 0;
  lines.push(hasReference ? '1' : '0');

  // 12. Reference (structured)
  lines.push(payload.reference || '');

  // 13. Unstructured message
  lines.push(payload.unstructuredMessage || '');

  // 14. Trailer element
  lines.push(payload.trailerElement || 'EPD');

  // 15. Debtor name
  lines.push(payload.debtorName);

  // 16. Debtor address line 1
  lines.push(payload.debtorAddressLine1);

  // 17. Debtor address line 2
  lines.push(`${payload.debtorPostalCode} ${payload.debtorCity}`);

  // 18. Debtor country
  lines.push(payload.debtorCountry);

  return lines.join('\n');
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(payload: string): Promise<string> {
  try {
    const svg = await QRCode.toString(payload, {
      type: 'svg',
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return svg;
  } catch (error) {
    throw new Error(`Failed to generate QR code SVG: ${error}`);
  }
}

/**
 * Generate QR code as PNG buffer
 */
export async function generateQRCodePNG(
  payload: string,
  width: number = 200
): Promise<Buffer> {
  try {
    const png = await QRCode.toDataURL(payload, {
      type: 'image/png',
      width,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    // Convert data URL to buffer
    const base64 = png.split(',')[1];
    return Buffer.from(base64, 'base64');
  } catch (error) {
    throw new Error(`Failed to generate QR code PNG: ${error}`);
  }
}

/**
 * Format CHF amount for QR-bill (decimal format)
 * Input: cents (number)
 * Output: "XXXX.XX" string
 */
export function formatAmountForQRBill(amountInCents: number): string {
  const chf = (amountInCents / 100).toFixed(2);
  return chf;
}

/**
 * Generate Swiss structured reference (QRF)
 * Format: "00 {6-digit-ref} {20-digit-check}"
 * For simplicity, using a deterministic format
 */
export function generateSwissReference(invoiceId: string, invoiceNumber: string | null): string {
  // If we have an invoice number, use it
  // Format: YYYY-NNN → pad to 26 digits with leading zeros
  if (invoiceNumber) {
    // Replace hyphen and pad
    const numericPart = invoiceNumber.replace('-', '').padStart(20, '0');
    return `00 ${numericPart.slice(0, 6)} ${numericPart.slice(6, 26)}`;
  }

  // Fallback: use invoice ID (first 26 chars, padded)
  const padded = invoiceId.replace(/-/g, '').substring(0, 26).padEnd(26, '0');
  return `00 ${padded.slice(0, 6)} ${padded.slice(6, 26)}`;
}

/**
 * Validate Swiss QR-bill payload structure
 */
export function validateSwissQRBillPayload(payload: SwissQRBillPayload): boolean {
  const errors: string[] = [];

  if (payload.qrType !== 'SPC') errors.push('Invalid QR type');
  if (payload.version !== '0200') errors.push('Invalid version');
  if (payload.currency !== 'CHF') errors.push('Invalid currency');
  if (!payload.iban || !payload.iban.startsWith('CH')) errors.push('Invalid IBAN');
  if (!payload.creditorName) errors.push('Missing creditor name');
  if (!payload.debtorName) errors.push('Missing debtor name');

  // Amount validation: should be decimal format
  const amountRegex = /^\d+\.\d{2}$/;
  if (!amountRegex.test(payload.amount)) errors.push('Invalid amount format');

  if (errors.length > 0) {
    throw new Error(`QR-Bill validation failed: ${errors.join(', ')}`);
  }

  return true;
}

/**
 * Generate complete Swiss QR-Bill data and QR code
 */
export async function generateCompleteQRBill(payload: SwissQRBillPayload): Promise<{
  qrPayload: string;
  qrCodeSVG: string;
  qrCodePNG: Buffer;
}> {
  // Validate
  validateSwissQRBillPayload(payload);

  // Build payload text
  const qrPayload = buildSwissQRBillPayload(payload);

  // Generate QR codes
  const [qrCodeSVG, qrCodePNG] = await Promise.all([
    generateQRCodeSVG(qrPayload),
    generateQRCodePNG(qrPayload, 250),
  ]);

  return {
    qrPayload,
    qrCodeSVG,
    qrCodePNG,
  };
}
