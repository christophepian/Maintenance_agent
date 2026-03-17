/**
 * Validation schemas for Slice 6: Scheduling Handshake
 *
 * Zod schemas for contractor slot proposals and tenant responses.
 */

import { z } from "zod";

/** A single proposed appointment slot. */
const SlotProposalItem = z.object({
  startTime: z
    .string()
    .datetime({ message: "startTime must be ISO 8601" }),
  endTime: z
    .string()
    .datetime({ message: "endTime must be ISO 8601" }),
}).refine(
  (s) => new Date(s.endTime) > new Date(s.startTime),
  { message: "endTime must be after startTime" },
);

/**
 * POST /contractor/jobs/:id/slots
 *
 * Contractor proposes 1–5 appointment slots for a job.
 */
export const ProposeSlotsSchema = z.object({
  slots: z
    .array(SlotProposalItem)
    .min(1, "At least one slot must be proposed")
    .max(5, "No more than 5 slots at a time"),
});

export type ProposeSlotsInput = z.infer<typeof ProposeSlotsSchema>;
