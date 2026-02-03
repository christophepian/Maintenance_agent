import { PrismaClient, RequestStatus } from "@prisma/client";

export type CreateMaintenanceRequestInput = {
  description: string; // already normalized by caller
  category: string | null; // already normalized by caller
  estimatedCost: number | null; // CHF (nullable)
  status: RequestStatus;
};

export type MaintenanceRequestDTO = {
  id: string;
  description: string;
  category?: string;
  estimatedCost?: number; // omit if null
  status: RequestStatus;
  assignedContractor?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    hourlyRate: number;
  };
  createdAt: string; // ISO
};

export type ListRequestsOptions = {
  limit: number;
  offset: number;
  order: "asc" | "desc";
};

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
}) {
  return {
    id: r.id,
    description: r.description,
    category: r.category ?? undefined,
    estimatedCost: r.estimatedCost ?? undefined,
    status: r.status,
    assignedContractor: r.assignedContractor ?? undefined,
    createdAt: r.createdAt.toISOString(),
  } satisfies MaintenanceRequestDTO;
}

/**
 * List requests (pagination + ordering).
 * Defaults should be set by caller.
 */
export async function listMaintenanceRequests(
  prisma: PrismaClient,
  opts?: Partial<ListRequestsOptions>
): Promise<MaintenanceRequestDTO[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const order: "asc" | "desc" = opts?.order ?? "asc";

  const rows = await prisma.request.findMany({
    orderBy: { createdAt: order },
    take: limit,
    skip: offset,
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

  return rows.map(toDTO);
}

/**
 * Get one request by id.
 */
export async function getMaintenanceRequestById(
  prisma: PrismaClient,
  id: string
): Promise<MaintenanceRequestDTO | null> {
  const row = await prisma.request.findUnique({
    where: { id },
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
  return row ? toDTO(row) : null;
}

/**
 * Create a request.
 */
export async function createMaintenanceRequest(
  prisma: PrismaClient,
  input: CreateMaintenanceRequestInput
): Promise<MaintenanceRequestDTO> {
  const created = await prisma.request.create({
    data: {
      description: input.description,
      category: input.category,
      estimatedCost: input.estimatedCost, // can be null
      status: input.status,
    },
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

  return toDTO(created);
}

/**
 * Update request status (used by manager actions).
 */
export async function updateMaintenanceRequestStatus(
  prisma: PrismaClient,
  id: string,
  status: RequestStatus
): Promise<MaintenanceRequestDTO | null> {
  try {
    const updated = await prisma.request.update({
      where: { id },
      data: { status },
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
    return toDTO(updated);
  } catch (e: any) {
    // Prisma throws if not found
    return null;
  }
}
