/**
 * Approval Rule Repository
 *
 * Centralizes all Prisma access for the ApprovalRule model.
 * G3: canonical include constant exported for DTO mapping.
 * G9: canonical include constants live here.
 */

import { PrismaClient, RuleAction, Prisma } from "@prisma/client";

// ─── Canonical Include ─────────────────────────────────────────

export const APPROVAL_RULE_INCLUDE = {} as const;

// ─── Query Functions ───────────────────────────────────────────

/**
 * List approval rules scoped to org, optionally filtered by building.
 */
export async function findApprovalRulesByOrg(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  const where: Prisma.ApprovalRuleWhereInput = buildingId
    ? { orgId, buildingId }
    : { orgId };
  return prisma.approvalRule.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * Find a single approval rule by id scoped to org.
 */
export async function findApprovalRuleByOrgAndId(
  prisma: PrismaClient,
  orgId: string,
  id: string,
) {
  return prisma.approvalRule.findFirst({ where: { id, orgId } });
}

/**
 * Find the building to validate it belongs to org.
 * (Delegated from approvalRules service — avoids cross-service calls.)
 */
export async function findBuildingForRuleValidation(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.building.findFirst({ where: { id: buildingId, orgId } });
}

/**
 * Create a new approval rule.
 */
export async function createApprovalRuleRecord(
  prisma: PrismaClient,
  data: Prisma.ApprovalRuleUncheckedCreateInput,
) {
  return prisma.approvalRule.create({ data });
}

/**
 * Update an approval rule by id.
 */
export async function updateApprovalRuleRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.ApprovalRuleUncheckedUpdateInput,
) {
  return prisma.approvalRule.update({ where: { id }, data });
}

/**
 * Delete an approval rule by id.
 */
export async function deleteApprovalRuleRecord(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.approvalRule.delete({ where: { id } });
}

/**
 * Load active approval rules for rule evaluation.
 * Returns org-level rules and (if buildingId provided) building-level rules.
 */
export async function findApprovalRulesForEvaluation(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  const orderBy: Prisma.ApprovalRuleOrderByWithRelationInput[] = [
    { priority: "desc" },
    { createdAt: "asc" },
  ];
  const [orgRules, buildingRules] = await Promise.all([
    prisma.approvalRule.findMany({
      where: { orgId, buildingId: null, isActive: true },
      orderBy,
    }),
    buildingId
      ? prisma.approvalRule.findMany({
          where: { orgId, buildingId, isActive: true },
          orderBy,
        })
      : Promise.resolve([]),
  ]);
  return { orgRules, buildingRules };
}
