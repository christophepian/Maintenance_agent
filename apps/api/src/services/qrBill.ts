import * as QRCode from 'qrcode';

// ────────────────────────────────────────────────────────────────
// Swiss QR-bill SPC payload — SIX Implementation Guidelines v2.3
// https://www.paymentstandards.ch/dam/downloads/ig-qr-bill-en.pdf
// ────────────────────────────────────────────────────────────────

/**
 * Address type per SIX spec §4.1:
 *  "S" = Structured (street + house number + postal code + city)
 *  "K" = Combined (2 free-form address lines)
 */
export type AddressType = 'S' | 'K';

/**
 * Reference type per SIX spec §4.3:
 *  "QRR" = QR-Reference (26 digits + mod-10-recursive check digit = 27 digits)
 *  "SCOR" = Creditor Reference (ISO 11649, starts with "RF")
 *  "NON"  = No reference
 */
export type ReferenceType = 'QRR' | 'SCOR' | 'NON';

/**
 * Swiss QR-Bill Payload — SIX SPC v2.0.0 structure
 *
 * This interface maps 1:1 to the 31 data elements defined in the spec.
 * The `buildSwissQRBillPayload` function serialises them in the exact
 * order required by the standard.
 */
export interface SwissQRBillPayload {
  // Header
  qrType: 'SPC';
  version: '0200';
  coding: '1'; // UTF-8

  // Creditor account (IBAN or QR-IBAN)
  iban: string;

  // Creditor address
  creditorAddressType: AddressType;
  creditorName: string;
  /** Street (type S) or address line 1 (type K) */
  creditorAddressLine1: string;
  /** House number (type S) or address line 2 (type K) */
  creditorAddressLine2: string;
  creditorPostalCode: string;
  creditorCity: string;
  creditorCountry: string; // ISO 3166-1 alpha-2

  // Ultimate creditor (not used — must be empty per SIX spec §4.2)
  // 7 empty lines

  // Amount & currency
  amount: string; // e.g. "1234.56" — empty string = open amount
  currency: 'CHF' | 'EUR';

  // Ultimate debtor
  debtorAddressType: AddressType;
  debtorName: string;
  debtorAddressLine1: string;
  debtorAddressLine2: string;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry: string;

  // Reference
  referenceType: ReferenceType;
  reference: string; // 27-digit QRR or RF… SCOR or empty for NON

  // Additional information
  unstructuredMessage?: string;
  billInformation?: string; // Swico S1 structured info (optional)

  // Alternative procedures (optional, max 2 lines)
  alternativeProcedure1?: string;
  alternativeProcedure2?: string;
}

/**
 * Build Swiss QR-Bill text payload (SPC format)
 *
 * SIX spec v2.3 §4: Data elements separated by line feed (LF = 0x0A).
 * The order of all 31 data elements is fixed and must not be altered.
 */
export function buildSwissQRBillPayload(payload: SwissQRBillPayload): string {
  const lines: string[] = [];

  // ── Header (3 elements) ──────────────────────────────────
  lines.push('SPC');          // 1  QRType
  lines.push('0200');         // 2  Version
  lines.push('1');            // 3  Coding type (1 = UTF-8)

  // ── Creditor account ─────────────────────────────────────
  lines.push(payload.iban);   // 4  Account (IBAN)

  // ── Creditor address (7 elements) ────────────────────────
  lines.push(payload.creditorAddressType);                  // 5  Address type
  lines.push(payload.creditorName);                         // 6  Name
  lines.push(payload.creditorAddressLine1);                 // 7  Street or addr line 1
  lines.push(payload.creditorAddressLine2);                 // 8  House no or addr line 2
  lines.push(payload.creditorPostalCode);                   // 9  Postal code
  lines.push(payload.creditorCity);                         // 10 City
  lines.push(payload.creditorCountry);                      // 11 Country

  // ── Ultimate creditor (7 empty elements — reserved) ──────
  lines.push('');  // 12
  lines.push('');  // 13
  lines.push('');  // 14
  lines.push('');  // 15
  lines.push('');  // 16
  lines.push('');  // 17
  lines.push('');  // 18

  // ── Payment amount (2 elements) ──────────────────────────
  lines.push(payload.amount);    // 19 Amount
  lines.push(payload.currency);  // 20 Currency

  // ── Ultimate debtor address (7 elements) ─────────────────
  lines.push(payload.debtorAddressType);     // 21 Address type
  lines.push(payload.debtorName);            // 22 Name
  lines.push(payload.debtorAddressLine1);    // 23 Street or addr line 1
  lines.push(payload.debtorAddressLine2);    // 24 House no or addr line 2
  lines.push(payload.debtorPostalCode);      // 25 Postal code
  lines.push(payload.debtorCity);            // 26 City
  lines.push(payload.debtorCountry);         // 27 Country

  // ── Reference (2 elements) ───────────────────────────────
  lines.push(payload.referenceType);         // 28 Reference type
  lines.push(payload.reference);             // 29 Reference

  // ── Additional information (2 elements) ──────────────────
  lines.push(payload.unstructuredMessage || '');  // 30 Unstructured message
  lines.push('EPD');                              // 31 Trailer (always "EPD")

  // ── Bill information (optional, after EPD) ───────────────
  if (payload.billInformation) {
    lines.push(payload.billInformation);
  }

  // ── Alternative procedures (optional, max 2) ────────────
  if (payload.alternativeProcedure1) {
    lines.push(payload.alternativeProcedure1);
  }
  if (payload.alternativeProcedure2) {
    lines.push(payload.alternativeProcedure2);
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// QR-Reference (QRR) — mod-10 recursive check digit (ISR)
// ────────────────────────────────────────────────────────────────

/** Mod-10-recursive carry table per Swiss ISR standard */
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

/**
 * Calculate mod-10-recursive check digit for a numeric string.
 * Used by QR-Reference (QRR) and legacy ISR references.
 *
 * Algorithm: iterate each digit through the carry table, then
 * the check digit = (10 - finalCarry) % 10.
 */
export function mod10Recursive(input: string): number {
  let carry = 0;
  for (const ch of input) {
    carry = MOD10_TABLE[(carry + Number(ch)) % 10];
  }
  return (10 - carry) % 10;
}

/**
 * Generate a valid 27-digit QR-Reference (QRR) from an invoice ID
 * and optional invoice number.
 *
 * Structure: 26 payload digits + 1 check digit (mod-10-recursive).
 * The payload is derived from the invoice number (if available)
 * or from the UUID, ensuring deterministic output.
 */
export function generateQRReference(invoiceId: string, invoiceNumber: string | null): string {
  let digits: string;

  if (invoiceNumber) {
    // Extract only digits from invoice number (e.g. "2026-003" → "2026003")
    digits = invoiceNumber.replace(/\D/g, '').padStart(26, '0').slice(-26);
  } else {
    // Derive from UUID: strip hyphens, take first 26 hex chars, convert to decimal-safe
    const hex = invoiceId.replace(/-/g, '').substring(0, 26);
    // Map hex a–f → digits 0–5 so the reference stays numeric
    digits = hex.replace(/[a-f]/gi, (c) => String(parseInt(c, 16) % 10)).padStart(26, '0').slice(-26);
  }

  const checkDigit = mod10Recursive(digits);
  return digits + String(checkDigit);
}

// ────────────────────────────────────────────────────────────────
// IBAN utilities
// ────────────────────────────────────────────────────────────────

/**
 * Check whether an IBAN is a QR-IBAN.
 * QR-IBANs have an IID (Institutional Identification) in range 30000–31999.
 * The IID is at positions 4–8 of the IBAN (0-indexed, after country + check digits).
 */
export function isQrIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!/^(CH|LI)\d{19,21}$/.test(clean)) return false;
  const iid = parseInt(clean.substring(4, 9), 10);
  return iid >= 30000 && iid <= 31999;
}

/**
 * Validate a Swiss/Liechtenstein IBAN (basic format check).
 * Full IBAN validation (mod-97) is intentionally omitted here;
 * the BillingEntity editor should enforce it at data-entry time.
 */
export function isValidSwissIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  return /^(CH|LI)\d{19}$/.test(clean);
}

/**
 * Determine the correct reference type for a given IBAN.
 * QR-IBANs require QRR references; regular IBANs use SCOR or NON.
 */
export function referenceTypeForIban(iban: string): ReferenceType {
  return isQrIban(iban) ? 'QRR' : 'SCOR';
}

// ────────────────────────────────────────────────────────────────
// Creditor Reference (SCOR) — ISO 11649
// ────────────────────────────────────────────────────────────────

/**
 * Generate a Creditor Reference (SCOR / ISO 11649) from an invoice ID.
 *
 * Format: "RF" + 2 check digits + up to 21 alphanumeric reference chars.
 * The check digits are calculated via mod-97 on the reference + "RF00".
 */
export function generateCreditorReference(invoiceId: string, invoiceNumber: string | null): string {
  // Build up to 21-char alphanumeric reference
  let ref: string;
  if (invoiceNumber) {
    ref = invoiceNumber.replace(/\D/g, '').padStart(10, '0').slice(-21);
  } else {
    ref = invoiceId.replace(/-/g, '').substring(0, 21).toUpperCase();
  }

  // ISO 11649 check digit: ref + "RF00", convert letters A=10..Z=35, mod 97
  const numericStr = (ref + 'RF00').split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) return c;           // digit
    if (code >= 65 && code <= 90) return String(code - 55); // A=10..Z=35
    return '';
  }).join('');

  // BigInt mod 97
  const remainder = bigMod97(numericStr);
  const checkDigits = String(98 - remainder).padStart(2, '0');

  return `RF${checkDigits}${ref}`;
}

/** Mod-97 for arbitrarily long numeric strings (ISO 7064) */
function bigMod97(numStr: string): number {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + Number(numStr[i])) % 97;
  }
  return remainder;
}

// ────────────────────────────────────────────────────────────────
// Legacy compatibility wrapper
// ────────────────────────────────────────────────────────────────

/**
 * Generate the appropriate Swiss payment reference for an invoice.
 *
 * @deprecated Use `generateQRReference` or `generateCreditorReference` directly
 *             with `referenceTypeForIban` to pick the right format.
 *
 * This wrapper exists for backward compatibility with `invoiceQRBill.ts`.
 * It defaults to QRR format (27-digit mod-10-recursive reference).
 */
export function generateSwissReference(invoiceId: string, invoiceNumber: string | null): string {
  return generateQRReference(invoiceId, invoiceNumber);
}

// ────────────────────────────────────────────────────────────────
// QR code generation
// ────────────────────────────────────────────────────────────────

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
  return (amountInCents / 100).toFixed(2);
}

// ────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────

/**
 * Validate Swiss QR-bill payload structure per SIX spec
 */
export function validateSwissQRBillPayload(payload: SwissQRBillPayload): boolean {
  const errors: string[] = [];

  if (payload.qrType !== 'SPC') errors.push('Invalid QR type');
  if (payload.version !== '0200') errors.push('Invalid version');
  if (payload.currency !== 'CHF' && payload.currency !== 'EUR') errors.push('Invalid currency');
  if (!isValidSwissIban(payload.iban)) errors.push('Invalid IBAN — must be CH or LI');
  if (!payload.creditorName) errors.push('Missing creditor name');

  // Amount validation: empty (= open amount) or decimal format
  if (payload.amount && !/^\d+\.\d{2}$/.test(payload.amount)) {
    errors.push('Invalid amount format');
  }

  // Reference type / reference consistency
  if (payload.referenceType === 'QRR') {
    if (!isQrIban(payload.iban)) {
      errors.push('QRR reference requires a QR-IBAN (IID 30000–31999)');
    }
    if (!/^\d{27}$/.test(payload.reference)) {
      errors.push('QRR reference must be exactly 27 digits');
    }
  } else if (payload.referenceType === 'SCOR') {
    if (isQrIban(payload.iban)) {
      errors.push('SCOR reference not allowed with QR-IBAN');
    }
    if (!/^RF\d{2}[A-Za-z0-9]{1,21}$/.test(payload.reference)) {
      errors.push('SCOR reference must match RF + 2 check digits + up to 21 chars');
    }
  } else if (payload.referenceType === 'NON') {
    if (payload.reference && payload.reference.trim().length > 0) {
      errors.push('NON reference type must have empty reference');
    }
  }

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
