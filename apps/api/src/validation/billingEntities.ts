import { z } from "zod";

const BillingEntityTypeEnum = z.enum(["CONTRACTOR", "ORG", "OWNER"]);

const IbanSchema = z.string().min(10, "IBAN must be at least 10 characters");

export const CreateBillingEntitySchema = z.object({
  type: BillingEntityTypeEnum,
  contractorId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  addressLine1: z.string().min(2, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  postalCode: z.string().min(2, "Postal code is required"),
  city: z.string().min(2, "City is required"),
  country: z.string().min(2).optional().default("CH"),
  iban: IbanSchema,
  vatNumber: z.string().optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
});

export const UpdateBillingEntitySchema = z.object({
  contractorId: z.string().uuid().optional().nullable(),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  addressLine1: z.string().min(2, "Address line 1 is required").optional(),
  addressLine2: z.string().optional().nullable(),
  postalCode: z.string().min(2, "Postal code is required").optional(),
  city: z.string().min(2, "City is required").optional(),
  country: z.string().min(2).optional(),
  iban: IbanSchema.optional(),
  vatNumber: z.string().optional().nullable(),
  defaultVatRate: z.number().min(0).max(100).optional(),
});

export type CreateBillingEntityInput = z.infer<typeof CreateBillingEntitySchema>;
export type UpdateBillingEntityInput = z.infer<typeof UpdateBillingEntitySchema>;
