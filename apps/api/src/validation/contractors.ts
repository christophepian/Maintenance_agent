import { z } from "zod";

const ALLOWED_CATEGORIES = ["stove", "oven", "dishwasher", "bathroom", "lighting"] as const;

export const CreateContractorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,}$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  hourlyRate: z.number().int().min(10).max(500).optional(),
  serviceCategories: z
    .array(z.enum(ALLOWED_CATEGORIES))
    .min(1, "Must select at least one service category"),
});

export const UpdateContractorSchema = CreateContractorSchema.partial();

export type CreateContractorInput = z.infer<typeof CreateContractorSchema>;
export type UpdateContractorInput = z.infer<typeof UpdateContractorSchema>;
