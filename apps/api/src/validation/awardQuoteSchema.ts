import { z } from "zod";

/**
 * Zod schema for POST /rfps/:id/award
 *
 * Required: quoteId — the ID of the quote being awarded
 */
export const AwardQuoteSchema = z.object({
  quoteId: z.string().uuid("quoteId must be a valid UUID"),
});

export type AwardQuoteInput = z.infer<typeof AwardQuoteSchema>;
