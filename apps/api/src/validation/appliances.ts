import { z } from "zod";

export const CreateApplianceSchema = z.object({
  name: z.string().min(1, "name is required"),
  category: z.string().optional(),
  assetModelId: z.string().uuid().optional(),
  serial: z.string().optional(),
  installDate: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateApplianceSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  assetModelId: z.string().uuid().optional(),
  serial: z.string().optional(),
  installDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateApplianceInput = z.infer<typeof CreateApplianceSchema>;
export type UpdateApplianceInput = z.infer<typeof UpdateApplianceSchema>;
