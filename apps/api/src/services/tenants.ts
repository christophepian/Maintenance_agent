import prisma from './prismaClient';
import * as tenantRepo from '../repositories/tenantRepository';
import * as leaseRepo from '../repositories/leaseRepository';
import * as inventoryRepo from '../repositories/inventoryRepository';
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

// ─── Remove building-tenant entries (import-junk cleanup) ──────────────────────
// The building "tenant list" is a merged view of occupancies + leases, so a row is
// removed by clearing its underlying records — NOT by deleting a Tenant. For each
// entry we soft-delete the matching ACTIVE lease(s) (they carry a deletedAt and drop
// out of the active view), delete the occupancy, and deactivate the tenant if it has
// no occupancies left. Entries whose lease already has real (non-DRAFT) invoices are
// KEPT — that's genuine billing history, not import junk, and needs a proper
// termination flow instead.

export interface RemoveTenantEntry { unitId: string; tenantId: string; }
export type RemoveEntryOutcome = "removed" | "kept_billing" | "not_found";
export interface RemoveEntryResult { unitId: string; tenantId: string; outcome: RemoveEntryOutcome; }

async function leaseHasRealBilling(leaseId: string, orgId: string): Promise<boolean> {
  const invoices = await leaseRepo.listInvoicesByLease(prisma, leaseId, orgId);
  return invoices.some((i) => i.status !== "DRAFT");
}

async function removeOneEntry(orgId: string, buildingId: string, e: RemoveTenantEntry): Promise<RemoveEntryResult> {
  const base = { unitId: e.unitId, tenantId: e.tenantId };
  const unit = await inventoryRepo.findUnitByIdAndOrg(prisma, e.unitId, orgId);
  if (!unit || unit.buildingId !== buildingId) return { ...base, outcome: "not_found" };

  // Lease-only row → the DTO key is "lease:<leaseId>".
  if (e.tenantId.startsWith("lease:")) {
    const leaseId = e.tenantId.slice("lease:".length);
    if (await leaseHasRealBilling(leaseId, orgId)) return { ...base, outcome: "kept_billing" };
    const n = await leaseRepo.softDeleteLeaseInOrg(prisma, leaseId, orgId);
    return { ...base, outcome: n > 0 ? "removed" : "not_found" };
  }

  // Occupancy row → real tenant id.
  const tenant = await tenantRepo.findTenantByOrgAndId(prisma, e.tenantId, orgId);
  if (!tenant) return { ...base, outcome: "not_found" };
  const leases = await leaseRepo.findActiveLeasesForUnitPhone(prisma, orgId, e.unitId, tenant.phone);
  for (const l of leases) {
    if (await leaseHasRealBilling(l.id, orgId)) return { ...base, outcome: "kept_billing" };
  }
  for (const l of leases) await leaseRepo.softDeleteLeaseInOrg(prisma, l.id, orgId);
  await tenantRepo.deleteOccupancies(prisma, e.tenantId, e.unitId);
  const remaining = await tenantRepo.countTenantOccupancies(prisma, e.tenantId);
  if (remaining === 0) await tenantRepo.updateTenantRecord(prisma, e.tenantId, { isActive: false });
  return { ...base, outcome: "removed" };
}

export async function removeBuildingTenantEntries(
  orgId: string,
  buildingId: string,
  entries: RemoveTenantEntry[],
): Promise<{ removed: number; keptBilling: number; notFound: number; results: RemoveEntryResult[] }> {
  const results: RemoveEntryResult[] = [];
  for (const e of entries) results.push(await removeOneEntry(orgId, buildingId, e));
  return {
    removed: results.filter((r) => r.outcome === "removed").length,
    keptBilling: results.filter((r) => r.outcome === "kept_billing").length,
    notFound: results.filter((r) => r.outcome === "not_found").length,
    results,
  };
}
