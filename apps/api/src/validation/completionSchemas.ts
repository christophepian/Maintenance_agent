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
  /**
   * Required when the request has a linked asset (Request.assetId is set).
   * Declares whether the intervention was a repair or a full replacement.
   * Used to auto-log an AssetIntervention on job completion.
   */
  interventionType: z.enum(["REPAIR", "REPLACEMENT"]).optional(),
});

export type ContractorCompleteInput = z.infer<typeof ContractorCompleteSchema>;

// ─── Rating submission ─────────────────────────────────────────

const criterionScore = () => z.number().int().min(1).max(5);

export const SubmitRatingSchema = z
  .object({
    // Per-criteria scores (preferred from UI — 3 placeholder criteria)
    scorePunctuality: criterionScore().optional(),
    scoreAccuracy:    criterionScore().optional(),
    scoreCourtesy:    criterionScore().optional(),
    // Overall score: required if criteria absent; auto-computed as average otherwise
    score:   z.number().int().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  })
  .refine(
    (d) =>
      d.score != null ||
      (d.scorePunctuality != null && d.scoreAccuracy != null && d.scoreCourtesy != null),
    { message: "Provide either score or all three criteria scores" },
  );

export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;
