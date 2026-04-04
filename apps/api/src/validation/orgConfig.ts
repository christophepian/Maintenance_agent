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
  invoiceLeadTimeDays: z
    .number()
    .int()
    .min(1, { message: "invoiceLeadTimeDays must be >= 1" })
    .max(60, { message: "invoiceLeadTimeDays must be <= 60" })
    .optional(),
  mode: OrgModeSchema.optional(),
});

export type UpdateOrgConfigInput = z.infer<typeof UpdateOrgConfigSchema>;
