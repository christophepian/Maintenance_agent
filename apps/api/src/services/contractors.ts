import { PrismaClient } from "@prisma/client";

export type ContractorDTO = {
  id: string;
  name: string;
  phone: string;
  email: string;
  hourlyRate: number;
  serviceCategories: string[]; // Array of category strings
  isActive: boolean;
  createdAt: string; // ISO
};

export type CreateContractorInput = {
  name: string;
  phone: string;
  email: string;
  hourlyRate?: number;
  serviceCategories: string[];
};

export type UpdateContractorInput = Partial<CreateContractorInput>;

function toDTO(c: {
  id: string;
  name: string;
  phone: string;
  email: string;
  hourlyRate: number;
  serviceCategories: string;
  isActive: boolean;
  createdAt: Date;
}): ContractorDTO {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    hourlyRate: c.hourlyRate,
    serviceCategories: JSON.parse(c.serviceCategories || "[]"),
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * List all active contractors for an org.
 */
export async function listContractors(
  prisma: PrismaClient,
  orgId: string
): Promise<ContractorDTO[]> {
  const rows = await prisma.contractor.findMany({
    where: { orgId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

/**
 * Get contractor by id.
 */
export async function getContractorById(
  prisma: PrismaClient,
  id: string
): Promise<ContractorDTO | null> {
  const row = await prisma.contractor.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

/**
 * Create a new contractor.
 */
export async function createContractor(
  prisma: PrismaClient,
  orgId: string,
  input: CreateContractorInput
): Promise<ContractorDTO> {
  const row = await prisma.contractor.create({
    data: {
      orgId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      hourlyRate: input.hourlyRate ?? 50,
      serviceCategories: JSON.stringify(input.serviceCategories),
    },
  });
  return toDTO(row);
}

/**
 * Update an existing contractor.
 */
export async function updateContractor(
  prisma: PrismaClient,
  id: string,
  input: UpdateContractorInput
): Promise<ContractorDTO | null> {
  const updates: any = {};
  if (input.name) updates.name = input.name;
  if (input.phone) updates.phone = input.phone;
  if (input.email) updates.email = input.email;
  if (input.hourlyRate !== undefined) updates.hourlyRate = input.hourlyRate;
  if (input.serviceCategories)
    updates.serviceCategories = JSON.stringify(input.serviceCategories);

  try {
    const row = await prisma.contractor.update({
      where: { id },
      data: updates,
    });
    return toDTO(row);
  } catch (e) {
    return null;
  }
}

/**
 * Delete a contractor (soft delete: set isActive = false).
 */
export async function deactivateContractor(
  prisma: PrismaClient,
  id: string
): Promise<boolean> {
  try {
    await prisma.contractor.update({
      where: { id },
      data: { isActive: false },
    });
    return true;
  } catch (e) {
    return false;
  }
}
