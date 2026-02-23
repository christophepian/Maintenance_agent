import { z } from 'zod';

export const SwissQRBillPayloadSchema = z.object({
  qrType: z.literal('SPC').describe('Swiss Payment Code'),
  version: z.literal('0200').describe('SPC version'),
  coding: z.literal('1').describe('UTF-8 coding'),
  amount: z
    .string()
    .regex(/^\d+\.\d{2}$/, 'Amount must be in format XXXX.XX (CHF)')
    .describe('CHF amount in decimal format'),
  currency: z.literal('CHF'),
  creditorName: z.string().min(1).max(70),
  creditorAddressLine1: z.string().min(1).max(70),
  creditorAddressLine2: z.string().max(70).optional(),
  creditorPostalCode: z.string().min(1).max(16),
  creditorCity: z.string().min(1).max(35),
  creditorCountry: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 country code'),
  iban: z
    .string()
    .regex(/^CH\d{21}$/, 'IBAN must be Swiss format (CHxxxxxxxxxxxxxxxxxx)'),
  reference: z.string().max(27).describe('Structured reference (QRF/ISR)'),
  unstructuredMessage: z.string().max(140).optional(),
  trailerElement: z.string().optional().default('EPD'),
  debtorName: z.string().min(1).max(70),
  debtorAddressLine1: z.string().min(1).max(70),
  debtorAddressLine2: z.string().max(70).optional(),
  debtorPostalCode: z.string().min(1).max(16),
  debtorCity: z.string().min(1).max(35),
  debtorCountry: z.string().length(2).regex(/^[A-Z]{2}$/),
});

export type SwissQRBillPayloadInput = z.infer<typeof SwissQRBillPayloadSchema>;

export const GetQRBillSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  orgId: z.string().uuid('Invalid org ID'),
});

export type GetQRBillInput = z.infer<typeof GetQRBillSchema>;
