import { z } from "zod";

export const LinkTenantSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
  })
  .refine((data) => data.tenantId || data.phone, {
    message: "tenantId or phone is required",
  });

export type LinkTenantInput = z.infer<typeof LinkTenantSchema>;
