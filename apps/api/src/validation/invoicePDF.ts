import { z } from 'zod';

export const GetInvoicePDFSchema = z.object({
  invoiceId: z.string().uuid(),
  orgId: z.string().uuid(),
  includeQRBill: z.boolean().optional().default(true),
});

export type GetInvoicePDFRequest = z.infer<typeof GetInvoicePDFSchema>;
