/**
 * Tenant Repository
 *
 * Centralizes all Prisma access for Tenant and Occupancy models.
 * G3: canonical include constant exported for DTO mapping.
 * G9: canonical include constants live here.
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Canonical Include ─────────────────────────────────────────

export const TENANT_WITH_OCCUPANCIES_INCLUDE = {
  occupancies: {
    include: {
      unit: {
        include: {
          assets: {
            include: { assetModel: true },
          },
        },
      },
    },
  },
} as const;

// ─── Tenant Query Functions ────────────────────────────────────

/**
 * Find a tenant by org + phone composite key with full occupancy include.
 */
export async function findTenantByOrgPhone(
  prisma: PrismaClient,
  orgId: string,
  phone: string,
) {
  return prisma.tenant.findUnique({
    where: { orgId_phone: { orgId, phone } },
    include: TENANT_WITH_OCCUPANCIES_INCLUDE,
  });
}

/**
 * Create a new tenant record (no occupancy).
 */
export async function createTenantRecord(
  prisma: PrismaClient,
  data: Prisma.TenantUncheckedCreateInput,
) {
  return prisma.tenant.create({ data });
}

/**
 * Find a tenant by id with full occupancy include.
 */
export async function findTenantByIdFull(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.tenant.findUnique({
    where: { id },
    include: TENANT_WITH_OCCUPANCIES_INCLUDE,
  });
}

/**
 * Find a tenant by id + org for ownership checks (no include).
 */
export async function findTenantByOrgAndId(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.tenant.findFirst({ where: { id, orgId } });
}

/**
 * Find a tenant's email by id (lightweight — no include).
 */
export async function findTenantEmail(prisma: PrismaClient, id: string) {
  return prisma.tenant.findUnique({ where: { id }, select: { email: true } });
}

/**
 * Update a tenant record by id.
 */
export async function updateTenantRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.TenantUncheckedUpdateInput,
) {
  return prisma.tenant.update({ where: { id }, data });
}

/**
 * List tenants with count, optionally including inactive.
 */
export async function listTenantsWithCount(
  prisma: PrismaClient,
  orgId: string,
  includeInactive?: boolean,
) {
  const where: Prisma.TenantWhereInput = {
    orgId,
    ...(includeInactive ? {} : { isActive: true }),
  };
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: TENANT_WITH_OCCUPANCIES_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.count({ where }),
  ]);
  return { tenants, total };
}

/**
 * Count active occupancies for a tenant.
 * Used to guard against deactivating tenants with active occupancies.
 */
export async function countTenantOccupancies(
  prisma: PrismaClient,
  tenantId: string,
) {
  return prisma.occupancy.count({ where: { tenantId } });
}

// ─── Occupancy Functions ───────────────────────────────────────

/**
 * Create an occupancy linking a tenant to a unit.
 */
export async function createOccupancyRecord(
  prisma: PrismaClient,
  tenantId: string,
  unitId: string,
) {
  return prisma.occupancy.create({ data: { tenantId, unitId } });
}

/**
 * Upsert an occupancy (create if not exists, no-op if exists).
 */
export async function upsertOccupancy(
  prisma: PrismaClient,
  tenantId: string,
  unitId: string,
) {
  return prisma.occupancy.upsert({
    where: { tenantId_unitId: { tenantId, unitId } },
    update: {},
    create: { tenantId, unitId },
  });
}

/**
 * List occupancies for a unit with tenant data.
 */
export async function findOccupanciesByUnit(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.occupancy.findMany({
    where: { unitId },
    include: { tenant: true },
    orderBy: { tenantId: "asc" },
  });
}

/**
 * List occupancies for a tenant with unit data.
 */
export async function findOccupanciesByTenant(
  prisma: PrismaClient,
  tenantId: string,
) {
  return prisma.occupancy.findMany({
    where: { tenantId },
    include: { unit: true },
    orderBy: { unitId: "asc" },
  });
}

/**
 * Remove all occupancies linking a tenant to a specific unit.
 */
export async function deleteOccupancies(
  prisma: PrismaClient,
  tenantId: string,
  unitId: string,
) {
  return prisma.occupancy.deleteMany({ where: { tenantId, unitId } });
}

// ─── Dev-only helpers ──────────────────────────────────────────

/**
 * List tenants with active occupancies for dev impersonation.
 * Returns limited fields + one occupancy sample. Limited to 50.
 */
export async function listTenantsForDevImpersonation(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.tenant.findMany({
    where: {
      occupancies: {
        some: { unit: { building: { orgId } } },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      occupancies: {
        select: {
          unit: {
            select: {
              unitNumber: true,
              floor: true,
              building: { select: { name: true } },
            },
          },
        },
        take: 1,
      },
    },
    take: 50,
  });
}

/**
 * Find a single tenant by ID for dev login JWT generation.
 * Returns full occupancy + asset data needed for the tenant JWT payload.
 */
export async function findTenantForDevLogin(
  prisma: PrismaClient,
  tenantId: string,
  orgId: string,
) {
  return prisma.tenant.findFirst({
    where: {
      id: tenantId,
      occupancies: { some: { unit: { building: { orgId } } } },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      occupancies: {
        select: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              floor: true,
              building: { select: { id: true, name: true, address: true } },
              assets: {
                select: { id: true, name: true, topic: true, type: true, serialNumber: true },
              },
            },
          },
        },
        take: 1,
      },
    },
  });
}
