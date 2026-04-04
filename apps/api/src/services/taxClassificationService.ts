/**
 * Tax Classification Service
 *
 * Looks up tax treatment for a given asset (type + topic + canton),
 * with canton → federal fallback. Returns the classification, deductible
 * percentage, and a confidence gauge.
 *
 * Layer: service (delegates to taxRuleRepository).
 */

import { PrismaClient, AssetType, TaxClassification } from "@prisma/client";
import * as taxRuleRepo from "../repositories/taxRuleRepository";

// ─── Types ─────────────────────────────────────────────────────

export interface TaxClassificationResult {
  classification: TaxClassification;
  deductiblePct: number;
  confidence: number;
  source: "CANTONAL" | "FEDERAL" | "HEURISTIC";
  notes: string | null;
  citations: any | null;
  ruleId: string | null;
}

// ─── Heuristic Fallback ────────────────────────────────────────

/**
 * When no rule exists at all, apply a sensible heuristic based on
 * asset type. Confidence is low to signal the need for curation.
 */
function heuristicClassification(assetType: AssetType): TaxClassificationResult {
  switch (assetType) {
    case "APPLIANCE":
    case "FIXTURE":
    case "FINISH":
      return {
        classification: "WERTERHALTEND",
        deductiblePct: 100,
        confidence: 0.4,
        source: "HEURISTIC",
        notes: "Heuristic: like-for-like replacement is typically value-preserving",
        citations: null,
        ruleId: null,
      };
    case "STRUCTURAL":
      return {
        classification: "WERTVERMEHREND",
        deductiblePct: 0,
        confidence: 0.3,
        source: "HEURISTIC",
        notes: "Heuristic: structural work often enhances value — review required",
        citations: null,
        ruleId: null,
      };
    case "SYSTEM":
      return {
        classification: "MIXED",
        deductiblePct: 50,
        confidence: 0.3,
        source: "HEURISTIC",
        notes: "Heuristic: building systems often have a mixed tax treatment",
        citations: null,
        ruleId: null,
      };
    default:
      return {
        classification: "MIXED",
        deductiblePct: 50,
        confidence: 0.2,
        source: "HEURISTIC",
        notes: "Unknown asset type — defaulting to MIXED",
        citations: null,
        ruleId: null,
      };
  }
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Get tax classification for a specific asset.
 * Priority:
 *   1. Canton-specific rule (highest confidence)
 *   2. Federal default rule
 *   3. Heuristic fallback (low confidence)
 */
export async function classifyAsset(
  prisma: PrismaClient,
  assetType: AssetType,
  topic: string,
  canton?: string | null,
): Promise<TaxClassificationResult> {
  const rule = await taxRuleRepo.findTaxRule(prisma, assetType, topic, canton);

  if (!rule || rule.versions.length === 0) {
    return heuristicClassification(assetType);
  }

  const latestVersion = rule.versions[0]; // Already sorted desc by effectiveFrom
  const isCantonal = rule.canton !== null;

  return {
    classification: latestVersion.classification,
    deductiblePct: latestVersion.deductiblePct,
    confidence: latestVersion.confidence,
    source: isCantonal ? "CANTONAL" : "FEDERAL",
    notes: latestVersion.notes,
    citations: latestVersion.citationsJson,
    ruleId: rule.id,
  };
}

/**
 * Batch-classify multiple assets at once.
 * Groups by (assetType, topic) to minimize DB queries.
 */
export async function classifyAssets(
  prisma: PrismaClient,
  assets: Array<{ assetType: AssetType; topic: string }>,
  canton?: string | null,
): Promise<Map<string, TaxClassificationResult>> {
  const results = new Map<string, TaxClassificationResult>();
  const seen = new Map<string, TaxClassificationResult>();

  for (const asset of assets) {
    const key = `${asset.assetType}::${asset.topic}`;
    if (seen.has(key)) {
      results.set(key, seen.get(key)!);
      continue;
    }
    const result = await classifyAsset(prisma, asset.assetType, asset.topic, canton);
    seen.set(key, result);
    results.set(key, result);
  }

  return results;
}
