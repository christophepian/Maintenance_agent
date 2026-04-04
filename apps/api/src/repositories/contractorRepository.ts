/**
 * Contractor Repository
 *
 * Centralizes all Prisma access for Contractor entity verification.
 * Route handlers should use these functions instead of ad-hoc
 * prisma.contractor calls for org ownership checks.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 * CQ-13 fix: extracted from routes/contractor.ts
 */

import { PrismaClient } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/** Minimal include for contractor verification — no relations needed. */
export const CONTRACTOR_INCLUDE = {} as const;

// ─── Query Functions ───────────────────────────────────────────

/**
 * Verify a contractor exists and belongs to the given org.
 * Returns the contractor if found and owned by org, null otherwise.
 * CQ-13: Replaces ad-hoc prisma.contractor.findUnique() in route handlers.
 */
export async function verifyOrgOwnership(
  prisma: PrismaClient,
  contractorId: string,
  orgId: string,
) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
  });

  if (!contractor || contractor.orgId !== orgId) return null;
  return contractor;
}

/**
 * Find a contractor by ID, scoped to org.
 * Returns the full record (including serviceCategories for category matching).
 */
export async function findContractorById(
  prisma: PrismaClient,
  contractorId: string,
  orgId: string,
) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
  });
  if (!contractor || contractor.orgId !== orgId) return null;
  return contractor;
}

/**
 * Parse the JSON serviceCategories string into an array.
 * Returns empty array on parse failure or missing data.
 */
export function parseServiceCategories(contractor: { serviceCategories: string }): string[] {
  try {
    const cats = JSON.parse(contractor.serviceCategories);
    return Array.isArray(cats) ? cats : [];
  } catch {
    return [];
  }
}

/**
 * Find multiple contractors by IDs, scoped to org.
 * Returns only active contractors that belong to the org.
 * Used for bulk validation in re-invite flows.
 */
export async function findContractorsByIds(
  prisma: PrismaClient,
  contractorIds: string[],
  orgId: string,
) {
  return prisma.contractor.findMany({
    where: {
      id: { in: contractorIds },
      orgId,
      isActive: true,
    },
    select: { id: true, name: true },
  });
}

/**
 * Find all active contractors for an org.
 * Used when matching contractors to an RFP by trade group / category.
 */
export async function findActiveByOrg(
  prisma: PrismaClient,
  orgId: string,
): Promise<Array<{ id: string; serviceCategories: string }>> {
  return prisma.contractor.findMany({
    where: { orgId, isActive: true },
    select: { id: true, serviceCategories: true },
  });
}
