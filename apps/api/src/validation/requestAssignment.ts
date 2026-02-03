import { z } from "zod";

export const AssignContractorSchema = z.object({
  contractorId: z.string().uuid("Invalid contractor ID"),
});

export type AssignContractorInput = z.infer<typeof AssignContractorSchema>;
