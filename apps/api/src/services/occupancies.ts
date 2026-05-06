import prisma from './prismaClient';
import * as tenantRepo from '../repositories/tenantRepository';
import * as inventoryRepo from '../repositories/inventoryRepository';

export async function listUnitTenants(orgId: string, unitId: string) {
  const unit = await inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
  if (!unit) return null;

  const occupancies = await tenantRepo.findOccupanciesByUnit(prisma, unitId);
  return occupancies.map((o) => o.tenant);
}

export async function listTenantUnits(orgId: string, tenantId: string) {
  const tenant = await tenantRepo.findTenantByOrgAndId(prisma, tenantId, orgId);
  if (!tenant) return null;

  const occupancies = await tenantRepo.findOccupanciesByTenant(prisma, tenantId);
  return occupancies.map((o) => o.unit);
}

export async function linkTenantToUnit(orgId: string, tenantId: string, unitId: string) {
  const unit = await inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
  if (!unit) return { success: false, reason: "UNIT_NOT_FOUND" };

  const tenant = await tenantRepo.findTenantByOrgAndId(prisma, tenantId, orgId);
  if (!tenant) return { success: false, reason: "TENANT_NOT_FOUND" };

  await tenantRepo.upsertOccupancy(prisma, tenantId, unitId);
  return { success: true };
}

export async function unlinkTenantFromUnit(orgId: string, tenantId: string, unitId: string) {
  const unit = await inventoryRepo.findUnitByIdAndOrg(prisma, unitId, orgId);
  if (!unit) return { success: false, reason: "UNIT_NOT_FOUND" };

  await tenantRepo.deleteOccupancies(prisma, tenantId, unitId);
  return { success: true };
}
