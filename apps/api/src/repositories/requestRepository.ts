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

import { PrismaClient, Prisma, RequestStatus, RequestUrgency, ApprovalSource, PayingParty } from "@prisma/client";

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
  asset: {
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      topic: true,
      serialNumber: true,
      brand: true,
      modelNumber: true,
      installedAt: true,
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
  // Most-recent RFP for this request (used on approval screens)
  rfps: {
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  // Linked job — carries execution state (IN_PROGRESS/COMPLETED) that no longer lives on Request
  job: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      contractorId: true,
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
  job: {
    select: { id: true, status: true, completedAt: true },
  },
} as const;

// ─── Org Scope Filter ──────────────────────────────────────────

/**
 * Build a Prisma WHERE clause that scopes Requests to a given org.
 * Request now has a direct orgId column (DT-114 migration).
 */
export function requestOrgScopeWhere(orgId: string): Prisma.RequestWhereInput {
  return { orgId };
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
  orgId: string;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  assetId?: string | null;
}

/**
 * Create a new request record.  Returns the row with canonical includes.
 */
export async function createRequest(prisma: PrismaClient, data: CreateRequestData) {
  return prisma.request.create({
    data: {
      orgId: data.orgId,
      description: data.description,
      category: data.category,
      estimatedCost: data.estimatedCost,
      status: data.status,
      contactPhone: data.contactPhone ?? null,
      tenantId: data.tenantId ?? null,
      unitId: data.unitId ?? null,
      assetId: data.assetId ?? null,
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

/**
 * Resolve a route parameter that may be either a UUID or a numeric requestNumber.
 * Returns the UUID primary key, or null if not found.
 */
export async function resolveRequestId(prisma: PrismaClient, idOrNumber: string): Promise<string | null> {
  // If the param looks like a positive integer, treat it as requestNumber
  if (/^\d+$/.test(idOrNumber)) {
    const row = await prisma.request.findUnique({
      where: { requestNumber: Number(idOrNumber) },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  // Otherwise assume it's already a UUID
  return idOrNumber;
}

/**
 * Resolve a request by UUID or requestNumber and verify it belongs to orgId in one query.
 * Returns { id } if found and in-scope, null otherwise.
 * Replaces the three-step resolveRequestId → resolveRequestOrg → assertOrgScope pattern.
 */
export async function resolveAndScopeRequest(
  prisma: PrismaClient,
  idOrNumber: string,
  orgId: string,
): Promise<{ id: string } | null> {
  const id = await resolveRequestId(prisma, idOrNumber);
  if (!id) return null;
  return prisma.request.findFirst({ where: { id, orgId }, select: { id: true } });
}

/**
 * Fetch only the tenantId for a request — used for tenant ownership checks.
 */
export async function findRequestTenantId(prisma: PrismaClient, id: string) {
  return prisma.request.findUnique({ where: { id }, select: { tenantId: true } });
}

/**
 * Fetch only the orgId for a request — used when the caller (e.g. a tenant)
 * may belong to a different org context.
 */
export async function findRequestOrgId(prisma: PrismaClient, id: string) {
  return prisma.request.findUnique({ where: { id }, select: { orgId: true } });
}

/**
 * Link or unlink an asset on a request. Returns id + assetId only.
 */
export async function updateRequestAsset(
  prisma: PrismaClient,
  id: string,
  assetId: string | null,
) {
  return prisma.request.update({
    where: { id },
    data: { assetId },
    select: { id: true, assetId: true },
  });
}

/**
 * Update a request's urgency and return the full request with canonical includes.
 */
export async function updateRequestUrgency(
  prisma: PrismaClient,
  id: string,
  urgency: RequestUrgency
) {
  return prisma.request.update({
    where: { id },
    data: { urgency },
    include: REQUEST_FULL_INCLUDE,
  });
}

/**
 * Delete all requests — dev-only bulk wipe.
 */
export async function deleteAllRequests(prisma: PrismaClient) {
  return prisma.request.deleteMany({});
}
