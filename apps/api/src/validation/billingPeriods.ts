import { z } from "zod";

export const CreateBillingPeriodSchema = z.object({
  buildingId: z.string().uuid(),
  startDate: z.string().min(8), // ISO date
  endDate: z.string().min(8),
  adminFeeRatePermille: z.number().int().min(0).max(30).optional(), // cap 3%
});

export const UpdateBillingPeriodSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  adminFeeRatePermille: z.number().int().min(0).max(30).optional(),
});

export const CreateCostEntrySchema = z.object({
  categoryId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  sourceInvoiceId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export type CreateBillingPeriodPayload = z.infer<typeof CreateBillingPeriodSchema>;
export type UpdateBillingPeriodPayload = z.infer<typeof UpdateBillingPeriodSchema>;
export type CreateCostEntryPayload = z.infer<typeof CreateCostEntrySchema>;
