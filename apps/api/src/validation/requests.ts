import { z } from "zod";

export const ALLOWED_CATEGORIES = ["stove", "oven", "dishwasher", "bathroom", "lighting"] as const;

function normalizeDescription(s: string) {
  return (s || "").trim().replace(/\s+/g, " ");
}

export const CreateRequestSchema = z.object({
  description: z
    .string()
    .transform((s) => normalizeDescription(s))
    .refine((s) => s.length >= 10, { message: "description must be at least 10 characters" })
    .refine((s) => s.length <= 2000, { message: "description must be at most 2000 characters" })
    .refine((s) => /[A-Za-z0-9À-ÖØ-öø-ÿ]/.test(s), { message: "description must contain meaningful text" }),

  category: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => (s.length === 0 ? false : true), { message: "category cannot be empty" })
    .refine((s) => ALLOWED_CATEGORIES.includes(s as any), {
      message: `Invalid option: expected one of ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join("|")}`,
    })
    .optional(),

  // NEW (optional for backwards compatibility)
  estimatedCost: z
    .number()
    .int()
    .min(0, { message: "estimatedCost must be >= 0" })
    .max(100000, { message: "estimatedCost must be <= 100000" })
    .optional(),

  // legacy support
  text: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;
