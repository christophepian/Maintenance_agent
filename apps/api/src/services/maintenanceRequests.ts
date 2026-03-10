import { PrismaClient, Prisma, RequestStatus } from "@prisma/client";
import { REQUEST_FULL_INCLUDE, REQUEST_SUMMARY_INCLUDE } from "../repositories/requestRepository";

/** Compile-time type for a Request row loaded with REQUEST_FULL_INCLUDE. */
type RequestWithFullInclude = Prisma.RequestGetPayload<{ include: typeof REQUEST_FULL_INCLUDE }>;
/** Compile-time type for a Request row loaded with REQUEST_SUMMARY_INCLUDE. */
type RequestWithSummaryInclude = Prisma.RequestGetPayload<{ include: typeof REQUEST_SUMMARY_INCLUDE }>;

/**
 * Build a Prisma WHERE clause that scopes Requests to a given org.
 *
 * Since Request has no orgId column we filter through its nullable
 * FK chains: unit.orgId OR tenant.orgId OR appliance.orgId OR
 * assignedContractor.orgId.
 */
function orgScopeWhere(orgId: string): Prisma.RequestWhereInput {
  return {
    OR: [
      { unit: { orgId } },
      { tenant: { orgId } },
      { appliance: { orgId } },
      { assignedContractor: { orgId } },
    ],
  };
}

export type MaintenanceRequestDTO = {
  id: string;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;

  // ✅ NEW but OPTIONAL to avoid breaking other services
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  applianceId?: string | null;

  assignedContractor: null | {
    id: string;
    name: string;
    phone: string;
    email: string;
    hourlyRate: number;
  };

  // optional enrichments
  tenant?: null | {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  unit?: any | null;
  appliance?: any | null;

  // JSON-friendly
  createdAt: string;
};

  /**
   * H5: Summary DTO for list endpoints.
   * Reduces overfetch by omitting deep nested relations for list views.
   */
  export interface MaintenanceRequestSummaryDTO {
    id: string;
    status: RequestStatus;
    createdAt: string;
    description: string;
    estimatedCost: number | null;
    category: string | null;
    unitNumber: string | null;
    buildingName: string | null;
    assignedContractorName: string | null;
  }

type ListOpts = {
  limit: number;
  offset: number;
  order: "asc" | "desc";
    view?: "summary" | "full";
};

const requestInclude = {
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

  const requestSummaryInclude = {
    assignedContractor: {
      select: {
        name: true,
      },
    },
    unit: {
      select: {
        unitNumber: true,
        building: {
          select: {
            name: true,
          },
        },
      },
    },
  } as const;

export function toDTO(r: RequestWithFullInclude): MaintenanceRequestDTO {
  return {
    id: r.id,
    description: r.description,
    category: r.category ?? null,
    estimatedCost: r.estimatedCost ?? null,
    status: r.status,

    // ✅ NEW
    contactPhone: r.contactPhone ?? null,
    tenantId: r.tenantId ?? null,
    unitId: r.unitId ?? null,
    applianceId: r.applianceId ?? null,

    assignedContractor: r.assignedContractor
      ? {
          id: r.assignedContractor.id,
          name: r.assignedContractor.name,
          phone: r.assignedContractor.phone,
          email: r.assignedContractor.email,
          hourlyRate: r.assignedContractor.hourlyRate,
        }
      : null,

    tenant: r.tenant
      ? {
          id: r.tenant.id,
          name: r.tenant.name ?? null,
          phone: r.tenant.phone,
          email: r.tenant.email ?? null,
        }
      : null,

    unit: r.unit ?? null,
    appliance: r.appliance ?? null,

    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

export function toSummaryDTO(r: RequestWithSummaryInclude): MaintenanceRequestSummaryDTO {
    return {
      id: r.id,
      status: r.status,
      description: r.description,
      estimatedCost: r.estimatedCost ?? null,
      category: r.category ?? null,
      unitNumber: r.unit?.unitNumber ?? null,
      buildingName: r.unit?.building?.name ?? null,
      assignedContractorName: r.assignedContractor?.name ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

export async function listMaintenanceRequests(
  prisma: PrismaClient,
  orgId: string,
  opts: ListOpts
  ): Promise<MaintenanceRequestDTO[] | MaintenanceRequestSummaryDTO[]> {
    const useSummary = opts.view === "summary";
  
  const rows = await prisma.request.findMany({
    where: orgScopeWhere(orgId),
    orderBy: { createdAt: opts.order },
    take: opts.limit,
    skip: opts.offset,
      include: useSummary ? requestSummaryInclude : requestInclude,
  });

    return useSummary ? rows.map(toSummaryDTO) : rows.map(toDTO);
}

export async function listOwnerPendingApprovals(
  prisma: PrismaClient,
  orgId: string,
  opts: { buildingId?: string }
): Promise<MaintenanceRequestDTO[]> {
  const baseWhere = orgScopeWhere(orgId);

  const where = opts.buildingId
    ? { ...baseWhere, status: RequestStatus.PENDING_OWNER_APPROVAL, unit: { buildingId: opts.buildingId, orgId } }
    : { ...baseWhere, status: RequestStatus.PENDING_OWNER_APPROVAL };

  const rows = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: requestInclude,
  });

  return rows.map(toDTO);
}


// Re-export real implementations from requestAssignment
export { assignContractor, unassignContractor, findMatchingContractor } from './requestAssignment';

export async function getMaintenanceRequestById(
  prisma: PrismaClient,
  id: string
): Promise<MaintenanceRequestDTO | null> {
  const row = await prisma.request.findUnique({
    where: { id },
    include: requestInclude,
  });

  if (!row) return null;
  return toDTO(row);
}

export async function createMaintenanceRequest(
  prisma: PrismaClient,
  input: {
    description: string;
    category: string | null;
    estimatedCost: number | null;
    status: RequestStatus;
    contactPhone?: string | null;
    tenantId?: string | null;
    unitId?: string | null;
    applianceId?: string | null;
  }
): Promise<MaintenanceRequestDTO> {
  const created = await prisma.request.create({
    data: {
      description: input.description,
      category: input.category,
      estimatedCost: input.estimatedCost,
      status: input.status,

      contactPhone: input.contactPhone ?? null,
      tenantId: input.tenantId ?? null,
      unitId: input.unitId ?? null,
      applianceId: input.applianceId ?? null,
    },
    include: requestInclude,
  });

  return toDTO(created);
}

export async function updateMaintenanceRequestStatus(
  prisma: PrismaClient,
  id: string,
  status: RequestStatus
): Promise<MaintenanceRequestDTO | null> {
  const updated = await prisma.request.update({
    where: { id },
    data: { status },
    include: requestInclude,
  });

  return updated ? toDTO(updated) : null;
}
