import { z } from "zod";

export const OrgModeSchema = z.enum(["MANAGED", "OWNER_DIRECT"]);

export const UpdateOrgConfigSchema = z.object({
  autoApproveLimit: z
    .number()
    .int()
    .min(0, { message: "autoApproveLimit must be >= 0" })
    .max(100000, { message: "autoApproveLimit must be <= 100000" })
    .optional(),
  autoLegalRouting: z.boolean().optional(),
  mode: OrgModeSchema.optional(),
});

export type UpdateOrgConfigInput = z.infer<typeof UpdateOrgConfigSchema>;
