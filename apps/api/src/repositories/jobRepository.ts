/**
 * Job Repository
 *
 * Centralizes all Prisma access for the Job entity.
 * Owns canonical include trees so that DTO mappers always receive
 * the correct shape.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, JobStatus } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/**
 * Full include for single-job detail and full-list views.
 * Must stay in sync with mapJobToDTO in services/jobs.ts.
 */
export const JOB_FULL_INCLUDE = {
  request: {
    include: {
      tenant: true,
      unit: { include: { building: true } },
      appliance: { include: { assetModel: true } },
    },
  },
  contractor: true,
  ratings: true,
} as const;

/**
 * H5: Lighter include for summary/list views.
 * Must stay in sync with mapJobToSummaryDTO in services/jobs.ts.
 */
export const JOB_SUMMARY_INCLUDE = {
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
} as const;

// ─── Query Functions ───────────────────────────────────────────

/**
 * Fetch a single job by ID with full canonical include.
 */
export async function findJobById(prisma: PrismaClient, id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: JOB_FULL_INCLUDE,
  });
}

/**
 * Fetch a single job by ID (minimal, no includes).
 */
export async function findJobRaw(prisma: PrismaClient, id: string) {
  return prisma.job.findUnique({ where: { id } });
}

/**
 * Find a job by its requestId (unique constraint).
 */
export async function findJobByRequestId(prisma: PrismaClient, requestId: string) {
  return prisma.job.findUnique({
    where: { requestId },
    include: JOB_FULL_INCLUDE,
  });
}

/**
 * Find a job by requestId — minimal/raw (no includes).
 */
export async function findJobByRequestIdRaw(prisma: PrismaClient, requestId: string) {
  return prisma.job.findUnique({ where: { requestId } });
}

export interface ListJobOpts {
  orgId: string;
  contractorId?: string;
  status?: JobStatus;
  requestId?: string;
  view?: "summary" | "full";
}

/**
 * List jobs scoped to an org, with optional filters.
 */
export async function findJobsByOrg(prisma: PrismaClient, opts: ListJobOpts) {
  const useSummary = opts.view === "summary";
  return prisma.job.findMany({
    where: {
      orgId: opts.orgId,
      ...(opts.contractorId && { contractorId: opts.contractorId }),
      ...(opts.status && { status: opts.status }),
      ...(opts.requestId && { requestId: opts.requestId }),
    },
    include: useSummary ? JOB_SUMMARY_INCLUDE : JOB_FULL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export interface CreateJobData {
  orgId: string;
  requestId: string;
  contractorId: string;
  status?: JobStatus;
}

/**
 * Create a new job record. Returns with full canonical include.
 */
export async function createJobRecord(prisma: PrismaClient, data: CreateJobData) {
  return prisma.job.create({
    data: {
      orgId: data.orgId,
      requestId: data.requestId,
      contractorId: data.contractorId,
      status: data.status ?? JobStatus.PENDING,
    },
    include: JOB_FULL_INCLUDE,
  });
}

export interface UpdateJobData {
  status?: JobStatus;
  actualCost?: number;
  startedAt?: Date;
  completedAt?: Date;
  confirmedAt?: Date;
}

/**
 * Update a job record. Returns with full canonical include.
 */
export async function updateJobRecord(
  prisma: PrismaClient,
  id: string,
  data: UpdateJobData,
) {
  return prisma.job.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.actualCost !== undefined && { actualCost: data.actualCost }),
      ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
      ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
      ...(data.confirmedAt !== undefined && { confirmedAt: data.confirmedAt }),
    },
    include: JOB_FULL_INCLUDE,
  });
}
