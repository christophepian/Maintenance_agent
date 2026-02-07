import { z } from "zod";
import { UnitType } from "@prisma/client";

export const CreateUnitSchema = z.object({
  unitNumber: z.string().min(1, "unitNumber is required"),
  floor: z.string().optional(),
  type: z.nativeEnum(UnitType).optional(),
});

export const UpdateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  floor: z.string().optional(),
  type: z.nativeEnum(UnitType).optional(),
});

export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;
