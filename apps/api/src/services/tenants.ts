import prisma from './prismaClient';
import * as tenantRepo from '../repositories/tenantRepository';
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import {
  CreateTenantInput,
  UpdateTenantInput,
  GetTenantByPhoneInput,
  createTenantSchema,
  getTenantByPhoneSchema,
  updateTenantSchema,
} from "../validation/tenants";

/**
 * DTO for tenant response - excludes internal fields
 */
export interface TenantDTO {
  id: string;
  orgId: string;
  name?: string;
  phone: string;
  email?: string;
  unitId?: string;
  unit?: {
    id: string;
    buildingId: string;
    unitNumber: string;
    floor?: string;
  };
  assets?: Array<{
    id: string;
    name: string;
    topic: string;
    type: string;
    serialNumber?: string;
    assetModelId?: string;
    assetModel?: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transform database tenant record to DTO
 */
function tenantToDTO(tenant: any): TenantDTO {
  const primaryUnit = tenant.occupancies?.[0]?.unit;
  return {
    id: tenant.id,
    orgId: tenant.orgId,
    name: tenant.name || undefined,
    phone: tenant.phone,
    email: tenant.email || undefined,
    unitId: primaryUnit?.id || undefined,
    unit: primaryUnit
      ? {
          id: primaryUnit.id,
          buildingId: primaryUnit.buildingId,
          unitNumber: primaryUnit.unitNumber,
          floor: primaryUnit.floor || undefined,
        }
      : undefined,
    assets: primaryUnit?.assets
      ? primaryUnit.assets.map((asset: any) => ({
          id: asset.id,
          name: asset.name,
          topic: asset.topic,
          type: asset.type,
          serialNumber: asset.serialNumber || undefined,
          assetModelId: asset.assetModelId || undefined,
          assetModel: asset.assetModel
            ? {
                id: asset.assetModel.id,
                manufacturer: asset.assetModel.manufacturer,
                model: asset.assetModel.model,
                category: asset.assetModel.category,
              }
            : undefined,
        }))
      : undefined,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

/**
 * Create or fetch tenant by phone number
 * Returns existing tenant if found, creates new one if not
 */
export async function createOrGetTenant(
  input: CreateTenantInput
): Promise<TenantDTO> {
  const validated = createTenantSchema.parse(input);

  // Normalize phone to E.164
  const normalizedPhone = normalizePhoneToE164(input.phone);
  if (!normalizedPhone) {
    throw new Error("Invalid phone number format");
  }

  // Check if tenant already exists by phone in this org
  const existingTenant = await tenantRepo.findTenantByOrgPhone(prisma, validated.orgId, normalizedPhone);

  if (existingTenant) {
    return tenantToDTO(existingTenant);
  }

  // Create new tenant
  const newTenant = await tenantRepo.createTenantRecord(prisma, {
    orgId: validated.orgId,
    phone: normalizedPhone,
    name: validated.name || null,
    email: validated.email || null,
  });

  if (validated.unitId) {
    await tenantRepo.createOccupancyRecord(prisma, newTenant.id, validated.unitId);
  }

  const loadedTenant = await tenantRepo.findTenantByIdFull(prisma, newTenant.id);
  if (!loadedTenant) throw new Error("Failed to load tenant");
  return tenantToDTO(loadedTenant);
}

/**
 * Get tenant by phone number and org
 */
export async function getTenantByPhone(
  input: GetTenantByPhoneInput
): Promise<TenantDTO | null> {
  const validated = getTenantByPhoneSchema.parse(input);

  // Normalize phone to E.164
  const normalizedPhone = normalizePhoneToE164(input.phone);
  if (!normalizedPhone) {
    throw new Error("Invalid phone number format");
  }

  const tenant = await tenantRepo.findTenantByOrgPhone(prisma, validated.orgId, normalizedPhone);
  return tenant ? tenantToDTO(tenant) : null;
}

/**
 * Get tenant by ID
 */
export async function getTenantById(id: string): Promise<TenantDTO | null> {
  const tenant = await tenantRepo.findTenantByIdFull(prisma, id);
  return tenant ? tenantToDTO(tenant) : null;
}

/**
 * Update tenant information
 */
export async function updateTenant(
  orgId: string,
  id: string,
  input: UpdateTenantInput
): Promise<TenantDTO> {
  const validated = updateTenantSchema.parse(input);

  const existing = await tenantRepo.findTenantByOrgAndId(prisma, id, orgId);
  if (!existing) {
    throw new Error("Tenant not found");
  }

  const tenant = await tenantRepo.updateTenantRecord(prisma, id, {
    name: validated.name !== undefined ? validated.name : undefined,
    phone: validated.phone !== undefined ? validated.phone : undefined,
    email: validated.email !== undefined ? validated.email : undefined,
  });

  if (validated.unitId) {
    await tenantRepo.upsertOccupancy(prisma, tenant.id, validated.unitId);
  }

  const loadedTenant = await tenantRepo.findTenantByIdFull(prisma, tenant.id);
  if (!loadedTenant) throw new Error("Failed to load tenant");
  return tenantToDTO(loadedTenant);
}

/**
 * List tenants in org
 */
export async function listTenants(orgId: string, includeInactive?: boolean): Promise<{ data: TenantDTO[]; total: number }> {
  const { tenants, total } = await tenantRepo.listTenantsWithCount(prisma, orgId, includeInactive);
  return { data: tenants.map(tenantToDTO), total };
}

export async function deactivateTenant(orgId: string, tenantId: string) {
  const existing = await tenantRepo.findTenantByOrgAndId(prisma, tenantId, orgId);
  if (!existing) return { success: false, reason: "NOT_FOUND" };

  const occupancyCount = await tenantRepo.countTenantOccupancies(prisma, tenantId);
  if (occupancyCount > 0) {
    return { success: false, reason: "HAS_OCCUPANCIES" };
  }

  await tenantRepo.updateTenantRecord(prisma, tenantId, { isActive: false });

  return { success: true };
}
