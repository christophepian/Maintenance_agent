/**
 * Legal Source Repository
 *
 * Centralizes all Prisma access for the LegalSource entity.
 * Fixes G3 violation: Prisma calls were previously inline in routes.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, LegalSourceStatus, LegalSourceScope } from "@prisma/client";

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
