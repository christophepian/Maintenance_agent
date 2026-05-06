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

