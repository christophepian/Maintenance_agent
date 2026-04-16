import { z } from 'zod';

/**
 * Validation schema for Swiss QR-Bill payload — SIX spec v2.3
 */
export const SwissQRBillPayloadSchema = z.object({
  qrType: z.literal('SPC'),
  version: z.literal('0200'),
  coding: z.literal('1'),

  // Creditor account
  iban: z
    .string()
    .regex(/^(CH|LI)\d{19}$/, 'IBAN must be Swiss or Liechtenstein format'),

  // Creditor address
  creditorAddressType: z.enum(['S', 'K']),
  creditorName: z.string().min(1).max(70),
  creditorAddressLine1: z.string().max(70),
  creditorAddressLine2: z.string().max(70),
  creditorPostalCode: z.string().max(16),
  creditorCity: z.string().max(35),
  creditorCountry: z.string().length(2).regex(/^[A-Z]{2}$/),

  // Amount
  amount: z
    .string()
    .regex(/^(\d+\.\d{2})?$/, 'Amount must be decimal format or empty (open amount)'),
  currency: z.enum(['CHF', 'EUR']),

  // Debtor address
  debtorAddressType: z.enum(['S', 'K']),
  debtorName: z.string().min(1).max(70),
  debtorAddressLine1: z.string().max(70),
  debtorAddressLine2: z.string().max(70),
  debtorPostalCode: z.string().max(16),
  debtorCity: z.string().max(35),
  debtorCountry: z.string().length(2).regex(/^[A-Z]{2}$/),

  // Reference
  referenceType: z.enum(['QRR', 'SCOR', 'NON']),
  reference: z.string().max(27),

  // Additional info
  unstructuredMessage: z.string().max(140).optional(),
  billInformation: z.string().max(140).optional(),
  alternativeProcedure1: z.string().max(100).optional(),
  alternativeProcedure2: z.string().max(100).optional(),
});

export type SwissQRBillPayloadInput = z.infer<typeof SwissQRBillPayloadSchema>;

export const GetQRBillSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  orgId: z.string().uuid('Invalid org ID'),
});

export type GetQRBillInput = z.infer<typeof GetQRBillSchema>;
