import { z } from "zod";

const billability = z.enum(["BILLABLE", "NON_BILLABLE"]);
const distributionKey = z.enum([
  "SURFACE_AREA",
  "UNIT_COUNT",
  "CONSUMPTION",
  "OCCUPANT_COUNT",
  "FIXED_SHARE",
]);

export const CreateAncillaryCostCategorySchema = z.object({
  code: z.string().min(1, "code is required").max(64),
  name: z.string().min(1, "name is required"),
  billability: billability.optional(),
  defaultKey: distributionKey.optional(),
  isAdminFee: z.boolean().optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
});

export const UpdateAncillaryCostCategorySchema = z.object({
  name: z.string().min(1).optional(),
  billability: billability.optional(),
  defaultKey: distributionKey.optional(),
  isAdminFee: z.boolean().optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateAncillaryCostCategoryPayload = z.infer<typeof CreateAncillaryCostCategorySchema>;
export type UpdateAncillaryCostCategoryPayload = z.infer<typeof UpdateAncillaryCostCategorySchema>;
