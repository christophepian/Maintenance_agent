import { z } from "zod";

/**
 * Line item within a quote — each represents a distinct work item or material cost.
 */
export const QuoteLineItemSchema = z.object({
  description: z.string().min(1, "Line item description required"),
  amountCents: z.number().int().min(0, "Line item amount must be non-negative"),
});

/**
 * Zod schema for POST /contractor/rfps/:id/quotes
 *
 * Required: amountCents, workPlan
 * Optional: currency, vatIncluded, estimatedDurationDays, earliestAvailability,
 *           lineItems, assumptions, validUntil, notes
 */
export const SubmitQuoteSchema = z.object({
  amountCents: z.number().int().min(1, "Amount must be at least 1 centime"),
  currency: z.string().min(1).max(3).default("CHF"),
  vatIncluded: z.boolean().default(true),
  estimatedDurationDays: z.number().int().min(1).optional(),
  earliestAvailability: z
    .string()
    .datetime({ message: "earliestAvailability must be ISO 8601" })
    .optional(),
  lineItems: z.array(QuoteLineItemSchema).optional(),
  workPlan: z.string().min(1, "Work plan is required"),
  assumptions: z.string().optional(),
  validUntil: z
    .string()
    .datetime({ message: "validUntil must be ISO 8601" })
    .optional(),
  notes: z.string().optional(),
});

export type SubmitQuoteInput = z.infer<typeof SubmitQuoteSchema>;
