import { PrismaClient } from "@prisma/client";

export type ContractorDTO = {
  id: string;
  name: string;
  phone: string;
  email: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  iban?: string;
  vatNumber?: string;
  defaultVatRate?: number;
  hourlyRate: number;
  serviceCategories: string[]; // Array of category strings
  isActive: boolean;
  createdAt: string; // ISO
};

export type CreateContractorInput = {
  name: string;
  phone: string;
  email: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  iban?: string;
  vatNumber?: string;
  defaultVatRate?: number;
  hourlyRate?: number;
  serviceCategories: string[];
};

export type UpdateContractorInput = Partial<CreateContractorInput>;

function toDTO(c: {
  id: string;
  name: string;
  phone: string;
  email: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  iban: string | null;
  vatNumber: string | null;
  defaultVatRate: number | null;
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
    addressLine1: c.addressLine1 || undefined,
    addressLine2: c.addressLine2 || undefined,
    postalCode: c.postalCode || undefined,
    city: c.city || undefined,
    country: c.country || undefined,
    iban: c.iban || undefined,
    vatNumber: c.vatNumber || undefined,
    defaultVatRate: c.defaultVatRate ?? undefined,
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
): Promise<{ data: ContractorDTO[]; total: number }> {
  const where = { orgId, isActive: true };
  const [rows, total] = await Promise.all([
    prisma.contractor.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.contractor.count({ where }),
  ]);
  return { data: rows.map(toDTO), total };
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
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      postalCode: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country ?? "CH",
      iban: input.iban ?? null,
      vatNumber: input.vatNumber ?? null,
      defaultVatRate: input.defaultVatRate ?? 7.7,
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
  if (input.addressLine1 !== undefined) updates.addressLine1 = input.addressLine1 ?? null;
  if (input.addressLine2 !== undefined) updates.addressLine2 = input.addressLine2 ?? null;
  if (input.postalCode !== undefined) updates.postalCode = input.postalCode ?? null;
  if (input.city !== undefined) updates.city = input.city ?? null;
  if (input.country !== undefined) updates.country = input.country ?? null;
  if (input.iban !== undefined) updates.iban = input.iban ?? null;
  if (input.vatNumber !== undefined) updates.vatNumber = input.vatNumber ?? null;
  if (input.defaultVatRate !== undefined) updates.defaultVatRate = input.defaultVatRate ?? null;
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
