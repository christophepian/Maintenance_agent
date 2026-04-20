import { z } from "zod";
import { normalizeTopicKey } from "../utils/topicKey";
import { isModelEligible } from "../repositories/assetRepository";
import { RfpStatus, LegalObligation, LegalAuthority, AssetType, LegalRuleType, LegalSourceStatus, LegalSourceScope } from "@prisma/client";

// ── GET /rfps query params ──────────────────────────────────

export const ListRfpsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20", 10)))),
  offset: z
    .string()
    .optional()
    .transform((v) => Math.max(0, parseInt(v ?? "0", 10))),
  status: z.nativeEnum(RfpStatus).optional(),
});

export type ListRfpsQuery = z.infer<typeof ListRfpsSchema>;

// ── GET /contractor/rfps query params ───────────────────────

export const ListContractorRfpsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20", 10)))),
  offset: z
    .string()
    .optional()
    .transform((v) => Math.max(0, parseInt(v ?? "0", 10))),
  status: z.nativeEnum(RfpStatus).optional(),
  contractorId: z.string().uuid("contractorId must be a valid UUID"),
});

export type ListContractorRfpsQuery = z.infer<typeof ListContractorRfpsSchema>;

// ── POST /legal/category-mappings body ──────────────────────

export const CreateCategoryMappingSchema = z.object({
  requestCategory: z.string().min(1).max(100),
  legalTopic: z.string().min(1).max(100),
  isActive: z.boolean().optional().default(true),
});

export type CreateCategoryMappingBody = z.infer<typeof CreateCategoryMappingSchema>;

// ── PUT /legal/category-mappings/:id body ───────────────────

export const UpdateCategoryMappingSchema = z.object({
  legalTopic: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCategoryMappingBody = z.infer<typeof UpdateCategoryMappingSchema>;

// ── POST /legal/depreciation-standards body ─────────────────

export const CreateDepreciationStandardSchema = z.object({
  jurisdiction: z.string().max(10).optional().default("CH"),
  canton: z.string().max(5).nullable().optional(),
  authority: z.nativeEnum(LegalAuthority).optional().default("INDUSTRY_STANDARD"),
  assetType: z.nativeEnum(AssetType),
  topic: z.string().min(1).max(100),
  usefulLifeMonths: z.number().int().min(1).max(6000),
  notes: z.string().max(500).nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
});

export type CreateDepreciationStandardBody = z.infer<typeof CreateDepreciationStandardSchema>;

// ── POST /legal/rules body ──────────────────────────────────

export const CreateLegalRuleSchema = z.object({
  key: z.string().min(1).max(200),
  ruleType: z.nativeEnum(LegalRuleType),
  authority: z.nativeEnum(LegalAuthority),
  jurisdiction: z.string().max(10).optional().default("CH"),
  canton: z.string().max(5).nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional().default(0),
  isActive: z.boolean().optional().default(true),
  // Initial version
  dslJson: z.record(z.string(), z.unknown()),
  citationsJson: z.array(z.object({
    article: z.string(),
    text: z.string(),
  })).optional(),
  summary: z.string().max(1000).optional(),
  effectiveFrom: z.string().transform((s) => new Date(s)),
});

export type CreateLegalRuleBody = z.infer<typeof CreateLegalRuleSchema>;

// ── POST /legal/sources body ────────────────────────────────

export const CreateLegalSourceSchema = z.object({
  name: z.string().min(1).max(200),
  jurisdiction: z.string().max(10).optional().default("CH"),
  scope: z.nativeEnum(LegalSourceScope).optional().default("FEDERAL"),
  url: z.string().url().nullable().optional(),
  updateFrequency: z.string().max(50).nullable().optional(),
  fetcherType: z.string().max(50).nullable().optional(),
  parserType: z.string().max(50).nullable().optional(),
});

export type CreateLegalSourceBody = z.infer<typeof CreateLegalSourceSchema>;

// ── PATCH /legal/sources/:id body ───────────────────────────

export const UpdateLegalSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.union([z.string().url(), z.literal("")]).nullable().optional(),
  jurisdiction: z.string().max(10).optional(),
  scope: z.nativeEnum(LegalSourceScope).optional(),
  fetcherType: z.string().max(50).nullable().optional(),
  parserType: z.string().max(50).nullable().optional(),
  updateFrequency: z.string().max(50).nullable().optional(),
  status: z.nativeEnum(LegalSourceStatus).optional(),
});

export type UpdateLegalSourceBody = z.infer<typeof UpdateLegalSourceSchema>;

// ── POST /assets body ───────────────────────────────────────

export const CreateAssetSchema = z.object({
  unitId: z.string().uuid(),
  type: z.nativeEnum(AssetType),
  topic: z.string().min(1).max(100).transform(normalizeTopicKey),
  name: z.string().min(1).max(200),
  assetModelId: z.string().uuid().nullable().optional(),
  installedAt: z.string().transform((s) => new Date(s)).nullable().optional(),
  lastRenovatedAt: z.string().transform((s) => new Date(s)).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  modelNumber: z.string().max(200).nullable().optional(),
  serialNumber: z.string().max(200).nullable().optional(),
  usefulLifeOverrideMonths: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isPresent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.assetModelId && !isModelEligible(data.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assetModelId"],
      message: `Asset model assignment is not supported for type "${data.type}".`,
    });
  }
});

export type CreateAssetBody = z.infer<typeof CreateAssetSchema>;
