import { z } from "zod";

export const CreateAssetModelSchema = z.object({
  name: z.string().min(1, "name is required"),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  specs: z.string().optional(),
});

export const UpdateAssetModelSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  specs: z.string().optional(),
});

export type CreateAssetModelInput = z.infer<typeof CreateAssetModelSchema>;
export type UpdateAssetModelInput = z.infer<typeof UpdateAssetModelSchema>;
