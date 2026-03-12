/**
 * Request Repository
 *
 * Centralizes all Prisma access for the Request entity.
 * Owns the canonical include trees so that DTO mappers always receive
 * the correct shape.  Route handlers and workflows should use these
 * functions instead of ad-hoc prisma.request calls.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, Prisma, RequestStatus, ApprovalSource, PayingParty } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/** Full include for single-request and full-list views. */
export const REQUEST_FULL_INCLUDE = {
  assignedContractor: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      hourlyRate: true,
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      floor: true,
      building: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  },
  appliance: {
    select: {
      id: true,
      name: true,
      serial: true,
      installDate: true,
      notes: true,
      assetModel: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          category: true,
        },
      },
    },
  },
} as const;

/** Lighter include for summary/list views. */
export const REQUEST_SUMMARY_INCLUDE = {
  assignedContractor: {
    select: { name: true },
  },
  unit: {
    select: {
      unitNumber: true,
      building: {
        select: { name: true },
      },
    },
  },
} as const;

// ─── Org Scope Filter ──────────────────────────────────────────

/**
 * Build a Prisma WHERE clause that scopes Requests to a given org.
 * Since Request has no orgId column we filter through its nullable
 * FK chains: unit, tenant, appliance, assignedContractor.
 */
export function requestOrgScopeWhere(orgId: string): Prisma.RequestWhereInput {
  return {
    OR: [
      { unit: { orgId } },
      { tenant: { orgId } },
      { appliance: { orgId } },
      { assignedContractor: { orgId } },
    ],
  };
}

// ─── Query Functions ───────────────────────────────────────────

export interface ListRequestOpts {
  limit: number;
  offset: number;
  order: "asc" | "desc";
  view?: "summary" | "full";
}

/**
 * Fetch a single request by ID with full canonical include.
 * Returns the raw Prisma result (not yet DTO-mapped).
 */
export async function findRequestById(prisma: PrismaClient, id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: REQUEST_FULL_INCLUDE,
  });
}

/**
 * List requests scoped to an org, with pagination and view mode.
 */
export async function findRequestsByOrg(
  prisma: PrismaClient,
  orgId: string,
  opts: ListRequestOpts,
) {
  const useSummary = opts.view === "summary";
  return prisma.request.findMany({
    where: requestOrgScopeWhere(orgId),
    orderBy: { createdAt: opts.order },
    take: opts.limit,
    skip: opts.offset,
    include: useSummary ? REQUEST_SUMMARY_INCLUDE : REQUEST_FULL_INCLUDE,
  });
}

/**
 * Find all PENDING_OWNER_APPROVAL requests for an org,
 * optionally filtered by building.
 */
export async function findOwnerPendingApprovals(
  prisma: PrismaClient,
  orgId: string,
  opts: { buildingId?: string },
) {
  const baseWhere = requestOrgScopeWhere(orgId);
  const where = opts.buildingId
    ? { ...baseWhere, status: RequestStatus.PENDING_OWNER_APPROVAL, unit: { buildingId: opts.buildingId, orgId } }
    : { ...baseWhere, status: RequestStatus.PENDING_OWNER_APPROVAL };

  return prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: REQUEST_FULL_INCLUDE,
  });
}

export interface CreateRequestData {
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  applianceId?: string | null;
}

/**
 * Create a new request record.  Returns the row with canonical includes.
 */
export async function createRequest(prisma: PrismaClient, data: CreateRequestData) {
  return prisma.request.create({
    data: {
      description: data.description,
      category: data.category,
      estimatedCost: data.estimatedCost,
      status: data.status,
      contactPhone: data.contactPhone ?? null,
      tenantId: data.tenantId ?? null,
      unitId: data.unitId ?? null,
      applianceId: data.applianceId ?? null,
    },
    include: REQUEST_FULL_INCLUDE,
  });
}

/**
 * Update a request's status.  Optionally sets approvalSource and rejectionReason.
 * Returns the row with canonical includes.
 */
export async function updateRequestStatus(
  prisma: PrismaClient,
  id: string,
  status: RequestStatus,
  extra?: { approvalSource?: ApprovalSource; rejectionReason?: string | null; payingParty?: PayingParty },
) {
  return prisma.request.update({
    where: { id },
    data: {
      status,
      ...(extra?.approvalSource !== undefined && { approvalSource: extra.approvalSource }),
      ...(extra?.rejectionReason !== undefined && { rejectionReason: extra.rejectionReason }),
      ...(extra?.payingParty !== undefined && { payingParty: extra.payingParty }),
    },
    include: REQUEST_FULL_INCLUDE,
  });
}

/**
 * Assign a contractor to a request (raw DB update, no validation).
 */
export async function updateRequestContractor(
  prisma: PrismaClient,
  requestId: string,
  contractorId: string | null,
) {
  return prisma.request.update({
    where: { id: requestId },
    data: { assignedContractorId: contractorId },
    include: REQUEST_FULL_INCLUDE,
  });
}

/**
 * Find a raw request record (minimal, no includes).
 */
export async function findRequestRaw(prisma: PrismaClient, id: string) {
  return prisma.request.findUnique({ where: { id } });
}
