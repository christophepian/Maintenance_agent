import { REQUIRED_DOC_TYPES, RENTAL_DOC_TYPES } from "../validation/rentalApplications";

/* ══════════════════════════════════════════════════════════════
   Rental Evaluation Engine
   ══════════════════════════════════════════════════════════════

   Phase 1 rules:
   1. Income rule (hard disqualifier):
      net household income >= multiplier × (rent + charges)
   2. Missing docs rule (hard disqualifier):
      all required doc types must be present per applicant
   3. Confidence score (0–100):
      based on doc completeness + income proof + basic heuristics
   4. Score total (0–1000):
      weighted sum of confidence, income ratio, employment stability
   ══════════════════════════════════════════════════════════════ */

export interface EvaluationInput {
  applicants: Array<{
    id: string;
    role: string;
    firstName: string;
    lastName: string;
    netMonthlyIncome?: number | null;
    employer?: string | null;
    jobTitle?: string | null;
    employedSince?: Date | null;
    hasDebtEnforcement?: boolean | null;
  }>;
  attachments: Array<{
    applicantId: string;
    docType: string;
  }>;
  monthlyRentChf: number;
  monthlyChargesChf: number;
  incomeMultiplier: number; // from building policy, default 3
}

export interface EvaluationResult {
  scoreTotal: number;
  confidenceScore: number;
  disqualified: boolean;
  incomeDisqualified: boolean;
  reasons: string[];
  missingDocs: string[];
  breakdown: EvaluationBreakdown;
}

export interface EvaluationBreakdown {
  totalMonthlyIncome: number;
  requiredIncome: number;
  incomeRatio: number;
  incomeScore: number;
  docCompletenessScore: number;
  employmentStabilityScore: number;
  debtEnforcementPenalty: number;
  missingDocsPerApplicant: Record<string, string[]>;
}

/**
 * Evaluate a rental application against a specific unit.
 * Returns score, confidence, disqualification status, and breakdown.
 */
export function evaluate(input: EvaluationInput): EvaluationResult {
  const reasons: string[] = [];
  const missingDocs: string[] = [];
  let disqualified = false;
  let incomeDisqualified = false;

  const totalCost = input.monthlyRentChf + input.monthlyChargesChf;
  const requiredIncome = input.incomeMultiplier * totalCost;

  // ── 1. Calculate total household income ──────────────────

  const totalMonthlyIncome = input.applicants.reduce(
    (sum, a) => sum + (a.netMonthlyIncome || 0),
    0,
  );

  const incomeRatio =
    requiredIncome > 0 ? totalMonthlyIncome / requiredIncome : 999;

  // ── 2. Income rule (hard disqualifier) ───────────────────

  if (totalMonthlyIncome < requiredIncome) {
    disqualified = true;
    incomeDisqualified = true;
    reasons.push(
      `INSUFFICIENT_INCOME: household income CHF ${totalMonthlyIncome}/mo < required CHF ${requiredIncome}/mo (${input.incomeMultiplier}× rent+charges)`,
    );
  }

  // ── 3. Missing docs rule (hard disqualifier) ─────────────

  const missingDocsPerApplicant: Record<string, string[]> = {};

  for (const applicant of input.applicants) {
    const applicantDocs = input.attachments
      .filter((att) => att.applicantId === applicant.id)
      .map((att) => att.docType);

    const missing = REQUIRED_DOC_TYPES.filter(
      (dt) => !applicantDocs.includes(dt),
    );

    if (missing.length > 0) {
      missingDocsPerApplicant[applicant.id] = missing;
      for (const doc of missing) {
        missingDocs.push(`${applicant.firstName} ${applicant.lastName}: ${doc}`);
      }
      disqualified = true;
      reasons.push(
        `MISSING_REQUIRED_DOCS: ${applicant.firstName} ${applicant.lastName} missing ${missing.join(", ")}`,
      );
    }
  }

  // ── 4. Debt enforcement check ────────────────────────────

  let debtEnforcementPenalty = 0;
  for (const applicant of input.applicants) {
    if (applicant.hasDebtEnforcement) {
      debtEnforcementPenalty += 100;
      reasons.push(
        `DEBT_ENFORCEMENT: ${applicant.firstName} ${applicant.lastName} has debt enforcement records`,
      );
    }
  }

  // ── 5. Scoring ───────────────────────────────────────────

  // Income score (0–400): proportional to income ratio
  const incomeScore = Math.min(400, Math.round(incomeRatio * 200));

  // Doc completeness score (0–300): fraction of all doc types present
  const totalRequiredDocs = input.applicants.length * REQUIRED_DOC_TYPES.length;
  const totalPresentDocs = totalRequiredDocs - missingDocs.length;
  const docCompletenessScore =
    totalRequiredDocs > 0
      ? Math.round((totalPresentDocs / totalRequiredDocs) * 300)
      : 300;

  // Employment stability score (0–200): years employed
  let employmentStabilityScore = 0;
  for (const applicant of input.applicants) {
    if (applicant.employedSince) {
      const years =
        (Date.now() - new Date(applicant.employedSince).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000);
      // 50 points per year of employment, max 100 per applicant
      employmentStabilityScore += Math.min(100, Math.round(years * 50));
    }
  }
  employmentStabilityScore = Math.min(200, employmentStabilityScore);

  // Total score (0–1000)
  const scoreTotal = Math.max(
    0,
    incomeScore +
      docCompletenessScore +
      employmentStabilityScore -
      debtEnforcementPenalty,
  );

  // ── 6. Confidence score (0–100) ──────────────────────────
  // How confident are we in the evaluation?
  // Combines document presence + data completeness.

  let confidence = 0;

  // ─ Document-based confidence (max 50) ─

  // Income proof available? (+12)
  const hasAnyIncomeProof = input.attachments.some(
    (a) => a.docType === "SALARY_PROOF",
  );
  if (hasAnyIncomeProof) confidence += 12;

  // Identity docs present? (+10)
  const hasAnyIdentity = input.attachments.some(
    (a) => a.docType === "IDENTITY",
  );
  if (hasAnyIdentity) confidence += 10;

  // Debt enforcement extract present? (+8)
  const hasDebtExtract = input.attachments.some(
    (a) => a.docType === "DEBT_ENFORCEMENT_EXTRACT",
  );
  if (hasDebtExtract) confidence += 8;

  // All required docs present? (+10)
  if (missingDocs.length === 0) confidence += 10;

  // Optional docs bonus (+2 each, max 10)
  const optionalDocTypes = RENTAL_DOC_TYPES.filter(
    (dt) => !REQUIRED_DOC_TYPES.includes(dt as any),
  );
  const optionalPresent = optionalDocTypes.filter((dt) =>
    input.attachments.some((a) => a.docType === dt),
  ).length;
  confidence += Math.min(10, optionalPresent * 2);

  // ─ Data-based confidence (max 50) ─

  // Employment info provided? (+10)
  const hasEmploymentInfo = input.applicants.some(
    (a) => a.employer && a.netMonthlyIncome,
  );
  if (hasEmploymentInfo) confidence += 10;

  // Employment tenure known? (+8)
  const hasTenure = input.applicants.some((a) => a.employedSince);
  if (hasTenure) confidence += 8;

  // Income level relative to requirement determines confidence:
  // incomeRatio 1.0 = exactly meets 3× rent threshold
  // Higher surplus = more financial buffer = more confident (+0 to +12)
  if (incomeRatio >= 1.8) confidence += 12;
  else if (incomeRatio >= 1.3) confidence += 8;
  else if (incomeRatio >= 1.0) confidence += 4;
  // Below 1.0 = disqualified on income, no confidence bonus

  // Employer quality heuristic: known large employer names (+5)
  const knownEmployers = [
    "google", "ubs", "credit suisse", "novartis", "roche", "zurich insurance",
    "swiss re", "nestle", "abb", "sbb", "post", "swisscom", "migros", "coop",
    "swatch", "lonza", "holcim", "siemens", "accenture", "deloitte", "pwc",
    "kpmg", "ey", "mckinsey", "bcg",
  ];
  const hasKnownEmployer = input.applicants.some((a) =>
    a.employer && knownEmployers.some((e) => a.employer!.toLowerCase().includes(e)),
  );
  if (hasKnownEmployer) confidence += 5;

  // Debt enforcement flag gives a negative confidence signal:
  // We're more confident in a negative outcome (-0 or +5 if declared)
  if (debtEnforcementPenalty > 0) {
    // Declared debt = we know the situation (paradoxically more confident)
    confidence += 5;
  }

  // Multiple applicants provide more data points (+5)
  if (input.applicants.length > 1) confidence += 5;

  const confidenceScore = Math.min(100, confidence);

  return {
    scoreTotal,
    confidenceScore,
    disqualified,
    incomeDisqualified,
    reasons,
    missingDocs,
    breakdown: {
      totalMonthlyIncome,
      requiredIncome,
      incomeRatio: Math.round(incomeRatio * 100) / 100,
      incomeScore,
      docCompletenessScore,
      employmentStabilityScore,
      debtEnforcementPenalty,
      missingDocsPerApplicant,
    },
  };
}
