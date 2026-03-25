import { PrismaClient, RequestStatus } from "@prisma/client";
import { MaintenanceRequestDTO } from "./maintenanceRequests";
import {
  listContractors as listContractorsCore,
  createContractor as createContractorCore,
  getContractorById as getContractorByIdCore,
  updateContractor as updateContractorCore,
  deactivateContractor as deactivateContractorCore,
} from "./contractors";
import {
  CreateContractorSchema,
  UpdateContractorSchema,
} from "../validation/contractors";

export { CreateContractorSchema, UpdateContractorSchema };

export async function listContractors(prisma: PrismaClient, orgId: string) {
  return listContractorsCore(prisma, orgId);
}

export async function createContractor(
  prisma: PrismaClient,
  orgId: string,
  data: unknown
) {
  const parsed = CreateContractorSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return createContractorCore(prisma, orgId, parsed.data);
}

export async function getContractorById(prisma: PrismaClient, id: string) {
  return getContractorByIdCore(prisma, id);
}

export async function updateContractor(
  prisma: PrismaClient,
  id: string,
  data: unknown
) {
  const parsed = UpdateContractorSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return updateContractorCore(prisma, id, parsed.data);
}

export async function deactivateContractor(prisma: PrismaClient, id: string) {
  return deactivateContractorCore(prisma, id);
}

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
  orgId: string;
  requestNumber: number;
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
    orgId: r.orgId,
    requestNumber: r.requestNumber,
    description: r.description,
    category: r.category ?? undefined,
    estimatedCost: r.estimatedCost ?? undefined,
    status: r.status,
    assignedContractor: r.assignedContractor ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}
