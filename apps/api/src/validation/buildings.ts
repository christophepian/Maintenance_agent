import { z } from "zod";

export const CreateBuildingSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().optional(),
});

export const UpdateBuildingSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
});

export type CreateBuildingInput = z.infer<typeof CreateBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof UpdateBuildingSchema>;
