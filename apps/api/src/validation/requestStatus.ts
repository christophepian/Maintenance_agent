import { z } from "zod";

// Manager-facing: only APPROVED routes through approveRequestWorkflow.
// Contractor-initiated IN_PROGRESS/COMPLETED go through the job endpoint.
export const UpdateRequestStatusSchema = z.object({
  status: z.enum(["APPROVED"]),
});

export type UpdateRequestStatusInput = z.infer<typeof UpdateRequestStatusSchema>;
