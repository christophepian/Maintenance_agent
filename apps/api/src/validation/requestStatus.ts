import { z } from "zod";

export const UpdateRequestStatusSchema = z.object({
  status: z.enum(["APPROVED"]),
});

export type UpdateRequestStatusInput = z.infer<typeof UpdateRequestStatusSchema>;
