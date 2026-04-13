/**
 * Legal Domain — Typed API Client
 *
 * DTOs and fetch methods for the legal engine endpoints.
 * Part of Legal Engine Hardening Phase D (D-1).
 */

/* ═══════════════════════════════════════════════════════════════
 * Enums (mirror backend Prisma enums used in legal domain)
 * ═══════════════════════════════════════════════════════════════ */

export type LegalAuthority = "STATUTE" | "INDUSTRY_STANDARD" | "JUDICIAL_DECISION";

export type LegalSourceScope = "NATIONAL" | "CANTONAL" | "MUNICIPAL";

export type LegalSourceStatus = "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING";

export type LegalRuleScope = "FEDERAL" | "CANTONAL" | "MUNICIPAL";

export type LegalObligationResult =
  | "OBLIGATED"
  | "DISCRETIONARY"
  | "TENANT_RESPONSIBLE"
  | "UNKNOWN"
  | "RECOMMENDED"
  | "NOT_APPLICABLE";

export type DefectSeverity = "mild" | "moderate" | "severe" | "critical";

/* ═══════════════════════════════════════════════════════════════
 * DTOs
 * ═══════════════════════════════════════════════════════════════ */

// ─── Legal Source ─────────────────────────────────────────────

export interface LegalSourceDTO {
  id: string;
  name: string;
  url: string | null;
  jurisdiction: string;
  scope: LegalSourceScope;
  fetcherType: string | null;
  parserType: string | null;
  updateFrequency: string | null;
  status: LegalSourceStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Legal Variable ───────────────────────────────────────────

export interface LegalVariableDTO {
  id: string;
  key: string;
  name: string;
  jurisdiction: string;
  canton: string | null;
  currentValue: unknown;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceId: string | null;
}

// ─── Legal Rule ───────────────────────────────────────────────

export interface LegalRuleDTO {
  id: string;
  key: string;
  name: string;
  ruleType: string;
  authority: LegalAuthority;
  jurisdiction: string;
  canton: string | null;
  scope: LegalRuleScope;
  topic: string | null;
  priority: number;
  isActive: boolean;
  latestVersion: LegalRuleVersionDTO | null;
  createdAt: string;
}

export interface LegalRuleVersionDTO {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  dslJson: unknown;
  citationsJson: unknown;
}

// ─── Category Mapping ─────────────────────────────────────────

export interface LegalCategoryMappingDTO {
  id: string;
  orgId: string | null;
  requestCategory: string;
  legalTopic: string;
  confidence: number;
  isActive: boolean;
}

// ─── Legal Evaluation ─────────────────────────────────────────

export interface LegalEvaluationDTO {
  id: string;
  orgId: string;
  buildingId: string | null;
  unitId: string | null;
  requestId: string | null;
  obligation: LegalObligationResult;
  confidence: number;
  category: string | null;
  legalTopic: string | null;
  reasons: string[];
  recommendedActions: string[];
  contextJson: unknown;
  resultJson: unknown;
  createdAt: string;
}

// ─── Depreciation Standard ────────────────────────────────────

export interface DepreciationStandardDTO {
  id: string;
  name: string;
  canton: string | null;
  assetType: string;
  usefulLifeMonths: number;
  sourceReference: string | null;
}

// ─── Depreciation Signal ──────────────────────────────────────

export interface DepreciationSignalDTO {
  assetId: string;
  assetType: string;
  topic: string;
  ageMonths: number;
  usefulLifeMonths: number;
  remainingLifePct: number;
  fullyDepreciated: boolean;
}

// ─── Citation ─────────────────────────────────────────────────

export interface CitationDTO {
  article: string;
  text: string;
  authority: string;
}

// ─── Defect Signals ───────────────────────────────────────────

export interface DefectKeywordDTO {
  term: string;
  category: string;
  weight: number;
}

export interface DefectSignalsDTO {
  keywords: DefectKeywordDTO[];
  severity: DefectSeverity;
  affectedArea: {
    roomCount?: number;
    percentAffected?: number;
    rooms: string[];
  };
  duration: {
    months?: number;
    ongoing: boolean;
    seasonal: boolean;
  };
  inferredCategories: string[];
}

// ─── Defect Match ─────────────────────────────────────────────

export interface DefectMatchDTO {
  ruleKey: string;
  ruleId: string;
  defect: string;        // French (audit)
  defectEn: string;      // English display text
  category: string;      // French ASLOCA category
  categoryEn: string;    // English category
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number;
  matchReasons: string[];
  citation: { article: string; text: string };
}

// ─── Rent Reduction ───────────────────────────────────────────

export interface ReductionLineDTO {
  defect: string;
  ruleKey: string;
  reductionPercent: number;
  reductionMax?: number;
  monthlyReductionChf: number;
  monthlyReductionMaxChf?: number;
  seasonal: boolean;
  seasonalNote?: string;
}

export interface RentReductionResultDTO {
  netRentChf: number;
  primaryReduction: ReductionLineDTO;
  additionalReductions: ReductionLineDTO[];
  totalReductionPercent: number;
  totalReductionChf: number;
  capApplied: boolean;
  capNote?: string;
  estimatedBackPayMonths?: number;
}

// ─── Rent Reduction Match (Phase A simple) ────────────────────

export interface RentReductionMatchDTO {
  ruleKey: string;
  defect: string;
  category: string;
  reductionPercent: number;
  basis: string;
  source: string;
  relevanceScore: number;
}

// ─── Legal Decision ───────────────────────────────────────────

export interface LegalDecisionDTO {
  requestId: string;
  legalTopic: string | null;
  legalObligation: LegalObligationResult;
  confidence: number;
  reasons: string[];
  citations: CitationDTO[];
  depreciationSignal: DepreciationSignalDTO | null;
  matchedReductions: RentReductionMatchDTO[];
  defectSignals: DefectSignalsDTO | null;
  defectMatches: DefectMatchDTO[];
  rentReductionEstimate: RentReductionResultDTO | null;
  recommendedActions: string[];
  rfpId: string | null;
  evaluationLogId: string;
}

// ─── Tenant Claim Analysis ────────────────────────────────────

export interface MatchedDefectEntryDTO {
  rank: number;
  ruleKey: string;
  defect: string;
  category: string;
  reductionPercent: number;
  reductionMax?: number;
  matchConfidence: number;
  matchReasons: string[];
}

export interface LegalBasisEntryDTO {
  article: string;
  text: string;
  authority: string;
  relevance: string;
}

export interface TenantGuidanceDTO {
  summary: string;
  nextSteps: string[];
  deadlines: string[];
  escalation: string;
}

export interface LandlordObligationsDTO {
  summary: string;
  requiredActions: string[];
  timeline: string;
}

export interface TemporalContextDTO {
  defectOngoingSince?: string;
  durationMonths?: number;
  seasonalAdjustment: boolean;
  proRatedPercent?: number;
  backdatedReductionChf?: number;
}

export interface TenantClaimAnalysisDTO {
  requestId: string;
  requestDescription: string;
  category: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  canton: string | null;
  defectSignals: DefectSignalsDTO;
  legalObligation: LegalObligationResult;
  legalTopic: string | null;
  confidence: number;
  matchedDefects: MatchedDefectEntryDTO[];
  rentReduction: RentReductionResultDTO | null;
  legalBasis: LegalBasisEntryDTO[];
  depreciationSignal: DepreciationSignalDTO | null;
  tenantGuidance: TenantGuidanceDTO;
  landlordObligations: LandlordObligationsDTO;
  temporalContext: TemporalContextDTO;
  evaluationLogId: string;
  analysedAt: string;
}

// ─── Ingestion ────────────────────────────────────────────────

export interface IngestionResultDTO {
  sourceId: string;
  sourceName: string;
  success: boolean;
  rulesCreated: number;
  rulesUpdated: number;
  error?: string;
}

// ─── Coverage ─────────────────────────────────────────────────

export interface CoverageResultDTO {
  totalCategories: number;
  mappedCategories: number;
  unmappedCategories: string[];
  coveragePercent: number;
}

/* ═══════════════════════════════════════════════════════════════
 * Fetch methods
 * ═══════════════════════════════════════════════════════════════ */

/**
 * All fetch methods use the same base URL pattern and error handling
 * as the main api-client. They are standalone (no createApiClient dependency)
 * so that frontend pages can import and call them directly.
 */

async function legalFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: any;
    try { body = await res.json(); } catch { body = { error: { message: res.statusText } }; }
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** GET /requests/:id/legal-decision */
export async function fetchLegalDecision(
  requestId: string,
): Promise<LegalDecisionDTO> {
  const res = await legalFetch<{ data: LegalDecisionDTO }>(
    `/requests/${requestId}/legal-decision`,
  );
  return res.data;
}

/** GET /requests/:id/claim-analysis */
export async function fetchClaimAnalysis(
  requestId: string,
): Promise<TenantClaimAnalysisDTO> {
  const res = await legalFetch<{ data: TenantClaimAnalysisDTO }>(
    `/requests/${requestId}/claim-analysis`,
  );
  return res.data;
}

/** GET /legal/sources */
export async function fetchLegalSources(): Promise<LegalSourceDTO[]> {
  const res = await legalFetch<{ data: LegalSourceDTO[] }>("/legal/sources");
  return res.data;
}

/** GET /legal/variables */
export async function fetchLegalVariables(): Promise<LegalVariableDTO[]> {
  const res = await legalFetch<{ data: LegalVariableDTO[] }>("/legal/variables");
  return res.data;
}

/** GET /legal/rules */
export async function fetchLegalRules(): Promise<LegalRuleDTO[]> {
  const res = await legalFetch<{ data: LegalRuleDTO[] }>("/legal/rules");
  return res.data;
}

/** GET /legal/category-mappings */
export async function fetchCategoryMappings(): Promise<LegalCategoryMappingDTO[]> {
  const res = await legalFetch<{ data: LegalCategoryMappingDTO[] }>("/legal/category-mappings");
  return res.data;
}

/** GET /legal/category-mappings/coverage */
export async function fetchMappingCoverage(): Promise<CoverageResultDTO> {
  return legalFetch<CoverageResultDTO>("/legal/category-mappings/coverage");
}

/** GET /legal/evaluations */
export async function fetchEvaluations(params?: {
  limit?: number;
  offset?: number;
  obligation?: string;
  category?: string;
}): Promise<{ data: LegalEvaluationDTO[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.obligation) qs.set("obligation", params.obligation);
  if (params?.category) qs.set("category", params.category);
  const queryStr = qs.toString();
  return legalFetch<{ data: LegalEvaluationDTO[]; total: number }>(
    `/legal/evaluations${queryStr ? `?${queryStr}` : ""}`,
  );
}

/** GET /legal/depreciation-standards */
export async function fetchDepreciationStandards(): Promise<DepreciationStandardDTO[]> {
  const res = await legalFetch<{ data: DepreciationStandardDTO[] }>("/legal/depreciation-standards");
  return res.data;
}

/** POST /legal/ingest (or /legal/ingest/:sourceId) */
export async function triggerIngestion(
  sourceId?: string,
): Promise<IngestionResultDTO[]> {
  const path = sourceId
    ? `/legal/ingestion/trigger`
    : `/legal/ingestion/trigger`;
  const res = await legalFetch<{ data: IngestionResultDTO[] }>(path, {
    method: "POST",
    body: sourceId ? JSON.stringify({ sourceId }) : JSON.stringify({}),
  });
  return res.data;
}
