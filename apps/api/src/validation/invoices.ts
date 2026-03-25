import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';

export const InvoiceStatusEnum = z.enum([
  InvoiceStatus.DRAFT,
  InvoiceStatus.APPROVED,
  InvoiceStatus.PAID,
  InvoiceStatus.DISPUTED,
]);

const LineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).max(100000), // CHF
  vatRate: z.number().min(0).max(100).optional(),
});

export const CreateInvoiceSchema = z
  .object({
    jobId: z.string().uuid('Invalid job ID'),
    amount: z.number().min(0).max(100000).optional(),
    description: z.string().max(500).optional(),
    issuerBillingEntityId: z.string().uuid().optional(),
    recipientName: z.string().min(1).optional(),
    recipientAddressLine1: z.string().min(1).optional(),
    recipientAddressLine2: z.string().optional(),
    recipientPostalCode: z.string().min(1).optional(),
    recipientCity: z.string().min(1).optional(),
    recipientCountry: z.string().min(1).optional(),
    issueDate: z.string().datetime().optional(),
    dueDate: z.string().datetime().optional(),
    vatRate: z.number().min(0).max(100).optional(),
    expenseTypeId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
    lineItems: z.array(LineItemSchema).optional(),
  })
  .refine((data) => data.amount !== undefined || (data.lineItems && data.lineItems.length > 0), {
    message: 'Either amount or lineItems must be provided',
    path: ['amount'],
  });

export const UpdateInvoiceSchema = z.object({
  status: InvoiceStatusEnum.optional(),
  amount: z.number().min(0).max(100000).optional(),
  description: z.string().max(500).optional(),
  issuerBillingEntityId: z.string().uuid().nullable().optional(),
  recipientName: z.string().min(1).optional(),
  recipientAddressLine1: z.string().min(1).optional(),
  recipientAddressLine2: z.string().nullable().optional(),
  recipientPostalCode: z.string().min(1).optional(),
  recipientCity: z.string().min(1).optional(),
  recipientCountry: z.string().min(1).optional(),
  issueDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  lineItems: z.array(LineItemSchema).optional(),
});

export type CreateInvoicePayload = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoicePayload = z.infer<typeof UpdateInvoiceSchema>;
