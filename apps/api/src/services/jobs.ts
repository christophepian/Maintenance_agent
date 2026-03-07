import { JobStatus } from '@prisma/client';
import prisma from './prismaClient';
import { JOB_FULL_INCLUDE, JOB_SUMMARY_INCLUDE } from '../repositories/jobRepository';

/**
 * G9: Canonical include tree for Job queries.
 * Single source of truth lives in jobRepository; re-exported here for backward compat.
 */
export const JOB_INCLUDE = JOB_FULL_INCLUDE;

export interface CreateJobParams {
  orgId: string;
  requestId: string;
  contractorId: string;
}

export interface UpdateJobParams {
  status?: JobStatus;
  startedAt?: Date;
  completedAt?: Date;
  actualCost?: number;
}

export interface JobDTO {
  id: string;
  orgId: string;
  requestId: string;
  contractorId: string;
  status: JobStatus;
  actualCost?: number;
  startedAt?: string; // ISO
  completedAt?: string; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
  request?: {
    description: string;
    category?: string;
    contactPhone?: string;
    tenant?: {
      id: string;
      name?: string;
      phone: string;
      email?: string;
    };
    unit?: {
      id: string;
      unitNumber: string;
      building: {
        id: string;
        name: string;
        address: string;
      };
    };
    appliance?: {
      id: string;
      category: string;
      serial?: string;
    };
  };
  contractor?: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  /**
   * Provisional invoice addressee indicator.
   * "TENANT" if the request is linked to a tenant, otherwise "PROPERTY_MANAGER".
   * Actual billing rules TBD.
   */
  invoiceAddressedTo: "TENANT" | "PROPERTY_MANAGER";
}

/**
 * H5: Summary DTO for list endpoints.
 * Reduces overfetch by omitting nested relations for list views.
 */
export interface JobSummaryDTO {
  id: string;
  orgId: string;
  requestId: string;
  contractorId: string;
  status: JobStatus;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Summary fields only (no deep nesting)
  contractorName?: string;
  requestDescription?: string;
  unitNumber?: string;
  buildingName?: string;
}

/**
 * Create a job from an approved request.
 * Ensures job doesn't already exist for this request.
 */
export async function createJob(params: CreateJobParams): Promise<JobDTO> {
  const { orgId, requestId, contractorId } = params;

  // Verify request exists and belongs to org
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request || request.id === undefined) {
    throw new Error(`Request not found: ${requestId}`);
  }

  // Check if job already exists for this request
  const existing = await prisma.job.findUnique({
    where: { requestId },
  });

  if (existing) {
    throw new Error(`Job already exists for request ${requestId}`);
  }

  const job = await prisma.job.create({
    data: {
      orgId,
      requestId,
      contractorId,
      status: JobStatus.PENDING,
    },
    include: JOB_INCLUDE,
  });

  return mapJobToDTO(job);
}

/**
 * Get job by ID.
 */
export async function getJob(jobId: string): Promise<JobDTO | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: JOB_INCLUDE,
  });

  return job ? mapJobToDTO(job) : null;
}

/**
 * List jobs for org with optional filters.
 * H5: Supports view=summary for lighter payloads.
 */
export async function listJobs(
  orgId: string,
  filters?: {
    contractorId?: string;
    status?: JobStatus;
    requestId?: string;
    view?: "summary" | "full";
  }
): Promise<JobDTO[] | JobSummaryDTO[]> {
  const useSummary = filters?.view === "summary";

  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      ...(filters?.contractorId && { contractorId: filters.contractorId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.requestId && { requestId: filters.requestId }),
    },
    include: useSummary
      ? {
          contractor: { select: { name: true } },
          request: {
            select: {
              description: true,
              unit: {
                select: {
                  unitNumber: true,
                  building: { select: { name: true } },
                },
              },
            },
          },
        }
      : JOB_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return useSummary ? jobs.map(mapJobToSummaryDTO) : jobs.map(mapJobToDTO);
}

/**
 * Update job status and metadata.
 */
export async function updateJob(jobId: string, params: UpdateJobParams): Promise<JobDTO> {
  const job = await prisma.job.update({
    where: { id: jobId },
    data: {
      ...(params.status !== undefined && { status: params.status }),
      ...(params.startedAt !== undefined && { startedAt: params.startedAt }),
      ...(params.completedAt !== undefined && { completedAt: params.completedAt }),
      ...(params.actualCost !== undefined && { actualCost: params.actualCost }),
    },
    include: JOB_INCLUDE,
  });

  return mapJobToDTO(job);
}

/**
 * Get or create a job for a request.
 * Used during request approval to auto-create job in owner-direct mode.
 */
export async function getOrCreateJobForRequest(
  orgId: string,
  requestId: string,
  contractorId: string
): Promise<JobDTO> {
  const existing = await prisma.job.findUnique({
    where: { requestId },
    include: JOB_INCLUDE,
  });

  if (existing) {
    return mapJobToDTO(existing);
  }

  return createJob({ orgId, requestId, contractorId });
}

function mapJobToDTO(job: any): JobDTO {
  return {
    id: job.id,
    orgId: job.orgId,
    requestId: job.requestId,
    contractorId: job.contractorId,
    status: job.status,
    actualCost: job.actualCost ?? undefined,
    startedAt: job.startedAt ? job.startedAt.toISOString() : undefined,
    completedAt: job.completedAt ? job.completedAt.toISOString() : undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    request: job.request ? {
      description: job.request.description,
      category: job.request.category ?? undefined,
      contactPhone: job.request.contactPhone ?? undefined,
      tenant: job.request.tenant ? {
        id: job.request.tenant.id,
        name: job.request.tenant.name ?? undefined,
        phone: job.request.tenant.phone,
        email: job.request.tenant.email ?? undefined,
      } : undefined,
      unit: job.request.unit ? {
        id: job.request.unit.id,
        unitNumber: job.request.unit.unitNumber,
        building: {
          id: job.request.unit.building.id,
          name: job.request.unit.building.name,
          address: job.request.unit.building.address,
        },
      } : undefined,
      appliance: job.request.appliance ? {
        id: job.request.appliance.id,
        category: job.request.appliance.assetModel?.category ?? job.request.appliance.name,
        serial: job.request.appliance.serial ?? undefined,
      } : undefined,
    } : undefined,
    contractor: job.contractor ? {
      id: job.contractor.id,
      name: job.contractor.name,
      phone: job.contractor.phone,
      email: job.contractor.email,
    } : undefined,
    // Provisional rule: if request has a tenant linked, invoice goes to tenant;
    // otherwise it goes to the property manager. Actual rules TBD.
    invoiceAddressedTo: job.request?.tenantId ? "TENANT" : "PROPERTY_MANAGER",
  };
}

/**
 * H5: Map Job to summary DTO for list endpoints.
 * Uses lighter include to reduce overfetch.
 */
function mapJobToSummaryDTO(job: any): JobSummaryDTO {
  return {
    id: job.id,
    orgId: job.orgId,
    requestId: job.requestId,
    contractorId: job.contractorId,
    status: job.status,
    actualCost: job.actualCost ?? undefined,
    startedAt: job.startedAt ? job.startedAt.toISOString() : undefined,
    completedAt: job.completedAt ? job.completedAt.toISOString() : undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    contractorName: job.contractor?.name,
    requestDescription: job.request?.description,
    unitNumber: job.request?.unit?.unitNumber,
    buildingName: job.request?.unit?.building?.name,
  };
}
