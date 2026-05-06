import { BillingEntityType } from "@prisma/client";
import prisma from './prismaClient';
import {
  findBillingEntityByTypeAndOwner,
  createBillingEntityRecord,
  listBillingEntitiesFiltered,
  findBillingEntityByOrgAndId,
  updateBillingEntityRecord,
  deleteBillingEntityRecord,
} from "../repositories/billingEntityRepository";
import { findContractorByOrgAndId } from "../repositories/contractorRepository";

export type BillingEntityDTO = {
  id: string;
  orgId: string;
  type: BillingEntityType;
  contractorId?: string;
  userId?: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country: string;
  iban: string;
  vatNumber?: string;
  defaultVatRate: number;
  nextInvoiceSequence: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateBillingEntityParams = {
  orgId: string;
  type: BillingEntityType;
  contractorId?: string;
  userId?: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country?: string;
  iban: string;
  vatNumber?: string;
  defaultVatRate?: number;
};

export type UpdateBillingEntityParams = {
  contractorId?: string | null;
  name?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  postalCode?: string;
  city?: string;
  country?: string;
  iban?: string;
  vatNumber?: string | null;
  defaultVatRate?: number;
};

export async function createBillingEntity(
  params: CreateBillingEntityParams
): Promise<BillingEntityDTO> {
  if (params.contractorId && params.type !== BillingEntityType.CONTRACTOR) {
    throw new Error("CONTRACTOR_TYPE_REQUIRED");
  }

  if (params.contractorId) {
    const contractor = await findContractorByOrgAndId(prisma, params.contractorId, params.orgId);
    if (!contractor) {
      throw new Error("CONTRACTOR_NOT_FOUND");
    }
  }

  const existing = await findBillingEntityByTypeAndOwner(
    prisma,
    params.orgId,
    params.type,
    params.userId,
  );
  if (existing) {
    throw new Error("BILLING_ENTITY_TYPE_EXISTS");
  }

  const created = await createBillingEntityRecord(prisma, {
    orgId: params.orgId,
    type: params.type,
    contractorId: params.contractorId ?? null,
    userId: params.userId ?? null,
    name: params.name,
    addressLine1: params.addressLine1,
    addressLine2: params.addressLine2 ?? null,
    postalCode: params.postalCode,
    city: params.city,
    country: params.country || "CH",
    iban: params.iban,
    vatNumber: params.vatNumber ?? null,
    defaultVatRate: params.defaultVatRate ?? 7.7,
  });

  return mapBillingEntityToDTO(created);
}

export async function listBillingEntities(
  orgId: string,
  filters?: { type?: BillingEntityType }
): Promise<BillingEntityDTO[]> {
  const entities = await listBillingEntitiesFiltered(prisma, orgId, filters?.type);

  return entities.map(mapBillingEntityToDTO);
}

export async function getBillingEntity(
  orgId: string,
  billingEntityId: string
): Promise<BillingEntityDTO | null> {
  const entity = await findBillingEntityByOrgAndId(prisma, orgId, billingEntityId);

  return entity ? mapBillingEntityToDTO(entity) : null;
}

export async function updateBillingEntity(
  orgId: string,
  billingEntityId: string,
  params: UpdateBillingEntityParams
): Promise<BillingEntityDTO | null> {
  const entity = await findBillingEntityByOrgAndId(prisma, orgId, billingEntityId);

  if (!entity) return null;

  if (params.contractorId !== undefined) {
    if (params.contractorId === null) {
      // allow unlink
    } else {
      const contractor = await findContractorByOrgAndId(prisma, params.contractorId, orgId);
      if (!contractor) {
        throw new Error("CONTRACTOR_NOT_FOUND");
      }
      if (entity.type !== BillingEntityType.CONTRACTOR) {
        throw new Error("CONTRACTOR_TYPE_REQUIRED");
      }
    }
  }

  const updated = await updateBillingEntityRecord(prisma, billingEntityId, {
    ...(params.contractorId !== undefined
      ? { contractorId: params.contractorId === null ? null : params.contractorId }
      : {}),
    ...(params.name !== undefined ? { name: params.name } : {}),
    ...(params.addressLine1 !== undefined ? { addressLine1: params.addressLine1 } : {}),
    ...(params.addressLine2 !== undefined
      ? { addressLine2: params.addressLine2 === null ? null : params.addressLine2 }
      : {}),
    ...(params.postalCode !== undefined ? { postalCode: params.postalCode } : {}),
    ...(params.city !== undefined ? { city: params.city } : {}),
    ...(params.country !== undefined ? { country: params.country } : {}),
    ...(params.iban !== undefined ? { iban: params.iban } : {}),
    ...(params.vatNumber !== undefined
      ? { vatNumber: params.vatNumber === null ? null : params.vatNumber }
      : {}),
    ...(params.defaultVatRate !== undefined ? { defaultVatRate: params.defaultVatRate } : {}),
  });

  return mapBillingEntityToDTO(updated);
}

export async function deleteBillingEntity(
  orgId: string,
  billingEntityId: string
): Promise<boolean> {
  const entity = await findBillingEntityByOrgAndId(prisma, orgId, billingEntityId);

  if (!entity) return false;

  await deleteBillingEntityRecord(prisma, billingEntityId);
  return true;
}

function mapBillingEntityToDTO(entity: any): BillingEntityDTO {
  return {
    id: entity.id,
    orgId: entity.orgId,
    type: entity.type,
    contractorId: entity.contractorId || undefined,
    userId: entity.userId || undefined,
    name: entity.name,
    addressLine1: entity.addressLine1,
    addressLine2: entity.addressLine2 || undefined,
    postalCode: entity.postalCode,
    city: entity.city,
    country: entity.country,
    iban: entity.iban,
    vatNumber: entity.vatNumber || undefined,
    defaultVatRate: entity.defaultVatRate,
    nextInvoiceSequence: entity.nextInvoiceSequence,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
