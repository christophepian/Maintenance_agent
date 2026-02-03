import { RequestStatus } from "@prisma/client";

export function decideRequestStatus(
  estimatedCost: number,
  autoApproveLimit: number
): RequestStatus {
  if (estimatedCost <= autoApproveLimit) return RequestStatus.AUTO_APPROVED;
  return RequestStatus.PENDING_REVIEW;
}
