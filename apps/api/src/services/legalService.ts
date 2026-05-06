/**
 * Legal Service
 *
 * CRUD and query logic for:
 *   - LegalVariable (jurisdiction-scoped, global — SA-11)
 *   - LegalRule + versions (jurisdiction-scoped, global — SA-11)
 *   - LegalCategoryMapping (org-scoped or global)
 *   - LegalEvaluationLog (org-scoped)
 *   - DepreciationStandard (jurisdiction-scoped, global — SA-11)
 *
 * Layer: service (calls prismaClient directly — no workflow orchestration here)
 *
 * SA-11: LegalVariable, LegalRule, and DepreciationStandard are intentionally
 * global (no orgId) because statutory rules and industry standards apply
 * uniformly across all organisations within a jurisdiction.
 */

import prisma from "./prismaClient";
import * as legalSourceRepo from "../repositories/legalSourceRepository";
import * as requestRepo from "../repositories/requestRepository";
import {
  LEGAL_VARIABLE_INCLUDE,
  LEGAL_RULE_INCLUDE,
  LEGAL_RULE_WITH_VERSIONS_INCLUDE,
  DEPRECIATION_STANDARD_INCLUDE,
} from "../repositories/legalSourceRepository";
import type { CreateLegalRuleBody } from "../validation/legal";

// ── Error types ──────────────────────────────────────────────

export class LegalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalConflictError";
  }
}

export class LegalNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalNotFoundError";
  }
}

export class LegalForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalForbiddenError";
  }
}

// ── Legal Variables ──────────────────────────────────────────

export async function listVariables() {
  return legalSourceRepo.findAllLegalVariables(prisma);
}

// ── Legal Rules ──────────────────────────────────────────────

export async function listRules() {
  return legalSourceRepo.findAllLegalRules(prisma);
}

export async function createRule(data: CreateLegalRuleBody) {
  const { dslJson, citationsJson, summary, effectiveFrom, ...ruleData } = data;
  try {
    return await legalSourceRepo.createLegalRuleWithVersion(prisma, {
      key: ruleData.key,
      ruleType: ruleData.ruleType,
      authority: ruleData.authority,
      jurisdiction: ruleData.jurisdiction,
      canton: ruleData.canton ?? null,
      priority: ruleData.priority,
      isActive: ruleData.isActive,
      effectiveFrom,
      dslJson,
      citationsJson: citationsJson ?? null,
      summary: summary ?? null,
    });
  } catch (e: any) {
    if (e.code === "P2002") throw new LegalConflictError("Rule key already exists");
    throw e;
  }
}

// ── Category Mappings ────────────────────────────────────────

export async function listCategoryMappings(orgId: string) {
  return legalSourceRepo.findCategoryMappingsByOrg(prisma, orgId);
}

export interface CreateCategoryMappingData {
  requestCategory: string;
  legalTopic: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export async function createCategoryMapping(orgId: string, data: CreateCategoryMappingData) {
  try {
    return await legalSourceRepo.createCategoryMappingRecord(prisma, orgId, data);
  } catch (e: any) {
    if (e.code === "P2002") throw new LegalConflictError("Mapping for this category already exists in this org");
    throw e;
  }
}

export async function updateCategoryMapping(id: string, orgId: string, data: Partial<CreateCategoryMappingData>) {
  const existing = await legalSourceRepo.findCategoryMappingById(prisma, id);
  if (!existing) throw new LegalNotFoundError("Mapping not found");
  if (existing.orgId && existing.orgId !== orgId) throw new LegalForbiddenError("Mapping belongs to another org");
  return legalSourceRepo.updateCategoryMappingById(prisma, id, data);
}

export async function deleteCategoryMapping(id: string, orgId: string) {
  const existing = await legalSourceRepo.findCategoryMappingById(prisma, id);
  if (!existing) throw new LegalNotFoundError("Mapping not found");
  if (existing.orgId && existing.orgId !== orgId) throw new LegalForbiddenError("Mapping belongs to another org");
  await legalSourceRepo.deleteCategoryMappingById(prisma, id);
}

// ── Category Mapping Coverage ────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  STOVE_COOKTOP: ["STOVE", "COOKTOP", "HOB", "CUISIN", "COOKER"],
  OVEN_APPLIANCE: ["OVEN", "FOUR", "COOKER"],
  DISHWASHER: ["DISHWASHER", "LAVE_VAISSELLE"],
  BATHROOM_PLUMBING: ["BATHROOM", "BATHTUB", "SHOWER", "WC", "TOILET", "BIDET"],
  LIGHTING_ELECTRICAL: ["LIGHT", "SWITCH", "LAMP", "DIMMER"],
  PLUMBING_WATER: ["TAP", "PIPE", "DRAIN", "WATER", "PLUMB", "FAUCET", "SIPHON"],
  GENERAL_MAINTENANCE: [],
};

export async function getMappingCoverage(orgId: string) {
  const requests = await requestRepo.findDistinctRequestCategories(prisma);
  const usedCategories = requests.map((r) => r.category).filter(Boolean) as string[];

  const mappings = await legalSourceRepo.findActiveCategoryMappings(prisma, orgId);

  const allDeps = await legalSourceRepo.findDepreciationStandardsForCoverage(prisma);
  const allRules = await legalSourceRepo.findRentReductionRuleKeys(prisma);

  const knownCategories = ["stove", "oven", "dishwasher", "bathroom", "lighting", "plumbing", "other"];
  const allCategories = [...new Set([...knownCategories, ...usedCategories])];

  const coverage = allCategories.map((cat) => {
    const orgMapping = mappings.find((m) => m.requestCategory === cat && m.orgId === orgId);
    const globalMapping = mappings.find((m) => m.requestCategory === cat && m.orgId === null);
    const mapping = orgMapping || globalMapping;
    const legalTopic = mapping?.legalTopic || null;
    const scope = orgMapping ? "org" : globalMapping ? "global" : null;

    const keywords = legalTopic ? (TOPIC_KEYWORDS[legalTopic] || []) : [];
    const depMatches = keywords.length > 0
      ? allDeps.filter((d) => keywords.some((k) => d.topic.toUpperCase().includes(k)))
      : [];
    const ruleMatches = keywords.length > 0
      ? allRules.filter((r) => keywords.some((k) => r.key.toUpperCase().includes(k)))
      : [];

    const lifespanMonths = depMatches.map((d) => d.usefulLifeMonths);
    const minLifeYears = lifespanMonths.length > 0 ? Math.round(Math.min(...lifespanMonths) / 12) : null;
    const maxLifeYears = lifespanMonths.length > 0 ? Math.round(Math.max(...lifespanMonths) / 12) : null;
    const readableAssets = [...new Set(depMatches.map((d) =>
      d.topic.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
    ))].slice(0, 6);
    const readableRules = [...new Set(ruleMatches.map((r) =>
      r.key.replace(/^CH_RENT_RED_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
    ))].slice(0, 5);

    return {
      category: cat,
      mapped: !!mapping,
      legalTopic,
      scope,
      mappingId: mapping?.id || null,
      isActive: mapping?.isActive ?? null,
      depreciationCount: depMatches.length,
      ruleCount: ruleMatches.length,
      depreciationSamples: depMatches.slice(0, 5).map((d) => ({
        topic: d.topic,
        assetType: d.assetType,
        usefulLifeMonths: d.usefulLifeMonths,
      })),
      ruleSamples: ruleMatches.slice(0, 5).map((r) => r.key),
      lifespanRange: minLifeYears !== null
        ? (minLifeYears === maxLifeYears ? `${minLifeYears} years` : `${minLifeYears}–${maxLifeYears} years`)
        : null,
      readableAssets,
      readableRules,
    };
  });

  return {
    data: coverage,
    summary: {
      totalCategories: allCategories.length,
      mappedCategories: coverage.filter((c) => c.mapped).length,
      unmappedCategories: coverage.filter((c) => !c.mapped).length,
    },
  };
}

// ── Evaluation Logs ──────────────────────────────────────────

export interface ListEvaluationsParams {
  orgId: string;
  limit?: number;
  offset?: number;
  obligationFilter?: string;
  categoryFilter?: string;
  requestIdFilter?: string;
}

export async function listEvaluations(params: ListEvaluationsParams) {
  const { orgId, limit = 20, offset = 0, obligationFilter, categoryFilter, requestIdFilter } = params;

  const where: any = { orgId };
  if (requestIdFilter) where.requestId = requestIdFilter;

  const [rows, total] = await legalSourceRepo.findEvaluationLogsWithCount(prisma, where, limit, offset);

  // ── Resolve building names, unit numbers, request descriptions ──
  const buildingIds = [...new Set(rows.map((r: any) => r.buildingId).filter(Boolean))] as string[];
  const unitIds = [...new Set(rows.map((r: any) => r.unitId).filter(Boolean))] as string[];
  const requestIds = [...new Set(rows.map((r: any) => r.requestId).filter(Boolean))] as string[];

  const [buildings, units, requests] = await Promise.all([
    buildingIds.length ? legalSourceRepo.findBuildingNamesByIds(prisma, buildingIds) : [],
    unitIds.length ? legalSourceRepo.findUnitNumbersByIds(prisma, unitIds) : [],
    requestIds.length ? legalSourceRepo.findRequestSummariesByIds(prisma, requestIds) : [],
  ]);

  const buildingMap = new Map(buildings.map((b: any) => [b.id, b] as const));
  const unitMap = new Map(units.map((u: any) => [u.id, u] as const));
  const requestMap = new Map(requests.map((r: any) => [r.id, r] as const));

  const data = rows
    .map((row: any) => {
      const ctx = (row.contextJson ?? {}) as Record<string, any>;
      const result = (row.resultJson ?? {}) as Record<string, any>;
      const building = row.buildingId ? buildingMap.get(row.buildingId) : null;
      const unit = row.unitId ? unitMap.get(row.unitId) : null;
      const request = row.requestId ? requestMap.get(row.requestId) : null;
      return {
        id: row.id,
        requestId: row.requestId,
        requestNumber: request?.requestNumber ?? null,
        requestDescription: request?.description ?? null,
        buildingId: row.buildingId,
        buildingName: building?.name ?? null,
        buildingAddress: building?.address ?? null,
        unitId: row.unitId,
        unitNumber: unit?.unitNumber ?? null,
        createdAt: row.createdAt,
        category: ctx.category ?? null,
        canton: ctx.canton ?? null,
        legalTopic: result.legalTopic ?? ctx.legalTopic ?? null,
        obligation: result.obligation ?? null,
        confidence: typeof result.confidence === "number" ? result.confidence / 100 : 0,
        reasons: Array.isArray(result.reasons) ? result.reasons : [],
        citations: deduplicateCitations(Array.isArray(result.citations) ? result.citations : []),
        recommendedActions: Array.isArray(result.recommendedActions) ? result.recommendedActions : [],
        depreciationSignal: result.depreciationSignal ?? null,
        matchedRuleCount: result.matchedRuleCount ?? 0,
      };
    })
    .filter((ev) => {
      if (obligationFilter && ev.obligation !== obligationFilter) return false;
      if (categoryFilter && ev.category !== categoryFilter) return false;
      return true;
    });

  return { data, total };
}

// ── Depreciation Standards ───────────────────────────────────

export async function listDepreciationStandards() {
  return legalSourceRepo.findAllDepreciationStandards(prisma);
}

export interface CreateDepreciationStandardData {
  assetType: string;
  topic: string;
  usefulLifeMonths: number;
  jurisdiction?: string;
  [key: string]: unknown;
}

export async function createDepreciationStandard(data: CreateDepreciationStandardData) {
  try {
    return await legalSourceRepo.createDepreciationStandardFull(prisma, data);
  } catch (e: any) {
    if (e.code === "P2002") throw new LegalConflictError("Depreciation standard for this asset/topic/jurisdiction already exists");
    throw e;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function deduplicateCitations(
  citations: Array<{ article?: string; text?: string; authority?: string }>,
): Array<{ article: string; text: string; authority: string }> {
  const seen = new Set<string>();
  const result: Array<{ article: string; text: string; authority: string }> = [];
  for (const c of citations) {
    const key = `${c.article || ""}|${c.text || ""}|${c.authority || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ article: c.article || "", text: c.text || "", authority: c.authority || "" });
    }
  }
  return result;
}
