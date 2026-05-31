/**
 * Legal Source Repository
 *
 * Centralizes all Prisma access for the LegalSource entity.
 * Fixes G3 violation: Prisma calls were previously inline in routes.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, LegalSourceStatus, LegalSourceScope, Prisma } from "@prisma/client";

// ─── Canonical Includes (G9) ───────────────────────────────────

/** Include for GET /legal/variables — last 5 versions, ordered desc. */
export const LEGAL_VARIABLE_INCLUDE = {
  versions: {
    orderBy: { effectiveFrom: "desc" as const },
    take: 5,
  },
};

/** Include for GET /legal/rules — latest version only. */
export const LEGAL_RULE_INCLUDE = {
  versions: {
    orderBy: { effectiveFrom: "desc" as const },
    take: 1,
  },
};

/** Include for POST /legal/rules — all versions after create. */
export const LEGAL_RULE_WITH_VERSIONS_INCLUDE = {
  versions: true,
};

/** Include for GET /legal/depreciation-standards. */
export const DEPRECIATION_STANDARD_INCLUDE = {
  source: { select: { id: true, name: true } },
};

// ─── Input Types ───────────────────────────────────────────────

export interface CreateLegalSourceInput {
  name: string;
  url?: string | null;
  jurisdiction?: string;
  scope?: LegalSourceScope;
  fetcherType?: string | null;
  parserType?: string | null;
  updateFrequency?: string | null;
  status?: LegalSourceStatus;
}

export type UpdateLegalSourceInput = Partial<CreateLegalSourceInput>;

// ─── Query Functions ───────────────────────────────────────────

/**
 * List all legal sources, ordered by name.
 * orgId is reserved for future multi-tenant scoping.
 */
export async function findAll(
  prisma: PrismaClient,
  _orgId?: string,
) {
  return prisma.legalSource.findMany({
    orderBy: { name: "asc" },
  });
}

/**
 * Find sources matching a set of scopes, excluding INACTIVE.
 * Used by ingestion when a canton is known: pass [FEDERAL, <canton>].
 */
export async function findByScope(
  prisma: PrismaClient,
  scopes: LegalSourceScope[],
) {
  return prisma.legalSource.findMany({
    where: {
      status: { not: LegalSourceStatus.INACTIVE },
      scope: { in: scopes },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Find legal sources applicable to a specific building.
 * Returns FEDERAL sources + canton-specific sources matching the building's canton.
 * Used by the Documents tab and AI system prompt enrichment.
 */
export async function findForBuilding(
  prisma: PrismaClient,
  buildingId: string,
) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { canton: true },
  });

  const scopes: LegalSourceScope[] = [LegalSourceScope.FEDERAL];
  if (building?.canton && building.canton in LegalSourceScope) {
    scopes.push(building.canton as LegalSourceScope);
  }

  return prisma.legalSource.findMany({
    where: {
      status: { not: LegalSourceStatus.INACTIVE },
      scope: { in: scopes },
    },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
  });
}

/**
 * Find a single legal source by ID.
 */
export async function findById(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.legalSource.findUnique({ where: { id } });
}

/**
 * Create a new legal source.
 */
export async function create(
  prisma: PrismaClient,
  data: CreateLegalSourceInput,
) {
  return prisma.legalSource.create({ data });
}

/**
 * Update an existing legal source.
 */
export async function update(
  prisma: PrismaClient,
  id: string,
  data: UpdateLegalSourceInput,
) {
  return prisma.legalSource.update({ where: { id }, data });
}

/**
 * Delete a legal source by ID.
 */
export async function remove(
  prisma: PrismaClient,
  id: string,
) {
  await prisma.legalSource.delete({ where: { id } });
}

/**
 * Check whether a source has any linked data
 * (variableVersions or depreciationStandards).
 * Used by the DELETE guard to prevent accidental deletion.
 */
export async function hasLinkedData(
  prisma: PrismaClient,
  id: string,
): Promise<boolean> {
  const [varCount, depCount] = await Promise.all([
    prisma.legalVariableVersion.count({ where: { sourceId: id } }),
    prisma.depreciationStandard.count({ where: { sourceId: id } }),
  ]);
  return varCount > 0 || depCount > 0;
}

// ─── LegalRule lookups (defect matcher) ───────────────────────

/** Include for rent-reduction rule queries — latest active version. */
export const LEGAL_RULE_ACTIVE_VERSION_INCLUDE = {
  versions: {
    where: {
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: "desc" as const },
    take: 1,
  },
} as const;

/**
 * Find active legal rules for rent-reduction evaluation.
 * Filters by authority, jurisdiction, optional canton.
 */
export async function findRentReductionRules(
  prisma: PrismaClient,
  now: Date,
  canton?: string | null,
) {
  return prisma.legalRule.findMany({
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
        orderBy: { effectiveFrom: "desc" as const },
        take: 1,
      },
    },
  });
}

// ─── LegalEvaluationLog ───────────────────────────────────────

/**
 * Create a new legal evaluation log entry.
 */
export async function createLegalEvaluationLog(
  prisma: PrismaClient,
  data: Prisma.LegalEvaluationLogUncheckedCreateInput,
) {
  return prisma.legalEvaluationLog.create({ data });
}

// ─── DepreciationStandard ─────────────────────────────────────

/** Find a single depreciation standard by composite fields. */
export async function findDepreciationStandard(
  prisma: PrismaClient,
  where: Prisma.DepreciationStandardWhereInput,
) {
  return prisma.depreciationStandard.findFirst({ where });
}

/** Update a depreciation standard by ID. */
export async function updateDepreciationStandardById(
  prisma: PrismaClient,
  id: string,
  data: Prisma.DepreciationStandardUncheckedUpdateInput,
) {
  return prisma.depreciationStandard.update({ where: { id }, data });
}

/** Create a new depreciation standard record. */
export async function createDepreciationStandardRecord(
  prisma: PrismaClient,
  data: Prisma.DepreciationStandardUncheckedCreateInput,
) {
  return prisma.depreciationStandard.create({ data });
}

// ─── LegalRule ────────────────────────────────────────────────

/** Upsert a legal rule by unique key. */
export async function upsertLegalRule(
  prisma: PrismaClient,
  key: string,
  create: Prisma.LegalRuleUncheckedCreateInput,
  update: Prisma.LegalRuleUncheckedUpdateInput,
) {
  return prisma.legalRule.upsert({ where: { key }, create, update });
}

/** Find a single legal rule version by composite fields. */
export async function findLegalRuleVersion(
  prisma: PrismaClient,
  where: Prisma.LegalRuleVersionWhereInput,
) {
  return prisma.legalRuleVersion.findFirst({ where });
}

/** Create a new legal rule version record. */
export async function createLegalRuleVersionRecord(
  prisma: PrismaClient,
  data: Prisma.LegalRuleVersionUncheckedCreateInput,
) {
  return prisma.legalRuleVersion.create({ data });
}

// ─── LegalVariable / LegalVariableVersion ────────────────────

/** Find a single legal variable by key+jurisdiction. */
export async function findLegalVariable(
  prisma: PrismaClient,
  where: Prisma.LegalVariableWhereInput,
) {
  return prisma.legalVariable.findFirst({ where });
}

/** Create a new legal variable record. */
export async function createLegalVariableRecord(
  prisma: PrismaClient,
  data: Prisma.LegalVariableUncheckedCreateInput,
) {
  return prisma.legalVariable.create({ data });
}

/** Find a single legal variable version by variableId+effectiveFrom. */
export async function findLegalVariableVersion(
  prisma: PrismaClient,
  where: Prisma.LegalVariableVersionWhereInput,
) {
  return prisma.legalVariableVersion.findFirst({ where });
}

/** Create a new legal variable version record. */
export async function createLegalVariableVersionRecord(
  prisma: PrismaClient,
  data: Prisma.LegalVariableVersionUncheckedCreateInput,
) {
  return prisma.legalVariableVersion.create({ data });
}

/** Update a legal source status by ID. */
export async function updateLegalSourceById(
  prisma: PrismaClient,
  id: string,
  data: Prisma.LegalSourceUncheckedUpdateInput,
) {
  return prisma.legalSource.update({ where: { id }, data });
}

// ── Legal Variables list ──────────────────────────────────────

export async function findAllLegalVariables(prisma: PrismaClient) {
  return prisma.legalVariable.findMany({
    include: LEGAL_VARIABLE_INCLUDE,
    orderBy: { key: "asc" },
  });
}

/**
 * Fetch the latest active version value for a specific set of variable keys.
 * Used to inject current rate/index values into the AI system prompt.
 */
export async function findCurrentVariableValues(
  prisma: PrismaClient,
  keys: string[],
): Promise<Array<{ key: string; valueJson: unknown; effectiveFrom: Date | null }>> {
  const variables = await prisma.legalVariable.findMany({
    where: { key: { in: keys } },
    include: {
      versions: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  return variables.map((v) => ({
    key: v.key,
    valueJson: v.versions[0]?.valueJson ?? null,
    effectiveFrom: v.versions[0]?.effectiveFrom ?? null,
  }));
}

// ── Legal Rules list + create ─────────────────────────────────

export async function findAllLegalRules(prisma: PrismaClient) {
  return prisma.legalRule.findMany({
    include: LEGAL_RULE_INCLUDE,
    orderBy: [{ priority: "desc" }, { key: "asc" }],
  });
}

export async function createLegalRuleWithVersion(
  prisma: PrismaClient,
  data: {
    key: string;
    ruleType: string;
    authority: string;
    jurisdiction: string;
    canton?: string | null;
    priority: number;
    isActive: boolean;
    effectiveFrom: string | Date;
    dslJson: unknown;
    citationsJson?: unknown;
    summary?: string | null;
  },
) {
  const { effectiveFrom, dslJson, citationsJson, summary, ...ruleData } = data;
  return prisma.legalRule.create({
    data: {
      ...ruleData,
      versions: {
        create: {
          effectiveFrom,
          dslJson: dslJson as any,
          citationsJson: (citationsJson as any) ?? null,
          summary: summary ?? null,
        },
      },
    } as any,
    include: LEGAL_RULE_WITH_VERSIONS_INCLUDE,
  });
}

// ── Category Mappings ─────────────────────────────────────────

export async function findCategoryMappingsByOrg(prisma: PrismaClient, orgId: string) {
  return prisma.legalCategoryMapping.findMany({
    where: { OR: [{ orgId }, { orgId: null }] },
    orderBy: [{ orgId: "desc" }, { requestCategory: "asc" }],
  });
}

export async function createCategoryMappingRecord(
  prisma: PrismaClient,
  orgId: string,
  data: Record<string, unknown>,
) {
  return prisma.legalCategoryMapping.create({ data: { orgId, ...data } as any });
}

export async function findCategoryMappingById(prisma: PrismaClient, id: string) {
  return prisma.legalCategoryMapping.findUnique({ where: { id } });
}

export async function updateCategoryMappingById(
  prisma: PrismaClient,
  id: string,
  data: Record<string, unknown>,
) {
  return prisma.legalCategoryMapping.update({ where: { id }, data: data as any });
}

export async function deleteCategoryMappingById(prisma: PrismaClient, id: string) {
  return prisma.legalCategoryMapping.delete({ where: { id } });
}

export async function findActiveCategoryMappings(prisma: PrismaClient, orgId: string) {
  return prisma.legalCategoryMapping.findMany({
    where: { OR: [{ orgId }, { orgId: null }], isActive: true },
    orderBy: [{ orgId: "desc" }, { requestCategory: "asc" }],
  });
}

export async function findDepreciationStandardsForCoverage(prisma: PrismaClient) {
  return prisma.depreciationStandard.findMany({
    select: { topic: true, assetType: true, usefulLifeMonths: true },
  });
}

export async function findRentReductionRuleKeys(prisma: PrismaClient) {
  return prisma.legalRule.findMany({
    where: { key: { startsWith: "CH_RENT_RED" }, isActive: true },
    select: { key: true, id: true },
  });
}

// ── Evaluation Logs ───────────────────────────────────────────

export async function findEvaluationLogsWithCount(
  prisma: PrismaClient,
  where: Prisma.LegalEvaluationLogWhereInput,
  limit: number,
  offset: number,
) {
  return Promise.all([
    prisma.legalEvaluationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.legalEvaluationLog.count({ where }),
  ]);
}

export async function findBuildingNamesByIds(prisma: PrismaClient, ids: string[]) {
  return prisma.building.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, address: true },
  });
}

export async function findUnitNumbersByIds(prisma: PrismaClient, ids: string[]) {
  return prisma.unit.findMany({
    where: { id: { in: ids } },
    select: { id: true, unitNumber: true },
  });
}

export async function findRequestSummariesByIds(prisma: PrismaClient, ids: string[]) {
  return prisma.request.findMany({
    where: { id: { in: ids } },
    select: { id: true, requestNumber: true, description: true, category: true },
  });
}

// ── Depreciation Standards ────────────────────────────────────

export async function findAllDepreciationStandards(prisma: PrismaClient) {
  return prisma.depreciationStandard.findMany({
    include: DEPRECIATION_STANDARD_INCLUDE,
    orderBy: [{ assetType: "asc" }, { topic: "asc" }],
  });
}

export async function createDepreciationStandardFull(
  prisma: PrismaClient,
  data: unknown,
) {
  return prisma.depreciationStandard.create({ data: data as any });
}

