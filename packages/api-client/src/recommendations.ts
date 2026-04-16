/**
 * Recommendations — API client DTO types and fetch methods
 *
 * Matches endpoints in routes/recommendations.ts
 */

// ── Types ──────────────────────────────────────────────────────

export type DecisionOptionType =
  | "replace_full"
  | "replace_component"
  | "repair"
  | "defer"
  | "upgrade";

export type UserDecisionStatus = "pending" | "accepted" | "rejected" | "deferred";

export interface DecisionOptionDTO {
  id: string;
  orgId: string;
  opportunityId: string;
  optionType: DecisionOptionType;
  title: string;
  description: string;
  estimatedCost: number;
  estimatedUsefulLifeYears: number;
  implementationMonths: number;
  tenantDisruptionScore: number;
  riskReductionScore: number;
  complianceCoverageScore: number;
  saleAttractivenessScore: number;
  rentUpliftScore: number;
  opexReductionScore: number;
  lifecycleExtensionScore: number;
  modernizationImpactScore: number;
  totalValueCreationScore: number;
  uncertaintyScore: number;
  taxProfileJson?: string | null;
  financialProjectionJson?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationDTO {
  id: string;
  orgId: string;
  opportunityId: string;
  buildingProfileId: string;
  evaluatedAt: string;
  selectedOptionId: string;
  rankedOptionsJson: string;
  explanationJson: string;
  userDecision: UserDecisionStatus;
  userDecidedAt?: string | null;
  userFeedback?: string | null;
  selectedOption: Pick<DecisionOptionDTO, "id" | "optionType" | "title" | "estimatedCost">;
  buildingProfile: { id: string; primaryArchetype: string; secondaryArchetype?: string | null };
  createdAt: string;
  updatedAt: string;
}

// ── Fetch helpers ──────────────────────────────────────────────

const BASE = typeof window !== "undefined" ? "" : "http://localhost:3001";

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function createDecisionOptions(
  options: Array<Partial<DecisionOptionDTO> & { opportunityId: string; optionType: string }>,
  token?: string,
): Promise<{ options: DecisionOptionDTO[] }> {
  const res = await fetch(`${BASE}/decision-options`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ options }),
  });
  if (!res.ok) throw new Error(`createDecisionOptions failed: ${res.status}`);
  return res.json();
}

export async function getDecisionOptions(
  opportunityId: string,
  token?: string,
): Promise<{ options: DecisionOptionDTO[] }> {
  const res = await fetch(`${BASE}/decision-options/${opportunityId}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`getDecisionOptions failed: ${res.status}`);
  return res.json();
}

export async function evaluateRecommendation(
  body: {
    opportunityId: string;
    buildingProfileId: string;
    primaryArchetype: string;
    secondaryArchetype?: string | null;
    secondaryMix?: number;
    opportunity?: { urgency: string; conditionState: string; complianceRisk: string };
    planningHorizonYears?: number;
    capexBudgetConstraint?: number;
    plannedSaleWithin12Months?: boolean;
  },
  token?: string,
): Promise<{ recommendation: RecommendationDTO }> {
  const res = await fetch(`${BASE}/recommendations/evaluate`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`evaluateRecommendation failed: ${res.status}`);
  return res.json();
}

export async function getRecommendations(
  opportunityId: string,
  token?: string,
): Promise<{ recommendations: RecommendationDTO[] }> {
  const res = await fetch(`${BASE}/recommendations/${opportunityId}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`getRecommendations failed: ${res.status}`);
  return res.json();
}

export async function recordDecision(
  resultId: string,
  body: { userDecision: "accepted" | "rejected" | "deferred"; userFeedback?: string },
  token?: string,
): Promise<{ recommendation: RecommendationDTO }> {
  const res = await fetch(`${BASE}/recommendations/${resultId}/decision`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recordDecision failed: ${res.status}`);
  return res.json();
}
