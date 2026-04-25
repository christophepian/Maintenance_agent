import { RequestStatus } from "@prisma/client";

/**
 * Auto-approval logic removed. AUTO_APPROVED status no longer exists.
 * All requests start at PENDING_REVIEW and are routed by the legal engine
 * or manager action. Cost threshold checks happen at quote award time
 * in awardQuoteWorkflow.
 *
 * These stubs are kept to prevent import errors in any residual callers.
 * Remove callers and delete this file in the next cleanup pass.
 */
export function decideRequestStatus(
  _estimatedCost: number,
  _autoApproveLimit: number
): RequestStatus {
  return RequestStatus.PENDING_REVIEW;
}

export async function decideRequestStatusWithRules(
  _prisma: any,
  _orgId: string,
  _requestContext: any,
  _autoApproveLimit?: number,
  _unitId?: string
): Promise<{ status: RequestStatus; matchedRuleName?: string; effectiveLimit?: number }> {
  return { status: RequestStatus.PENDING_REVIEW };
}
