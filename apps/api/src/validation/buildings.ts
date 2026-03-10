import { z } from "zod";

const currentYear = new Date().getFullYear();

export const CreateBuildingSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().optional(),
});

export const UpdateBuildingSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),

  // Rent estimation fields
  yearBuilt: z.number().int().min(1800).max(currentYear + 1).optional(),
  hasElevator: z.boolean().optional(),
  hasConcierge: z.boolean().optional(),

  // Management
  managedSince: z.string().datetime().optional().nullable(),
});

export type CreateBuildingInput = z.infer<typeof CreateBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof UpdateBuildingSchema>;
