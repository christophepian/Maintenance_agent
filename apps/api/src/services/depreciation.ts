/**
 * Depreciation Service
 *
 * Computes depreciation signals for assets based on Swiss industry
 * standard depreciation schedules (Paritätische Lebensdauertabelle).
 *
 * Authority: INDUSTRY_STANDARD only — advisory signal, not obligation.
 */

import { AssetType, LegalAuthority } from "@prisma/client";
import prisma from "./prismaClient";

// ==========================================
// DTOs
// ==========================================

export interface DepreciationSignalDTO {
  assetId: string;
  topic: string;
  assetType: AssetType;
  usefulLifeMonths: number;
  ageMonths: number;
  remainingLifePct: number; // 0–100, clamped
  fullyDepreciated: boolean;
  basisAuthority: LegalAuthority;
  standardId: string | null;
  notes: string | null;
}

// ==========================================
// Errors
// ==========================================

export class DepreciationNotFoundError extends Error {
  constructor(assetType: AssetType, topic: string) {
    super(
      `No depreciation standard found for ${assetType}/${topic}`,
    );
    this.name = "DepreciationNotFoundError";
  }
}

// ==========================================
// Core
// ==========================================

/**
 * Compute the depreciation signal for an asset as of a given date.
 *
 * Lookup priority:
 *   1. Canton-specific standard (if canton provided)
 *   2. National standard (canton = null)
 *
 * Returns null if no matching DepreciationStandard exists.
 */
export async function computeDepreciationSignal(
  asset: {
    id: string;
    type: AssetType;
    topic: string;
    installedAt: Date | null;
    lastRenovatedAt: Date | null;
  },
  asOfDate: Date,
  canton?: string | null,
): Promise<DepreciationSignalDTO | null> {
  // Find best-match depreciation standard
  const standard = await findDepreciationStandard(
    asset.type,
    asset.topic,
    canton ?? null,
  );

  if (!standard) return null;

  // Age calculation: use lastRenovatedAt if available, else installedAt
  const referenceDate = asset.lastRenovatedAt ?? asset.installedAt;
  if (!referenceDate) {
    // Cannot compute age without a reference date — return with 0 age
    return {
      assetId: asset.id,
      topic: asset.topic,
      assetType: asset.type,
      usefulLifeMonths: standard.usefulLifeMonths,
      ageMonths: 0,
      remainingLifePct: 100,
      fullyDepreciated: false,
      basisAuthority: standard.authority,
      standardId: standard.id,
      notes: standard.notes,
    };
  }

  const ageMonths = monthsBetween(referenceDate, asOfDate);
  const remainingLifePct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((standard.usefulLifeMonths - ageMonths) / standard.usefulLifeMonths) *
          100,
      ),
    ),
  );

  return {
    assetId: asset.id,
    topic: asset.topic,
    assetType: asset.type,
    usefulLifeMonths: standard.usefulLifeMonths,
    ageMonths,
    remainingLifePct,
    fullyDepreciated: ageMonths >= standard.usefulLifeMonths,
    basisAuthority: standard.authority,
    standardId: standard.id,
    notes: standard.notes,
  };
}

// ==========================================
// Helpers
// ==========================================

/**
 * Find the best-match depreciation standard.
 *
 * Priority:
 *   1. Exact canton match
 *   2. National (canton = null)
 */
async function findDepreciationStandard(
  assetType: AssetType,
  topic: string,
  canton: string | null,
) {
  // normalizeTopicKey → UPPER_SNAKE_CASE, but the DB may have mixed-case rows
  // from older seeds. Use mode:"insensitive" throughout.
  const topicKey = topic.trim().replace(/[\s]+/g, "_").replace(/-/g, "_").toUpperCase();

  // Try canton-specific first (case-insensitive)
  if (canton) {
    const cantonStd = await prisma.depreciationStandard.findFirst({
      where: {
        jurisdiction: "CH",
        canton,
        assetType,
        topic: { equals: topicKey, mode: "insensitive" },
      },
    });
    if (cantonStd) return cantonStd;
  }

  // Fall back to national (case-insensitive, with assetType)
  const national = await prisma.depreciationStandard.findFirst({
    where: {
      jurisdiction: "CH",
      canton: null,
      assetType,
      topic: { equals: topicKey, mode: "insensitive" },
    },
  });
  if (national) return national;

  // Tier 5: topic-only fallback — drop assetType for mismatched legacy assets
  return prisma.depreciationStandard.findFirst({
    where: {
      jurisdiction: "CH",
      canton: null,
      topic: { equals: topicKey, mode: "insensitive" },
    },
    orderBy: { assetType: "asc" },
  });
}

/**
 * Calculate the number of whole months between two dates.
 */
function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  let total = years * 12 + months;
  if (days < 0) total -= 1; // partial month not yet complete
  return Math.max(0, total);
}
