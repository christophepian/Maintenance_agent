import { z } from "zod";

const AmortizationTypeSchema = z.enum(["INTEREST_ONLY", "LINEAR", "ANNUITY"]);

// ISO date string → accepted as optional/nullable
const dateString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const CreateMortgageSchema = z.object({
  lenderName: z.string().max(200).optional().nullable(),
  originalPrincipalChf: z.number().min(0),
  currentBalanceChf: z.number().min(0),
  interestRatePct: z.number().min(0).max(20),
  amortizationType: AmortizationTypeSchema.default("ANNUITY"),
  annualAmortizationChf: z.number().min(0).optional().nullable(),
  startDate: dateString.optional().nullable(),
  fixedUntil: dateString.optional().nullable(),
  maturityDate: dateString.optional().nullable(),
});

export const UpdateMortgageSchema = CreateMortgageSchema.partial();

export const UpdateValuationSchema = z.object({
  marketValueChf: z.number().min(0).optional().nullable(),
});

export type CreateMortgageInput = z.infer<typeof CreateMortgageSchema>;
export type UpdateMortgageInput = z.infer<typeof UpdateMortgageSchema>;
