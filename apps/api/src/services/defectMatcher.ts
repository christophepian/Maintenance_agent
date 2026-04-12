/**
 * Defect Matcher — Match DefectSignals Against ASLOCA Rent Reduction Rules
 *
 * Scores each of the ~55 ASLOCA RENT_REDUCTION rules against the extracted
 * DefectSignals, producing ranked matches with confidence scores and reasons.
 *
 * Part of Legal Engine Hardening Phase B (B-2).
 */

import prisma from "./prismaClient";
import type { DefectSignals, DefectSeverity } from "./defectClassifier";

// ==========================================
// Public types
// ==========================================

export interface DefectMatch {
  ruleKey: string;
  ruleId: string;
  defect: string;           // ASLOCA defect description (French)
  category: string;         // ASLOCA category
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number;  // 0–100
  matchReasons: string[];   // Why this rule matched
  citation: { article: string; text: string };
}

export interface MatchResult {
  matches: DefectMatch[];       // Sorted by confidence desc
  bestMatch: DefectMatch | null;
  totalConfidence: number;      // Weighted aggregate of top matches
  unmatchedSignals: string[];   // Keywords that didn't match any rule
}

// ==========================================
// Scoring weights
// ==========================================

const SCORE_CATEGORY_MATCH = 30;
const SCORE_KEYWORD_OVERLAP_PER_HIT = 15;
const SCORE_KEYWORD_OVERLAP_MAX = 40;
const SCORE_SEVERITY_ALIGNMENT = 15;
const SCORE_AREA_MATCH = 15;
const MIN_CONFIDENCE_THRESHOLD = 20;
const MAX_RESULTS = 5;

// ==========================================
// Main matching function
// ==========================================

/**
 * Match extracted DefectSignals against ASLOCA rent reduction rules in the DB.
 *
 * @param signals - Structured signals from extractDefectSignals()
 * @param canton - Optional canton for jurisdiction filtering
 * @returns MatchResult with ranked matches, best match, and unmatched signals
 */
export async function matchDefectsToRules(
  signals: DefectSignals,
  canton?: string | null,
): Promise<MatchResult> {
  if (!signals.keywords.length && !signals.inferredCategories.length) {
    return {
      matches: [],
      bestMatch: null,
      totalConfidence: 0,
      unmatchedSignals: [],
    };
  }

  // 1. Load all active RENT_REDUCTION rules
  const rules = await loadRentReductionRules(canton);

  // 2. Score each rule against signals
  const scored: DefectMatch[] = [];
  const matchedKeywords = new Set<string>();

  for (const rule of rules) {
    const { confidence, reasons, keywordsUsed } = scoreRule(rule, signals);
    if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
      scored.push({
        ruleKey: rule.key,
        ruleId: rule.id,
        defect: rule.defect,
        category: rule.category,
        reductionPercent: rule.reductionPercent,
        reductionMax: rule.reductionMax,
        matchConfidence: Math.min(100, confidence),
        matchReasons: reasons,
        citation: rule.citation,
      });
      for (const kw of keywordsUsed) matchedKeywords.add(kw);
    }
  }

  // 3. Sort by confidence desc, then reduction % desc
  scored.sort((a, b) =>
    b.matchConfidence - a.matchConfidence || b.reductionPercent - a.reductionPercent
  );

  // 4. Limit to top N
  const matches = scored.slice(0, MAX_RESULTS);

  // 5. Compute unmatched signals
  const unmatchedSignals = signals.keywords
    .filter((kw) => !matchedKeywords.has(kw.term))
    .map((kw) => kw.term);

  // 6. Compute aggregate confidence
  const totalConfidence = computeAggregateConfidence(matches);

  return {
    matches,
    bestMatch: matches[0] ?? null,
    totalConfidence,
    unmatchedSignals,
  };
}

// ==========================================
// Internal: rule loading
// ==========================================

interface ParsedRule {
  id: string;
  key: string;
  defect: string;
  category: string;
  reductionPercent: number;
  reductionMax?: number;
  citation: { article: string; text: string };
}

async function loadRentReductionRules(canton?: string | null): Promise<ParsedRule[]> {
  const now = new Date();

  const rules = await prisma.legalRule.findMany({
    where: {
      isActive: true,
      authority: "INDUSTRY_STANDARD",
      jurisdiction: "CH",
      OR: [
        { canton: null },
        ...(canton ? [{ canton }] : []),
      ],
    },
    include: {
      versions: {
        where: {
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  const parsed: ParsedRule[] = [];

  for (const rule of rules) {
    const version = rule.versions[0];
    if (!version) continue;

    const dsl = version.dslJson as any;
    if (!dsl || dsl.type !== "RENT_REDUCTION") continue;

    const citations = version.citationsJson as any[] | null;
    const firstCitation = citations?.[0];

    parsed.push({
      id: rule.id,
      key: rule.key,
      defect: dsl.defect || "",
      category: dsl.category || "",
      reductionPercent: dsl.reductionPercent ?? 0,
      reductionMax: dsl.reductionMax ?? undefined,
      citation: {
        article: firstCitation?.article || "ASLOCA/Lachat",
        text: firstCitation?.text || dsl.source || "Swiss tenancy case law",
      },
    });
  }

  return parsed;
}

// ==========================================
// Internal: scoring
// ==========================================

interface ScoreResult {
  confidence: number;
  reasons: string[];
  keywordsUsed: string[];
}

/**
 * Score a single rule against the signals.
 *
 * Scoring dimensions:
 *   1. Category match (signals.inferredCategories ∩ rule.category): +30
 *   2. Keyword overlap (signal keywords vs rule defect text): +15 per hit, max 40
 *   3. Severity alignment (signal severity vs rule's implied severity): +15
 *   4. Area match (rooms overlap with rule defect text): +15
 */
function scoreRule(rule: ParsedRule, signals: DefectSignals): ScoreResult {
  let confidence = 0;
  const reasons: string[] = [];
  const keywordsUsed: string[] = [];

  const defectLower = rule.defect.toLowerCase();
  const defectNorm = stripAccents(defectLower);

  // 1. Category match
  if (signals.inferredCategories.includes(rule.category)) {
    confidence += SCORE_CATEGORY_MATCH;
    reasons.push(`Category match: ${rule.category}`);
  }

  // 2. Keyword overlap with defect text
  let keywordHits = 0;
  for (const kw of signals.keywords) {
    const kwNorm = stripAccents(kw.term.toLowerCase());
    if (kwNorm.length >= 3 && (defectNorm.includes(kwNorm) || kwNorm.includes(defectNorm.split(" ")[0]))) {
      keywordHits++;
      keywordsUsed.push(kw.term);
      if (keywordHits <= 3) {
        reasons.push(`Keyword "${kw.term}" found in defect: "${rule.defect}"`);
      }
    }
  }
  confidence += Math.min(SCORE_KEYWORD_OVERLAP_MAX, keywordHits * SCORE_KEYWORD_OVERLAP_PER_HIT);

  // 3. Severity alignment
  const impliedSeverity = inferSeverityFromReduction(rule.reductionPercent);
  if (severityAligns(signals.severity, impliedSeverity)) {
    confidence += SCORE_SEVERITY_ALIGNMENT;
    reasons.push(`Severity alignment: ${signals.severity} ↔ ${impliedSeverity} (${rule.reductionPercent}%)`);
  }

  // 4. Area match — rooms mentioned in signals that appear in defect text
  if (signals.affectedArea.rooms.length > 0) {
    const roomMatch = signals.affectedArea.rooms.some((room) =>
      defectNorm.includes(stripAccents(room.toLowerCase()))
    );
    if (roomMatch) {
      confidence += SCORE_AREA_MATCH;
      reasons.push("Room name match in defect description");
    }
  }

  return { confidence, reasons, keywordsUsed };
}

/**
 * Infer expected severity from the rule's reduction percentage.
 * Swiss practice: higher % = more severe defect.
 */
function inferSeverityFromReduction(percent: number): DefectSeverity {
  if (percent >= 50) return "critical";
  if (percent >= 25) return "severe";
  if (percent >= 10) return "moderate";
  return "mild";
}

/**
 * Check if detected severity aligns with implied severity.
 * Alignment = same level, or ±1 level (partial match).
 */
const SEVERITY_RANK: Record<DefectSeverity, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
  critical: 4,
};

function severityAligns(detected: DefectSeverity, implied: DefectSeverity): boolean {
  return Math.abs(SEVERITY_RANK[detected] - SEVERITY_RANK[implied]) <= 1;
}

/**
 * Strip diacritics for fuzzy matching.
 */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Compute aggregate confidence from top matches.
 * Weighted: best match counts fully, subsequent matches contribute diminishing returns.
 */
function computeAggregateConfidence(matches: DefectMatch[]): number {
  if (matches.length === 0) return 0;

  let total = 0;
  const weights = [1.0, 0.3, 0.15, 0.1, 0.05];
  for (let i = 0; i < matches.length && i < weights.length; i++) {
    total += matches[i].matchConfidence * weights[i];
  }

  return Math.min(100, Math.round(total));
}
