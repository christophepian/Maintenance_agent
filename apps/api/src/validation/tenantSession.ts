import { z } from "zod";

export const TenantSessionSchema = z.object({
  phone: z.string().min(6, { message: "phone is required" }),
});

export type TenantSessionInput = z.infer<typeof TenantSessionSchema>;
