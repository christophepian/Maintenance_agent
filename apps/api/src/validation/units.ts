import { z } from "zod";
import { UnitType, LocationSegment, InsulationQuality, EnergyLabel, HeatingType } from "@prisma/client";

const currentYear = new Date().getFullYear();

export const CreateUnitSchema = z.object({
  unitNumber: z.string().min(1, "unitNumber is required"),
  floor: z.string().optional(),
  type: z.nativeEnum(UnitType).optional(),
});

export const UpdateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  floor: z.string().optional(),
  type: z.nativeEnum(UnitType).optional(),

  // Rent estimation fields
  livingAreaSqm: z.number().min(5).max(1000).optional(),
  rooms: z.number().min(0.5).max(20).optional(),
  hasBalcony: z.boolean().optional(),
  hasTerrace: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  locationSegment: z.nativeEnum(LocationSegment).optional(),
  lastRenovationYear: z.number().int().min(1800).max(currentYear + 1).optional(),
  insulationQuality: z.nativeEnum(InsulationQuality).optional(),
  energyLabel: z.nativeEnum(EnergyLabel).optional(),
  heatingType: z.nativeEnum(HeatingType).optional(),

  // Pricing
  monthlyRentChf: z.number().int().min(0).max(100000).nullable().optional(),
  monthlyChargesChf: z.number().int().min(0).max(50000).nullable().optional(),
});

export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;
