import prisma from './prismaClient';

export async function listUnitTenants(orgId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!unit) return null;

  const occupancies = await prisma.occupancy.findMany({
    where: { unitId },
    include: {
      tenant: true,
    },
    orderBy: { tenantId: "asc" },
  });

  return occupancies.map((o) => o.tenant);
}

export async function listTenantUnits(orgId: string, tenantId: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, orgId } });
  if (!tenant) return null;

  const occupancies = await prisma.occupancy.findMany({
    where: { tenantId },
    include: {
      unit: true,
    },
    orderBy: { unitId: "asc" },
  });

  return occupancies.map((o) => o.unit);
}

export async function linkTenantToUnit(orgId: string, tenantId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!unit) return { success: false, reason: "UNIT_NOT_FOUND" };

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, orgId } });
  if (!tenant) return { success: false, reason: "TENANT_NOT_FOUND" };

  await prisma.occupancy.upsert({
    where: {
      tenantId_unitId: {
        tenantId,
        unitId,
      },
    },
    update: {},
    create: {
      tenantId,
      unitId,
    },
  });

  return { success: true };
}

export async function unlinkTenantFromUnit(orgId: string, tenantId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!unit) return { success: false, reason: "UNIT_NOT_FOUND" };

  await prisma.occupancy.deleteMany({
    where: { tenantId, unitId },
  });

  return { success: true };
}
