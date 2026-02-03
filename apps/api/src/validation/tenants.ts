import { z } from "zod";
import { isValidE164 } from "../utils/phoneNormalization";

/**
 * Validation schemas for Tenant operations
 */

export const createTenantSchema = z.object({
  orgId: z.string().min(1, "Invalid org ID"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine(isValidE164, "Invalid phone format. Must be E.164 format (+41...)"),
  name: z.string().optional().default(""),
  email: z.string().email().optional(),
  unitId: z.string().uuid().optional(),
});

export const getTenantByPhoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine(isValidE164, "Invalid phone format. Must be E.164 format (+41...)"),
  orgId: z.string().min(1, "Invalid org ID"),
});

export const updateTenantSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  unitId: z.string().uuid().optional(),
});

// Type exports for use in services
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type GetTenantByPhoneInput = z.infer<typeof getTenantByPhoneSchema>;
