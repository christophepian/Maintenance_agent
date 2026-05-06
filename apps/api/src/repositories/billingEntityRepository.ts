/**
 * Billing Entity Repository
 *
 * Centralizes all Prisma access for the BillingEntity model.
 * G3: canonical include constant exported for DTO mapping.
 * G9: canonical include constants live here.
 */

import { PrismaClient } from "@prisma/client";

// ─── Canonical Include ────────────────────────────────────────

export const BILLING_ENTITY_INCLUDE = {} as const;

// ─── Query Functions ──────────────────────────────────────────

/**
 * Find all billing entities for an org (id, name, type).
 * Used by invoice ingestion for vendor name matching.
 */
export async function findBillingEntitiesByOrg(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.billingEntity.findMany({
    where: { orgId },
    select: { id: true, name: true, type: true },
  });
}

/**
 * Find the ORG-type billing entity for an org.
 * Used as fallback when no vendor match is found.
 */
export async function findOrgBillingEntity(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.billingEntity.findFirst({
    where: { orgId, type: "ORG" },
    select: { id: true },
  });
}
