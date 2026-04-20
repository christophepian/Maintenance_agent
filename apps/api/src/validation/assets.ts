import { z } from "zod";
import { isModelEligible } from "../repositories/assetRepository";
import { normalizeTopicKey } from "../utils/topicKey";

const ASSET_TYPES = ["APPLIANCE", "FIXTURE", "FINISH", "STRUCTURAL", "SYSTEM", "OTHER"] as const;
const INTERVENTION_TYPES = ["REPAIR", "REPLACEMENT"] as const;

/**
 * Model-related fields (assetModelId, brand, modelNumber, serialNumber) are only
 * meaningful for model-eligible asset types (EQUIPMENT category: APPLIANCE, FIXTURE, OTHER).
 * Generic components like walls, floors, ceilings, and building systems (HVAC, plumbing)
 * are not model-driven by default — they lack a specific manufacturer/model identity.
 */
export const UpsertAssetSchema = z.object({
  unitId: z.string().uuid("unitId must be a UUID"),
  type: z.enum(ASSET_TYPES),
  // topic is the PRIMARY depreciation key — normalize to canonical form
  // so that "Kitchen", "kitchen", and " kitchen " all resolve identically.
  topic: z.string().min(1, "topic is required").max(200).transform(normalizeTopicKey),
  name: z.string().min(1, "name is required").max(200),
  assetModelId: z.string().uuid().optional(),
  installedAt: z.string().optional(),
  lastRenovatedAt: z.string().optional(),
  replacedAt: z.string().optional(),
  brand: z.string().max(200).optional(),
  modelNumber: z.string().max(200).optional(),
  serialNumber: z.string().max(200).optional(),
  usefulLifeOverrideMonths: z.number().int().min(1).optional(),
  notes: z.string().max(2000).optional(),
  isPresent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  // Reject assetModelId for non-model-eligible types (FINISH, STRUCTURAL, SYSTEM).
  // Brand/modelNumber/serialNumber are allowed as free-text metadata even for components.
  if (data.assetModelId && !isModelEligible(data.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assetModelId"],
      message: `Asset model assignment is not supported for type "${data.type}". Only equipment types (APPLIANCE, FIXTURE, OTHER) can be linked to an asset model.`,
    });
  }
});

export const AddInterventionSchema = z.object({
  type: z.enum(INTERVENTION_TYPES),
  interventionDate: z.string().min(1, "interventionDate is required"),
  costChf: z.number().min(0).optional(),
  jobId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Partial update schema for PATCH /assets/:id.
 * topic and type are intentionally excluded — they are immutable after creation.
 */
export const PatchAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  installedAt: z.string().optional().nullable(),
  lastRenovatedAt: z.string().optional().nullable(),
  replacedAt: z.string().optional().nullable(),
  brand: z.string().max(200).optional().nullable(),
  modelNumber: z.string().max(200).optional().nullable(),
  serialNumber: z.string().max(200).optional().nullable(),
  usefulLifeOverrideMonths: z.number().int().min(1).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isPresent: z.boolean().optional(),
});

export type UpsertAssetInput = z.infer<typeof UpsertAssetSchema>;
export type PatchAssetInput = z.infer<typeof PatchAssetSchema>;
export type AddInterventionInput = z.infer<typeof AddInterventionSchema>;
