import type { PrismaClient, RequestStatus } from "@prisma/client";

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

type ListOpts = {
  limit: number;
  offset: number;
  order: "asc" | "desc";
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

function toDTO(r: any): MaintenanceRequestDTO {
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

export async function listMaintenanceRequests(
  prisma: PrismaClient,
  opts: ListOpts
): Promise<MaintenanceRequestDTO[]> {
  const rows = await prisma.request.findMany({
    orderBy: { createdAt: opts.order },
    take: opts.limit,
    skip: opts.offset,
    include: requestInclude,
  });

  return rows.map(toDTO);
}


export async function assignContractor(prisma: PrismaClient, requestId: string, contractorId: string) {
  // Stub implementation
  return { success: true, message: "Stub: assigned contractor", data: { id: contractorId } };
}

export async function unassignContractor(prisma: PrismaClient, requestId: string) {
  // Stub implementation
  return { success: true, message: "Stub: unassigned contractor" };
}

export async function findMatchingContractor(prisma: PrismaClient, orgId: string, category: string) {
  // Stub implementation
  return { id: "stub-contractor-id", name: "Stub Contractor" };
}
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
