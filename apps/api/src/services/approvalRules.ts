import { PrismaClient, RuleAction, RequestStatus } from "@prisma/client";
import { RuleCondition, RuleConditionField, RuleConditionOperator } from "../types/approvalRules";

export type ApprovalRuleDTO = {
  id: string;
  orgId: string;
  buildingId: string | null;
  name: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  action: RuleAction;
  createdAt: Date;
  updatedAt: Date;
};

export type RequestContext = {
  category?: string | null;
  estimatedCost?: number | null;
  unitType?: string | null;
  unitNumber?: string | null;
};

/**
 * Convert database rule to DTO with parsed conditions
 */
function toDTO(rule: any): ApprovalRuleDTO {
  return {
    id: rule.id,
    orgId: rule.orgId,
    buildingId: rule.buildingId,
    name: rule.name,
    priority: rule.priority,
    isActive: rule.isActive,
    conditions: JSON.parse(rule.conditions),
    action: rule.action,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * List all approval rules for an org, optionally filtered by building
 */
export async function listApprovalRules(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string
): Promise<ApprovalRuleDTO[]> {
  const where = buildingId ? { orgId, buildingId } : { orgId };
  const rules = await prisma.approvalRule.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return rules.map(toDTO);
}

/**
 * Get a single approval rule by ID
 */
export async function getApprovalRule(
  prisma: PrismaClient,
  orgId: string,
  ruleId: string
): Promise<ApprovalRuleDTO | null> {
  const rule = await prisma.approvalRule.findFirst({
    where: { id: ruleId, orgId },
  });
  return rule ? toDTO(rule) : null;
}

/**
 * Create a new approval rule
 */
export async function createApprovalRule(
  prisma: PrismaClient,
  orgId: string,
  payload: {
    buildingId?: string | null;
    name: string;
    priority?: number;
    conditions: RuleCondition[];
    action: RuleAction;
  }
): Promise<ApprovalRuleDTO> {
  // Validate building exists if buildingId provided
  if (payload.buildingId) {
    const building = await prisma.building.findFirst({
      where: { id: payload.buildingId, orgId },
    });
    if (!building) throw new Error("BUILDING_NOT_FOUND");
  }

  const rule = await prisma.approvalRule.create({
    data: {
      orgId,
      buildingId: payload.buildingId ?? null,
      name: payload.name,
      priority: payload.priority ?? 0,
      conditions: JSON.stringify(payload.conditions),
      action: payload.action,
    },
  });
  return toDTO(rule);
}

/**
 * Update an existing approval rule
 */
export async function updateApprovalRule(
  prisma: PrismaClient,
  orgId: string,
  ruleId: string,
  payload: {
    name?: string;
    priority?: number;
    isActive?: boolean;
    conditions?: RuleCondition[];
    action?: RuleAction;
  }
): Promise<ApprovalRuleDTO | null> {
  const existing = await prisma.approvalRule.findFirst({
    where: { id: ruleId, orgId },
  });
  if (!existing) return null;

  const rule = await prisma.approvalRule.update({
    where: { id: ruleId },
    data: {
      name: payload.name !== undefined ? payload.name : undefined,
      priority: payload.priority !== undefined ? payload.priority : undefined,
      isActive: payload.isActive !== undefined ? payload.isActive : undefined,
      conditions: payload.conditions !== undefined ? JSON.stringify(payload.conditions) : undefined,
      action: payload.action !== undefined ? payload.action : undefined,
    },
  });
  return toDTO(rule);
}

/**
 * Delete an approval rule
 */
export async function deleteApprovalRule(
  prisma: PrismaClient,
  orgId: string,
  ruleId: string
): Promise<boolean> {
  const existing = await prisma.approvalRule.findFirst({
    where: { id: ruleId, orgId },
  });
  if (!existing) return false;

  await prisma.approvalRule.delete({ where: { id: ruleId } });
  return true;
}

/**
 * Evaluate a single condition against request context
 */
function evaluateCondition(condition: RuleCondition, context: RequestContext): boolean {
  const { field, operator, value } = condition;

  let contextValue: string | number | undefined;
  if (field === RuleConditionField.CATEGORY) {
    contextValue = context.category ?? undefined;
  } else if (field === RuleConditionField.ESTIMATED_COST) {
    contextValue = context.estimatedCost ?? undefined;
  } else if (field === RuleConditionField.UNIT_TYPE) {
    contextValue = context.unitType ?? undefined;
  } else if (field === RuleConditionField.UNIT_NUMBER) {
    contextValue = context.unitNumber ?? undefined;
  }

  // If context value is missing, condition fails
  if (contextValue === undefined) return false;

  switch (operator) {
    case RuleConditionOperator.EQUALS:
      return contextValue === value;
    case RuleConditionOperator.NOT_EQUALS:
      return contextValue !== value;
    case RuleConditionOperator.LESS_THAN:
      return typeof contextValue === "number" && typeof value === "number" && contextValue < value;
    case RuleConditionOperator.LESS_THAN_OR_EQUAL:
      return typeof contextValue === "number" && typeof value === "number" && contextValue <= value;
    case RuleConditionOperator.GREATER_THAN:
      return typeof contextValue === "number" && typeof value === "number" && contextValue > value;
    case RuleConditionOperator.GREATER_THAN_OR_EQUAL:
      return typeof contextValue === "number" && typeof value === "number" && contextValue >= value;
    case RuleConditionOperator.CONTAINS:
      return typeof contextValue === "string" && typeof value === "string" && contextValue.includes(value);
    case RuleConditionOperator.STARTS_WITH:
      return typeof contextValue === "string" && typeof value === "string" && contextValue.startsWith(value);
    case RuleConditionOperator.ENDS_WITH:
      return typeof contextValue === "string" && typeof value === "string" && contextValue.endsWith(value);
    default:
      return false;
  }
}

/**
 * Evaluate all rules for a request context and return the matching rule action
 * Rules are evaluated in priority order (highest first), and the first matching rule wins
 */
export async function evaluateRules(
  prisma: PrismaClient,
  orgId: string,
  context: RequestContext,
  buildingId?: string
): Promise<{ action: RuleAction; matchedRule?: ApprovalRuleDTO } | null> {
  // Fetch org-level and building-level rules
  const [orgRules, buildingRules] = await Promise.all([
    prisma.approvalRule.findMany({
      where: { orgId, buildingId: null, isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    buildingId
      ? prisma.approvalRule.findMany({
          where: { orgId, buildingId, isActive: true },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  // Combine and sort: building rules take precedence over org rules at same priority
  const allRules = [...buildingRules, ...orgRules];

  // Evaluate each rule in order
  for (const rule of allRules) {
    const conditions: RuleCondition[] = JSON.parse(rule.conditions);
    
    // All conditions must match for the rule to apply
    const allConditionsMatch = conditions.every((condition) =>
      evaluateCondition(condition, context)
    );

    if (allConditionsMatch) {
      return { action: rule.action, matchedRule: toDTO(rule) };
    }
  }

  // No rules matched
  return null;
}

/**
 * Map rule action to request status
 */
export function ruleActionToStatus(action: RuleAction): RequestStatus {
  switch (action) {
    case RuleAction.AUTO_APPROVE:
      // AUTO_APPROVED status removed — all requests route through PENDING_REVIEW
      return RequestStatus.PENDING_REVIEW;
    case RuleAction.REQUIRE_MANAGER_REVIEW:
      return RequestStatus.PENDING_REVIEW;
    case RuleAction.REQUIRE_OWNER_APPROVAL:
      return RequestStatus.PENDING_OWNER_APPROVAL;
    default:
      return RequestStatus.PENDING_REVIEW;
  }
}
