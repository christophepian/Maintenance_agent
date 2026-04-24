import { PrismaClient, Prisma, RequestStatus, JobStatus, ApprovalSource, PayingParty, RequestUrgency } from "@prisma/client";
import { REQUEST_FULL_INCLUDE, REQUEST_SUMMARY_INCLUDE } from "../repositories/requestRepository";

/** Compile-time type for a Request row loaded with REQUEST_FULL_INCLUDE. */
type RequestWithFullInclude = Prisma.RequestGetPayload<{ include: typeof REQUEST_FULL_INCLUDE }>;
/** Compile-time type for a Request row loaded with REQUEST_SUMMARY_INCLUDE. */
type RequestWithSummaryInclude = Prisma.RequestGetPayload<{ include: typeof REQUEST_SUMMARY_INCLUDE }>;

/**
 * Build a Prisma WHERE clause that scopes Requests to a given org.
 * Request now has a direct orgId column (DT-114 migration).
 */
function orgScopeWhere(orgId: string): Prisma.RequestWhereInput {
  return { orgId };
}

export type MaintenanceRequestDTO = {
  id: string;
  orgId: string;
  requestNumber: number;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;

  // ✅ NEW but OPTIONAL to avoid breaking other services
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  assetId?: string | null;
  approvalSource?: ApprovalSource | null;
  rejectionReason?: string | null;
  payingParty?: PayingParty;
  urgency?: RequestUrgency;

  assignedContractor: null | {
    id: string;
    name: string;
    phone: string;
    email: string;
    hourlyRate: number;
  };

  /** ID of the most-recent RFP linked to this request, if any. */
  rfpId?: string | null;

  /** Linked job — carries execution state (IN_PROGRESS/COMPLETED) that no longer lives on Request.status */
  job?: {
    id: string;
    status: JobStatus;
    startedAt: string | null;
    completedAt: string | null;
    contractorId: string;
  } | null;

  // optional enrichments
  tenant?: null | {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  unit?: null | {
    id: string;
    unitNumber: string;
    floor: string | null;
    building: {
      id: string;
      name: string;
      address: string;
    };
  };
  asset?: null | {
    id: string;
    name: string;
    type: string;
    category: string;
    topic: string;
    serialNumber: string | null;
    brand: string | null;
    modelNumber: string | null;
    installedAt: Date | null;
    notes: string | null;
    assetModel: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
    } | null;
  };

  // JSON-friendly
  createdAt: string;
};

  /**
   * H5: Summary DTO for list endpoints.
   * Reduces overfetch by omitting deep nested relations for list views.
   */
  export interface MaintenanceRequestSummaryDTO {
    id: string;
    requestNumber: number;
    status: RequestStatus;
    createdAt: string;
    description: string;
    estimatedCost: number | null;
    category: string | null;
    unitNumber: string | null;
    buildingName: string | null;
    assignedContractorName: string | null;
    payingParty?: PayingParty;
    approvalSource?: ApprovalSource | null;
    urgency?: RequestUrgency;
    jobStatus?: JobStatus | null;
    jobCompletedAt?: string | null;
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
  rfps: {
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
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
    job: {
      select: { id: true, status: true, completedAt: true },
    },
  } as const;

export function toDTO(r: RequestWithFullInclude): MaintenanceRequestDTO {
  return {
    id: r.id,
    orgId: r.orgId,
    requestNumber: r.requestNumber,
    description: r.description,
    category: r.category ?? null,
    estimatedCost: r.estimatedCost ?? null,
    status: r.status,

    // ✅ NEW
    contactPhone: r.contactPhone ?? null,
    tenantId: r.tenantId ?? null,
    unitId: r.unitId ?? null,
    assetId: (r as any).assetId ?? null,
    approvalSource: r.approvalSource ?? null,
    rejectionReason: r.rejectionReason ?? null,
    payingParty: r.payingParty,
    urgency: r.urgency,

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
    asset: (r as any).asset ?? null,
    rfpId: r.rfps?.[0]?.id ?? null,

    job: (r as any).job
      ? {
          id: (r as any).job.id,
          status: (r as any).job.status as JobStatus,
          startedAt: (r as any).job.startedAt instanceof Date
            ? (r as any).job.startedAt.toISOString()
            : ((r as any).job.startedAt ?? null),
          completedAt: (r as any).job.completedAt instanceof Date
            ? (r as any).job.completedAt.toISOString()
            : ((r as any).job.completedAt ?? null),
          contractorId: (r as any).job.contractorId,
        }
      : null,

    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

export function toSummaryDTO(r: RequestWithSummaryInclude): MaintenanceRequestSummaryDTO {
    return {
      id: r.id,
      requestNumber: r.requestNumber,
      status: r.status,
      description: r.description,
      estimatedCost: r.estimatedCost ?? null,
      category: r.category ?? null,
      unitNumber: r.unit?.unitNumber ?? null,
      buildingName: r.unit?.building?.name ?? null,
      assignedContractorName: r.assignedContractor?.name ?? null,
      payingParty: r.payingParty,
      approvalSource: r.approvalSource ?? null,
      urgency: r.urgency,
      jobStatus: (r as any).job?.status ?? null,
      jobCompletedAt: (r as any).job?.completedAt instanceof Date
        ? (r as any).job.completedAt.toISOString()
        : ((r as any).job?.completedAt ?? null),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

export async function listMaintenanceRequests(
  prisma: PrismaClient,
  orgId: string,
  opts: ListOpts
  ): Promise<{ data: MaintenanceRequestDTO[] | MaintenanceRequestSummaryDTO[]; total: number }> {
    const useSummary = opts.view === "summary";
    const where = orgScopeWhere(orgId);

  const [rows, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: opts.order },
      take: opts.limit,
      skip: opts.offset,
      include: useSummary ? requestSummaryInclude : requestInclude,
    }),
    prisma.request.count({ where }),
  ]);

    const data = useSummary ? rows.map(toSummaryDTO) : rows.map(toDTO);
    return { data, total };
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
): Promise<MaintenanceRequestDTO> {
  const created = await prisma.request.create({
    data: {
      orgId: input.orgId,
      description: input.description,
      category: input.category,
      estimatedCost: input.estimatedCost,
      status: input.status,

      contactPhone: input.contactPhone ?? null,
      tenantId: input.tenantId ?? null,
      unitId: input.unitId ?? null,
      assetId: input.assetId ?? null,
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
