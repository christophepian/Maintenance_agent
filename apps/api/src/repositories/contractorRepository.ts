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
