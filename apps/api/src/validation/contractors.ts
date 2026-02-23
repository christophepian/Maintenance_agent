import { z } from "zod";
import { ALLOWED_CATEGORIES } from "./categories";

export const CreateContractorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,}$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  addressLine1: z.string().min(2, "Address line 1 is required").optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().min(2, "Postal code is required").optional(),
  city: z.string().min(2, "City is required").optional(),
  country: z.string().min(2).optional(),
  iban: z.string().min(10, "IBAN must be at least 10 characters").optional(),
  vatNumber: z.string().optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  hourlyRate: z.number().int().min(10).max(500).optional(),
  serviceCategories: z
    .array(z.enum(ALLOWED_CATEGORIES))
    .min(1, "Must select at least one service category"),
});

export const UpdateContractorSchema = CreateContractorSchema.partial();

export type CreateContractorInput = z.infer<typeof CreateContractorSchema>;
export type UpdateContractorInput = z.infer<typeof UpdateContractorSchema>;
