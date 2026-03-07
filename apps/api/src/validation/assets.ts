import { z } from "zod";

const ASSET_TYPES = ["APPLIANCE", "FIXTURE", "FINISH", "STRUCTURAL", "SYSTEM", "OTHER"] as const;
const INTERVENTION_TYPES = ["REPAIR", "REPLACEMENT"] as const;

export const UpsertAssetSchema = z.object({
  unitId: z.string().uuid("unitId must be a UUID"),
  type: z.enum(ASSET_TYPES),
  topic: z.string().min(1, "topic is required").max(200),
  name: z.string().min(1, "name is required").max(200),
  assetModelId: z.string().uuid().optional(),
  installedAt: z.string().optional(),
  lastRenovatedAt: z.string().optional(),
  replacedAt: z.string().optional(),
  brand: z.string().max(200).optional(),
  modelNumber: z.string().max(200).optional(),
  serialNumber: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isPresent: z.boolean().optional(),
});

export const AddInterventionSchema = z.object({
  type: z.enum(INTERVENTION_TYPES),
  interventionDate: z.string().min(1, "interventionDate is required"),
  costChf: z.number().min(0).optional(),
  jobId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export type UpsertAssetInput = z.infer<typeof UpsertAssetSchema>;
export type AddInterventionInput = z.infer<typeof AddInterventionSchema>;
