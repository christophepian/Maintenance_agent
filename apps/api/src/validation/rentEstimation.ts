import { z } from "zod";
import { LocationSegment, InsulationQuality, EnergyLabel, HeatingType } from "@prisma/client";

/* ── Config Upsert Schema ─────────────────────────────────── */

const coefRange = z.number().min(0.5).max(2.5);
const rateRange = z.number().min(0).max(1);

export const UpsertRentEstimationConfigSchema = z.object({
  baseRentPerSqmChfMonthly: z.number().positive().max(200).optional(),

  locationCoefPrime: coefRange.optional(),
  locationCoefStandard: coefRange.optional(),
  locationCoefPeriphery: coefRange.optional(),

  ageCoefNew: coefRange.optional(),
  ageCoefMid: coefRange.optional(),
  ageCoefOld: coefRange.optional(),
  ageCoefVeryOld: coefRange.optional(),

  energyCoefJson: z.record(z.string(), z.number().min(0.5).max(1.5)).optional(),

  chargesBaseOptimistic: rateRange.optional(),
  chargesBasePessimistic: rateRange.optional(),
  heatingChargeAdjJson: z.record(z.string(), z.number().min(-0.1).max(0.1)).optional(),
  serviceChargeAdjElevator: rateRange.optional(),
  serviceChargeAdjConcierge: rateRange.optional(),
  chargesMinClamp: rateRange.optional(),
  chargesMaxClamp: rateRange.optional(),
});

export type UpsertRentEstimationConfigInput = z.infer<typeof UpsertRentEstimationConfigSchema>;

/* ── Bulk Estimate Schema ─────────────────────────────────── */

export const BulkEstimateSchema = z.object({
  unitIds: z.array(z.string().uuid()).optional(),
  buildingId: z.string().uuid().optional(),
}).refine(
  (d) => d.unitIds?.length || d.buildingId,
  { message: "Provide unitIds or buildingId" },
);

export type BulkEstimateInput = z.infer<typeof BulkEstimateSchema>;

/* ── Extended Unit Update Fields (for inventory PATCH) ───── */

const currentYear = new Date().getFullYear();

export const RentEstimationUnitFieldsSchema = z.object({
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
});

export type RentEstimationUnitFields = z.infer<typeof RentEstimationUnitFieldsSchema>;

/* ── Extended Building Update Fields ─────────────────────── */

export const RentEstimationBuildingFieldsSchema = z.object({
  yearBuilt: z.number().int().min(1800).max(currentYear + 1).optional(),
  hasElevator: z.boolean().optional(),
  hasConcierge: z.boolean().optional(),
});

export type RentEstimationBuildingFields = z.infer<typeof RentEstimationBuildingFieldsSchema>;
