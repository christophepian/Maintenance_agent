import { z } from "zod";

export const CreateCashflowPlanSchema = z.object({
  name: z.string().min(1, "name is required"),
  buildingId: z.string().uuid().optional().nullable(),
  incomeGrowthRatePct: z.number().min(-100).max(100).optional(),
  openingBalanceCents: z.number().int().optional().nullable(),
  horizonMonths: z.number().int().min(12).max(120).optional(),
});

export const UpdateCashflowPlanSchema = z.object({
  name: z.string().min(1).optional(),
  incomeGrowthRatePct: z.number().min(-100).max(100).optional(),
  openingBalanceCents: z.number().int().optional().nullable(),
});

export const AddOverrideSchema = z.object({
  assetId: z.string().min(1, "assetId is required"),
  originalYear: z.number().int().min(2000).max(2100),
  overriddenYear: z.number().int().min(2000).max(2100),
});

export type CreateCashflowPlanInput = z.infer<typeof CreateCashflowPlanSchema>;
export type UpdateCashflowPlanInput = z.infer<typeof UpdateCashflowPlanSchema>;
export type AddOverrideInput = z.infer<typeof AddOverrideSchema>;
