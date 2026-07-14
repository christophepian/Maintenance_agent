import { z } from "zod";

const currentYear = new Date().getFullYear();

export const CreateBuildingSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
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

  // House rules
  houseRulesText: z.string().optional().nullable(),

  // Cadastral / legal
  parcelNumber: z.string().optional().nullable(),
  easementsText: z.string().optional().nullable(),

  // Physical dimensions
  ecaVolumeM3: z.number().nonnegative().optional().nullable(),
  netAreaSqm: z.number().nonnegative().optional().nullable(),
  weightedAreaSqm: z.number().nonnegative().optional().nullable(),

  // Lot counts
  lotsApartments: z.number().int().min(0).optional().nullable(),
  lotsGarages: z.number().int().min(0).optional().nullable(),
  lotsExteriorParking: z.number().int().min(0).optional().nullable(),

  // Build / renovation dates
  constructionDate: z.string().datetime().optional().nullable(),
  lastRenovationDate: z.string().datetime().optional().nullable(),

  // Valuations, CHF
  fiscalValueChf: z.number().nonnegative().optional().nullable(),
  insuranceValueChf: z.number().nonnegative().optional().nullable(),
  ppeEstimateChf: z.number().nonnegative().optional().nullable(),
});

export const UpsertMarketPriceSchema = z.object({
  postalCode: z.string().min(1, "postalCode is required"),
  city: z.string().optional().nullable(),
  pricePerSqmChf: z.number().nonnegative(),
  source: z.string().optional().nullable(),
  asOf: z.string().datetime().optional().nullable(),
});

export type CreateBuildingInput = z.infer<typeof CreateBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof UpdateBuildingSchema>;
export type UpsertMarketPriceInput = z.infer<typeof UpsertMarketPriceSchema>;
