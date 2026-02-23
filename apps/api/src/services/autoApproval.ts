import { RequestStatus, PrismaClient } from "@prisma/client";
import { evaluateRules, ruleActionToStatus } from "./approvalRules";
import { computeEffectiveUnitConfig } from "./unitConfig";

/**
 * Legacy auto-approval logic (fallback when no rules match)
 */
export function decideRequestStatus(
  estimatedCost: number,
  autoApproveLimit: number
): RequestStatus {
  if (estimatedCost <= autoApproveLimit) return RequestStatus.AUTO_APPROVED;
  return RequestStatus.PENDING_REVIEW;
}

/**
 * Enhanced auto-approval logic with rules engine
 * First evaluates rules, then falls back to threshold-based logic
 * Uses three-tier cascade: Unit → Building → Org for determining effective policy
 */
export async function decideRequestStatusWithRules(
  prisma: PrismaClient,
  orgId: string,
  requestContext: {
    category?: string | null;
    estimatedCost?: number | null;
    unitType?: string | null;
    unitNumber?: string | null;
    buildingId?: string | null;
    unitId?: string | null;
  },
  autoApproveLimit?: number,
  unitId?: string
): Promise<{ status: RequestStatus; matchedRuleName?: string; effectiveLimit?: number }> {
  // Determine effective auto-approve limit using three-tier cascade
  let effectiveAutoApproveLimit = autoApproveLimit;
  
  if (unitId || requestContext.unitId) {
    try {
      const uId = unitId || requestContext.unitId;
      if (uId) {
        const unitConfig = await computeEffectiveUnitConfig(prisma, orgId, uId);
        effectiveAutoApproveLimit = unitConfig.effectiveAutoApproveLimit;
      }
    } catch (e) {
      // If unit config lookup fails, fall back to provided autoApproveLimit
      if (!effectiveAutoApproveLimit) {
        effectiveAutoApproveLimit = 200; // Fallback default
      }
    }
  } else if (!effectiveAutoApproveLimit) {
    // If no unit-specific config and no explicit limit provided, use 200 as default
    effectiveAutoApproveLimit = 200;
  }

  // Try rule evaluation first
  const ruleResult = await evaluateRules(
    prisma,
    orgId,
    {
      category: requestContext.category,
      estimatedCost: requestContext.estimatedCost,
      unitType: requestContext.unitType,
    },
    requestContext.buildingId ?? undefined
  );

  if (ruleResult) {
    return {
      status: ruleActionToStatus(ruleResult.action),
      matchedRuleName: ruleResult.matchedRule?.name,
      effectiveLimit: effectiveAutoApproveLimit,
    };
  }

  // Fallback to threshold-based logic using effective limit
  const fallbackStatus =
    requestContext.estimatedCost !== null && requestContext.estimatedCost !== undefined
      ? decideRequestStatus(requestContext.estimatedCost, effectiveAutoApproveLimit)
      : RequestStatus.PENDING_REVIEW;

  return { status: fallbackStatus, effectiveLimit: effectiveAutoApproveLimit };
}

