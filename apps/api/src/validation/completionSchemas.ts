/**
 * Completion & Rating validation schemas — Slice 7: job-completion-ratings
 *
 * Zod schemas for:
 *   - Contractor marking a job complete
 *   - Tenant/Contractor submitting a rating
 */

import { z } from "zod";

// ─── Contractor completion ─────────────────────────────────────

export const ContractorCompleteSchema = z.object({
  actualCost: z.number().int().min(0).optional(),
  completedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export type ContractorCompleteInput = z.infer<typeof ContractorCompleteSchema>;

// ─── Rating submission ─────────────────────────────────────────

export const SubmitRatingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;
