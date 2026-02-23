import { z } from "zod";

export const UnitConfigSchema = z.object({
  autoApproveLimit: z
    .number()
    .int()
    .min(0, { message: "autoApproveLimit must be >= 0" })
    .max(100000, { message: "autoApproveLimit must be <= 100000" })
    .nullable()
    .optional(),
  emergencyAutoDispatch: z.boolean().nullable().optional(),
  requireOwnerApprovalAbove: z
    .number()
    .int()
    .min(0, { message: "requireOwnerApprovalAbove must be >= 0" })
    .max(100000, { message: "requireOwnerApprovalAbove must be <= 100000" })
    .nullable()
    .optional(),
});

export type UnitConfigInput = z.infer<typeof UnitConfigSchema>;
