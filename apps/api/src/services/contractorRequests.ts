import { PrismaClient, RequestStatus } from "@prisma/client";
import { MaintenanceRequestDTO } from "./maintenanceRequests";

/**
 * Get all requests assigned to a specific contractor.
 * Ordered by createdAt descending (newest first).
 */
export async function getContractorAssignedRequests(
  prisma: PrismaClient,
  contractorId: string
): Promise<MaintenanceRequestDTO[]> {
  const rows = await prisma.request.findMany({
    where: { assignedContractorId: contractorId },
    orderBy: { createdAt: "desc" },
    include: {
      assignedContractor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          hourlyRate: true,
        },
      },
    },
  });

  return rows.map((r) => toDTO(r));
}

/**
 * Contractor updates request status.
 * Allowed transitions: any approval status → IN_PROGRESS → COMPLETED
 * Contractor cannot transition back to PENDING_REVIEW or AUTO_APPROVED
 */
export async function updateContractorRequestStatus(
  prisma: PrismaClient,
  requestId: string,
  contractorId: string,
  newStatus: RequestStatus
): Promise<{ success: boolean; message: string; data?: MaintenanceRequestDTO }> {
  // Verify the request exists and is assigned to this contractor
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      assignedContractor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          hourlyRate: true,
        },
      },
    },
  });

  if (!request) {
    return { success: false, message: "Request not found" };
  }

  if (request.assignedContractorId !== contractorId) {
    return { success: false, message: "Not authorized: this request is not assigned to you" };
  }

  // Validate status transition
  const validContractorStatuses: RequestStatus[] = [RequestStatus.IN_PROGRESS, RequestStatus.COMPLETED];
  if (!validContractorStatuses.includes(newStatus)) {
    return {
      success: false,
      message: `Contractors can only update to: IN_PROGRESS, COMPLETED (not ${newStatus})`,
    };
  }

  // Prevent going backwards
  if (newStatus === RequestStatus.IN_PROGRESS && request.status === RequestStatus.COMPLETED) {
    return { success: false, message: "Cannot transition from COMPLETED back to IN_PROGRESS" };
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: newStatus },
    include: {
      assignedContractor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          hourlyRate: true,
        },
      },
    },
  });

  return {
    success: true,
    message: `Request updated to ${newStatus}`,
    data: toDTO(updated),
  };
}

function toDTO(r: {
  id: string;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;
  createdAt: Date;
  assignedContractor?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    hourlyRate: number;
  } | null;
}): MaintenanceRequestDTO {
  return {
    id: r.id,
    description: r.description,
    category: r.category ?? undefined,
    estimatedCost: r.estimatedCost ?? undefined,
    status: r.status,
    assignedContractor: r.assignedContractor ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}
