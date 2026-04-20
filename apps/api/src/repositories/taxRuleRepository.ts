/**
 * Tax Rule Repository
 *
 * Centralizes all Prisma access for TaxRule, TaxRuleVersion,
 * and ReplacementBenchmark entities.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, AssetType, TaxClassification } from "@prisma/client";
import { normalizeTopicKey } from "../utils/topicKey";

// ─── Canonical Includes (G9) ───────────────────────────────────

/** Include for tax rule lookups — latest effective version only. */
export const TAX_RULE_INCLUDE = {
  versions: {
    orderBy: { effectiveFrom: "desc" as const },
    take: 1,
  },
} as const;

/** Include for tax rule detail — all versions ordered by effectiveFrom desc. */
export const TAX_RULE_WITH_ALL_VERSIONS_INCLUDE = {
  versions: {
    orderBy: { effectiveFrom: "desc" as const },
  },
} as const;

// ─── Input Types ───────────────────────────────────────────────

export interface CreateTaxRuleInput {
  jurisdiction?: string;
  canton?: string | null;
  assetType: AssetType;
  topic: string;
  scope?: "FEDERAL" | "CANTONAL" | "MUNICIPAL";
  isActive?: boolean;
}

export interface CreateTaxRuleVersionInput {
  ruleId: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  classification: TaxClassification;
  deductiblePct?: number;
  confidence?: number;
  notes?: string | null;
  citationsJson?: any;
}

export interface CreateReplacementBenchmarkInput {
  assetType: AssetType;
  topic: string;
  lowChf: number;
  medianChf: number;
  highChf: number;
  sourceNotes?: string | null;
  isActive?: boolean;
}

// ─── Tax Rule Queries ──────────────────────────────────────────

/**
 * Find a tax rule for a specific (canton, assetType, topic) combo.
 * Returns the rule with its latest effective version.
 */
export async function findTaxRule(
  prisma: PrismaClient,
  assetType: AssetType,
  topic: string,
  canton?: string | null,
): Promise<TaxRuleWithLatestVersion | null> {
  // Try canton-specific first
  if (canton) {
    const rule = await prisma.taxRule.findFirst({
      where: {
        assetType,
        topic,
        canton,
        isActive: true,
      },
      include: TAX_RULE_INCLUDE,
    });
    if (rule && rule.versions.length > 0) return rule as TaxRuleWithLatestVersion;
  }

  // Fall back to federal default (canton = null)
  const rule = await prisma.taxRule.findFirst({
    where: {
      assetType,
      topic,
      canton: null,
      isActive: true,
    },
    include: TAX_RULE_INCLUDE,
  });

  if (rule && rule.versions.length > 0) return rule as TaxRuleWithLatestVersion;
  return null;
}

/**
 * List all active tax rules with latest versions.
 * Optionally filter by canton.
 */
export async function findAllTaxRules(
  prisma: PrismaClient,
  filters: { canton?: string; assetType?: AssetType } = {},
) {
  const where: any = { isActive: true };
  if (filters.canton !== undefined) where.canton = filters.canton;
  if (filters.assetType !== undefined) where.assetType = filters.assetType;

  return prisma.taxRule.findMany({
    where,
    include: TAX_RULE_INCLUDE,
    orderBy: [{ assetType: "asc" }, { topic: "asc" }],
  });
}

/**
 * Create a tax rule with its initial version.
 */
export async function createTaxRuleWithVersion(
  prisma: PrismaClient,
  ruleData: CreateTaxRuleInput,
  versionData: Omit<CreateTaxRuleVersionInput, "ruleId">,
) {
  return prisma.taxRule.create({
    data: {
      jurisdiction: ruleData.jurisdiction ?? "CH",
      canton: ruleData.canton ?? null,
      assetType: ruleData.assetType,
      topic: ruleData.topic,
      scope: ruleData.scope ?? "FEDERAL",
      isActive: ruleData.isActive ?? true,
      versions: {
        create: {
          effectiveFrom: versionData.effectiveFrom,
          effectiveTo: versionData.effectiveTo ?? null,
          classification: versionData.classification,
          deductiblePct: versionData.deductiblePct ?? 100,
          confidence: versionData.confidence ?? 1.0,
          notes: versionData.notes ?? null,
          citationsJson: versionData.citationsJson ?? null,
        },
      },
    },
    include: TAX_RULE_WITH_ALL_VERSIONS_INCLUDE,
  });
}

/**
 * Upsert a tax rule: create or update if it already exists.
 * Used by seed scripts to be idempotent.
 */
export async function upsertTaxRuleWithVersion(
  prisma: PrismaClient,
  ruleData: CreateTaxRuleInput,
  versionData: Omit<CreateTaxRuleVersionInput, "ruleId">,
) {
  const existing = await prisma.taxRule.findFirst({
    where: {
      jurisdiction: ruleData.jurisdiction ?? "CH",
      canton: ruleData.canton ?? null,
      assetType: ruleData.assetType,
      topic: ruleData.topic,
    },
    include: { versions: true },
  });

  if (existing) {
    // Delete existing versions and re-create
    await prisma.taxRuleVersion.deleteMany({ where: { ruleId: existing.id } });
    await prisma.taxRuleVersion.create({
      data: {
        ruleId: existing.id,
        effectiveFrom: versionData.effectiveFrom,
        effectiveTo: versionData.effectiveTo ?? null,
        classification: versionData.classification,
        deductiblePct: versionData.deductiblePct ?? 100,
        confidence: versionData.confidence ?? 1.0,
        notes: versionData.notes ?? null,
        citationsJson: versionData.citationsJson ?? null,
      },
    });
    return prisma.taxRule.findUnique({
      where: { id: existing.id },
      include: TAX_RULE_WITH_ALL_VERSIONS_INCLUDE,
    });
  }

  return createTaxRuleWithVersion(prisma, ruleData, versionData);
}

// ─── Replacement Benchmark Queries ─────────────────────────────

/**
 * Find a replacement benchmark for (assetType, topic).
 */
export async function findBenchmark(
  prisma: PrismaClient,
  assetType: AssetType,
  topic: string,
): Promise<ReplacementBenchmarkRow | null> {
  // Normalize topic for matching — topic is the primary depreciation key
  return prisma.replacementBenchmark.findFirst({
    where: { assetType, topic: normalizeTopicKey(topic), isActive: true },
  });
}

/**
 * List all active replacement benchmarks.
 */
export async function findAllBenchmarks(
  prisma: PrismaClient,
  filters: { assetType?: AssetType } = {},
) {
  const where: any = { isActive: true };
  if (filters.assetType) where.assetType = filters.assetType;

  return prisma.replacementBenchmark.findMany({
    where,
    orderBy: [{ assetType: "asc" }, { topic: "asc" }],
  });
}

/**
 * Upsert a replacement benchmark. Idempotent for seed scripts.
 */
export async function upsertBenchmark(
  prisma: PrismaClient,
  data: CreateReplacementBenchmarkInput,
) {
  const existing = await prisma.replacementBenchmark.findFirst({
    where: { assetType: data.assetType, topic: data.topic },
  });

  if (existing) {
    return prisma.replacementBenchmark.update({
      where: { id: existing.id },
      data: {
        lowChf: data.lowChf,
        medianChf: data.medianChf,
        highChf: data.highChf,
        sourceNotes: data.sourceNotes ?? existing.sourceNotes,
        isActive: data.isActive ?? true,
      },
    });
  }

  return prisma.replacementBenchmark.create({ data });
}

// ─── Type Aliases (for clarity in service layer) ───────────────

export type TaxRuleWithLatestVersion = {
  id: string;
  jurisdiction: string;
  canton: string | null;
  assetType: AssetType;
  topic: string;
  scope: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    id: string;
    ruleId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    classification: TaxClassification;
    deductiblePct: number;
    confidence: number;
    notes: string | null;
    citationsJson: any;
    createdAt: Date;
  }>;
};

export type ReplacementBenchmarkRow = {
  id: string;
  assetType: AssetType;
  topic: string;
  lowChf: number;
  medianChf: number;
  highChf: number;
  sourceNotes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
