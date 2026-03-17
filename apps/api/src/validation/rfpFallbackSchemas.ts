import { z } from "zod";

/**
 * Zod schema for POST /rfps/:id/reinvite
 *
 * Required: contractorIds — array of contractor UUIDs to invite
 */
export const ReinviteContractorsSchema = z.object({
  contractorIds: z
    .array(z.string().uuid("Each contractor ID must be a valid UUID"))
    .min(1, "At least one contractor ID is required")
    .max(20, "Cannot invite more than 20 contractors at once"),
});

export type ReinviteContractorsInput = z.infer<typeof ReinviteContractorsSchema>;

/**
 * Zod schema for POST /rfps/:id/direct-assign
 *
 * Required: contractorId — the contractor to assign directly
 */
export const DirectAssignContractorSchema = z.object({
  contractorId: z.string().uuid("contractorId must be a valid UUID"),
});

export type DirectAssignContractorInput = z.infer<typeof DirectAssignContractorSchema>;
