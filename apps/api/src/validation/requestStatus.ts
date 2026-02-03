import { z } from "zod";

export const UpdateRequestStatusSchema = z.object({
  status: z.enum(["APPROVED", "IN_PROGRESS", "COMPLETED"]),
});

export type UpdateRequestStatusInput = z.infer<typeof UpdateRequestStatusSchema>;
