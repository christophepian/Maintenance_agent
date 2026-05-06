/**
 * Billing Entity Repository
 *
 * Centralizes all Prisma access for the BillingEntity model.
 * G3: canonical include constant exported for DTO mapping.
 * G9: canonical include constants live here.
 */

import { PrismaClient, BillingEntityType, Prisma } from "@prisma/client";

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

// ─── CRUD for billingEntities service ─────────────────────────

/**
 * List billing entities for an org, optionally filtered by type.
 */
export async function listBillingEntitiesFiltered(
  prisma: PrismaClient,
  orgId: string,
  type?: BillingEntityType,
) {
  return prisma.billingEntity.findMany({
    where: { orgId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find a billing entity by id scoped to org.
 */
export async function findBillingEntityByOrgAndId(
  prisma: PrismaClient,
  orgId: string,
  id: string,
) {
  return prisma.billingEntity.findFirst({ where: { id, orgId } });
}

/**
 * Find the first billing entity linked to a contractor.
 */
export async function findBillingEntityByContractor(
  prisma: PrismaClient,
  contractorId: string,
) {
  return prisma.billingEntity.findFirst({ where: { contractorId } });
}

/**
 * Find existing entity by type + owner combination.
 * Used to enforce one-entity-per-type constraint.
 */
export async function findBillingEntityByTypeAndOwner(
  prisma: PrismaClient,
  orgId: string,
  type: BillingEntityType,
  userId: string | null | undefined,
) {
  const where =
    type === BillingEntityType.OWNER && userId
      ? { orgId, type, userId }
      : { orgId, type, userId: null as string | null };
  return prisma.billingEntity.findFirst({ where });
}

/**
 * Create a new billing entity.
 */
export async function createBillingEntityRecord(
  prisma: PrismaClient,
  data: Prisma.BillingEntityUncheckedCreateInput,
) {
  return prisma.billingEntity.create({ data });
}

/**
 * Update a billing entity by id.
 */
export async function updateBillingEntityRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.BillingEntityUncheckedUpdateInput,
) {
  return prisma.billingEntity.update({ where: { id }, data });
}

/**
 * Delete a billing entity by id.
 */
export async function deleteBillingEntityRecord(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.billingEntity.delete({ where: { id } });
}
