import { z } from "zod";

export const TriageSchema = z.object({
  unitId: z.string().uuid(),
  message: z.string().min(3, { message: "message is required" }),
});

export type TriageInput = z.infer<typeof TriageSchema>;
