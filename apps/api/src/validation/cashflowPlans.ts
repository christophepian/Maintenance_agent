import { z } from "zod";

const NpvAssumptionsSchema = z.object({
  discountRatePct:  z.number().min(0).max(30).optional(),
  capRatePct:       z.number().min(0).max(30).optional(),
  deferYears:       z.number().int().min(1).max(10).optional(),
  propertyValueChf: z.number().min(0).optional().nullable(),
});

export const CreateCashflowPlanSchema = z.object({
  name: z.string().min(1, "name is required"),
  buildingId: z.string().uuid().optional().nullable(),
  incomeGrowthRatePct: z.number().min(-100).max(100).optional(),
  openingBalanceCents: z.number().int().optional().nullable(),
  horizonMonths: z.number().int().min(12).max(120).optional(),
}).merge(NpvAssumptionsSchema);

export const UpdateCashflowPlanSchema = z.object({
  name: z.string().min(1).optional(),
  incomeGrowthRatePct: z.number().min(-100).max(100).optional(),
  openingBalanceCents: z.number().int().optional().nullable(),
}).merge(NpvAssumptionsSchema);

export const AddOverrideSchema = z.object({
  assetId: z.string().min(1, "assetId is required"),
  originalYear: z.number().int().min(2000).max(2100),
  overriddenYear: z.number().int().min(2000).max(2100),
});

export type CreateCashflowPlanInput = z.infer<typeof CreateCashflowPlanSchema>;
export type UpdateCashflowPlanInput = z.infer<typeof UpdateCashflowPlanSchema>;
export type AddOverrideInput = z.infer<typeof AddOverrideSchema>;
