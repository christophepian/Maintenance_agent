import { PrismaClient, JobStatus, RequestStatus } from "@prisma/client";
import { assertJobTransition } from "../workflows/transitions";
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
 * Contractor updates job execution state for their assigned request.
 *
 * IN_PROGRESS → updates Job.status via assertJobTransition (respects state machine).
 * COMPLETED   → updates Job.status to COMPLETED and mirrors COMPLETED onto Request.status
 *               so the manager DONE tab reflects completion.
 *
 * Request.status is no longer written directly — execution state lives on Job.
 */
export async function updateContractorRequestStatus(
  prisma: PrismaClient,
  requestId: string,
  contractorId: string,
  newStatus: RequestStatus
): Promise<{ success: boolean; message: string; data?: MaintenanceRequestDTO }> {
  // Only IN_PROGRESS and COMPLETED are valid contractor-initiated transitions.
  // IN_PROGRESS no longer exists on RequestStatus; map it to the Job status string.
  const validValues = ["IN_PROGRESS", "COMPLETED"];
  if (!validValues.includes(String(newStatus))) {
    return {
      success: false,
      message: `Contractors can only update to: IN_PROGRESS, COMPLETED (not ${newStatus})`,
    };
  }

  // Verify the request exists and is assigned to this contractor
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      assignedContractor: {
        select: { id: true, name: true, phone: true, email: true, hourlyRate: true },
      },
      job: {
        select: { id: true, status: true },
      },
    },
  });

  if (!request) {
    return { success: false, message: "Request not found" };
  }

  if (request.assignedContractorId !== contractorId) {
    return { success: false, message: "Not authorized: this request is not assigned to you" };
  }

  if (!request.job) {
    return { success: false, message: "No job found for this request" };
  }

  const targetJobStatus = newStatus === RequestStatus.COMPLETED
    ? JobStatus.COMPLETED
    : JobStatus.IN_PROGRESS;

  // Guard via state machine
  try {
    assertJobTransition(request.job.status as JobStatus, targetJobStatus);
  } catch {
    return {
      success: false,
      message: `Cannot transition job from ${request.job.status} to ${targetJobStatus}`,
    };
  }

  // Update Job.status
  await prisma.job.update({
    where: { id: request.job.id },
    data: { status: targetJobStatus },
  });

  // Mirror COMPLETED onto Request.status so the DONE tab works
  if (targetJobStatus === JobStatus.COMPLETED && request.status === RequestStatus.ASSIGNED) {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: RequestStatus.COMPLETED },
    });
  }

  const reloaded = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      assignedContractor: {
        select: { id: true, name: true, phone: true, email: true, hourlyRate: true },
      },
    },
  });

  return {
    success: true,
    message: `Job updated to ${targetJobStatus}`,
    data: reloaded ? toDTO(reloaded) : undefined,
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
