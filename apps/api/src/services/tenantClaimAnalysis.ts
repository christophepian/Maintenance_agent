/**
 * Tenant Claim Analysis — Structured Claim Assessment Service
 *
 * Top-level composition service that produces a complete claim assessment
 * for a tenant maintenance request. Orchestrates:
 *   - Defect signal extraction (defectClassifier)
 *   - Legal decision engine (statutory + case law)
 *   - Defect matching (ASLOCA rules)
 *   - Rent reduction calculation (CHF amounts)
 *   - Tenant guidance + landlord obligation generation
 *   - Temporal context (seasonal pro-rating, back-dating)
 *
 * Part of Legal Engine Hardening Phase C (C-1 + C-3).
 */

import { LegalObligation } from "@prisma/client";
import * as crypto from "crypto";
import prisma from "./prismaClient";
import { REQUEST_LEGAL_DECISION_INCLUDE } from "./legalIncludes";
import {
  evaluateRequestLegalDecision,
  type LegalDecisionDTO,
  type Citation,
  RequestNotFoundError,
} from "./legalDecisionEngine";
import {
  extractDefectSignals,
  type DefectSignals,
} from "./defectClassifier";
import {
  matchDefectsToRules,
  type DefectMatch,
  type MatchResult,
} from "./defectMatcher";
import {
  calculateRentReductionForUnit,
  type RentReductionResult,
} from "./rentReductionCalculator";
import { resolveRequestOrg, assertOrgScope } from "../governance/orgScope";
import { type DepreciationSignalDTO } from "./depreciation";
import {
  cantonFromPostalCode,
  extractPostalCode,
} from "./cantonMapping";

// ==========================================
// DTOs
// ==========================================

export interface TenantClaimAnalysisDTO {
  // ─── Request context ───
  requestId: string;
  requestDescription: string;
  category: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  canton: string | null;

  // ─── Defect classification ───
  defectSignals: DefectSignals;

  // ─── Legal assessment ───
  legalObligation: LegalObligation;
  legalTopic: string | null;
  confidence: number;

  // ─── Matched defects (from ASLOCA case law) ───
  matchedDefects: MatchedDefectEntry[];

  // ─── Financial impact ───
  rentReduction: RentReductionResult | null;

  // ─── Legal basis ───
  legalBasis: LegalBasisEntry[];

  // ─── Depreciation context ───
  depreciationSignal: DepreciationSignalDTO | null;

  // ─── Actionable guidance ───
  tenantGuidance: TenantGuidance;
  landlordObligations: LandlordObligations;

  // ─── Temporal context (C-3) ───
  temporalContext: TemporalContext;

  // ─── Audit ───
  evaluationLogId: string;
  analysedAt: string;
}

export interface MatchedDefectEntry {
  rank: number;
  ruleKey: string;
  defect: string;
  category: string;
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number;
  matchReasons: string[];
}

export interface LegalBasisEntry {
  article: string;
  text: string;
  authority: string;
  relevance: string;
}

export interface TenantGuidance {
  summary: string;
  nextSteps: string[];
  deadlines: string[];
  escalation: string;
}

export interface LandlordObligations {
  summary: string;
  requiredActions: string[];
  timeline: string;
}

export interface TemporalContext {
  /** ISO date if extractable from description */
  defectOngoingSince?: string;
  /** Duration in months from defect signals */
  durationMonths?: number;
  /** Whether seasonal adjustment applies (heating: Oct–Apr) */
  seasonalAdjustment: boolean;
  /** Reduction % after seasonal pro-rating */
  proRatedPercent?: number;
  /** Total back-dated reduction amount (months × monthly reduction) */
  backdatedReductionChf?: number;
}

// ==========================================
// Constants
// ==========================================

/** Heating season: October through April = 7 months out of 12 */
const HEATING_SEASON_MONTHS = 7;
const MONTHS_IN_YEAR = 12;

/** Categories considered seasonal (heating-related) */
const SEASONAL_CATEGORIES = new Set(["Température"]);

// ==========================================
// Core: analyseClaimForRequest
// ==========================================

/**
 * Analyse a tenant maintenance request as a potential rent reduction claim.
 *
 * Orchestration:
 *   1. Validate org scope
 *   2. Load request context
 *   3. Run legal decision engine (produces statutory + case law analysis)
 *   4. Extract defect signals from description
 *   5. Run defect matcher against ASLOCA rules
 *   6. Calculate rent reduction if active lease exists
 *   7. Build legal basis from matched rules
 *   8. Generate tenant guidance + landlord obligations
 *   9. Compute temporal context (seasonal, back-dating)
 *  10. Write evaluation log
 *  11. Return complete DTO
 */
export async function analyseClaimForRequest(
  orgId: string,
  requestId: string,
): Promise<TenantClaimAnalysisDTO> {
  // 1. Resolve org scope
  const orgRes = await resolveRequestOrg(prisma, requestId);
  assertOrgScope(orgId, orgRes);

  // 2. Load request with full context
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: REQUEST_LEGAL_DECISION_INCLUDE,
  });

  if (!request) {
    throw new RequestNotFoundError(requestId);
  }

  // Derive canton
  let canton: string | null = null;
  if (request.unit?.building) {
    canton = request.unit.building.canton;
    if (!canton && request.unit.building.address) {
      const postalCode = extractPostalCode(request.unit.building.address);
      if (postalCode) canton = cantonFromPostalCode(postalCode);
    }
  }

  // 3. Run legal decision engine (existing comprehensive evaluation)
  const decision = await evaluateRequestLegalDecision(orgId, requestId);

  // 4. Extract defect signals from complaint text
  const defectSignals = extractDefectSignals(
    request.description ?? "",
    request.category ?? null,
  );

  // 5. Run defect matcher for ASLOCA case law matches
  let matchResult: MatchResult = {
    matches: [],
    bestMatch: null,
    totalConfidence: 0,
    unmatchedSignals: [],
  };
  if (defectSignals.keywords.length > 0 || defectSignals.inferredCategories.length > 0) {
    matchResult = await matchDefectsToRules(defectSignals, canton);
  }

  // 6. Calculate rent reduction if unit has active lease
  let rentReduction: RentReductionResult | null = null;
  if (matchResult.matches.length > 0 && request.unitId) {
    rentReduction = await calculateRentReductionForUnit(
      matchResult.matches,
      request.unitId,
      defectSignals.duration,
    );
  }

  // 7. Build legal basis from citations + matched rules
  const legalBasis = buildLegalBasis(decision.citations, matchResult.matches);

  // 8. Generate actionable guidance
  const tenantGuidance = buildTenantGuidance(
    decision.legalObligation,
    rentReduction,
    matchResult,
    defectSignals,
  );
  const landlordObligations = buildLandlordObligations(
    decision.legalObligation,
    decision.depreciationSignal,
    matchResult,
  );

  // 9. Compute temporal context (C-3)
  const temporalContext = buildTemporalContext(
    defectSignals,
    matchResult,
    rentReduction,
  );

  // 10. Build matched defects with ranking
  const matchedDefects = buildMatchedDefects(matchResult.matches);

  // 11. Write extended evaluation log
  const analysedAt = new Date().toISOString();
  const contextJson = {
    analysisType: "CLAIM_ANALYSIS",
    requestId,
    category: request.category,
    canton,
    unitId: request.unitId,
    buildingId: request.unit?.buildingId ?? null,
    defectSignalCount: defectSignals.keywords.length,
    matchedDefectCount: matchResult.matches.length,
    hasRentReduction: !!rentReduction,
    temporalContext: JSON.parse(JSON.stringify(temporalContext)),
  };
  const contextHash = sha256(JSON.stringify(contextJson));

  const evalLog = await prisma.legalEvaluationLog.create({
    data: {
      orgId,
      buildingId: request.unit?.buildingId ?? null,
      unitId: request.unitId ?? null,
      requestId,
      contextJson,
      contextHash,
      resultJson: {
        legalObligation: decision.legalObligation,
        confidence: decision.confidence,
        matchedDefectCount: matchResult.matches.length,
        topDefect: matchResult.bestMatch?.defect ?? null,
        totalReductionPercent: rentReduction?.totalReductionPercent ?? null,
        totalReductionChf: rentReduction?.totalReductionChf ?? null,
        temporalContext: JSON.parse(JSON.stringify(temporalContext)),
        tenantGuidanceSummary: tenantGuidance.summary,
      },
      matchedRuleVersionIdsJson: [],
    },
  });

  return {
    requestId,
    requestDescription: request.description ?? "",
    category: request.category ?? null,
    buildingName: request.unit?.building?.name ?? null,
    unitNumber: request.unit?.unitNumber ?? null,
    canton,
    defectSignals,
    legalObligation: decision.legalObligation,
    legalTopic: decision.legalTopic,
    confidence: decision.confidence,
    matchedDefects,
    rentReduction,
    legalBasis,
    depreciationSignal: decision.depreciationSignal,
    tenantGuidance,
    landlordObligations,
    temporalContext,
    evaluationLogId: evalLog.id,
    analysedAt,
  };
}

// ==========================================
// Matched defects builder
// ==========================================

function buildMatchedDefects(matches: DefectMatch[]): MatchedDefectEntry[] {
  return matches.map((m, idx) => ({
    rank: idx + 1,
    ruleKey: m.ruleKey,
    defect: m.defect,
    category: m.category,
    reductionPercent: m.reductionPercent,
    reductionMax: m.reductionMax,
    matchConfidence: m.matchConfidence,
    matchReasons: m.matchReasons,
  }));
}

// ==========================================
// Legal basis builder
// ==========================================

/**
 * Build legalBasis array from citations (statutory) + matched defect rules (case law).
 */
function buildLegalBasis(
  citations: Citation[],
  matches: DefectMatch[],
): LegalBasisEntry[] {
  const basis: LegalBasisEntry[] = [];

  // Statutory citations
  for (const c of citations) {
    basis.push({
      article: c.article,
      text: c.text,
      authority: c.authority,
      relevance: inferRelevance(c.article),
    });
  }

  // CO 259d for rent reduction cases (always include if defect matches exist)
  if (matches.length > 0) {
    const hasRentReductionArticle = basis.some(
      (b) => b.article.includes("259d") || b.article.includes("259 d"),
    );
    if (!hasRentReductionArticle) {
      basis.push({
        article: "CO 259d",
        text: "Rent reduction for defects reducing the use of the property",
        authority: "STATUTE",
        relevance: "Entitles tenant to proportional rent reduction during defect period",
      });
    }
  }

  // Add ASLOCA case law references from matched rules
  for (const m of matches.slice(0, 3)) {
    basis.push({
      article: m.citation.article || `ASLOCA/${m.ruleKey}`,
      text: m.citation.text || m.defect,
      authority: "INDUSTRY_STANDARD",
      relevance: `ASLOCA jurisprudence: ${m.reductionPercent}% reduction for ${m.category.toLowerCase()} defect`,
    });
  }

  return basis;
}

/**
 * Infer human-readable relevance from a Swiss legal article reference.
 */
function inferRelevance(article: string): string {
  const lower = article.toLowerCase();
  if (lower.includes("256")) return "Defines landlord obligation to maintain habitable condition";
  if (lower.includes("259a")) return "Tenant notification of defects to landlord";
  if (lower.includes("259b")) return "Landlord must remedy defects within reasonable time";
  if (lower.includes("259d")) return "Entitles tenant to proportional rent reduction during defect period";
  if (lower.includes("259e")) return "Tenant may claim damages for defects";
  if (lower.includes("270")) return "Initial rent challenge procedure";
  if (lower.includes("271")) return "Protection against retaliatory termination";
  return "Supporting legal provision";
}

// ==========================================
// Tenant guidance builder
// ==========================================

function buildTenantGuidance(
  obligation: LegalObligation,
  rentReduction: RentReductionResult | null,
  matchResult: MatchResult,
  defectSignals: DefectSignals,
): TenantGuidance {
  const nextSteps: string[] = [];
  const deadlines: string[] = [];

  // Always start with notification
  nextSteps.push("Notify your landlord/property manager in writing about the defect");
  nextSteps.push("Document the defect with photos and date-stamped evidence");

  if (obligation === LegalObligation.OBLIGATED) {
    nextSteps.push("Request a written confirmation of repair timeline");
    nextSteps.push("If no response within 30 days, send a formal notice (mise en demeure)");
    if (rentReduction) {
      nextSteps.push(
        `Consider requesting a rent reduction of ${rentReduction.totalReductionPercent}% ` +
          `(~CHF ${rentReduction.totalReductionChf}/month) until the defect is resolved`,
      );
    }
    deadlines.push("Notify landlord in writing within 30 days of discovering the defect");
    deadlines.push("If no repair: formal notice with reasonable deadline (typically 30 days)");
  } else if (obligation === LegalObligation.DISCRETIONARY) {
    nextSteps.push("The landlord may repair at their discretion — discuss the issue");
    if (rentReduction) {
      nextSteps.push(
        `A rent reduction of ~${rentReduction.totalReductionPercent}% may be applicable ` +
          "if the defect materially reduces your use of the property",
      );
    }
    deadlines.push("No strict legal deadline, but prompt notification is recommended");
  } else if (obligation === LegalObligation.TENANT_RESPONSIBLE) {
    nextSteps.push("This issue is likely your responsibility as tenant (minor maintenance)");
    nextSteps.push("Check your lease for specific maintenance obligations (petit entretien)");
  } else {
    nextSteps.push("The legal obligation is unclear — request a professional assessment");
    nextSteps.push("Contact the conciliation authority for guidance if needed");
  }

  // Severity-specific guidance
  if (defectSignals.severity === "critical" || defectSignals.severity === "severe") {
    nextSteps.push("Given the severity, consider depositing rent with the conciliation authority (consignation de loyer)");
    deadlines.push("For urgent/health-related defects: landlord must act immediately");
  }

  // Build summary
  let summary: string;
  if (obligation === LegalObligation.OBLIGATED && rentReduction) {
    summary =
      `You are likely entitled to a rent reduction of ${rentReduction.totalReductionPercent}% ` +
      `(~CHF ${rentReduction.totalReductionChf}/month). The landlord is legally obligated to ` +
      "repair this defect under Swiss tenancy law.";
  } else if (obligation === LegalObligation.OBLIGATED) {
    summary =
      "The landlord is legally obligated to repair this defect. " +
      "A rent reduction may apply if the defect reduces your use of the property.";
  } else if (obligation === LegalObligation.DISCRETIONARY) {
    summary =
      "Repair is at the landlord's discretion. A rent reduction may still apply " +
      "if the defect materially affects your use of the property.";
  } else if (obligation === LegalObligation.TENANT_RESPONSIBLE) {
    summary =
      "This appears to be a tenant maintenance responsibility (petit entretien). " +
      "Check your lease agreement for details.";
  } else {
    summary =
      "The legal situation requires further assessment. We recommend contacting " +
      "the conciliation authority or a tenant association for guidance.";
  }

  const escalation =
    "If unresolved, contact the conciliation authority (Schlichtungsbehörde / " +
    "autorité de conciliation) in your canton. This is a free, mandatory step " +
    "before any court proceedings.";

  return { summary, nextSteps, deadlines, escalation };
}

// ==========================================
// Landlord obligations builder
// ==========================================

function buildLandlordObligations(
  obligation: LegalObligation,
  depreciation: DepreciationSignalDTO | null,
  matchResult: MatchResult,
): LandlordObligations {
  const requiredActions: string[] = [];

  if (obligation === LegalObligation.OBLIGATED) {
    requiredActions.push("Repair the reported defect within a reasonable timeframe");
    requiredActions.push("Acknowledge the tenant's defect notification in writing");

    if (depreciation?.fullyDepreciated) {
      requiredActions.push("Consider full replacement — asset is past its useful life");
    } else if (depreciation && depreciation.remainingLifePct < 20) {
      requiredActions.push("Consider replacement — asset is near end of useful life");
    }

    if (matchResult.bestMatch) {
      requiredActions.push(
        `Address the ${matchResult.bestMatch.category.toLowerCase()} defect ` +
          "to avoid tenant rent reduction claims",
      );
    }

    const summary =
      "Repair is legally required under CO 256 (landlord duty to maintain) " +
      "and CO 259a–259b (defect remediation obligations).";

    const timeline = determineTimeline(obligation, matchResult);

    return { summary, requiredActions, timeline };
  }

  if (obligation === LegalObligation.DISCRETIONARY) {
    requiredActions.push("Evaluate whether repair is appropriate given asset condition");
    if (depreciation && depreciation.remainingLifePct < 30) {
      requiredActions.push("Asset nearing end of life — replacement may be more cost-effective");
    }

    return {
      summary: "Repair is discretionary. Consider cost-benefit and tenant satisfaction.",
      requiredActions,
      timeline: "No strict legal deadline — assess on a case-by-case basis",
    };
  }

  if (obligation === LegalObligation.TENANT_RESPONSIBLE) {
    return {
      summary: "No landlord obligation — defect falls under tenant's petit entretien.",
      requiredActions: ["Inform tenant of their maintenance responsibility"],
      timeline: "N/A — tenant responsibility",
    };
  }

  // UNKNOWN
  return {
    summary: "Legal obligation unclear — manual review recommended.",
    requiredActions: [
      "Review the defect report manually",
      "Consult legal counsel if amount is significant",
    ],
    timeline: "Reasonable delay — typically 30 days for non-urgent repairs",
  };
}

/**
 * Determine repair timeline based on obligation and severity.
 */
function determineTimeline(
  obligation: LegalObligation,
  matchResult: MatchResult,
): string {
  if (!matchResult.bestMatch) {
    return "Reasonable delay — typically 30 days for non-urgent repairs";
  }

  // High-severity defects (health/safety) require immediate action
  const category = matchResult.bestMatch.category;
  const reduction = matchResult.bestMatch.reductionPercent;

  if (reduction >= 50) {
    return "Urgent — immediate action required (health/safety impact, >50% reduction applicable)";
  }
  if (reduction >= 20 || category === "Température") {
    return "Priority repair — within 14 days (significant impact on habitability)";
  }
  return "Reasonable delay — typically 30 days for non-urgent repairs";
}

// ==========================================
// Temporal context (C-3)
// ==========================================

/**
 * Build temporal context for the claim analysis.
 *
 * Swiss law: rent reduction applies from date of notification (CO 259d).
 * Seasonal defects (heating) are pro-rated to the heating season (Oct–Apr).
 * Multi-defect aggregation: categories are aggregated with cumulative %.
 */
export function buildTemporalContext(
  defectSignals: DefectSignals,
  matchResult: MatchResult,
  rentReduction: RentReductionResult | null,
): TemporalContext {
  const ctx: TemporalContext = {
    seasonalAdjustment: false,
  };

  // Duration from defect signals
  if (defectSignals.duration.months != null && defectSignals.duration.months > 0) {
    ctx.durationMonths = defectSignals.duration.months;

    // Estimate "ongoing since" date
    const since = new Date();
    since.setMonth(since.getMonth() - defectSignals.duration.months);
    ctx.defectOngoingSince = since.toISOString().split("T")[0];
  }

  // Seasonal adjustment for heating-related categories
  const isSeasonalDefect =
    defectSignals.duration.seasonal ||
    defectSignals.inferredCategories.some((cat) => SEASONAL_CATEGORIES.has(cat));

  if (isSeasonalDefect && matchResult.bestMatch) {
    ctx.seasonalAdjustment = true;
    // Pro-rate: heating season is 7/12 of the year
    ctx.proRatedPercent = Math.round(
      (matchResult.bestMatch.reductionPercent * HEATING_SEASON_MONTHS) / MONTHS_IN_YEAR * 100,
    ) / 100;
  }

  // Back-dated reduction calculation
  if (rentReduction && ctx.durationMonths && ctx.durationMonths > 0) {
    const monthlyReduction = rentReduction.totalReductionChf;
    const effectiveMonths = ctx.seasonalAdjustment
      ? Math.min(ctx.durationMonths, HEATING_SEASON_MONTHS)
      : ctx.durationMonths;
    ctx.backdatedReductionChf = Math.round(monthlyReduction * effectiveMonths * 100) / 100;
  }

  return ctx;
}

// ==========================================
// Utilities
// ==========================================

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
